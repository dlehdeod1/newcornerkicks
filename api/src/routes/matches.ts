import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../index'
import { optionalAuthMiddleware, authMiddleware } from '../middleware/auth'
import { autoSettleSession } from './sessions'

const matchesRoutes = new Hono<{ Bindings: Env }>()

// 경기 생성
matchesRoutes.post('/', authMiddleware(), async (c) => {
  try {
    const body = await c.req.json()
    const clubId = (c as any).clubId

    const schema = z.object({
      sessionId: z.number(),
      team1Id: z.number(),
      team2Id: z.number(),
      matchNo: z.number().optional(),
    })

    const data = schema.parse(body)

    // 세션이 요청자의 클럽 소속인지 확인
    const session = await c.env.DB.prepare(
      'SELECT club_id FROM sessions WHERE id = ?'
    ).bind(data.sessionId).first()
    if (!session || (session as any).club_id !== clubId) {
      return c.json({ error: '해당 클럽 소속 세션이 아닙니다.' }, 403)
    }

    // matchNo가 없으면 자동 계산
    let matchNo = data.matchNo
    if (!matchNo) {
      const lastMatch = await c.env.DB.prepare(`
        SELECT MAX(match_no) as max_no FROM matches WHERE session_id = ?
      `).bind(data.sessionId).first()
      matchNo = ((lastMatch?.max_no as number) || 0) + 1
    }

    // created_at 컬럼이 없을 수 있어서 제외
    const result = await c.env.DB.prepare(`
      INSERT INTO matches (session_id, team1_id, team2_id, match_no, team1_score, team2_score, status)
      VALUES (?, ?, ?, ?, 0, 0, 'pending')
    `).bind(data.sessionId, data.team1Id, data.team2Id, matchNo).run()

    return c.json({
      id: result.meta.last_row_id,
      matchNo,
      message: '경기가 생성되었습니다.',
    }, 201)
  } catch (err: any) {
    console.error('Match create error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// 3팀 순환 경기 일괄 생성 (AB, BC, CA)
matchesRoutes.post('/round-robin', authMiddleware(), async (c) => {
  try {
    const body = await c.req.json()
    const clubId = (c as any).clubId

    const schema = z.object({
      sessionId: z.number(),
      teamIds: z.array(z.number()).min(2).max(4),
      rounds: z.number().min(1).max(5).optional(),
    })

    const parsed = schema.parse(body)
    const data = { ...parsed, rounds: parsed.rounds || 1 }

    // 세션이 요청자의 클럽 소속인지 확인
    const session = await c.env.DB.prepare(
      'SELECT club_id FROM sessions WHERE id = ?'
    ).bind(data.sessionId).first()
    if (!session || (session as any).club_id !== clubId) {
      return c.json({ error: '해당 클럽 소속 세션이 아닙니다.' }, 403)
    }

    // 현재 최대 match_no 조회
    const lastMatch = await c.env.DB.prepare(`
      SELECT MAX(match_no) as max_no FROM matches WHERE session_id = ?
    `).bind(data.sessionId).first()
    let matchNo = ((lastMatch?.max_no as number) || 0)

    // 라운드 로빈 경기 조합 생성
    const matchups: Array<[number, number]> = []
    const teamCount = data.teamIds.length

    for (let round = 0; round < data.rounds; round++) {
      for (let i = 0; i < teamCount; i++) {
        for (let j = i + 1; j < teamCount; j++) {
          matchups.push([data.teamIds[i], data.teamIds[j]])
        }
      }
    }

    // 경기 생성 (created_at 제외)
    const createdMatches = []
    for (const [team1Id, team2Id] of matchups) {
      matchNo++
      const result = await c.env.DB.prepare(`
        INSERT INTO matches (session_id, team1_id, team2_id, match_no, team1_score, team2_score, status)
        VALUES (?, ?, ?, ?, 0, 0, 'pending')
      `).bind(data.sessionId, team1Id, team2Id, matchNo).run()

      createdMatches.push({
        id: result.meta.last_row_id,
        matchNo,
        team1Id,
        team2Id,
      })
    }

    return c.json({
      message: `${createdMatches.length}개의 경기가 생성되었습니다.`,
      matches: createdMatches,
    }, 201)
  } catch (err: any) {
    console.error('Round robin error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// 경기 삭제
matchesRoutes.delete('/:id', authMiddleware('ADMIN'), async (c) => {
  try {
    const id = c.req.param('id')
    const clubId = (c as any).clubId

    // 삭제 전 세션 정보 가져오기 (랭킹 캐시 무효화용 + 클럽 검증)
    const match = await c.env.DB.prepare(
      'SELECT m.session_id, s.club_id FROM matches m JOIN sessions s ON m.session_id = s.id WHERE m.id = ?'
    ).bind(id).first()

    if (!match) {
      return c.json({ error: '경기를 찾을 수 없습니다.' }, 404)
    }

    if ((match as any).club_id !== clubId) {
      return c.json({ error: '해당 클럽 소속 경기가 아닙니다.' }, 403)
    }

    // 관련 데이터 먼저 삭제
    await c.env.DB.prepare('DELETE FROM player_substitutions WHERE match_id = ?').bind(id).run()
    await c.env.DB.prepare('DELETE FROM match_events WHERE match_id = ?').bind(id).run()
    await c.env.DB.prepare('DELETE FROM player_match_stats WHERE match_id = ?').bind(id).run()

    // 경기 삭제
    await c.env.DB.prepare('DELETE FROM matches WHERE id = ?').bind(id).run()

    // 랭킹 캐시 무효화 (해당 연도)
    if (match) {
      try {
        const session = await c.env.DB.prepare(
          'SELECT session_date FROM sessions WHERE id = ?'
        ).bind(match.session_id).first()

        if (session?.session_date) {
          const year = new Date(session.session_date as string).getFullYear()
          await c.env.DB.prepare(
            'DELETE FROM rankings_cache WHERE year = ?'
          ).bind(year).run()
          console.log(`Rankings cache invalidated for year ${year}`)
        }
      } catch (cacheErr) {
        console.error('Cache invalidation error (ignored):', cacheErr)
      }
    }

    return c.json({ message: '경기가 삭제되었습니다.' })
  } catch (err: any) {
    console.error('Match delete error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// 경기 상세 조회
matchesRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')

  const match = await c.env.DB.prepare(`
    SELECT m.*,
           t1.name as team1_name, t1.vest_color as team1_color,
           t2.name as team2_name, t2.vest_color as team2_color,
           s.session_date
    FROM matches m
    JOIN teams t1 ON m.team1_id = t1.id
    JOIN teams t2 ON m.team2_id = t2.id
    JOIN sessions s ON m.session_id = s.id
    WHERE m.id = ?
  `).bind(id).first()

  if (!match) {
    return c.json({ error: '경기를 찾을 수 없습니다.' }, 404)
  }

  // 팀별 선수
  const team1Members = await c.env.DB.prepare(`
    SELECT tm.*, p.name, p.nickname
    FROM team_members tm
    LEFT JOIN players p ON tm.player_id = p.id
    WHERE tm.team_id = ?
  `).bind(match.team1_id).all()

  const team2Members = await c.env.DB.prepare(`
    SELECT tm.*, p.name, p.nickname
    FROM team_members tm
    LEFT JOIN players p ON tm.player_id = p.id
    WHERE tm.team_id = ?
  `).bind(match.team2_id).all()

  // 이벤트 조회
  const events = await c.env.DB.prepare(`
    SELECT me.*, p.name as player_name, p.is_guest as player_is_guest,
           a.name as assister_name, a.is_guest as assister_is_guest
    FROM match_events me
    LEFT JOIN players p ON me.player_id = p.id
    LEFT JOIN players a ON me.assister_id = a.id
    WHERE me.match_id = ?
    ORDER BY me.event_time ASC
  `).bind(id).all()

  // 교체 기록
  const substitutions = await c.env.DB.prepare(`
    SELECT ps.*, p.name as player_name, p.nickname as player_nickname,
           ft.name as from_team_name, tt.name as to_team_name
    FROM player_substitutions ps
    LEFT JOIN players p ON ps.player_id = p.id
    LEFT JOIN teams ft ON ps.from_team_id = ft.id
    LEFT JOIN teams tt ON ps.to_team_id = tt.id
    WHERE ps.match_id = ?
    ORDER BY ps.minute ASC, ps.created_at ASC
  `).bind(id).all()

  return c.json({
    match,
    team1Members: team1Members.results,
    team2Members: team2Members.results,
    events: events.results,
    substitutions: substitutions.results,
  })
})

// 경기 상태 변경
matchesRoutes.put('/:id', optionalAuthMiddleware, async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()

  const schema = z.object({
    status: z.enum(['pending', 'playing', 'completed']).optional(),
    team1Score: z.number().min(0).optional(),
    team2Score: z.number().min(0).optional(),
  })

  const data = schema.parse(body)
  const updates: string[] = []
  const values: any[] = []

  if (data.status !== undefined) {
    updates.push('status = ?')
    values.push(data.status)
  }
  if (data.team1Score !== undefined) {
    updates.push('team1_score = ?')
    values.push(data.team1Score)
  }
  if (data.team2Score !== undefined) {
    updates.push('team2_score = ?')
    values.push(data.team2Score)
  }

  if (updates.length === 0) {
    return c.json({ error: '수정할 내용이 없습니다.' }, 400)
  }

  values.push(id)

  await c.env.DB.prepare(`
    UPDATE matches SET ${updates.join(', ')} WHERE id = ?
  `).bind(...values).run()

  // 경기 완료 시 추가 처리
  if (data.status === 'completed') {
    await onMatchCompleted(c.env.DB, Number(id))
  }

  return c.json({ message: '경기가 업데이트되었습니다.' })
})

// 이벤트 추가 (골/수비)
matchesRoutes.post('/:id/events', authMiddleware(), async (c) => {
  try {
    const matchId = c.req.param('id')
    const body = await c.req.json()
    const clubId = (c as any).clubId

    // 경기가 요청자의 클럽 소속인지 확인
    const matchCheck = await c.env.DB.prepare(
      'SELECT s.club_id FROM matches m JOIN sessions s ON m.session_id = s.id WHERE m.id = ?'
    ).bind(matchId).first()
    if (!matchCheck || (matchCheck as any).club_id !== clubId) {
      return c.json({ error: '해당 클럽 소속 경기가 아닙니다.' }, 403)
    }

    const schema = z.object({
      eventType: z.enum(['GOAL', 'DEFENSE', 'TACKLE', 'INTERCEPTION', 'CLEARANCE', 'SAVE', 'KEY_PASS', 'DRIBBLE', 'SHOT_ON', 'SHOT_OFF']),
      playerId: z.number().nullable(),
      guestName: z.string().nullable().optional(),
      teamId: z.number(),
      assisterId: z.number().nullable().optional(),
      assisterGuestName: z.string().nullable().optional(),
      eventTime: z.number().optional(),
    })

    const data = schema.parse(body)

    // 이벤트 생성
    const result = await c.env.DB.prepare(`
      INSERT INTO match_events (match_id, player_id, guest_name, team_id, event_type, assister_id, assister_guest_name, event_time, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    `).bind(
      matchId,
      data.playerId,
      data.guestName || null,
      data.teamId,
      data.eventType,
      data.assisterId || null,
      data.assisterGuestName || null,
      data.eventTime || null
    ).run()

    // 골이면 스코어 업데이트
    if (data.eventType === 'GOAL') {
      await updateMatchScore(c.env.DB, Number(matchId))
    }

    // player_match_stats 전체 재계산 (중복 방지)
    await recalculateMatchStats(c.env.DB, Number(matchId))

    // 랭킹 캐시 무효화
    await invalidateRankingsCache(c.env.DB, Number(matchId))

    // 정산 재계산 (골 변경 시 순위 바뀔 수 있음)
    if (data.eventType === 'GOAL') {
      await recalculateSettlement(c.env.DB, Number(matchId))
    }

    return c.json({
      id: result.meta.last_row_id,
      message: '이벤트가 기록되었습니다.',
    }, 201)
  } catch (err: any) {
    console.error('Event add error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// 이벤트 삭제
matchesRoutes.delete('/:id/events/:eventId', authMiddleware(), async (c) => {
  try {
    const matchId = c.req.param('id')
    const eventId = c.req.param('eventId')
    const clubId = (c as any).clubId

    // 경기가 요청자의 클럽 소속인지 확인
    const matchCheck = await c.env.DB.prepare(
      'SELECT s.club_id FROM matches m JOIN sessions s ON m.session_id = s.id WHERE m.id = ?'
    ).bind(matchId).first()
    if (!matchCheck || (matchCheck as any).club_id !== clubId) {
      return c.json({ error: '해당 클럽 소속 경기가 아닙니다.' }, 403)
    }

    // 이벤트 조회
    const event = await c.env.DB.prepare(
      'SELECT * FROM match_events WHERE id = ? AND match_id = ?'
    ).bind(eventId, matchId).first()

    if (!event) {
      return c.json({ error: '이벤트를 찾을 수 없습니다.' }, 404)
    }

    // 삭제
    await c.env.DB.prepare('DELETE FROM match_events WHERE id = ?').bind(eventId).run()

    // 스코어 재계산
    await updateMatchScore(c.env.DB, Number(matchId))

    // 스탯 재계산
    await recalculateMatchStats(c.env.DB, Number(matchId))

    // 랭킹 캐시 무효화
    await invalidateRankingsCache(c.env.DB, Number(matchId))

    // 골 삭제 시 정산 재계산
    if ((event as any).event_type === 'GOAL') {
      await recalculateSettlement(c.env.DB, Number(matchId))
    }

    return c.json({ message: '이벤트가 삭제되었습니다.' })
  } catch (err: any) {
    console.error('Event delete error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// 랭킹 캐시 무효화 헬퍼
async function invalidateRankingsCache(db: D1Database, matchId: number) {
  try {
    const match = await db.prepare(`
      SELECT s.session_date FROM matches m
      JOIN sessions s ON m.session_id = s.id
      WHERE m.id = ?
    `).bind(matchId).first()

    if (match?.session_date) {
      const year = new Date(match.session_date as string).getFullYear()
      await db.prepare('DELETE FROM rankings_cache WHERE year = ?').bind(year).run()
      console.log(`Rankings cache invalidated for year ${year}`)
    }
  } catch (err) {
    console.error('Cache invalidation error (ignored):', err)
  }
}

// 스코어 재계산
async function updateMatchScore(db: D1Database, matchId: number) {
  const match = await db.prepare('SELECT team1_id, team2_id FROM matches WHERE id = ?').bind(matchId).first()
  if (!match) return

  const team1Goals = await db.prepare(`
    SELECT COUNT(*) as count FROM match_events
    WHERE match_id = ? AND team_id = ? AND event_type = 'GOAL'
  `).bind(matchId, match.team1_id).first()

  const team2Goals = await db.prepare(`
    SELECT COUNT(*) as count FROM match_events
    WHERE match_id = ? AND team_id = ? AND event_type = 'GOAL'
  `).bind(matchId, match.team2_id).first()

  await db.prepare(`
    UPDATE matches SET team1_score = ?, team2_score = ? WHERE id = ?
  `).bind(team1Goals?.count || 0, team2Goals?.count || 0, matchId).run()
}

// 선수 경기 스탯 업데이트
async function updatePlayerMatchStats(db: D1Database, matchId: number, playerId: number, eventType: string) {
  // 기존 스탯 확인
  const existing = await db.prepare(`
    SELECT * FROM player_match_stats WHERE match_id = ? AND player_id = ?
  `).bind(matchId, playerId).first()

  if (existing) {
    let field = ''
    if (eventType === 'GOAL') field = 'goals'
    else if (eventType === 'DEFENSE') field = 'blocks'
    else if (eventType === 'TACKLE') field = 'tackles'
    else if (eventType === 'INTERCEPTION') field = 'interceptions'
    else if (eventType === 'CLEARANCE') field = 'clearances'
    else if (eventType === 'SAVE') field = 'saves'
    else if (eventType === 'KEY_PASS') field = 'key_passes'
    else if (eventType === 'DRIBBLE') field = 'dribbles'
    else if (eventType === 'SHOT_ON') field = 'shots_on'
    else if (eventType === 'SHOT_OFF') field = 'shots_off'
    else if (eventType === 'ASSIST') field = 'assists'

    if (field) {
      await db.prepare(`
        UPDATE player_match_stats SET ${field} = ${field} + 1 WHERE id = ?
      `).bind(existing.id).run()
    }
  } else {
    const goals = eventType === 'GOAL' ? 1 : 0
    const blocks = eventType === 'DEFENSE' ? 1 : 0
    const tackles = eventType === 'TACKLE' ? 1 : 0
    const interceptions = eventType === 'INTERCEPTION' ? 1 : 0
    const clearances = eventType === 'CLEARANCE' ? 1 : 0
    const saves = eventType === 'SAVE' ? 1 : 0
    const keyPasses = eventType === 'KEY_PASS' ? 1 : 0
    const dribbles = eventType === 'DRIBBLE' ? 1 : 0
    const shotsOn = eventType === 'SHOT_ON' ? 1 : 0
    const shotsOff = eventType === 'SHOT_OFF' ? 1 : 0
    const assists = eventType === 'ASSIST' ? 1 : 0

    await db.prepare(`
      INSERT INTO player_match_stats (match_id, player_id, goals, assists, blocks, tackles, interceptions, clearances, saves, key_passes, dribbles, shots_on, shots_off)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(matchId, playerId, goals, assists, blocks, tackles, interceptions, clearances, saves, keyPasses, dribbles, shotsOn, shotsOff).run()
  }
}

// 경기 스탯 전체 재계산
async function recalculateMatchStats(db: D1Database, matchId: number) {
  // 기존 스탯 삭제
  await db.prepare('DELETE FROM player_match_stats WHERE match_id = ?').bind(matchId).run()

  // 이벤트 기반 재계산 — 득점자가 용병(player_id NULL)이어도 assister 집계를 위해 행을 유지
  const events = await db.prepare(`
    SELECT player_id, event_type, assister_id FROM match_events
    WHERE match_id = ? AND (player_id IS NOT NULL OR assister_id IS NOT NULL)
  `).bind(matchId).all()

  const empty = () => ({ goals: 0, assists: 0, blocks: 0, tackles: 0, interceptions: 0, clearances: 0, saves: 0, keyPasses: 0, dribbles: 0, shotsOn: 0, shotsOff: 0 })
  const stats = new Map<number, ReturnType<typeof empty>>()

  const getOrCreate = (pid: number) => {
    if (!stats.has(pid)) stats.set(pid, empty())
    return stats.get(pid)!
  }

  const fieldMap: Record<string, keyof ReturnType<typeof empty>> = {
    GOAL: 'goals', DEFENSE: 'blocks', TACKLE: 'tackles', INTERCEPTION: 'interceptions',
    CLEARANCE: 'clearances', SAVE: 'saves', KEY_PASS: 'keyPasses', DRIBBLE: 'dribbles',
    SHOT_ON: 'shotsOn', SHOT_OFF: 'shotsOff',
  }

  for (const event of events.results as any[]) {
    if (event.player_id) {
      const s = getOrCreate(event.player_id)
      const f = fieldMap[event.event_type]
      if (f) (s as any)[f]++
    }

    if (event.assister_id) {
      getOrCreate(event.assister_id).assists++
    }
  }

  for (const [playerId, s] of stats) {
    await db.prepare(`
      INSERT INTO player_match_stats (match_id, player_id, goals, assists, blocks, tackles, interceptions, clearances, saves, key_passes, dribbles, shots_on, shots_off)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(matchId, playerId, s.goals, s.assists, s.blocks, s.tackles, s.interceptions, s.clearances, s.saves, s.keyPasses, s.dribbles, s.shotsOn, s.shotsOff).run()
  }
}

// 경기 완료 시 처리
async function onMatchCompleted(db: D1Database, matchId: number) {
  await invalidateRankingsCache(db, matchId)
  await awardBadgesForMatch(db, matchId)
}

// 경기 완료 후 골/어시스트 배지 자동 부여
async function awardBadgesForMatch(db: D1Database, matchId: number) {
  // 이 경기에 참가한 정회원 선수 목록
  const participants = await db.prepare(`
    SELECT DISTINCT player_id FROM player_match_stats WHERE match_id = ?
  `).bind(matchId).all()

  const playerIds: number[] = (participants.results as any[]).map((r) => r.player_id)
  if (playerIds.length === 0) return

  const now = Date.now()

  for (const playerId of playerIds) {
    // 누적 골/어시스트 집계 (전체 이력)
    const stats = await db.prepare(`
      SELECT
        COALESCE(SUM(goals), 0)   AS total_goals,
        COALESCE(SUM(assists), 0) AS total_assists
      FROM player_match_stats
      WHERE player_id = ?
    `).bind(playerId).first() as { total_goals: number; total_assists: number } | null

    const totalGoals   = stats?.total_goals   ?? 0
    const totalAssists = stats?.total_assists ?? 0

    // 배지 조건: [badge_code, 조건 충족 여부]
    const badgesToCheck: [string, boolean][] = [
      ['first_goal', totalGoals >= 1],
      ['goal_5',     totalGoals >= 5],
      ['goal_10',    totalGoals >= 10],
      ['assist_5',   totalAssists >= 5],
      ['assist_10',  totalAssists >= 10],
    ]

    for (const [code, conditionMet] of badgesToCheck) {
      if (!conditionMet) continue
      // INSERT OR IGNORE: 이미 보유한 배지면 무시
      await db.prepare(`
        INSERT OR IGNORE INTO player_badges (player_id, badge_code, earned_at)
        VALUES (?, ?, ?)
      `).bind(playerId, code, now).run()
    }
  }
}

// 경기 결과 변경 시 정산 재계산 (세션이 ended/completed이고 settlement 있을 때만)
async function recalculateSettlement(db: any, matchId: number) {
  try {
    const match = await db.prepare(
      'SELECT session_id FROM matches WHERE id = ?'
    ).bind(matchId).first() as any
    if (!match) return

    const session = await db.prepare(
      'SELECT id, status FROM sessions WHERE id = ?'
    ).bind(match.session_id).first() as any
    if (!session || !['ended', 'completed'].includes(session.status)) return

    // 기존 정산 삭제 후 재생성
    await db.prepare('DELETE FROM session_payments WHERE session_id = ?').bind(session.id).run()
    await db.prepare('DELETE FROM settlements WHERE session_id = ?').bind(session.id).run()
    await autoSettleSession(db, session.id)
  } catch (e) {
    console.error(`recalculateSettlement failed for match ${matchId}:`, e)
  }
}

// 선수 교체 등록
matchesRoutes.post('/:id/substitutions', authMiddleware(), async (c) => {
  try {
    const matchId = c.req.param('id')
    const body = await c.req.json()
    const clubId = (c as any).clubId

    // 경기 검증
    const match = await c.env.DB.prepare(`
      SELECT m.*, s.club_id FROM matches m
      JOIN sessions s ON m.session_id = s.id
      WHERE m.id = ?
    `).bind(matchId).first() as any
    if (!match || match.club_id !== clubId) {
      return c.json({ error: '해당 클럽 소속 경기가 아닙니다.' }, 403)
    }
    if (match.status !== 'playing') {
      return c.json({ error: '진행 중인 경기에서만 교체할 수 있습니다.' }, 400)
    }

    const schema = z.object({
      playerId: z.number().nullable(),
      guestName: z.string().nullable().optional(),
      fromTeamId: z.number(),
      toTeamId: z.number(),
      minute: z.number().nullable().optional(),
    })

    const data = schema.parse(body)

    // playerId 또는 guestName 중 하나는 필수
    if (!data.playerId && !data.guestName) {
      return c.json({ error: 'playerId 또는 guestName 중 하나는 필수입니다.' }, 400)
    }

    // 같은 팀 교체 거부
    if (data.fromTeamId === data.toTeamId) {
      return c.json({ error: '같은 팀으로는 교체할 수 없습니다.' }, 400)
    }

    // 두 팀 모두 해당 경기 소속인지 확인
    const teamIds = [match.team1_id, match.team2_id]
    if (!teamIds.includes(data.fromTeamId) || !teamIds.includes(data.toTeamId)) {
      return c.json({ error: '해당 경기의 팀이 아닙니다.' }, 400)
    }

    // 선수가 from_team에 소속인지 확인
    let memberCheck: any
    if (data.playerId) {
      memberCheck = await c.env.DB.prepare(
        'SELECT id FROM team_members WHERE team_id = ? AND player_id = ?'
      ).bind(data.fromTeamId, data.playerId).first()
    } else {
      memberCheck = await c.env.DB.prepare(
        'SELECT id FROM team_members WHERE team_id = ? AND guest_name = ? LIMIT 1'
      ).bind(data.fromTeamId, data.guestName).first()
    }
    if (!memberCheck) {
      return c.json({ error: '해당 선수가 출발 팀에 소속되어 있지 않습니다.' }, 400)
    }

    // team_members 소속 변경: 정확한 row ID로 업데이트
    await c.env.DB.prepare(
      'UPDATE team_members SET team_id = ? WHERE id = ?'
    ).bind(data.toTeamId, memberCheck.id).run()

    // 교체 기록 저장
    const result = await c.env.DB.prepare(`
      INSERT INTO player_substitutions (match_id, player_id, guest_name, from_team_id, to_team_id, minute)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      matchId,
      data.playerId || null,
      data.guestName || null,
      data.fromTeamId,
      data.toTeamId,
      data.minute ?? null
    ).run()

    return c.json({
      id: result.meta.last_row_id,
      message: '선수 교체가 완료되었습니다.',
    }, 201)
  } catch (err: any) {
    console.error('Substitution error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// 교체 기록 조회
matchesRoutes.get('/:id/substitutions', async (c) => {
  const matchId = c.req.param('id')

  const substitutions = await c.env.DB.prepare(`
    SELECT ps.*, p.name as player_name, p.nickname as player_nickname,
           ft.name as from_team_name, tt.name as to_team_name
    FROM player_substitutions ps
    LEFT JOIN players p ON ps.player_id = p.id
    LEFT JOIN teams ft ON ps.from_team_id = ft.id
    LEFT JOIN teams tt ON ps.to_team_id = tt.id
    WHERE ps.match_id = ?
    ORDER BY ps.minute ASC, ps.created_at ASC
  `).bind(matchId).all()

  return c.json({ substitutions: substitutions.results })
})

export { matchesRoutes }
