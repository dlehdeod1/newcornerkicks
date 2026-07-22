import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../index'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth'
import { rateLimit } from '../middleware/rateLimit'
import { getFutsalDNA } from '../utils/futsalDna'
import { isClubPro, proLockedResponse } from '../utils/planUtils'
import { computeStreaks } from '../utils/streaks'

const PRESET_TAGS = [
  '골결정력', '스피드스터', '프리킥장인', '양발',
  '플레이메이커', '연계왕', '다재다능',
  '수비벽', '탱커', '인터셉터',
  '체력괴물', '캡틴', '분위기메이커',
]

const playersRoutes = new Hono<{ Bindings: Env }>()

// 선수 목록 조회
playersRoutes.get('/', optionalAuthMiddleware, async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId
  const includeGuests = c.req.query('all') === '1'

  if (!clubId) return c.json({ players: [] })

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
    WHERE p.club_id = ? ${includeGuests ? '' : 'AND p.is_guest = 0'}
    ORDER BY p.is_guest ASC, p.name ASC
  `).bind(clubId).all()

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
    futsal_dna: getFutsalDNA(player),
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

  // 태그 투표 집계 (상위 3개)
  const tags = await c.env.DB.prepare(`
    SELECT tag, COUNT(*) as votes
    FROM player_tag_votes
    WHERE player_id = ?
    GROUP BY tag
    ORDER BY votes DESC
    LIMIT 3
  `).bind(id).all()

  // 풋살 DNA
  const futsalDna = getFutsalDNA(player as any)

  return c.json({
    player,
    stats,
    recentMatches: recentMatches.results,
    badges: badges.results,
    ratings: ratings.results,
    tags: tags.results,
    futsalDna,
  })
})

// 선수 생성 (관리자)
playersRoutes.post('/', authMiddleware('ADMIN'), async (c) => {
  try {
    const body = await c.req.json()

    const schema = z.object({
      name: z.string().min(2),
      nickname: z.string().optional(),
    })

    const data = schema.parse(body)
    const now = Math.floor(Date.now() / 1000)
    const playerCode = generatePlayerCode()

    const clubId = (c as any).clubId
    if (!clubId) return c.json({ error: '클럽에 소속되어 있지 않습니다.' }, 403)

    const result = await c.env.DB.prepare(`
      INSERT INTO players (name, nickname, player_code, club_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(data.name, data.nickname || null, playerCode, clubId, now, now).run()

    return c.json({
      id: result.meta.last_row_id,
      playerCode,
      message: '선수가 등록되었습니다.',
    }, 201)
  } catch (e: any) {
    if (e instanceof z.ZodError) return c.json({ error: '입력값이 올바르지 않습니다.', details: e.errors }, 400)
    throw e
  }
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
// 주의: club_members INNER JOIN이라 클럽 미소속 유저는 나오지 않음.
//       미소속 유저를 찾으려면 아래 /admin/lookup-user (이메일 정확 일치) 사용
playersRoutes.get('/admin/search-users', authMiddleware('ADMIN'), async (c) => {
  const q = c.req.query('q') || ''
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ error: '클럽 정보가 없습니다.' }, 403)

  const baseQuery = `
    SELECT u.id, u.email, u.username, u.role, u.created_at,
           p.id as player_id, p.name as player_name,
           CASE WHEN p.id IS NULL THEN 0 ELSE 1 END as is_linked
    FROM users u
    JOIN club_members cm ON cm.user_id = u.id AND cm.club_id = ?
    LEFT JOIN players p ON p.user_id = u.id AND p.club_id = ?
    ${q.length > 0 ? 'WHERE u.username LIKE ? OR u.email LIKE ?' : ''}
    ORDER BY is_linked ASC, u.username ASC
    LIMIT 200
  `

  const bindings: any[] = [clubId, clubId, ...(q.length > 0 ? [`%${q}%`, `%${q}%`] : [])]
  const users = await c.env.DB.prepare(baseQuery).bind(...bindings).all()

  return c.json({ users: users.results })
})

