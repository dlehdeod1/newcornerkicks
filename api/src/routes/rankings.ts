import { Hono } from 'hono'
import type { Env } from '../index'
import { authMiddleware } from '../middleware/auth'

const rankingsRoutes = new Hono<{ Bindings: Env }>()

// 랭킹 조회 (캐시) + 통계 데이터 포함
rankingsRoutes.get('/', async (c) => {
  const year = Number(c.req.query('year')) || new Date().getFullYear()
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  // 캐시된 랭킹 데이터
  const cache = await c.env.DB.prepare(`
    SELECT * FROM rankings_cache WHERE year = ?
  `).bind(year).first()

  let rankings: any[] = []
  if (cache) {
    rankings = JSON.parse(cache.data as string)
  }

  // 실시간 통계 데이터 계산
  const totalPlayers = rankings.filter((p: any) => p.attendance > 0).length
  const totalGoals = rankings.reduce((sum: number, p: any) => sum + (p.goals || 0), 0)
  const totalAssists = rankings.reduce((sum: number, p: any) => sum + (p.assists || 0), 0)
  const totalDefenses = rankings.reduce((sum: number, p: any) => sum + (p.defenses || 0), 0)

  // 세션 수
  const sessionCount = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM sessions WHERE session_date BETWEEN ? AND ?
  `).bind(yearStart, yearEnd).first()

  // 경기 수
  const matchCount = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM matches m
    JOIN sessions s ON m.session_id = s.id
    WHERE s.session_date BETWEEN ? AND ?
  `).bind(yearStart, yearEnd).first()

  // 세션당 평균 참석자 수 계산
  const avgAttendanceResult = await c.env.DB.prepare(`
    SELECT AVG(att_count) as avg FROM (
      SELECT session_id, COUNT(*) as att_count FROM attendance a
      JOIN sessions s ON a.session_id = s.id
      WHERE s.session_date BETWEEN ? AND ?
      GROUP BY session_id
    )
  `).bind(yearStart, yearEnd).first()

  // 평균 계산
  const totalSessions = (sessionCount?.count as number) || 0
  const totalMatches = (matchCount?.count as number) || 0
  const avgGoalsPerMatch = totalMatches > 0 ? totalGoals / totalMatches : 0
  const avgAttendancePerSession = (avgAttendanceResult?.avg as number) || 0

  // 랭킹별 정렬
  const goalRanking = [...rankings].sort((a, b) => (b.goals || 0) - (a.goals || 0)).filter(p => p.goals > 0)
  const assistRanking = [...rankings].sort((a, b) => (b.assists || 0) - (a.assists || 0)).filter(p => p.assists > 0)
  const defenseRanking = [...rankings].sort((a, b) => (b.defenses || 0) - (a.defenses || 0)).filter(p => p.defenses > 0)
  const attendanceRanking = [...rankings].sort((a, b) => (b.attendance || 0) - (a.attendance || 0)).filter(p => p.attendance > 0)
  const winRateRanking = [...rankings]
    .filter(p => p.games >= 5) // 최소 5경기 이상
    .sort((a, b) => (b.winRate || 0) - (a.winRate || 0))
  // MVP 랭킹: mvpCount 기준 (MVP 선정 횟수)
  const mvpRanking = [...rankings].sort((a, b) => (b.mvpCount || 0) - (a.mvpCount || 0)).filter(p => p.mvpCount > 0)

  return c.json({
    data: {
      rankings,
      totalPlayers,
      totalGoals,
      totalAssists,
      totalDefenses,
      totalSessions,
      totalMatches,
      avgGoalsPerMatch,
      avgAttendancePerSession,
      goalRanking,
      assistRanking,
      defenseRanking,
      attendanceRanking,
      winRateRanking,
      mvpRanking,
    },
    updatedAt: cache?.updated_at || null,
    updatedBy: cache?.updated_by || null,
  })
})

