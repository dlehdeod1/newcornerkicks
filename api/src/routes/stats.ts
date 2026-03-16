import { Hono } from 'hono'
import type { Env } from '../index'
import { optionalAuthMiddleware } from '../middleware/auth'
import { getSeasonDateRange, getClubSeasonStartMonth, getCurrentSeasonYear } from '../utils/season'

const statsRoutes = new Hono<{ Bindings: Env }>()

// 시즌 요약 통계
statsRoutes.get('/season-summary', optionalAuthMiddleware, async (c) => {
  const clubId = (c as any).clubId
  if (!clubId) {
    return c.json({
      year: getCurrentSeasonYear(1),
      totalSessions: 0,
      totalMatches: 0,
      totalGoals: 0,
      totalAssists: 0,
      averageAttendance: 0,
      topAttendees: [],
      monthlySessions: [],
      monthlyAttendance: [],
    })
  }

  const seasonStartMonth = await getClubSeasonStartMonth(c.env.DB, clubId)
  const year = Number(c.req.query('year')) || getCurrentSeasonYear(seasonStartMonth)
  const { yearStart, yearEnd } = getSeasonDateRange(year, seasonStartMonth)

  // 총 세션 수
  const sessionsResult = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM sessions
    WHERE session_date BETWEEN ? AND ?
      AND club_id = ?
  `).bind(yearStart, yearEnd, clubId).first()

  // 총 경기 수
  const matchesResult = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM matches m
    JOIN sessions s ON m.session_id = s.id
    WHERE s.session_date BETWEEN ? AND ?
      AND s.club_id = ?
  `).bind(yearStart, yearEnd, clubId).first()

  // 총 골
  const goalsResult = await c.env.DB.prepare(`
    SELECT COALESCE(SUM(pms.goals), 0) as total FROM player_match_stats pms
    JOIN matches m ON pms.match_id = m.id
    JOIN sessions s ON m.session_id = s.id
    WHERE s.session_date BETWEEN ? AND ?
      AND s.club_id = ?
  `).bind(yearStart, yearEnd, clubId).first()

  // 총 어시스트
  const assistsResult = await c.env.DB.prepare(`
    SELECT COALESCE(SUM(pms.assists), 0) as total FROM player_match_stats pms
    JOIN matches m ON pms.match_id = m.id
    JOIN sessions s ON m.session_id = s.id
    WHERE s.session_date BETWEEN ? AND ?
      AND s.club_id = ?
  `).bind(yearStart, yearEnd, clubId).first()

  // 평균 참석자 수
  const avgAttendanceResult = await c.env.DB.prepare(`
    SELECT AVG(att_count) as avg FROM (
      SELECT session_id, COUNT(*) as att_count FROM attendance a
      JOIN sessions s ON a.session_id = s.id
      WHERE s.session_date BETWEEN ? AND ?
        AND s.club_id = ?
      GROUP BY session_id
    )
  `).bind(yearStart, yearEnd, clubId).first()

  // 출석 TOP 5
  const topAttendeesResult = await c.env.DB.prepare(`
    SELECT p.id, p.name, COUNT(*) as attendance_count
    FROM attendance a
    JOIN players p ON a.player_id = p.id
    JOIN sessions s ON a.session_id = s.id
    WHERE s.session_date BETWEEN ? AND ?
      AND s.club_id = ?
      AND p.is_guest = 0
    GROUP BY p.id
    ORDER BY attendance_count DESC
    LIMIT 5
  `).bind(yearStart, yearEnd, clubId).all()

  // 월별 세션 수
  const monthlySessionsResult = await c.env.DB.prepare(`
    SELECT
      strftime('%m', session_date) as month,
      COUNT(*) as count
    FROM sessions
    WHERE session_date BETWEEN ? AND ?
      AND club_id = ?
    GROUP BY strftime('%m', session_date)
    ORDER BY month
  `).bind(yearStart, yearEnd, clubId).all()

  // 월별 참석자 수 추이
  const monthlyAttendanceResult = await c.env.DB.prepare(`
    SELECT
      strftime('%m', s.session_date) as month,
      AVG(att_count) as avg_attendance
    FROM (
      SELECT a.session_id, COUNT(*) as att_count
      FROM attendance a
      JOIN sessions s2 ON a.session_id = s2.id
      WHERE s2.club_id = ?
      GROUP BY a.session_id
    ) att
    JOIN sessions s ON att.session_id = s.id
    WHERE s.session_date BETWEEN ? AND ?
      AND s.club_id = ?
    GROUP BY strftime('%m', s.session_date)
    ORDER BY month
  `).bind(clubId, yearStart, yearEnd, clubId).all()

  return c.json({
    year,
    totalSessions: (sessionsResult as any)?.count || 0,
    totalMatches: (matchesResult as any)?.count || 0,
    totalGoals: (goalsResult as any)?.total || 0,
    totalAssists: (assistsResult as any)?.total || 0,
    averageAttendance: (avgAttendanceResult as any)?.avg || 0,
    topAttendees: topAttendeesResult.results,
    monthlySessions: monthlySessionsResult.results,
    monthlyAttendance: monthlyAttendanceResult.results,
  })
})