// 이메일로 유저 조회 (관리자) - 클럽 미소속 유저까지 포함
// 검색(부분 일치)이 아니라 이메일 "정확 일치"만 허용 — 타 클럽 유저 목록 노출 방지
playersRoutes.get('/admin/lookup-user', authMiddleware('ADMIN'), rateLimit(20, 60000), async (c) => {
  const email = (c.req.query('email') || '').trim().toLowerCase()
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ error: '클럽 정보가 없습니다.' }, 403)
  if (!email) return c.json({ error: '이메일을 입력해주세요.' }, 400)

  const user = await c.env.DB.prepare(
    'SELECT id, email, username, created_at FROM users WHERE lower(email) = ?'
  ).bind(email).first<{ id: string; email: string; username: string; created_at: number }>()

  if (!user) {
    return c.json({ error: '해당 이메일로 가입된 계정이 없습니다.' }, 404)
  }

  const membership = await c.env.DB.prepare(
    'SELECT role FROM club_members WHERE user_id = ? AND club_id = ?'
  ).bind(user.id, clubId).first<{ role: string }>()

  // 이 클럽에서 이미 선수와 연동되어 있는지
  const player = await c.env.DB.prepare(
    'SELECT id, name FROM players WHERE user_id = ? AND club_id = ?'
  ).bind(user.id, clubId).first<{ id: number; name: string }>()

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      createdAt: user.created_at,
      isMember: !!membership,
      clubRole: membership?.role ?? null,
      playerId: player?.id ?? null,
      playerName: player?.name ?? null,
    },
  })
})

// 유저를 내 클럽 멤버로 추가 (관리자)
playersRoutes.post('/admin/club-members', authMiddleware('ADMIN'), async (c) => {
  const body = await c.req.json()
  const userId = body?.userId
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ error: '클럽 정보가 없습니다.' }, 403)
  if (!userId || typeof userId !== 'string') {
    return c.json({ error: 'userId가 필요합니다.' }, 400)
  }

  const user = await c.env.DB.prepare(
    'SELECT id, username FROM users WHERE id = ?'
  ).bind(userId).first<{ id: string; username: string }>()

  if (!user) {
    return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404)
  }

  const existing = await c.env.DB.prepare(
    'SELECT id FROM club_members WHERE club_id = ? AND user_id = ?'
  ).bind(clubId, userId).first()

  if (existing) {
    return c.json({ error: '이미 해당 클럽의 멤버입니다.' }, 400)
  }

  const now = Math.floor(Date.now() / 1000)
  await c.env.DB.prepare(
    `INSERT INTO club_members (club_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)`
  ).bind(clubId, userId, now).run()

  return c.json({ message: `@${user.username}이(가) 클럽에 추가되었습니다.` })
})