// 랭킹 새로고침 (관리자)
rankingsRoutes.post('/refresh', authMiddleware('ADMIN'), async (c) => {
  const year = Number(c.req.query('year')) || new Date().getFullYear()
  const userId = (c as any).userId

  // 해당 연도 세션 조회
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  // 선수별 통계 집계
  const rankings = await c.env.DB.prepare(`
    SELECT
      p.id,
      p.name,
      COUNT(DISTINCT pms.match_id) as games,
      COALESCE(SUM(pms.goals), 0) as goals,
      COALESCE(SUM(pms.assists), 0) as assists,
      COALESCE(SUM(pms.blocks), 0) as defenses,
      (SELECT COUNT(*) FROM attendance a
       JOIN sessions s ON a.session_id = s.id
       WHERE a.player_id = p.id AND s.session_date BETWEEN ? AND ?) as attendance
    FROM players p
    LEFT JOIN player_match_stats pms ON p.id = pms.player_id
    LEFT JOIN matches m ON pms.match_id = m.id
    LEFT JOIN sessions s ON m.session_id = s.id
    WHERE p.is_guest = 0
      AND (s.session_date IS NULL OR s.session_date BETWEEN ? AND ?)
    GROUP BY p.id
    ORDER BY goals DESC, assists DESC, defenses DESC
  `).bind(yearStart, yearEnd, yearStart, yearEnd).all()

  // 승/무/패 계산을 위한 추가 쿼리
  const enrichedRankings = await Promise.all(
    rankings.results.map(async (player: any) => {
      // 승/무/패 계산 (team_members 기준 - 실제 참여 경기)
      const matchResults = await c.env.DB.prepare(`
        SELECT
          COUNT(*) as total_games,
          SUM(CASE
            WHEN (tm.team_id = m.team1_id AND m.team1_score > m.team2_score) OR
                 (tm.team_id = m.team2_id AND m.team2_score > m.team1_score)
            THEN 1 ELSE 0 END) as wins,
          SUM(CASE
            WHEN m.team1_score = m.team2_score THEN 1 ELSE 0 END) as draws,
          SUM(CASE
            WHEN (tm.team_id = m.team1_id AND m.team1_score < m.team2_score) OR
                 (tm.team_id = m.team2_id AND m.team2_score < m.team1_score)
            THEN 1 ELSE 0 END) as losses
        FROM team_members tm
        JOIN matches m ON (tm.team_id = m.team1_id OR tm.team_id = m.team2_id)
        JOIN sessions s ON m.session_id = s.id
        WHERE tm.player_id = ?
          AND m.status = 'completed'
          AND s.session_date BETWEEN ? AND ?
      `).bind(player.id, yearStart, yearEnd).first()

      const totalGames = (matchResults?.total_games as number) || 0
      const wins = (matchResults?.wins as number) || 0
      const draws = (matchResults?.draws as number) || 0
      const losses = (matchResults?.losses as number) || 0
      const points = wins * 3 + draws * 1

      // 세션별 우승 횟수 계산 (승점 1등 팀 소속 횟수)
      const sessionWinsResult = await c.env.DB.prepare(`
        WITH team_standings AS (
          SELECT
            t.session_id,
            t.id as team_id,
            SUM(CASE
              WHEN (t.id = m.team1_id AND m.team1_score > m.team2_score) OR
                   (t.id = m.team2_id AND m.team2_score > m.team1_score)
              THEN 3
              WHEN m.team1_score = m.team2_score THEN 1
              ELSE 0
            END) as points,
            SUM(CASE
              WHEN t.id = m.team1_id THEN m.team1_score
              ELSE m.team2_score
            END) as goals_for
          FROM teams t
          JOIN matches m ON t.id = m.team1_id OR t.id = m.team2_id
          JOIN sessions s ON t.session_id = s.id
          WHERE s.session_date BETWEEN ? AND ? AND m.status = 'completed'
          GROUP BY t.session_id, t.id
        ),
        winning_teams AS (
          SELECT ts.session_id, ts.team_id
          FROM team_standings ts
          WHERE (ts.session_id, ts.points, ts.goals_for) IN (
            SELECT session_id, MAX(points), MAX(goals_for)
            FROM team_standings
            GROUP BY session_id
          )
        )
        SELECT COUNT(*) as session_wins
        FROM winning_teams wt
        JOIN team_members tm ON wt.team_id = tm.team_id
        WHERE tm.player_id = ?
      `).bind(yearStart, yearEnd, player.id).first()
      const sessionWins = (sessionWinsResult?.session_wins as number) || 0

      // MVP 점수 계산 (골*2 + 어시*1 + 수비*0.5 + 우승*1.5)
      const mvpScore = player.goals * 2 + player.assists * 1 + player.defenses * 0.5 + sessionWins * 1.5

      // PPM (Points Per Match) - team_members 기준 게임 수 사용
      const ppm = totalGames > 0 ? (points / totalGames).toFixed(2) : '0.00'

      // 세션 우승률 = 세션 우승 횟수 / 출석 횟수
      const winRate = player.attendance > 0 ? ((sessionWins / player.attendance) * 100).toFixed(1) : '0.0'

      // 1등, 2등, 3등 횟수 (팀 순위 기준)
      const placementResults = await c.env.DB.prepare(`
        SELECT
          SUM(CASE WHEN t.rank = 1 THEN 1 ELSE 0 END) as rank1,
          SUM(CASE WHEN t.rank = 2 THEN 1 ELSE 0 END) as rank2,
          SUM(CASE WHEN t.rank = 3 THEN 1 ELSE 0 END) as rank3
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        JOIN sessions s ON t.session_id = s.id
        WHERE tm.player_id = ?
          AND t.rank IS NOT NULL
          AND s.session_date BETWEEN ? AND ?
      `).bind(player.id, yearStart, yearEnd).first()

      // MVP 횟수 조회 (세션 MVP 투표 결과)
      const mvpCountResult = await c.env.DB.prepare(`
        SELECT COUNT(*) as mvp_count
        FROM session_mvp_results smr
        JOIN sessions s ON smr.session_id = s.id
        WHERE smr.player_id = ?
          AND s.session_date BETWEEN ? AND ?
      `).bind(player.id, yearStart, yearEnd).first()
      const mvpCount = (mvpCountResult?.mvp_count as number) || 0

      return {
        id: player.id,
        name: player.name,
        games: totalGames, // team_members 기준 실제 경기 수
        goals: player.goals,
        assists: player.assists,
        defenses: player.defenses,
        wins,
        draws,
        losses,
        points,
        ppm: parseFloat(ppm),
        winRate: parseFloat(winRate),
        attendance: player.attendance,
        sessionWins, // 세션 우승 횟수
        rank1: placementResults?.rank1 || 0,
        rank2: placementResults?.rank2 || 0,
        rank3: placementResults?.rank3 || 0,
        mvpScore,
        mvpCount, // MVP 횟수 추가
      }
    })
  )

  // 정렬 (MVP 점수 기준)
  enrichedRankings.sort((a, b) => b.mvpScore - a.mvpScore)

  // 캐시 저장
  const now = new Date().toISOString()

  await c.env.DB.prepare(`
    INSERT OR REPLACE INTO rankings_cache (id, data, updated_at, updated_by, year)
    VALUES (?, ?, ?, ?, ?)
  `).bind(year, JSON.stringify(enrichedRankings), now, userId || 'admin', year).run()

  return c.json({
    message: '랭킹이 갱신되었습니다.',
    rankings: enrichedRankings,
    updatedAt: now,
  })
})

