import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../index'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth'

const playersRoutes = new Hono<{ Bindings: Env }>()

// 선수 목록 조회
playersRoutes.get('/', optionalAuthMiddleware, async (c) => {
  const userId = (c as any).userId
  const includeGuests = c.req.query('all') === '1'

  const players = await c.env.DB.prepare(`
    SELECT p.*,
           u.email as user_email,
           (SELECT COUNT(*) FROM attendance WHERE player_id = p.id) as total_attendance,
           (SELECT SUM(goals) FROM player_match_stats WHERE player_id = p.id) as total_goals,
           (SELECT SUM(assists) FROM player_match_stats WHERE player_id = p.id) as total_assists,
           (SELECT SUM(blocks) FROM player_match_stats WHERE player_id = p.id) as total_blocks,
           (SELECT COUNT(*) FROM player_ratings WHERE player_id = p.id) as rating_count
    FROM players p
    LEFT JOIN users u ON p.user_id = u.id
    ${includeGuests ? '' : 'WHERE p.is_guest = 0'}
    ORDER BY p.is_guest ASC, p.name ASC
  `).all()

  // 로그인된 사용자가 있으면 각 선수에 대한 평가 여부 및 내 평가 점수 확인
  let myRatingsMap: Map<number, any> = new Map()
  if (userId) {
    const ratingResults = await c.env.DB.prepare(`
      SELECT player_id, shooting, offball_run, ball_keeping, passing, linkup,
             intercept, marking, stamina, speed, physical, overall, comment
      FROM player_ratings WHERE rater_user_id = ?
    `).bind(userId).all()
    ratingResults.results.forEach((r: any) => {
      myRatingsMap.set(r.player_id, {
        shooting: r.shooting,
        offball_run: r.offball_run,
        ball_keeping: r.ball_keeping,
        passing: r.passing,
        linkup: r.linkup,
        intercept: r.intercept,
        marking: r.marking,
        stamina: r.stamina,
        speed: r.speed,
        physical: r.physical,
        overall: r.overall,
        comment: r.comment,
      })
    })
  }

  const playersWithRatingStatus = players.results.map((player: any) => ({
    ...player,
    has_my_rating: myRatingsMap.has(player.id),
    my_rating: myRatingsMap.get(player.id) || null,
  }))

  return c.json({ players: playersWithRatingStatus })
})

// 선수 상세 조회
playersRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')

  const player = await c.env.DB.prepare(`
    SELECT p.*,
           (SELECT COUNT(*) FROM attendance WHERE player_id = p.id) as total_attendance
    FROM players p
    WHERE p.id = ?
  `).bind(id).first()

  if (!player) {
    return c.json({ error: '선수를 찾을 수 없습니다.' }, 404)
  }

  // 통산 기록
  const stats = await c.env.DB.prepare(`
    SELECT
      COUNT(DISTINCT pms.match_id) as total_matches,
      SUM(pms.goals) as total_goals,
      SUM(pms.assists) as total_assists,
      SUM(pms.blocks) as total_blocks
    FROM player_match_stats pms
    WHERE pms.player_id = ?
  `).bind(id).first()

  // 최근 경기 기록
  const recentMatches = await c.env.DB.prepare(`
    SELECT pms.*, m.match_no, m.team1_score, m.team2_score, s.session_date,
           t1.name as team1_name, t2.name as team2_name
    FROM player_match_stats pms
    JOIN matches m ON pms.match_id = m.id
    JOIN sessions s ON m.session_id = s.id
    JOIN teams t1 ON m.team1_id = t1.id
    JOIN teams t2 ON m.team2_id = t2.id
    WHERE pms.player_id = ?
    ORDER BY s.session_date DESC, m.match_no DESC
    LIMIT 10
  `).bind(id).all()

  // 배지
  const badges = await c.env.DB.prepare(`
    SELECT b.*, pb.earned_at
    FROM player_badges pb
    JOIN badges b ON pb.badge_code = b.code
    WHERE pb.player_id = ?
  `).bind(id).all()

  // 능력치 평가 목록
  const ratings = await c.env.DB.prepare(`
    SELECT pr.*
    FROM player_ratings pr
    WHERE pr.player_id = ?
    ORDER BY pr.updated_at DESC
  `).bind(id).all()

  return c.json({
    player,
    stats,
    recentMatches: recentMatches.results,
    badges: badges.results,
    ratings: ratings.results,
  })
})

