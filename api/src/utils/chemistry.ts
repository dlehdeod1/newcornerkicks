/**
 * Chemistry score calculation utility.
 *
 * Precomputes pairwise chemistry between non-guest players and stores results
 * in `player_chemistry_cache`. Called during ranking refresh so the heavy SQL
 * work runs once rather than on every read.
 */

export async function refreshChemistryCache(db: D1Database, clubId: number) {
  // 1. Get all non-guest players for the club
  const playersResult = await db.prepare(
    `SELECT id FROM players WHERE club_id = ? AND is_guest = 0`
  ).bind(clubId).all()
  const playerIds = (playersResult.results as any[]).map(p => p.id)

  if (playerIds.length < 2) return

  // 2. Load preferences
  const prefsResult = await db.prepare(
    `SELECT player_id, target_player_id FROM player_preferences WHERE player_id IN (SELECT id FROM players WHERE club_id = ?)`
  ).bind(clubId).all()

  const prefSet = new Set<string>()
  for (const pref of prefsResult.results as any[]) {
    prefSet.add(`${pref.player_id}-${pref.target_player_id}`)
  }

  // 3. Load team membership + match results for completed/closed sessions
  const teamDataResult = await db.prepare(`
    SELECT tm.player_id, t.id as team_id, t.session_id, m.id as match_id,
           m.team1_id, m.team2_id, m.team1_score, m.team2_score
    FROM team_members tm
    JOIN teams t ON tm.team_id = t.id
    JOIN sessions s ON t.session_id = s.id
    LEFT JOIN matches m ON m.session_id = s.id AND (m.team1_id = t.id OR m.team2_id = t.id)
    WHERE s.club_id = ? AND s.status IN ('completed', 'closed') AND m.status = 'completed'
  `).bind(clubId).all()

  // Build lookup: matchId -> teamId -> [playerIds]
  const matchTeamPlayers = new Map<number, Map<number, number[]>>()
  // matchId -> teamId -> won (boolean)
  const matchTeamWon = new Map<number, Map<number, boolean>>()

  for (const row of teamDataResult.results as any[]) {
    if (!row.match_id) continue

    if (!matchTeamPlayers.has(row.match_id)) {
      matchTeamPlayers.set(row.match_id, new Map())
    }
    const teamMap = matchTeamPlayers.get(row.match_id)!
    if (!teamMap.has(row.team_id)) {
      teamMap.set(row.team_id, [])
    }
    teamMap.get(row.team_id)!.push(row.player_id)

    // Determine win
    if (!matchTeamWon.has(row.match_id)) {
      matchTeamWon.set(row.match_id, new Map())
    }
    const wonMap = matchTeamWon.get(row.match_id)!
    if (!wonMap.has(row.team_id)) {
      const isTeam1 = row.team_id === row.team1_id
      const won = isTeam1
        ? row.team1_score > row.team2_score
        : row.team2_score > row.team1_score
      wonMap.set(row.team_id, won)
    }
  }

  // 4. Load assists (GOAL events with assister_id)
  const assistsResult = await db.prepare(`
    SELECT me.player_id as scorer, me.assister_id
    FROM match_events me
    JOIN matches m ON me.match_id = m.id
    JOIN sessions s ON m.session_id = s.id
    WHERE s.club_id = ? AND me.event_type = 'GOAL' AND me.assister_id IS NOT NULL
  `).bind(clubId).all()

  // Build assist counts: "A-B" -> count (directional)
  const assistCounts = new Map<string, number>()
  for (const row of assistsResult.results as any[]) {
    const key = `${row.assister_id}-${row.scorer}`
    assistCounts.set(key, (assistCounts.get(key) || 0) + 1)
  }

  // 5. For each player pair, compute co-games, co-wins, assist links
  const playerIdSet = new Set(playerIds)

  // pairKey "minId-maxId" -> { coGames, coWins, assistLink }
  const pairStats = new Map<string, { coGames: number; coWins: number; assistLink: number; playerA: number; playerB: number }>()

  for (const [_matchId, teamMap] of matchTeamPlayers) {
    const wonMap = matchTeamWon.get(_matchId)!
    for (const [teamId, members] of teamMap) {
      // Filter to club players only
      const clubMembers = members.filter(id => playerIdSet.has(id))
      const won = wonMap.get(teamId) || false

      // For each pair on this team in this match
      for (let i = 0; i < clubMembers.length; i++) {
        for (let j = i + 1; j < clubMembers.length; j++) {
          const a = Math.min(clubMembers[i], clubMembers[j])
          const b = Math.max(clubMembers[i], clubMembers[j])
          const key = `${a}-${b}`

          if (!pairStats.has(key)) {
            pairStats.set(key, { coGames: 0, coWins: 0, assistLink: 0, playerA: a, playerB: b })
          }
          const stats = pairStats.get(key)!
          stats.coGames++
          if (won) stats.coWins++
        }
      }
    }
  }

  // Compute assist links for qualifying pairs
  for (const [key, stats] of pairStats) {
    const { playerA, playerB } = stats
    // A assisted B's goal + B assisted A's goal
    const aToB = assistCounts.get(`${playerA}-${playerB}`) || 0
    const bToA = assistCounts.get(`${playerB}-${playerA}`) || 0
    stats.assistLink = aToB + bToA
  }

  // 6. Delete existing cache for the club
  await db.prepare(`DELETE FROM player_chemistry_cache WHERE club_id = ?`).bind(clubId).run()

  // 7. Build insert statements for pairs with >= 5 co-games
  const statements: D1PreparedStatement[] = []

  for (const [_key, stats] of pairStats) {
    if (stats.coGames < 5) continue

    const { playerA, playerB, coGames, coWins, assistLink } = stats

    const winRate = (coWins / coGames) * 100
    const assistLinkScore = (assistLink / coGames) * 100

    // Preference bonus
    const aPrefsB = prefSet.has(`${playerA}-${playerB}`)
    const bPrefsA = prefSet.has(`${playerB}-${playerA}`)
    const prefBonus = (aPrefsB && bPrefsA) ? 100 : (aPrefsB || bPrefsA) ? 50 : 0

    const chemScore = winRate * 0.4 + assistLinkScore * 0.4 + prefBonus * 0.2
    const now = new Date().toISOString()

    // A -> B
    statements.push(
      db.prepare(
        `INSERT INTO player_chemistry_cache (club_id, player_id, partner_id, games_together, win_rate, assist_link, pref_bonus, chem_score, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(clubId, playerA, playerB, coGames, winRate, assistLinkScore, prefBonus, chemScore, now)
    )

    // B -> A
    statements.push(
      db.prepare(
        `INSERT INTO player_chemistry_cache (club_id, player_id, partner_id, games_together, win_rate, assist_link, pref_bonus, chem_score, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(clubId, playerB, playerA, coGames, winRate, assistLinkScore, prefBonus, chemScore, now)
    )
  }

  // 8. Batch insert (max 100 per batch)
  for (let i = 0; i < statements.length; i += 100) {
    const batch = statements.slice(i, i + 100)
    await db.batch(batch)
  }
}