// MVP 데이터 백필 (기존 완료된 세션에 대해)
rankingsRoutes.post('/backfill-mvp', authMiddleware('ADMIN'), async (c) => {
  const year = Number(c.req.query('year')) || new Date().getFullYear()
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  // 완료된 세션 조회 (MVP가 아직 없는 것) - closed 또는 completed 상태
  const sessionsWithoutMvp = await c.env.DB.prepare(`
    SELECT s.id, s.session_date, s.title
    FROM sessions s
    WHERE s.status IN ('completed', 'closed')
      AND s.session_date BETWEEN ? AND ?
      AND s.id NOT IN (SELECT session_id FROM session_mvp_results)
    ORDER BY s.session_date
  `).bind(yearStart, yearEnd).all()

  const results: any[] = []

  for (const session of sessionsWithoutMvp.results as any[]) {
    // 해당 세션의 팀 조회
    const teams = await c.env.DB.prepare(`
      SELECT id FROM teams WHERE session_id = ?
    `).bind(session.id).all()

    const teamIds = (teams.results as any[]).map(t => t.id)
    if (teamIds.length === 0) continue

    // 해당 세션의 완료된 경기 조회
    const matches = await c.env.DB.prepare(`
      SELECT * FROM matches WHERE session_id = ? AND status = 'completed'
    `).bind(session.id).all()

    if (matches.results.length === 0) continue

    // 팀별 승점 계산
    const teamStandings = new Map<number, { points: number; goalsFor: number; members: number[] }>()

    for (const teamId of teamIds) {
      const members = await c.env.DB.prepare(`
        SELECT player_id FROM team_members WHERE team_id = ? AND player_id IS NOT NULL
      `).bind(teamId).all()
      teamStandings.set(teamId, {
        points: 0,
        goalsFor: 0,
        members: (members.results as any[]).map(m => m.player_id)
      })
    }

    for (const match of matches.results as any[]) {
      const team1 = teamStandings.get(match.team1_id)
      const team2 = teamStandings.get(match.team2_id)

      if (team1 && team2) {
        team1.goalsFor += match.team1_score || 0
        team2.goalsFor += match.team2_score || 0

        if (match.team1_score > match.team2_score) {
          team1.points += 3
        } else if (match.team1_score < match.team2_score) {
          team2.points += 3
        } else {
          team1.points += 1
          team2.points += 1
        }
      }
    }

    // 우승팀 찾기 (승점 > 득점 순)
    const sortedTeams = Array.from(teamStandings.entries())
      .sort((a, b) => b[1].points - a[1].points || b[1].goalsFor - a[1].goalsFor)
    const winningTeamMembers = new Set(sortedTeams[0]?.[1]?.members || [])

    // 선수별 MVP 점수 계산
    const playerStats = new Map<number, {
      id: number
      name: string
      goals: number
      assists: number
      defenses: number
      mvpScore: number
    }>()

    // match_events에서 골/어시스트/수비 조회
    for (const match of matches.results as any[]) {
      const events = await c.env.DB.prepare(`
        SELECT * FROM match_events WHERE match_id = ?
      `).bind(match.id).all()

      for (const event of events.results as any[]) {
        // 용병 제외
        if (!event.player_id || event.guest_name) continue

        if (!playerStats.has(event.player_id)) {
          const player = await c.env.DB.prepare(`
            SELECT name FROM players WHERE id = ?
          `).bind(event.player_id).first()

          playerStats.set(event.player_id, {
            id: event.player_id,
            name: (player as any)?.name || 'Unknown',
            goals: 0,
            assists: 0,
            defenses: 0,
            mvpScore: 0,
          })
        }

        const stats = playerStats.get(event.player_id)!

        if (event.event_type === 'GOAL') {
          stats.goals++
          stats.mvpScore += 2
        } else if (event.event_type === 'DEFENSE') {
          stats.defenses++
          stats.mvpScore += 0.5
        }

        // 어시스트
        if (event.assister_id && event.event_type === 'GOAL' && !event.assister_guest_name) {
          if (!playerStats.has(event.assister_id)) {
            const assister = await c.env.DB.prepare(`
              SELECT name FROM players WHERE id = ?
            `).bind(event.assister_id).first()

            playerStats.set(event.assister_id, {
              id: event.assister_id,
              name: (assister as any)?.name || 'Unknown',
              goals: 0,
              assists: 0,
              defenses: 0,
              mvpScore: 0,
            })
          }
          const assisterStats = playerStats.get(event.assister_id)!
          assisterStats.assists++
          assisterStats.mvpScore += 1
        }
      }
    }

    // 우승팀 멤버에게 1.5점 보너스
    playerStats.forEach((stats, playerId) => {
      if (winningTeamMembers.has(playerId)) {
        stats.mvpScore += 1.5
      }
    })

    // MVP 선정 (최고 점수)
    const sortedPlayers = Array.from(playerStats.values()).sort((a, b) => b.mvpScore - a.mvpScore)
    const mvp = sortedPlayers[0]

    if (mvp) {
      const now = new Date().toISOString()

      // session_mvp_results에 저장
      await c.env.DB.prepare(`
        INSERT INTO session_mvp_results (session_id, player_id, vote_count, decided_at)
        VALUES (?, ?, 0, ?)
      `).bind(session.id, mvp.id, now).run()

      results.push({
        sessionId: session.id,
        sessionDate: session.session_date,
        mvpId: mvp.id,
        mvpName: mvp.name,
        mvpScore: mvp.mvpScore,
        stats: { goals: mvp.goals, assists: mvp.assists, defenses: mvp.defenses }
      })
    }
  }

  return c.json({
    message: `${results.length}개 세션의 MVP를 백필했습니다.`,
    results,
  })
})