// 선수 트렌드 (최근 N세션 성적)
statsRoutes.get('/player-trend/:playerId', optionalAuthMiddleware, async (c) => {
  const clubId = (c as any).clubId
  if (!clubId) {
    return c.json({ trend: [] })
  }

  const playerId = c.req.param('playerId')
  const limit = Number(c.req.query('limit')) || 10

  // 선수가 해당 클럽에 속하는지 확인
  const player = await c.env.DB.prepare(
    'SELECT id FROM players WHERE id = ? AND club_id = ?'
  ).bind(playerId, clubId).first()

  if (!player) {
    return c.json({ trend: [] })
  }

  const trend = await c.env.DB.prepare(`
    SELECT
      s.session_date,
      s.id as session_id,
      COALESCE(SUM(pms.goals), 0) as goals,
      COALESCE(SUM(pms.assists), 0) as assists,
      COALESCE(SUM(pms.blocks), 0) as blocks
    FROM attendance a
    JOIN sessions s ON a.session_id = s.id
    LEFT JOIN matches m ON m.session_id = s.id
    LEFT JOIN player_match_stats pms ON pms.match_id = m.id AND pms.player_id = ?
    WHERE a.player_id = ?
      AND s.club_id = ?
    GROUP BY s.id
    ORDER BY s.session_date DESC
    LIMIT ?
  `).bind(playerId, playerId, clubId, limit).all()

  return c.json({
    trend: trend.results.reverse(), // 오래된 순으로 정렬
  })
})

// 팀 대결 기록
statsRoutes.get('/head-to-head', optionalAuthMiddleware, async (c) => {
  const clubId = (c as any).clubId
  if (!clubId) {
    return c.json({ sameTeamCount: 0, opponentCount: 0 })
  }

  const player1Id = c.req.query('player1')
  const player2Id = c.req.query('player2')

  if (!player1Id || !player2Id) {
    return c.json({ error: '두 선수 ID가 필요합니다.' }, 400)
  }

  // 두 선수가 모두 해당 클럽에 속하는지 확인
  const player1 = await c.env.DB.prepare(
    'SELECT id FROM players WHERE id = ? AND club_id = ?'
  ).bind(player1Id, clubId).first()

  const player2 = await c.env.DB.prepare(
    'SELECT id FROM players WHERE id = ? AND club_id = ?'
  ).bind(player2Id, clubId).first()

  if (!player1 || !player2) {
    return c.json({ sameTeamCount: 0, opponentCount: 0 })
  }

  // 두 선수가 같은 팀이었던 경기 (같은 클럽의 세션 내)
  const sameTeam = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM team_members tm1
    JOIN team_members tm2 ON tm1.team_id = tm2.team_id
    JOIN teams t ON tm1.team_id = t.id
    JOIN sessions s ON t.session_id = s.id
    WHERE tm1.player_id = ? AND tm2.player_id = ?
      AND s.club_id = ?
  `).bind(player1Id, player2Id, clubId).first()

  // 두 선수가 다른 팀이었던 경기 (맞대결, 같은 클럽의 세션 내)
  const opponents = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM matches m
    JOIN team_members tm1 ON tm1.team_id = m.team1_id
    JOIN team_members tm2 ON tm2.team_id = m.team2_id
    JOIN sessions s ON m.session_id = s.id
    WHERE ((tm1.player_id = ? AND tm2.player_id = ?)
       OR (tm1.player_id = ? AND tm2.player_id = ?))
      AND s.club_id = ?
  `).bind(player1Id, player2Id, player2Id, player1Id, clubId).first()

  return c.json({
    sameTeamCount: (sameTeam as any)?.count || 0,
    opponentCount: (opponents as any)?.count || 0,
  })
})

