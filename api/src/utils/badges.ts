import { computeStreaks } from './streaks'
import { getSeasonDateRange, getClubSeasonStartMonth, getCurrentSeasonYear } from './season'

/**
 * Check all badge conditions for a player and award any newly earned badges.
 * Returns array of newly awarded badge codes.
 */
export async function checkAndAwardBadges(
  db: D1Database, playerId: number, clubId: number, sessionId: number
): Promise<string[]> {
  // 1. Get all badge definitions
  const allBadges = await db.prepare('SELECT code, condition_type, threshold FROM badges').all()
  const badgeDefs = allBadges.results as any[]

  // 2. Get already earned badges for this player
  const earned = await db.prepare(
    'SELECT badge_code FROM player_badges WHERE player_id = ?'
  ).bind(playerId).all()
  const earnedSet = new Set((earned.results as any[]).map((b: any) => b.badge_code))

  // 3. Filter to only un-earned badges
  const toCheck = badgeDefs.filter(b => !earnedSet.has(b.code))
  if (toCheck.length === 0) return []

  const now = Math.floor(Date.now() / 1000)
  const newBadges: string[] = []

  for (const badge of toCheck) {
    let met = false
    try {
      met = await checkBadgeCondition(db, badge.code, playerId, clubId, sessionId)
    } catch (e) {
      console.error(`Badge check failed for ${badge.code}:`, e)
      continue
    }

    if (met) {
      await db.prepare(
        'INSERT OR IGNORE INTO player_badges (player_id, badge_code, earned_at) VALUES (?, ?, ?)'
      ).bind(playerId, badge.code, now).run()
      newBadges.push(badge.code)
    }
  }

  return newBadges
}

