import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../index'
import { optionalAuthMiddleware, authMiddleware } from '../middleware/auth'

const matchesRoutes = new Hono<{ Bindings: Env }>()

// 경기 생성
matchesRoutes.post('/', optionalAuthMiddleware, async (c) => {
  try {
    const body = await c.req.json()

    const schema = z.object({
      sessionId: z.number(),
      team1Id: z.number(),
      team2Id: z.number(),
      matchNo: z.number().optional(),
    })

    const data = schema.parse(body)

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
matchesRoutes.post('/round-robin', optionalAuthMiddleware, async (c) => {
  try {
    const body = await c.req.json()

    const schema = z.object({
      sessionId: z.number(),
      teamIds: z.array(z.number()).min(2).max(4),
      rounds: z.number().min(1).max(5).optional(),
    })

    const parsed = schema.parse(body)
    const data = { ...parsed, rounds: parsed.rounds || 1 }

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
matchesRoutes.delete('/:id', optionalAuthMiddleware, async (c) => {
  try {
    const id = c.req.param('id')

    // 삭제 전 세션 정보 가져오기 (랭킹 캐시 무효화용)
    const match = await c.env.DB.prepare(
      'SELECT session_id FROM matches WHERE id = ?'
    ).bind(id).first()

    // 관련 이벤트 먼저 삭제
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
    SELECT me.*, p.name as player_name, a.name as assister_name
    FROM match_events me
    LEFT JOIN players p ON me.player_id = p.id
    LEFT JOIN players a ON me.assister_id = a.id
    WHERE me.match_id = ?
    ORDER BY me.event_time ASC
  `).bind(id).all()

  return c.json({
    match,
    team1Members: team1Members.results,
    team2Members: team2Members.results,
    events: events.results,
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
matchesRoutes.post('/:id/events', optionalAuthMiddleware, async (c) => {
  try {
    const matchId = c.req.param('id')
    const body = await c.req.json()

    const schema = z.object({
      eventType: z.enum(['GOAL', 'DEFENSE']),
      playerId: z.number().nullable(),
      guestName: z.string().optional(),
      teamId: z.number(),
      assisterId: z.number().nullable().optional(),
      eventTime: z.number().optional(),
    })

    const data = schema.parse(body)

    // 이벤트 생성 (created_at 컬럼 없을 수 있어서 간단하게)
    const result = await c.env.DB.prepare(`
      INSERT INTO match_events (match_id, player_id, guest_name, team_id, event_type, assister_id, event_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      matchId,
      data.playerId,
      data.guestName || null,
      data.teamId,
      data.eventType,
      data.assisterId || null,
      data.eventTime || null
    ).run()

    // 골이면 스코어 업데이트
    if (data.eventType === 'GOAL') {
      await updateMatchScore(c.env.DB, Number(matchId))
    }

    // player_match_stats 업데이트 (정회원만) - 에러나도 무시
    try {
      if (data.playerId) {
        await updatePlayerMatchStats(c.env.DB, Number(matchId), data.playerId, data.eventType)
      }
      if (data.assisterId) {
        await updatePlayerMatchStats(c.env.DB, Number(matchId), data.assisterId, 'ASSIST')
      }
    } catch (statsErr) {
      console.error('Stats update error (ignored):', statsErr)
    }

    // 랭킹 캐시 무효화
    await invalidateRankingsCache(c.env.DB, Number(matchId))

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
matchesRoutes.delete('/:id/events/:eventId', optionalAuthMiddleware, async (c) => {
  try {
    const matchId = c.req.param('id')
    const eventId = c.req.param('eventId')

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

    // 스탯 재계산 (에러나도 무시)
    try {
      await recalculateMatchStats(c.env.DB, Number(matchId))
    } catch (statsErr) {
      console.error('Stats recalculate error (ignored):', statsErr)
    }

    // 랭킹 캐시 무효화
    await invalidateRankingsCache(c.env.DB, Number(matchId))

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
    else if (eventType === 'ASSIST') field = 'assists'

    if (field) {
      await db.prepare(`
        UPDATE player_match_stats SET ${field} = ${field} + 1 WHERE id = ?
      `).bind(existing.id).run()
    }
  } else {
    const goals = eventType === 'GOAL' ? 1 : 0
    const blocks = eventType === 'DEFENSE' ? 1 : 0
    const assists = eventType === 'ASSIST' ? 1 : 0

    // created_at 없이 삽입 (remote DB 호환)
    await db.prepare(`
      INSERT INTO player_match_stats (match_id, player_id, goals, assists, blocks)
      VALUES (?, ?, ?, ?, ?)
    `).bind(matchId, playerId, goals, assists, blocks).run()
  }
}

// 경기 스탯 전체 재계산
async function recalculateMatchStats(db: D1Database, matchId: number) {
  // 기존 스탯 삭제
  await db.prepare('DELETE FROM player_match_stats WHERE match_id = ?').bind(matchId).run()

  // 이벤트 기반 재계산
  const events = await db.prepare(`
    SELECT player_id, event_type, assister_id FROM match_events
    WHERE match_id = ? AND player_id IS NOT NULL
  `).bind(matchId).all()

  const stats = new Map<number, { goals: number; assists: number; blocks: number }>()

  for (const event of events.results as any[]) {
    if (!stats.has(event.player_id)) {
      stats.set(event.player_id, { goals: 0, assists: 0, blocks: 0 })
    }
    const s = stats.get(event.player_id)!

    if (event.event_type === 'GOAL') s.goals++
    if (event.event_type === 'DEFENSE') s.blocks++

    if (event.assister_id) {
      if (!stats.has(event.assister_id)) {
        stats.set(event.assister_id, { goals: 0, assists: 0, blocks: 0 })
      }
      stats.get(event.assister_id)!.assists++
    }
  }

  // created_at 없이 삽입 (remote DB 호환)
  for (const [playerId, s] of stats) {
    await db.prepare(`
      INSERT INTO player_match_stats (match_id, player_id, goals, assists, blocks)
      VALUES (?, ?, ?, ?, ?)
    `).bind(matchId, playerId, s.goals, s.assists, s.blocks).run()
  }
}

// 경기 완료 시 처리
async function onMatchCompleted(db: D1Database, matchId: number) {
  // 랭킹 캐시 무효화
  await invalidateRankingsCache(db, matchId)

  // TODO: 배지 자동 부여 로직
}

export { matchesRoutes }
