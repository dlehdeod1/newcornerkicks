import { Hono } from 'hono'
import type { Env } from '../index'
import { authMiddleware } from '../middleware/auth'

const settlementsRoutes = new Hono<{ Bindings: Env }>()

// 시즌 요약 조회
settlementsRoutes.get('/summary', async (c) => {
  const year = Number(c.req.query('year')) || new Date().getFullYear()
  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`

  try {
    // 세션 수만 먼저 조회 (이건 항상 동작)
    const sessionCount = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM sessions WHERE session_date BETWEEN ? AND ?
    `).bind(startDate, endDate).first()

    // settlements 테이블이 있으면 정산 통계도 조회
    let totalPot = 0
    let operationFee = 0
    let totalPrize = 0

    try {
      const stats = await c.env.DB.prepare(`
        SELECT
          COALESCE(SUM(st.total_pot), 0) as total_pot,
          COALESCE(SUM(st.operation_fee), 0) as operation_fee
        FROM settlements st
        JOIN sessions s ON st.session_id = s.id
        WHERE s.session_date BETWEEN ? AND ?
          AND st.status = 'completed'
      `).bind(startDate, endDate).first()

      totalPot = (stats?.total_pot as number) || 0
      operationFee = (stats?.operation_fee as number) || 0
    } catch {
      // settlements 테이블이 없으면 무시
    }

    return c.json({
      summary: {
        year,
        totalSessions: (sessionCount?.count as number) || 0,
        totalPot,
        operationFee,
        totalPrize,
      }
    })
  } catch (error) {
    console.error('Settlement summary error:', error)
    return c.json({
      summary: {
        year,
        totalSessions: 0,
        totalPot: 0,
        operationFee: 0,
        totalPrize: 0,
      }
    })
  }
})

// 내 정산 이력 조회
settlementsRoutes.get('/me', authMiddleware(), async (c) => {
  const userId = (c as any).userId

  // 사용자에 연결된 선수 찾기
  const player = await c.env.DB.prepare(
    'SELECT id FROM players WHERE user_id = ?'
  ).bind(userId).first()

  if (!player) {
    return c.json({ history: [] })
  }

  // 팀 정산 이력 (내가 속한 팀의 정산)
  const teamHistory = await c.env.DB.prepare(`
    SELECT
      ts.id,
      'team' as type,
      ts.rank,
      ts.per_person as amount,
      t.name as team_name,
      s.session_date,
      s.id as session_id
    FROM team_settlements ts
    JOIN settlements st ON ts.settlement_id = st.id
    JOIN sessions s ON st.session_id = s.id
    JOIN teams t ON ts.team_id = t.id
    JOIN team_members tm ON t.id = tm.team_id
    WHERE tm.player_id = ?
      AND st.status = 'completed'
    ORDER BY s.session_date DESC
  `).bind(player.id).all()

  // MVP 정산 이력
  const mvpHistory = await c.env.DB.prepare(`
    SELECT
      ps.id,
      'mvp' as type,
      ps.prize_amount as amount,
      s.session_date,
      s.id as session_id
    FROM player_settlements ps
    JOIN settlements st ON ps.settlement_id = st.id
    JOIN sessions s ON st.session_id = s.id
    WHERE ps.player_id = ?
      AND ps.prize_type = 'mvp'
      AND st.status = 'completed'
    ORDER BY s.session_date DESC
  `).bind(player.id).all()

  // 합치고 날짜순 정렬
  const allHistory = [
    ...teamHistory.results.map((h: any) => ({
      ...h,
      sessionDate: h.session_date,
      sessionId: h.session_id,
      teamName: h.team_name,
    })),
    ...mvpHistory.results.map((h: any) => ({
      ...h,
      sessionDate: h.session_date,
      sessionId: h.session_id,
    })),
  ].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))

  return c.json({ history: allHistory })
})

// 전체 정산 리더보드
settlementsRoutes.get('/leaderboard', async (c) => {
  const year = Number(c.req.query('year')) || new Date().getFullYear()
  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`

  // 팀 정산에서 개인별 수익 집계
  const teamEarnings = await c.env.DB.prepare(`
    SELECT
      p.id as player_id,
      p.name as player_name,
      p.nickname,
      p.photo_url,
      SUM(ts.per_person) as team_earnings,
      COUNT(DISTINCT s.id) as sessions_count
    FROM players p
    JOIN team_members tm ON p.id = tm.player_id
    JOIN teams t ON tm.team_id = t.id
    JOIN team_settlements ts ON t.id = ts.team_id
    JOIN settlements st ON ts.settlement_id = st.id
    JOIN sessions s ON st.session_id = s.id
    WHERE s.session_date BETWEEN ? AND ?
      AND st.status = 'completed'
    GROUP BY p.id
  `).bind(startDate, endDate).all()

  // MVP 상금 집계
  const mvpEarnings = await c.env.DB.prepare(`
    SELECT
      ps.player_id,
      SUM(ps.prize_amount) as mvp_earnings,
      COUNT(*) as mvp_count
    FROM player_settlements ps
    JOIN settlements st ON ps.settlement_id = st.id
    JOIN sessions s ON st.session_id = s.id
    WHERE s.session_date BETWEEN ? AND ?
      AND ps.prize_type = 'mvp'
      AND st.status = 'completed'
    GROUP BY ps.player_id
  `).bind(startDate, endDate).all()

  // 합치기
  const mvpMap = new Map<number, any>()
  mvpEarnings.results.forEach((m: any) => {
    mvpMap.set(m.player_id, m)
  })

  const leaderboard = teamEarnings.results.map((player: any) => {
    const mvp = mvpMap.get(player.player_id) || { mvp_earnings: 0, mvp_count: 0 }
    return {
      playerId: player.player_id,
      name: player.player_name,
      nickname: player.nickname,
      photoUrl: player.photo_url,
      teamEarnings: player.team_earnings || 0,
      mvpEarnings: mvp.mvp_earnings || 0,
      totalEarnings: (player.team_earnings || 0) + (mvp.mvp_earnings || 0),
      sessionsCount: player.sessions_count,
      mvpCount: mvp.mvp_count || 0,
    }
  }).sort((a: any, b: any) => b.totalEarnings - a.totalEarnings)

  return c.json({ leaderboard, year })
})

export { settlementsRoutes }