// 선수 생성 (관리자)
playersRoutes.post('/', authMiddleware('ADMIN'), async (c) => {
  const body = await c.req.json()

  const schema = z.object({
    name: z.string().min(2),
    nickname: z.string().optional(),
  })

  const data = schema.parse(body)
  const now = Math.floor(Date.now() / 1000)
  const playerCode = generatePlayerCode()

  const result = await c.env.DB.prepare(`
    INSERT INTO players (name, nickname, player_code, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(data.name, data.nickname || null, playerCode, now, now).run()

  return c.json({
    id: result.meta.last_row_id,
    playerCode,
    message: '선수가 등록되었습니다.',
  }, 201)
})

// 선수 수정 (관리자)
playersRoutes.put('/:id', authMiddleware('ADMIN'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const now = Math.floor(Date.now() / 1000)

  // 허용된 필드만 업데이트
  const allowedFields = [
    'name', 'nickname', 'birth_year', 'height_cm', 'weight_kg', 'photo_url',
    'shooting', 'offball_run', 'ball_keeping', 'passing', 'linkup',
    'intercept', 'marking', 'stamina', 'speed', 'physical', 'notes', 'is_guest'
  ]

  const updates: string[] = []
  const values: any[] = []

  for (const field of allowedFields) {
    const camelField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    if (body[camelField] !== undefined) {
      updates.push(`${field} = ?`)
      values.push(body[camelField])
    }
  }

  if (updates.length === 0) {
    return c.json({ error: '수정할 내용이 없습니다.' }, 400)
  }

  updates.push('updated_at = ?')
  values.push(now)
  values.push(id)

  await c.env.DB.prepare(`
    UPDATE players SET ${updates.join(', ')} WHERE id = ?
  `).bind(...values).run()

  return c.json({ message: '선수 정보가 수정되었습니다.' })
})

// 유저 목록/검색 (관리자) - 연동 변경용
// q 없으면 전체 목록(미연동 우선), q 있으면 필터링
playersRoutes.get('/admin/search-users', authMiddleware('ADMIN'), async (c) => {
  const q = c.req.query('q') || ''

  const users = await c.env.DB.prepare(`
    SELECT u.id, u.email, u.username, u.role, u.created_at,
           p.id as player_id, p.name as player_name,
           CASE WHEN p.id IS NULL THEN 0 ELSE 1 END as is_linked
    FROM users u
    LEFT JOIN players p ON p.user_id = u.id
    ${q.length > 0 ? 'WHERE u.username LIKE ? OR u.email LIKE ?' : ''}
    ORDER BY is_linked ASC, u.username ASC
    LIMIT 200
  `).bind(...(q.length > 0 ? [`%${q}%`, `%${q}%`] : [])).all()

  return c.json({ users: users.results })
})

// 유저 계정 삭제 (관리자)
playersRoutes.delete('/admin/users/:userId', authMiddleware('ADMIN'), async (c) => {
  const userId = c.req.param('userId')

  const user = await c.env.DB.prepare(
    'SELECT id, email, username, role FROM users WHERE id = ?'
  ).bind(userId).first()

  if (!user) {
    return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404)
  }

  if ((user as any).role === 'ADMIN') {
    return c.json({ error: '관리자 계정은 삭제할 수 없습니다.' }, 400)
  }

  const now = Math.floor(Date.now() / 1000)

  // 연동된 선수 해제
  await c.env.DB.prepare(
    `UPDATE players SET user_id = NULL, link_status = 'UNLINKED', updated_at = ? WHERE user_id = ?`
  ).bind(now, userId).run()

  // FK 제약 있는 테이블부터 삭제 (foreign_keys = ON 이므로 순서 중요)
  await c.env.DB.prepare('DELETE FROM profiles WHERE user_id = ?').bind(userId).run()
  await c.env.DB.prepare('DELETE FROM abilities WHERE user_id = ?').bind(userId).run()
  await c.env.DB.prepare('DELETE FROM ability_logs WHERE user_id = ?').bind(userId).run()
  await c.env.DB.prepare('DELETE FROM session_mvp_votes WHERE voter_user_id = ?').bind(userId).run()

  // 이 유저의 능력치 평가 삭제
  await c.env.DB.prepare('DELETE FROM player_ratings WHERE rater_user_id = ?').bind(userId).run()

  // 알림 삭제
  await c.env.DB.prepare('DELETE FROM notifications WHERE user_id = ?').bind(userId).run()

  // 유저 삭제
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run()

  return c.json({ message: `계정 @${(user as any).username}이(가) 삭제되었습니다.` })
})

// 선수-유저 연동 변경 (관리자)
playersRoutes.post('/:id/relink', authMiddleware('ADMIN'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { userId } = body // null이면 연동 해제
  const now = Math.floor(Date.now() / 1000)

  const player = await c.env.DB.prepare(
    'SELECT id, name, user_id FROM players WHERE id = ?'
  ).bind(id).first()

  if (!player) {
    return c.json({ error: '선수를 찾을 수 없습니다.' }, 404)
  }

  if (userId) {
    // 해당 유저가 이미 다른 선수에 연동되어 있는지 확인
    const conflict = await c.env.DB.prepare(
      'SELECT id, name FROM players WHERE user_id = ? AND id != ?'
    ).bind(userId, id).first()

    if (conflict) {
      return c.json({ error: `이 계정은 이미 "${(conflict as any).name}" 선수에 연동되어 있습니다.` }, 400)
    }

    await c.env.DB.prepare(
      `UPDATE players SET user_id = ?, link_status = 'ACTIVE', updated_at = ? WHERE id = ?`
    ).bind(userId, now, id).run()

    return c.json({ message: '연동이 변경되었습니다.' })
  } else {
    // 연동 해제
    await c.env.DB.prepare(
      `UPDATE players SET user_id = NULL, link_status = 'UNLINKED', updated_at = ? WHERE id = ?`
    ).bind(now, id).run()

    return c.json({ message: '연동이 해제되었습니다.' })
  }
})

// 선수-유저 연동 승인 (관리자)
playersRoutes.post('/:id/approve-link', authMiddleware('ADMIN'), async (c) => {
  const id = c.req.param('id')
  const now = Math.floor(Date.now() / 1000)

  const player = await c.env.DB.prepare(
    'SELECT * FROM players WHERE id = ? AND link_status = ?'
  ).bind(id, 'PENDING').first()

  if (!player) {
    return c.json({ error: '연동 대기 중인 선수가 아닙니다.' }, 400)
  }

  await c.env.DB.prepare(`
    UPDATE players SET link_status = 'ACTIVE', updated_at = ? WHERE id = ?
  `).bind(now, id).run()

  return c.json({ message: '선수 연동이 승인되었습니다.' })
})

// 비밀번호 초기화 (관리자)
playersRoutes.post('/:id/reset-password', authMiddleware('ADMIN'), async (c) => {
  const id = c.req.param('id')
  const now = Math.floor(Date.now() / 1000)

  const player = await c.env.DB.prepare(
    'SELECT user_id FROM players WHERE id = ?'
  ).bind(id).first()

  if (!player || !player.user_id) {
    return c.json({ error: '연동된 유저가 없습니다.' }, 400)
  }

  // 임시 비밀번호 생성
  const tempPassword = generateTempPassword()

  await c.env.DB.prepare(`
    UPDATE users SET password = ?, updated_at = ? WHERE id = ?
  `).bind(tempPassword, now, player.user_id).run()

  return c.json({
    message: '비밀번호가 초기화되었습니다.',
    tempPassword, // 실제 운영에서는 이메일/SMS로 전송
  })
})

// 능력치 평가 제출
playersRoutes.post('/:id/ratings', optionalAuthMiddleware, async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const userId = (c as any).userId

  if (!userId) {
    return c.json({ error: '로그인이 필요합니다.' }, 401)
  }

  const schema = z.object({
    shooting: z.number().min(0).max(100),
    offballRun: z.number().min(0).max(100),
    ballKeeping: z.number().min(0).max(100),
    passing: z.number().min(0).max(100),
    linkup: z.number().min(0).max(100),
    intercept: z.number().min(0).max(100),
    marking: z.number().min(0).max(100),
    stamina: z.number().min(0).max(100),
    speed: z.number().min(0).max(100),
    physical: z.number().min(0).max(100),
    comment: z.string().optional(),
  })

  const data = schema.parse(body)

  // 모든 능력치가 0이면 저장하지 않음
  const allZero = data.shooting === 0 && data.offballRun === 0 && data.ballKeeping === 0 &&
                  data.passing === 0 && data.linkup === 0 && data.intercept === 0 &&
                  data.marking === 0 && data.stamina === 0 && data.speed === 0 && data.physical === 0
  if (allZero) {
    return c.json({ error: '모든 능력치가 0일 수 없습니다. 최소 1점 이상 평가해주세요.' }, 400)
  }
  const now = Math.floor(Date.now() / 1000)

  // 기존 평가 확인
  const existing = await c.env.DB.prepare(`
    SELECT id FROM player_ratings WHERE player_id = ? AND rater_user_id = ?
  `).bind(id, userId).first()

  // overall도 0~100 기준으로 평균 계산
  const overall = Math.round(
    (data.shooting + data.offballRun + data.ballKeeping + data.passing + data.linkup +
     data.intercept + data.marking + data.stamina + data.speed + data.physical) / 10
  ) // 10개 항목 평균이므로 0~100 범위 유지

  if (existing) {
    // 업데이트
    await c.env.DB.prepare(`
      UPDATE player_ratings SET
        shooting = ?, offball_run = ?, ball_keeping = ?, passing = ?, linkup = ?,
        intercept = ?, marking = ?, stamina = ?, speed = ?, physical = ?,
        overall = ?, comment = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      data.shooting, data.offballRun, data.ballKeeping, data.passing, data.linkup,
      data.intercept, data.marking, data.stamina, data.speed, data.physical,
      overall, data.comment || null, now, existing.id
    ).run()
  } else {
    // 새로 생성
    await c.env.DB.prepare(`
      INSERT INTO player_ratings (
        player_id, rater_user_id, shooting, offball_run, ball_keeping, passing, linkup,
        intercept, marking, stamina, speed, physical, overall, comment, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, userId, data.shooting, data.offballRun, data.ballKeeping, data.passing, data.linkup,
      data.intercept, data.marking, data.stamina, data.speed, data.physical,
      overall, data.comment || null, now, now
    ).run()
  }

  // 평균 능력치 재계산 및 적용
  await updatePlayerStats(c.env.DB, Number(id))

  return c.json({ message: '평가가 저장되었습니다.' })
})

// 평균 능력치 계산 및 적용
async function updatePlayerStats(db: D1Database, playerId: number) {
  // 평가자별 가중치 조회
  const ratings = await db.prepare(`
    SELECT pr.*, u.role
    FROM player_ratings pr
    JOIN users u ON pr.rater_user_id = u.id
    WHERE pr.player_id = ?
  `).bind(playerId).all()

  if (ratings.results.length === 0) return

  const stats = ['shooting', 'offball_run', 'ball_keeping', 'passing', 'linkup',
                 'intercept', 'marking', 'stamina', 'speed', 'physical']

  // 0점 평가 필터링 (모든 스탯이 0이거나 null인 경우 제외)
  const validRatings = (ratings.results as any[]).filter(rating => {
    const hasValidStat = stats.some(stat => rating[stat] != null && rating[stat] > 0)
    return hasValidStat
  })

  if (validRatings.length === 0) return

  const avgStats: Record<string, number> = {}

  // 관리자 수와 일반 유저 수 계산 (유효한 평가만)
  const adminCount = validRatings.filter(r => r.role === 'ADMIN').length
  const userCount = validRatings.length - adminCount

  for (const stat of stats) {
    let totalWeight = 0
    let weightedSum = 0

    for (const rating of validRatings) {
      // 해당 스탯이 0이거나 null이면 이 평가에서 해당 스탯 무시
      if (rating[stat] == null || rating[stat] === 0) continue

      // 관리자가 있으면 관리자 30%, 일반 유저 70% 균등 분배
      // 관리자만 있으면 균등 분배
      // 일반 유저만 있으면 균등 분배
      let weight: number
      if (adminCount > 0 && userCount > 0) {
        weight = rating.role === 'ADMIN' ? (0.3 / adminCount) : (0.7 / userCount)
      } else {
        weight = 1 / validRatings.length
      }
      weightedSum += rating[stat] * weight
      totalWeight += weight
    }

    // 해당 스탯에 유효한 평가가 없으면 기본값 50
    avgStats[stat] = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50
  }

  const now = Math.floor(Date.now() / 1000)

  await db.prepare(`
    UPDATE players SET
      shooting = ?, offball_run = ?, ball_keeping = ?, passing = ?, linkup = ?,
      intercept = ?, marking = ?, stamina = ?, speed = ?, physical = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    avgStats.shooting, avgStats.offball_run, avgStats.ball_keeping, avgStats.passing, avgStats.linkup,
    avgStats.intercept, avgStats.marking, avgStats.stamina, avgStats.speed, avgStats.physical,
    now, playerId
  ).run()
}

// 전체 선수 능력치 재계산 (관리자)
playersRoutes.post('/recalculate-all', authMiddleware('ADMIN'), async (c) => {
  // 모든 선수 ID 조회
  const players = await c.env.DB.prepare(`
    SELECT id, name FROM players WHERE is_guest = 0
  `).all()

  const results: { id: number; name: string; status: string }[] = []

  for (const player of players.results as any[]) {
    try {
      await updatePlayerStats(c.env.DB, player.id)
      results.push({ id: player.id, name: player.name, status: 'success' })
    } catch (error) {
      results.push({ id: player.id, name: player.name, status: 'failed' })
    }
  }

  return c.json({
    message: `${results.filter(r => r.status === 'success').length}/${results.length}명의 능력치가 재계산되었습니다.`,
    results,
  })
})

// 선수 삭제 (관리자)
playersRoutes.delete('/:id', authMiddleware('ADMIN'), async (c) => {
  const id = c.req.param('id')

  // 선수 존재 확인
  const player = await c.env.DB.prepare(
    'SELECT id, name, user_id FROM players WHERE id = ?'
  ).bind(id).first()

  if (!player) {
    return c.json({ error: '선수를 찾을 수 없습니다.' }, 404)
  }

  // 연관 데이터 삭제 (cascade)
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM player_ratings WHERE player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM player_badges WHERE player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM player_match_stats WHERE player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM attendance WHERE player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM team_members WHERE player_id = ?').bind(id),       // team_players → team_members
    c.env.DB.prepare('DELETE FROM match_events WHERE player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM match_events WHERE assister_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM session_mvp WHERE player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM player_settlements WHERE player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM player_preferences WHERE player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM player_preferences WHERE target_player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM stat_changes WHERE player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM chemistry_edges WHERE player_a_id = ? OR player_b_id = ?').bind(id, id),
    c.env.DB.prepare('DELETE FROM players WHERE id = ?').bind(id),
  ])

  return c.json({ message: `선수 "${player.name}"이(가) 삭제되었습니다.` })
})

// 헬퍼 함수
function generatePlayerCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function generateTempPassword(): string {
  return Math.random().toString(36).substring(2, 10)
}

export { playersRoutes }