async function checkBadgeCondition(
  db: D1Database, code: string, playerId: number, clubId: number, sessionId: number
): Promise<boolean> {
  switch (code) {
    case 'FIRST_GOAL': {
      const row = await db.prepare(
        `SELECT COUNT(*) as cnt FROM match_events WHERE player_id = ? AND event_type = 'GOAL'`
      ).bind(playerId).first<any>()
      return (row?.cnt || 0) >= 1
    }

    case 'HAT_TRICK': {
      // Check if player has >=3 goals in any single match within the latest session
      const row = await db.prepare(`
        SELECT MAX(goal_count) as max_goals FROM (
          SELECT me.match_id, COUNT(*) as goal_count
          FROM match_events me
          JOIN matches m ON me.match_id = m.id
          WHERE me.player_id = ? AND me.event_type = 'GOAL' AND m.session_id = ?
          GROUP BY me.match_id
        )
      `).bind(playerId, sessionId).first<any>()
      return (row?.max_goals || 0) >= 3
    }

    case 'FIRST_ASSIST': {
      const row = await db.prepare(
        `SELECT COUNT(*) as cnt FROM match_events WHERE assist_player_id = ? AND event_type = 'GOAL'`
      ).bind(playerId).first<any>()
      return (row?.cnt || 0) >= 1
    }

    case 'DEFENSE_KING': {
      // >=5 defense events in a single match (check latest session)
      const row = await db.prepare(`
        SELECT MAX(def_count) as max_defs FROM (
          SELECT me.match_id, COUNT(*) as def_count
          FROM match_events me
          JOIN matches m ON me.match_id = m.id
          WHERE me.player_id = ? AND me.event_type IN ('DEFENSE', 'TACKLE', 'INTERCEPTION', 'CLEARANCE')
            AND m.session_id = ?
          GROUP BY me.match_id
        )
      `).bind(playerId, sessionId).first<any>()
      return (row?.max_defs || 0) >= 5
    }

    case 'ALL_ROUNDER': {
      // In the given session: at least 1 goal + 1 assist + 1 defense event
      const goals = await db.prepare(`
        SELECT COUNT(*) as cnt FROM match_events me
        JOIN matches m ON me.match_id = m.id
        WHERE me.player_id = ? AND me.event_type = 'GOAL' AND m.session_id = ?
      `).bind(playerId, sessionId).first<any>()

      const assists = await db.prepare(`
        SELECT COUNT(*) as cnt FROM match_events me
        JOIN matches m ON me.match_id = m.id
        WHERE me.assist_player_id = ? AND me.event_type = 'GOAL' AND m.session_id = ?
      `).bind(playerId, sessionId).first<any>()

      const defenses = await db.prepare(`
        SELECT COUNT(*) as cnt FROM match_events me
        JOIN matches m ON me.match_id = m.id
        WHERE me.player_id = ? AND me.event_type IN ('DEFENSE', 'TACKLE', 'INTERCEPTION', 'CLEARANCE')
          AND m.session_id = ?
      `).bind(playerId, sessionId).first<any>()

      return (goals?.cnt || 0) >= 1 && (assists?.cnt || 0) >= 1 && (defenses?.cnt || 0) >= 1
    }

    case 'MATCH_10':
    case 'MATCH_50':
    case 'MATCH_100': {
      const threshold = code === 'MATCH_10' ? 10 : code === 'MATCH_50' ? 50 : 100
      const row = await db.prepare(`
        SELECT COUNT(DISTINCT m.id) as cnt
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        JOIN matches m ON m.session_id = t.session_id AND (m.team1_id = t.id OR m.team2_id = t.id)
        JOIN sessions s ON t.session_id = s.id
        WHERE tm.player_id = ? AND s.club_id = ?
      `).bind(playerId, clubId).first<any>()
      return (row?.cnt || 0) >= threshold
    }

    case 'WIN_STREAK_3':
    case 'WIN_STREAK_5': {
      const threshold = code === 'WIN_STREAK_3' ? 3 : 5
      const seasonStartMonth = await getClubSeasonStartMonth(db, clubId)
      const year = getCurrentSeasonYear(seasonStartMonth)
      const streaks = await computeStreaks(db, playerId, clubId, year)
      return streaks.current.count >= threshold
    }

    case 'SCORING_STREAK_3': {
      const seasonStartMonth = await getClubSeasonStartMonth(db, clubId)
      const year = getCurrentSeasonYear(seasonStartMonth)
      const streaks = await computeStreaks(db, playerId, clubId, year)
      return streaks.scoring.current >= 3
    }

    case 'MVP': {
      const row = await db.prepare(
        'SELECT COUNT(*) as cnt FROM session_mvp_results WHERE player_id = ?'
      ).bind(playerId).first<any>()
      return (row?.cnt || 0) >= 1
    }

    case 'MVP_3': {
      const row = await db.prepare(
        'SELECT COUNT(*) as cnt FROM session_mvp_results WHERE player_id = ?'
      ).bind(playerId).first<any>()
      return (row?.cnt || 0) >= 3
    }

    case 'ATTENDANCE_90': {
      const seasonStartMonth = await getClubSeasonStartMonth(db, clubId)
      const year = getCurrentSeasonYear(seasonStartMonth)
      const { yearStart, yearEnd } = getSeasonDateRange(year, seasonStartMonth)

      const totalSessions = await db.prepare(`
        SELECT COUNT(*) as cnt FROM sessions
        WHERE club_id = ? AND status IN ('completed', 'closed')
          AND session_date >= ? AND session_date <= ?
      `).bind(clubId, yearStart, yearEnd).first<any>()

      const total = totalSessions?.cnt || 0
      if (total < 5) return false // minimum sessions to qualify

      const attended = await db.prepare(`
        SELECT COUNT(*) as cnt FROM attendance a
        JOIN sessions s ON a.session_id = s.id
        WHERE a.player_id = ? AND s.club_id = ?
          AND s.status IN ('completed', 'closed')
          AND s.session_date >= ? AND s.session_date <= ?
      `).bind(playerId, clubId, yearStart, yearEnd).first<any>()

      const rate = (attended?.cnt || 0) / total
      return rate >= 0.9
    }

    default:
      return false
  }
}