// 유저 계정 삭제 (관리자)
playersRoutes.delete('/admin/users/:userId', authMiddleware('ADMIN'), async (c) => {
  const userId = c.req.param('userId')
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ error: '클럽 정보가 없습니다.' }, 403)

  const user = await c.env.DB.prepare(
    'SELECT id, email, username, role FROM users WHERE id = ?'
  ).bind(userId).first()

  if (!user) {
    return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404)
  }

  // 해당 유저가 관리자의 클럽 소속인지 확인
  const membership = await c.env.DB.prepare(
    'SELECT id FROM club_members WHERE user_id = ? AND club_id = ?'
  ).bind(userId, clubId).first()

  if (!membership) {
    return c.json({ error: '해당 클럽 소속 사용자가 아닙니다.' }, 403)
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
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ error: '클럽 정보가 없습니다.' }, 403)

  const player = await c.env.DB.prepare(
    'SELECT id, name, user_id, club_id FROM players WHERE id = ?'
  ).bind(id).first()

  if (!player) {
    return c.json({ error: '선수를 찾을 수 없습니다.' }, 404)
  }

  if ((player as any).club_id !== clubId) {
    return c.json({ error: '해당 클럽 소속 선수가 아닙니다.' }, 403)
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
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ error: '클럽 정보가 없습니다.' }, 403)

  const player = await c.env.DB.prepare(
    'SELECT * FROM players WHERE id = ? AND link_status = ?'
  ).bind(id, 'PENDING').first()

  if (!player) {
    return c.json({ error: '연동 대기 중인 선수가 아닙니다.' }, 400)
  }

  if ((player as any).club_id !== clubId) {
    return c.json({ error: '해당 클럽 소속 선수가 아닙니다.' }, 403)
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
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ error: '클럽 정보가 없습니다.' }, 403)

  const player = await c.env.DB.prepare(
    'SELECT user_id, club_id FROM players WHERE id = ?'
  ).bind(id).first()

  if (!player || !player.user_id) {
    return c.json({ error: '연동된 유저가 없습니다.' }, 400)
  }

  if ((player as any).club_id !== clubId) {
    return c.json({ error: '해당 클럽 소속 선수가 아닙니다.' }, 403)
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
  const clubId = (c as any).clubId

  if (!userId) {
    return c.json({ error: '로그인이 필요합니다.' }, 401)
  }

  // 해당 선수가 요청자의 클럽 소속인지 확인
  if (clubId) {
    const playerCheck = await c.env.DB.prepare(
      'SELECT club_id FROM players WHERE id = ?'
    ).bind(id).first()
    if (!playerCheck || (playerCheck as any).club_id !== clubId) {
      return c.json({ error: '해당 클럽 소속 선수가 아닙니다.' }, 403)
    }
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
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ error: '클럽 정보가 없습니다.' }, 403)

  // 해당 클럽 선수 ID 조회
  const players = await c.env.DB.prepare(`
    SELECT p.id, p.name FROM players p WHERE p.is_guest = 0 AND p.club_id = ?
  `).bind(clubId).all()

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

// 케미 조회 (PRO 전용)
playersRoutes.get('/:id/chemistry', authMiddleware(), async (c) => {
  const clubId = (c as any).clubId
  const playerId = Number(c.req.param('id'))
  if (!clubId) return c.json({ error: '클럽이 없습니다.' }, 400)

  const club = await c.env.DB.prepare('SELECT plan_type FROM clubs WHERE id = ?').bind(clubId).first<any>()
  if (!isClubPro(club?.plan_type)) return proLockedResponse(c)

  // Best partners (top 5 by chem_score)
  const partners = await c.env.DB.prepare(`
    SELECT cc.partner_id as playerId, p.name, cc.games_together as gamesTogether,
           cc.win_rate as winRate, cc.assist_link as assistLink, cc.chem_score as chemScore
    FROM player_chemistry_cache cc
    JOIN players p ON cc.partner_id = p.id
    WHERE cc.club_id = ? AND cc.player_id = ? AND cc.games_together >= 5
    ORDER BY cc.chem_score DESC LIMIT 5
  `).bind(clubId, playerId).all()

  // Rivals (bottom 5 by win_rate)
  const rivals = await c.env.DB.prepare(`
    SELECT cc.partner_id as playerId, p.name, cc.games_together as gamesAgainst,
           cc.win_rate as winRate
    FROM player_chemistry_cache cc
    JOIN players p ON cc.partner_id = p.id
    WHERE cc.club_id = ? AND cc.player_id = ? AND cc.games_together >= 5
    ORDER BY cc.win_rate ASC LIMIT 5
  `).bind(clubId, playerId).all()

  return c.json({ bestPartners: partners.results, rivals: rivals.results })
})

// 스트릭 조회 (PRO 전용)
playersRoutes.get('/:id/streaks', authMiddleware(), async (c) => {
  const clubId = (c as any).clubId
  const playerId = Number(c.req.param('id'))
  if (!clubId) return c.json({ error: '클럽이 없습니다.' }, 400)

  const club = await c.env.DB.prepare('SELECT plan_type FROM clubs WHERE id = ?').bind(clubId).first<any>()
  if (!isClubPro(club?.plan_type)) return proLockedResponse(c)

  const year = Number(c.req.query('year')) || new Date().getFullYear()
  const streaks = await computeStreaks(c.env.DB, playerId, clubId, year)
  return c.json(streaks)
})

