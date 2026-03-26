import { Hono } from 'hono'
import type { Env } from '../index'
import { optionalAuthMiddleware, authMiddleware } from '../middleware/auth'
import { getSeasonDateRange, getClubSeasonStartMonth, getCurrentSeasonYear } from '../utils/season'

const awardsRoutes = new Hono<{ Bindings: Env }>()

// GET /awards — 시즌 어워드 조회
awardsRoutes.get('/', optionalAuthMiddleware, async (c) => {
  const clubId = (c as any).clubId
  if (!clubId) {
    return c.json({ awards: [], year: new Date().getFullYear() })
  }

  const seasonStartMonth = await getClubSeasonStartMonth(c.env.DB, clubId)
  const year = Number(c.req.query('year')) || getCurrentSeasonYear(seasonStartMonth)

  const result = await c.env.DB.prepare(`
    SELECT sa.id, sa.award_type, sa.player_id, sa.stat_value, sa.season_year,
           p.name as player_name
    FROM season_awards sa
    JOIN players p ON sa.player_id = p.id
    WHERE sa.club_id = ? AND sa.season_year = ?
    ORDER BY sa.award_type
  `).bind(clubId, year).all()

  return c.json({ awards: result.results, year })
})

// POST /awards/generate — 시즌 어워드 자동 생성 (관리자 전용)
awardsRoutes.post('/generate', authMiddleware('ADMIN'), async (c) => {
  const clubId = (c as any).clubId
  if (!clubId) {
    return c.json({ error: '클럽이 필요합니다.' }, 400)
  }

  const body = await c.req.json().catch(() => ({}))
  const seasonStartMonth = await getClubSeasonStartMonth(c.env.DB, clubId)
  const year = Number(body.year) || getCurrentSeasonYear(seasonStartMonth)
  const { yearStart, yearEnd } = getSeasonDateRange(year, seasonStartMonth)
  const now = Math.floor(Date.now() / 1000)

  // top_scorer: 시즌 내 최다 골
  const topScorer = await c.env.DB.prepare(`
    SELECT me.player_id, p.name, COUNT(*) as cnt
    FROM match_events me
    JOIN matches m ON me.match_id = m.id
    JOIN sessions s ON m.session_id = s.id
    JOIN players p ON me.player_id = p.id
    WHERE me.event_type = 'GOAL' AND s.club_id = ?
      AND s.status IN ('completed', 'closed')
      AND s.session_date BETWEEN ? AND ?
    GROUP BY me.player_id
    ORDER BY cnt DESC
    LIMIT 1
  `).bind(clubId, yearStart, yearEnd).first<any>()

  // top_assist: 시즌 내 최다 어시스트
  const topAssist = await c.env.DB.prepare(`
    SELECT me.assist_player_id as player_id, p.name, COUNT(*) as cnt
    FROM match_events me
    JOIN matches m ON me.match_id = m.id
    JOIN sessions s ON m.session_id = s.id
    JOIN players p ON me.assist_player_id = p.id
    WHERE me.event_type = 'GOAL' AND me.assist_player_id IS NOT NULL
      AND s.club_id = ?
      AND s.status IN ('completed', 'closed')
      AND s.session_date BETWEEN ? AND ?
    GROUP BY me.assist_player_id
    ORDER BY cnt DESC
    LIMIT 1
  `).bind(clubId, yearStart, yearEnd).first<any>()

  // top_defense: 최다 수비 이벤트 (DEFENSE + TACKLE + INTERCEPTION + CLEARANCE)
  const topDefense = await c.env.DB.prepare(`
    SELECT me.player_id, p.name, COUNT(*) as cnt
    FROM match_events me
    JOIN matches m ON me.match_id = m.id
    JOIN sessions s ON m.session_id = s.id
    JOIN players p ON me.player_id = p.id
    WHERE me.event_type IN ('DEFENSE', 'TACKLE', 'INTERCEPTION', 'CLEARANCE')
      AND s.club_id = ?
      AND s.status IN ('completed', 'closed')
      AND s.session_date BETWEEN ? AND ?
    GROUP BY me.player_id
    ORDER BY cnt DESC
    LIMIT 1
  `).bind(clubId, yearStart, yearEnd).first<any>()

  // top_attendance: 최다 출석
  const topAttendance = await c.env.DB.prepare(`
    SELECT a.player_id, p.name, COUNT(*) as cnt
    FROM attendance a
    JOIN players p ON a.player_id = p.id
    JOIN sessions s ON a.session_id = s.id
    WHERE s.club_id = ? AND p.is_guest = 0
      AND s.status IN ('completed', 'closed')
      AND s.session_date BETWEEN ? AND ?
    GROUP BY a.player_id
    ORDER BY cnt DESC
    LIMIT 1
  `).bind(clubId, yearStart, yearEnd).first<any>()

  // mvp: 최다 MVP 선정
  const topMvp = await c.env.DB.prepare(`
    SELECT smr.player_id, p.name, COUNT(*) as cnt
    FROM session_mvp_results smr
    JOIN sessions s ON smr.session_id = s.id
    JOIN players p ON smr.player_id = p.id
    WHERE s.club_id = ?
      AND s.status IN ('completed', 'closed')
      AND s.session_date BETWEEN ? AND ?
    GROUP BY smr.player_id
    ORDER BY cnt DESC
    LIMIT 1
  `).bind(clubId, yearStart, yearEnd).first<any>()

  // rookie: 시즌 내 가입한 선수 중 5경기 이상 참여한 가장 최근 선수
  const rookie = await c.env.DB.prepare(`
    SELECT p.id as player_id, p.name,
      (SELECT COUNT(DISTINCT a.session_id) FROM attendance a
       JOIN sessions s2 ON a.session_id = s2.id
       WHERE a.player_id = p.id AND s2.club_id = ?
         AND s2.status IN ('completed', 'closed')
         AND s2.session_date BETWEEN ? AND ?) as match_count
    FROM players p
    WHERE p.club_id = ? AND p.is_guest = 0
      AND p.created_at >= (SELECT strftime('%s', ?) )
      AND p.created_at <= (SELECT strftime('%s', ?) )
    HAVING match_count >= 5
    ORDER BY p.created_at DESC
    LIMIT 1
  `).bind(clubId, yearStart, yearEnd, clubId, yearStart, yearEnd).first<any>()

  // UPSERT awards
  const awards: { award_type: string; player_id: number; stat_value: number; player_name: string }[] = []

  const upsert = async (awardType: string, data: any) => {
    if (!data || !data.player_id) return
    const statValue = data.cnt ?? data.match_count ?? 0
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO season_awards (club_id, season_year, award_type, player_id, stat_value, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(clubId, year, awardType, data.player_id, statValue, now).run()
    awards.push({ award_type: awardType, player_id: data.player_id, stat_value: statValue, player_name: data.name })
  }

  await upsert('top_scorer', topScorer)
  await upsert('top_assist', topAssist)
  await upsert('top_defense', topDefense)
  await upsert('top_attendance', topAttendance)
  await upsert('mvp', topMvp)
  await upsert('rookie', rookie)

  return c.json({ awards, year })
})

export { awardsRoutes }
