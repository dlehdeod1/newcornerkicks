import { getSeasonDateRange, getClubSeasonStartMonth } from './season'

export interface StreakResult {
  current: { type: string; count: number }
  best: { type: string; count: number; period: string }
  attendance: { current: number; best: number }
  scoring: { current: number; best: number }
}

export async function computeStreaks(
  db: D1Database, playerId: number, clubId: number, year: number
): Promise<StreakResult> {
  const startMonth = await getClubSeasonStartMonth(db, clubId)
  const { yearStart, yearEnd } = getSeasonDateRange(year, startMonth)

  // 1. Get match results for the player
  const matchResults = await db.prepare(`
    SELECT s.id as session_id, s.session_date,
      CASE WHEN (m.team1_id = t.id AND m.team1_score > m.team2_score) OR (m.team2_id = t.id AND m.team2_score > m.team1_score) THEN 'win'
           WHEN m.team1_score = m.team2_score THEN 'draw' ELSE 'loss' END as result,
      (SELECT COUNT(*) FROM match_events me WHERE me.match_id = m.id AND me.player_id = ? AND me.event_type = 'GOAL') as goals
    FROM team_members tm
    JOIN teams t ON tm.team_id = t.id
    JOIN sessions s ON t.session_id = s.id
    JOIN matches m ON m.session_id = s.id AND (m.team1_id = t.id OR m.team2_id = t.id)
    WHERE tm.player_id = ? AND s.club_id = ? AND s.status IN ('completed', 'closed')
      AND s.session_date >= ? AND s.session_date <= ? AND m.status = 'completed'
    ORDER BY s.session_date ASC
  `).bind(playerId, playerId, clubId, yearStart, yearEnd).all()

  const rows = matchResults.results as any[]

  // 2. Win streak
  const winStreak = computeConsecutiveStreak(rows, r => r.result === 'win')

  // 3. Scoring streak
  const scoringStreak = computeConsecutiveStreak(rows, r => r.goals > 0)

  // 4. Attendance streak
  const allSessions = await db.prepare(`
    SELECT id FROM sessions WHERE club_id = ? AND status IN ('completed', 'closed')
      AND session_date >= ? AND session_date <= ? ORDER BY session_date ASC
  `).bind(clubId, yearStart, yearEnd).all()

  const allSessionIds = (allSessions.results as any[]).map(s => s.id)

  let attendedSet = new Set<number>()
  if (allSessionIds.length > 0) {
    const placeholders = allSessionIds.map(() => '?').join(',')
    const attended = await db.prepare(`
      SELECT session_id FROM attendance WHERE player_id = ? AND session_id IN (${placeholders})
    `).bind(playerId, ...allSessionIds).all()
    attendedSet = new Set((attended.results as any[]).map(a => a.session_id))
  }

  let attCurrent = 0
  let attBest = 0
  let attStreak = 0
  for (const sid of allSessionIds) {
    if (attendedSet.has(sid)) {
      attStreak++
      if (attStreak > attBest) attBest = attStreak
    } else {
      attStreak = 0
    }
  }
  // Current streak: count from end
  attCurrent = 0
  for (let i = allSessionIds.length - 1; i >= 0; i--) {
    if (attendedSet.has(allSessionIds[i])) {
      attCurrent++
    } else {
      break
    }
  }

  return {
    current: winStreak.current,
    best: winStreak.best,
    attendance: { current: attCurrent, best: attBest },
    scoring: { current: scoringStreak.current.count, best: scoringStreak.best.count },
  }
}

function computeConsecutiveStreak(
  rows: any[],
  predicate: (row: any) => boolean
): { current: { type: string; count: number }; best: { type: string; count: number; period: string } } {
  let bestCount = 0
  let bestStart = ''
  let bestEnd = ''
  let streak = 0
  let streakStart = ''

  for (const row of rows) {
    if (predicate(row)) {
      if (streak === 0) streakStart = row.session_date
      streak++
      if (streak > bestCount) {
        bestCount = streak
        bestStart = streakStart
        bestEnd = row.session_date
      }
    } else {
      streak = 0
    }
  }

  // Current streak: count from end
  let currentCount = 0
  for (let i = rows.length - 1; i >= 0; i--) {
    if (predicate(rows[i])) {
      currentCount++
    } else {
      break
    }
  }

  const period = bestStart && bestEnd ? `${bestStart} ~ ${bestEnd}` : ''

  return {
    current: { type: 'win', count: currentCount },
    best: { type: 'win', count: bestCount, period },
  }
}