// 사진 업로드
playersRoutes.post('/:id/photo', authMiddleware(), async (c) => {
  const id = c.req.param('id')
  const userId = (c as any).userId
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ error: '클럽에 소속되어 있지 않습니다.' }, 403)

  const player = await c.env.DB.prepare(
    'SELECT id, user_id, club_id FROM players WHERE id = ? AND club_id = ?'
  ).bind(id, clubId).first<any>()

  if (!player) return c.json({ error: '해당 클럽 소속 선수를 찾을 수 없습니다.' }, 404)

  // 본인 또는 admin/owner만 허용
  const member = await c.env.DB.prepare(
    'SELECT role FROM club_members WHERE user_id = ? AND club_id = ?'
  ).bind(userId, clubId).first<any>()

  const isOwnerOrAdmin = member && (member.role === 'admin' || member.role === 'owner')
  const isSelf = player.user_id === userId

  if (!isSelf && !isOwnerOrAdmin) {
    return c.json({ error: '권한이 없습니다.' }, 403)
  }

  const formData = await c.req.formData()
  const file = formData.get('photo') as File | null
  if (!file) return c.json({ error: '사진 파일이 필요합니다.' }, 400)

  if (file.size > 1024 * 1024) {
    return c.json({ error: '파일 크기는 1MB 이하여야 합니다.' }, 400)
  }

  const key = `players/${clubId}/${id}.webp`
  await c.env.PHOTOS.put(key, file.stream(), {
    httpMetadata: { contentType: 'image/webp' },
  })

  const photoUrl = `/photos/players/${clubId}/${id}.webp`
  const now = Math.floor(Date.now() / 1000)
  await c.env.DB.prepare(
    'UPDATE players SET photo_url = ?, updated_at = ? WHERE id = ?'
  ).bind(photoUrl, now, id).run()

  return c.json({ photoUrl })
})

// 사진 삭제
playersRoutes.delete('/:id/photo', authMiddleware(), async (c) => {
  const id = c.req.param('id')
  const userId = (c as any).userId
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ error: '클럽에 소속되어 있지 않습니다.' }, 403)

  const player = await c.env.DB.prepare(
    'SELECT id, user_id, club_id FROM players WHERE id = ? AND club_id = ?'
  ).bind(id, clubId).first<any>()

  if (!player) return c.json({ error: '해당 클럽 소속 선수를 찾을 수 없습니다.' }, 404)

  const member = await c.env.DB.prepare(
    'SELECT role FROM club_members WHERE user_id = ? AND club_id = ?'
  ).bind(userId, clubId).first<any>()

  const isOwnerOrAdmin = member && (member.role === 'admin' || member.role === 'owner')
  const isSelf = player.user_id === userId

  if (!isSelf && !isOwnerOrAdmin) {
    return c.json({ error: '권한이 없습니다.' }, 403)
  }

  const key = `players/${clubId}/${id}.webp`
  await c.env.PHOTOS.delete(key)

  const now = Math.floor(Date.now() / 1000)
  await c.env.DB.prepare(
    'UPDATE players SET photo_url = NULL, updated_at = ? WHERE id = ?'
  ).bind(now, id).run()

  return c.json({ ok: true })
})

// 선수 삭제 (관리자)
playersRoutes.delete('/:id', authMiddleware('ADMIN'), async (c) => {
  const id = c.req.param('id')
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ error: '클럽 정보가 없습니다.' }, 403)

  // 선수 존재 확인
  const player = await c.env.DB.prepare(
    'SELECT id, name, user_id, club_id FROM players WHERE id = ?'
  ).bind(id).first()

  if (!player) {
    return c.json({ error: '선수를 찾을 수 없습니다.' }, 404)
  }

  if ((player as any).club_id !== clubId) {
    return c.json({ error: '해당 클럽 소속 선수가 아닙니다.' }, 403)
  }

  // 연관 데이터 삭제 (cascade)
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM player_ratings WHERE player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM player_badges WHERE player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM player_match_stats WHERE player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM attendance WHERE player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM team_members WHERE player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM match_events WHERE player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM match_events WHERE assister_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM session_mvp_votes WHERE player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM session_mvp_results WHERE player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM player_settlements WHERE player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM player_preferences WHERE player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM player_preferences WHERE target_player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM player_tag_votes WHERE player_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM player_chemistry_cache WHERE player_id = ? OR partner_id = ?').bind(id, id),
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