// 기록들 (Records)
statsRoutes.get('/records', optionalAuthMiddleware, async (c) => {
  const clubId = (c as any).clubId
  if (!clubId) {
    return c.json({
      records: {
        mostGoalsInMatch: null,
        mostGoalsInSession: null,
        longestAttendanceStreak: null,
        mostWins: null,
      },
    })
  }

  // 한 경기 최다 골
  const maxGoalsGame = await c.env.DB.prepare(`
    SELECT p.name, pms.goals, s.session_date, m.match_no
    FROM player_match_stats pms
    JOIN players p ON pms.player_id = p.id
    JOIN matches m ON pms.match_id = m.id
    JOIN sessions s ON m.session_id = s.id
    WHERE s.club_id = ?
      AND pms.goals = (
        SELECT MAX(pms2.goals)
        FROM player_match_stats pms2
        JOIN matches m2 ON pms2.match_id = m2.id
        JOIN sessions s2 ON m2.session_id = s2.id
        WHERE s2.club_id = ?
      )
    LIMIT 1
  `).bind(clubId, clubId).first()

  // 한 세션 최다 골
  const maxGoalsSession = await c.env.DB.prepare(`
    SELECT p.name, SUM(pms.goals) as total_goals, s.session_date
    FROM player_match_stats pms
    JOIN players p ON pms.player_id = p.id
    JOIN matches m ON pms.match_id = m.id
    JOIN sessions s ON m.session_id = s.id
    WHERE s.club_id = ?
    GROUP BY p.id, s.id
    ORDER BY total_goals DESC
    LIMIT 1
  `).bind(clubId).first()

  // 연속 출석 기록
  const streakResult = await c.env.DB.prepare(`
    SELECT p.name, COUNT(*) as streak
    FROM attendance a
    JOIN players p ON a.player_id = p.id
    JOIN sessions s ON a.session_id = s.id
    WHERE s.club_id = ?
    GROUP BY p.id
    ORDER BY streak DESC
    LIMIT 1
  `).bind(clubId).first()

  // 최다 연승
  const mostWins = await c.env.DB.prepare(`
    SELECT p.name,
      SUM(CASE
        WHEN (tm.team_id = m.team1_id AND m.team1_score > m.team2_score) OR
             (tm.team_id = m.team2_id AND m.team2_score > m.team1_score)
        THEN 1 ELSE 0 END) as wins
    FROM team_members tm
    JOIN players p ON tm.player_id = p.id
    JOIN matches m ON (tm.team_id = m.team1_id OR tm.team_id = m.team2_id)
    JOIN sessions s ON m.session_id = s.id
    WHERE m.status = 'completed'
      AND s.club_id = ?
    GROUP BY p.id
    ORDER BY wins DESC
    LIMIT 1
  `).bind(clubId).first()

  return c.json({
    records: {
      mostGoalsInMatch: maxGoalsGame,
      mostGoalsInSession: maxGoalsSession,
      longestAttendanceStreak: streakResult,
      mostWins: mostWins,
    },
  })
})

export { statsRoutes }
