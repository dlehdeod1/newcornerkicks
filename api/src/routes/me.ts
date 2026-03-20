import { Hono } from 'hono'
import type { Env } from '../index'
import { authMiddleware } from '../middleware/auth'

const meRoutes = new Hono<{ Bindings: Env }>()

// 내 최근 세션 통계 조회
meRoutes.get('/stats', authMiddleware(), async (c) => {
  try {
    const userId = (c as any).userId

    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401)
    }

    // 연동된 선수 조회
    const player = await c.env.DB.prepare(
      'SELECT id, name FROM players WHERE user_id = ?'
    ).bind(userId).first()

    if (!player) {
      return c.json({
        stats: null,
        message: '선수 연동이 필요합니다',
      })
    }

    const playerId = player.id

    // 플레이어가 실제 기록이 있는 가장 최근 완료된 세션 조회
    const recentSession = await c.env.DB.prepare(`
      SELECT DISTINCT s.id, s.session_date, s.title FROM sessions s
      JOIN matches m ON m.session_id = s.id
      JOIN match_events me ON me.match_id = m.id
      WHERE s.status IN ('closed', 'completed')
        AND (me.player_id = ? OR (me.assister_id = ? AND me.event_type = 'GOAL'))
      ORDER BY s.session_date DESC
      LIMIT 1
    `).bind(playerId, playerId).first()

    if (!recentSession) {
      return c.json({
        stats: {
          goals: 0,
          assists: 0,
          defenses: 0,
          mvpScore: 0,
          sessionId: null,
          sessionDate: null,
          sessionTitle: null,
        },
      })
    }

    // 해당 세션에서 내 득점/수비 집계
    const statsQuery = await c.env.DB.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN me.event_type = 'GOAL' THEN 1 ELSE 0 END), 0) as goals,
        COALESCE(SUM(CASE WHEN me.event_type = 'DEFENSE' THEN 1 ELSE 0 END), 0) as defenses
      FROM match_events me
      JOIN matches m ON me.match_id = m.id
      WHERE m.session_id = ?
        AND me.player_id = ?
    `).bind(recentSession.id, playerId).first()

    // 해당 세션에서 내 어시스트 집계
    const assistQuery = await c.env.DB.prepare(`
      SELECT COUNT(*) as assists
      FROM match_events me
      JOIN matches m ON me.match_id = m.id
      WHERE m.session_id = ?
        AND me.assister_id = ?
        AND me.event_type = 'GOAL'
    `).bind(recentSession.id, playerId).first()

    const goals = Number(statsQuery?.goals) || 0
    const assists = Number(assistQuery?.assists) || 0
    const defenses = Number(statsQuery?.defenses) || 0
    // 우승팀 가점 조회 (rankings.ts와 동일 공식)
    const sessionWinResult = await c.env.DB.prepare(`
      WITH team_standings AS (
        SELECT t.id as team_id,
          SUM(CASE WHEN (t.id = m.team1_id AND m.team1_score > m.team2_score) OR (t.id = m.team2_id AND m.team2_score > m.team1_score) THEN 3 WHEN m.team1_score = m.team2_score THEN 1 ELSE 0 END) as points,
          SUM(CASE WHEN t.id = m.team1_id THEN m.team1_score ELSE m.team2_score END) as goals_for
        FROM teams t JOIN matches m ON t.id = m.team1_id OR t.id = m.team2_id
        WHERE t.session_id = ? AND m.status = 'completed' GROUP BY t.id
      ),
      winning_team AS (
        SELECT team_id FROM team_standings ORDER BY points DESC, goals_for DESC LIMIT 1
      )
      SELECT COUNT(*) as is_winner FROM winning_team wt
      JOIN team_members tm ON wt.team_id = tm.team_id
      WHERE tm.player_id = ?
    `).bind(recentSession.id, playerId).first()
    const sessionWinBonus = ((sessionWinResult?.is_winner as number) || 0) > 0 ? 1.5 : 0

    // rankings.ts와 동일 공식: goals*2 + assists*1.5 + defenses*0.5 + sessionWin*1.5
    const mvpScore = Math.round((goals * 2 + assists * 1.5 + defenses * 0.5 + sessionWinBonus) * 10) / 10

    return c.json({
      stats: {
        goals,
        assists,
        defenses,
        mvpScore,  // 원시 점수 (rankings.ts와 동일 공식)
        sessionId: recentSession.id,
        sessionDate: recentSession.session_date,
        sessionTitle: recentSession.title,
      },
    })
  } catch (err: any) {
    console.error('Me stats error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// 내 프로필 요약 (능력치 + 시즌 스탯 + 선호 선수)
meRoutes.get('/profile-summary', authMiddleware(), async (c) => {
  try {
    const userId = (c as any).userId
    const clubId = (c as any).clubId
    if (!clubId) return c.json({ error: '클럽에 소속되어 있지 않습니다.' }, 403)

    const player = await c.env.DB.prepare(
      'SELECT id, name, nickname, photo_url, height_cm, weight_kg, birth_year FROM players WHERE user_id = ? AND club_id = ?'
    ).bind(userId, clubId).first()

    if (!player) {
      return c.json({ player: null, abilities: null, seasonStats: null, preferences: [] })
    }

    const playerId = player.id as number

    // 능력치 평균
    const ratings = await c.env.DB.prepare(`
      SELECT
        AVG(shooting) as shooting, AVG(off_the_ball) as off_the_ball,
        AVG(ball_keeping) as ball_keeping, AVG(passing) as passing,
        AVG(linking_play) as linking_play, AVG(intercept) as intercept,
        AVG(marking) as marking, AVG(stamina) as stamina,
        AVG(speed) as speed, AVG(physical) as physical,
        COUNT(*) as rater_count
      FROM player_ratings WHERE player_id = ?
    `).bind(playerId).first()

    let abilities = null
    if (ratings && (ratings.rater_count as number) > 0) {
      const vals = [
        ratings.shooting, ratings.off_the_ball, ratings.ball_keeping,
        ratings.passing, ratings.linking_play, ratings.intercept,
        ratings.marking, ratings.stamina, ratings.speed, ratings.physical,
      ].map(v => Math.round(v as number))
      abilities = {
        shooting: vals[0], offTheBall: vals[1], ballKeeping: vals[2],
        passing: vals[3], linkingPlay: vals[4], intercept: vals[5],
        marking: vals[6], stamina: vals[7], speed: vals[8], physical: vals[9],
        overall: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
        raterCount: ratings.rater_count,
      }
    }

    // 시즌 스탯 (올해)
    const year = new Date().getFullYear()
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`

    const seasonStats = await c.env.DB.prepare(`
      SELECT
        COALESCE(SUM(pms.goals), 0) as goals,
        COALESCE(SUM(pms.assists), 0) as assists,
        COALESCE(SUM(pms.blocks), 0) as defenses,
        COUNT(DISTINCT pms.match_id) as games
      FROM player_match_stats pms
      JOIN matches m ON pms.match_id = m.id
      JOIN sessions s ON m.session_id = s.id
      WHERE pms.player_id = ? AND s.session_date BETWEEN ? AND ?
        AND s.status IN ('completed', 'closed')
    `).bind(playerId, yearStart, yearEnd).first()

    const attendance = await c.env.DB.prepare(`
      SELECT COUNT(*) as cnt FROM attendance a
      JOIN sessions s ON a.session_id = s.id
      WHERE a.player_id = ? AND s.session_date BETWEEN ? AND ? AND s.club_id = ?
    `).bind(playerId, yearStart, yearEnd, clubId).first()

    // 선호 선수
    const prefs = await c.env.DB.prepare(`
      SELECT pp.target_player_id as id, p.name, p.nickname, p.photo_url
      FROM player_preferences pp
      JOIN players p ON pp.target_player_id = p.id
      WHERE pp.player_id = ?
      ORDER BY pp.created_at ASC
    `).bind(playerId).all()

    return c.json({
      player: { id: playerId, name: player.name, nickname: player.nickname, photoUrl: player.photo_url, heightCm: player.height_cm, weightKg: player.weight_kg, birthYear: player.birth_year },
      abilities,
      seasonStats: {
        goals: seasonStats?.goals || 0,
        assists: seasonStats?.assists || 0,
        defenses: seasonStats?.defenses || 0,
        games: seasonStats?.games || 0,
        attendance: attendance?.cnt || 0,
        year,
      },
      preferences: prefs.results,
    })
  } catch (err: any) {
    console.error('Profile summary error:', err)
    return c.json({ error: err.message }, 500)
  }
})

export { meRoutes }