// 태그 투표
playersRoutes.post('/:id/tags', authMiddleware(), async (c) => {
  const id = c.req.param('id')
  const userId = (c as any).userId
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ error: '클럽에 소속되어 있지 않습니다.' }, 403)

  const body = await c.req.json()
  const schema = z.object({
    tags: z.array(z.string()).min(1).max(3),
  })

  let data: z.infer<typeof schema>
  try {
    data = schema.parse(body)
  } catch (e: any) {
    return c.json({ error: '태그는 1~3개를 선택해야 합니다.', details: e.errors }, 400)
  }

  // 각 태그 유효성: 프리셋이거나 최대 10자 커스텀
  for (const tag of data.tags) {
    if (!PRESET_TAGS.includes(tag) && tag.length > 10) {
      return c.json({ error: `커스텀 태그는 최대 10자입니다: "${tag}"` }, 400)
    }
  }

  // 선수 존재 + 클럽 확인
  const player = await c.env.DB.prepare(
    'SELECT id FROM players WHERE id = ? AND club_id = ?'
  ).bind(id, clubId).first()
  if (!player) return c.json({ error: '해당 클럽 소속 선수를 찾을 수 없습니다.' }, 404)

  const now = Math.floor(Date.now() / 1000)

  // 기존 투표 삭제 후 새 투표 삽입 (배치)
  const statements = [
    c.env.DB.prepare('DELETE FROM player_tag_votes WHERE player_id = ? AND voter_user_id = ?').bind(id, userId),
    ...data.tags.map(tag =>
      c.env.DB.prepare(
        'INSERT INTO player_tag_votes (player_id, voter_user_id, tag, created_at) VALUES (?, ?, ?, ?)'
      ).bind(id, userId, tag, now)
    ),
  ]
  await c.env.DB.batch(statements)

  // 전체 투표 집계 반환
  const tags = await c.env.DB.prepare(`
    SELECT tag, COUNT(*) as votes
    FROM player_tag_votes
    WHERE player_id = ?
    GROUP BY tag
    ORDER BY votes DESC
  `).bind(id).all()

  return c.json({ tags: tags.results })
})

// 태그 삭제 (관리자 - 어뷰징 방지)
playersRoutes.delete('/:id/tags/:tag', authMiddleware('ADMIN'), async (c) => {
  const id = c.req.param('id')
  const tag = decodeURIComponent(c.req.param('tag'))
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ error: '클럽 정보가 없습니다.' }, 403)

  // 선수 클럽 확인
  const player = await c.env.DB.prepare(
    'SELECT id FROM players WHERE id = ? AND club_id = ?'
  ).bind(id, clubId).first()
  if (!player) return c.json({ error: '해당 클럽 소속 선수를 찾을 수 없습니다.' }, 404)

  await c.env.DB.prepare(
    'DELETE FROM player_tag_votes WHERE player_id = ? AND tag = ?'
  ).bind(id, tag).run()

  return c.json({ ok: true })
})