// 명예의 전당
rankingsRoutes.get('/hall-of-fame', async (c) => {
  // 시즌별로 25세션 이상 참석 + 각 지표 1등 조회
  const years = await c.env.DB.prepare(`
    SELECT DISTINCT year FROM rankings_cache ORDER BY year DESC
  `).all()

  const hallOfFame = []

  for (const yearRow of years.results as any[]) {
    const year = yearRow.year
    const cache = await c.env.DB.prepare(`
      SELECT data FROM rankings_cache WHERE year = ?
    `).bind(year).first()

    if (!cache) continue

    const rankings = JSON.parse(cache.data as string)

    // 25세션 이상 필터
    const qualified = rankings.filter((p: any) => p.attendance >= 25)

    if (qualified.length === 0) continue

    // 각 부문 1등 찾기
    const categories = [
      { key: 'goals', name: '득점왕', icon: '⚽' },
      { key: 'assists', name: '도움왕', icon: '🅰️' },
      { key: 'defenses', name: '수비왕', icon: '🛡️' },
      { key: 'mvpScore', name: 'MVP', icon: '🏆' },
      { key: 'winRate', name: '승률왕', icon: '📈' },
      { key: 'attendance', name: '출석왕', icon: '📅' },
    ]

    const yearHonors = []

    for (const cat of categories) {
      const sorted = [...qualified].sort((a, b) => b[cat.key] - a[cat.key])
      if (sorted.length > 0 && sorted[0][cat.key] > 0) {
        yearHonors.push({
          category: cat.name,
          icon: cat.icon,
          player: {
            id: sorted[0].id,
            name: sorted[0].name,
          },
          value: sorted[0][cat.key],
        })
      }
    }

    hallOfFame.push({
      year,
      honors: yearHonors,
    })
  }

  return c.json({ hallOfFame })
})

export { rankingsRoutes }