// 선수 기록 로그 조회 (세션별 이벤트)
playersRoutes.get('/:id/event-logs', optionalAuthMiddleware, async (c) => {
  const id = c.req.param('id')
  const year = Number(c.req.query('year')) || new Date().getFullYear()
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  const clubId = (c as any).clubId

  // 선수가 요청자의 클럽 소속인지 확인 (clubId 있을 때만)
  if (clubId) {
    const playerCheck = await c.env.DB.prepare(
      'SELECT club_id FROM players WHERE id = ?'
    ).bind(id).first()
    if (!playerCheck || (playerCheck as any).club_id !== clubId) {
      return c.json({ error: '해당 클럽 소속 선수가 아닙니다.' }, 403)
    }
  }

  const clubFilter = clubId ? 'AND s.club_id = ?' : ''

  // 골/어시스트 이벤트
  const goalEvents = await c.env.DB.prepare(`
    SELECT me.id, me.event_type, me.event_time, m.match_no,
           s.session_date, s.id as session_id, s.title,
           t1.name as team1_name, t2.name as team2_name,
           m.team1_score, m.team2_score,
           pa.name as assister_name
    FROM match_events me
    JOIN matches m ON me.match_id = m.id
    JOIN sessions s ON m.session_id = s.id
    JOIN teams t1 ON m.team1_id = t1.id
    JOIN teams t2 ON m.team2_id = t2.id
    LEFT JOIN players pa ON me.assister_id = pa.id
    WHERE me.player_id = ? AND me.event_type = 'GOAL'
      AND s.session_date BETWEEN ? AND ?
      ${clubFilter}
    ORDER BY s.session_date DESC, m.match_no ASC
  `).bind(...[id, yearStart, yearEnd, ...(clubId ? [clubId] : [])]).all()

  // 어시스트 (내가 어시스트한 경우)
  const assistEvents = await c.env.DB.prepare(`
    SELECT me.id, 'ASSIST' as event_type, me.event_time, m.match_no,
           s.session_date, s.id as session_id, s.title,
           t1.name as team1_name, t2.name as team2_name,
           m.team1_score, m.team2_score,
           ps.name as scorer_name
    FROM match_events me
    JOIN matches m ON me.match_id = m.id
    JOIN sessions s ON m.session_id = s.id
    JOIN teams t1 ON m.team1_id = t1.id
    JOIN teams t2 ON m.team2_id = t2.id
    JOIN players ps ON me.player_id = ps.id
    WHERE me.assister_id = ? AND me.event_type = 'GOAL'
      AND s.session_date BETWEEN ? AND ?
      ${clubFilter}
    ORDER BY s.session_date DESC, m.match_no ASC
  `).bind(...[id, yearStart, yearEnd, ...(clubId ? [clubId] : [])]).all()

  // 수비 이벤트
  const defenseEvents = await c.env.DB.prepare(`
    SELECT me.id, me.event_type, me.event_time, m.match_no,
           s.session_date, s.id as session_id, s.title,
           t1.name as team1_name, t2.name as team2_name,
           m.team1_score, m.team2_score
    FROM match_events me
    JOIN matches m ON me.match_id = m.id
    JOIN sessions s ON m.session_id = s.id
    JOIN teams t1 ON m.team1_id = t1.id
    JOIN teams t2 ON m.team2_id = t2.id
    WHERE me.player_id = ? AND me.event_type = 'DEFENSE'
      AND s.session_date BETWEEN ? AND ?
      ${clubFilter}
    ORDER BY s.session_date DESC, m.match_no ASC
  `).bind(...[id, yearStart, yearEnd, ...(clubId ? [clubId] : [])]).all()

  // MVP 기록
  const mvpRecords = await c.env.DB.prepare(`
    SELECT smr.session_id, s.session_date, s.title, smr.decided_at
    FROM session_mvp_results smr
    JOIN sessions s ON smr.session_id = s.id
    WHERE smr.player_id = ?
      AND s.session_date BETWEEN ? AND ?
      ${clubFilter}
    ORDER BY s.session_date DESC
  `).bind(...[id, yearStart, yearEnd, ...(clubId ? [clubId] : [])]).all()

  // 1등/2등/3등 기록
  const placementRecords = await c.env.DB.prepare(`
    WITH team_standings AS (
      SELECT
        t.session_id,
        t.id as team_id,
        t.name as team_name,
        SUM(CASE
          WHEN (t.id = m.team1_id AND m.team1_score > m.team2_score) OR
               (t.id = m.team2_id AND m.team2_score > m.team1_score)
          THEN 3
          WHEN m.team1_score = m.team2_score THEN 1
          ELSE 0
        END) as points
      FROM teams t
      JOIN matches m ON t.id = m.team1_id OR t.id = m.team2_id
      JOIN sessions s ON t.session_id = s.id
      WHERE s.session_date BETWEEN ? AND ? AND m.status = 'completed'
        ${clubId ? 'AND s.club_id = ?' : ''}
      GROUP BY t.session_id, t.id
    ),
    ranked AS (
      SELECT *, RANK() OVER (PARTITION BY session_id ORDER BY points DESC) as team_rank
      FROM team_standings
    )
    SELECT r.session_id, r.team_rank, r.team_name, r.points, s.session_date, s.title
    FROM ranked r
    JOIN team_members tm ON r.team_id = tm.team_id
    JOIN sessions s ON r.session_id = s.id
    WHERE tm.player_id = ?
    ORDER BY s.session_date DESC
  `).bind(...[yearStart, yearEnd, ...(clubId ? [clubId] : []), id]).all()

  return c.json({
    goals: goalEvents.results,
    assists: assistEvents.results,
    defenses: defenseEvents.results,
    mvpRecords: mvpRecords.results,
    placements: placementRecords.results,
  })
})

// ── 선호 선수 ──────────────────────────────────

// 내 선호 선수 목록 조회
playersRoutes.get('/preferences/mine', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ error: '클럽에 소속되어 있지 않습니다.' }, 403)

  const player = await c.env.DB.prepare(
    'SELECT id FROM players WHERE user_id = ? AND club_id = ?'
  ).bind(userId, clubId).first()
  if (!player) return c.json({ preferences: [] })

  const prefs = await c.env.DB.prepare(`
    SELECT pp.target_player_id, p.name, p.nickname, p.photo_url
    FROM player_preferences pp
    JOIN players p ON pp.target_player_id = p.id
    WHERE pp.player_id = ?
    ORDER BY pp.created_at ASC
  `).bind(player.id).all()

  return c.json({ preferences: prefs.results })
})

// 선호 선수 등록 (최대 3명)
playersRoutes.post('/preferences/:targetId', authMiddleware(), async (c) => {
  const targetId = Number(c.req.param('targetId'))
  const userId = (c as any).userId
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ error: '클럽에 소속되어 있지 않습니다.' }, 403)

  const player = await c.env.DB.prepare(
    'SELECT id FROM players WHERE user_id = ? AND club_id = ?'
  ).bind(userId, clubId).first()
  if (!player) return c.json({ error: '선수 연동이 필요합니다.' }, 400)

  const playerId = player.id as number
  if (playerId === targetId) return c.json({ error: '자기 자신은 선택할 수 없습니다.' }, 400)

  // 대상 선수가 같은 클럽인지 확인
  const target = await c.env.DB.prepare(
    'SELECT id FROM players WHERE id = ? AND club_id = ? AND is_guest = 0'
  ).bind(targetId, clubId).first()
  if (!target) return c.json({ error: '유효하지 않은 선수입니다.' }, 404)

  // 현재 등록 수 확인
  const count = await c.env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM player_preferences WHERE player_id = ?'
  ).bind(playerId).first()
  if ((count?.cnt as number) >= 3) return c.json({ error: '최대 3명까지 선택 가능합니다.' }, 400)

  // 중복 확인
  const exists = await c.env.DB.prepare(
    'SELECT id FROM player_preferences WHERE player_id = ? AND target_player_id = ?'
  ).bind(playerId, targetId).first()
  if (exists) return c.json({ error: '이미 선호 선수로 등록되어 있습니다.' }, 409)

  await c.env.DB.prepare(
    'INSERT INTO player_preferences (player_id, target_player_id, created_at) VALUES (?, ?, ?)'
  ).bind(playerId, targetId, Date.now()).run()

  return c.json({ message: '선호 선수로 등록되었습니다.' })
})

// 선호 선수 해제
playersRoutes.delete('/preferences/:targetId', authMiddleware(), async (c) => {
  const targetId = Number(c.req.param('targetId'))
  const userId = (c as any).userId
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ error: '클럽에 소속되어 있지 않습니다.' }, 403)

  const player = await c.env.DB.prepare(
    'SELECT id FROM players WHERE user_id = ? AND club_id = ?'
  ).bind(userId, clubId).first()
  if (!player) return c.json({ error: '선수 연동이 필요합니다.' }, 400)

  await c.env.DB.prepare(
    'DELETE FROM player_preferences WHERE player_id = ? AND target_player_id = ?'
  ).bind(player.id, targetId).run()

  return c.json({ message: '선호 선수에서 해제되었습니다.' })
})

export { playersRoutes }
