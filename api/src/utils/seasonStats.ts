/**
 * 시즌 통계 공용 유틸 — 모든 엔드포인트가 이 함수를 통해 동일한 값을 반환
 * completed / closed 세션만 집계 (rankings 규칙과 동일)
 */

export interface SeasonSummaryStats {
  totalSessions: number
  totalMatches: number
  totalGoals: number
  totalAssists: number
  totalDefenses: number
  avgGoalsPerMatch: number
  avgAttendancePerSession: number
}

export async function getSeasonSummaryStats(
  db: any,
  clubId: number,
  yearStart: string,
  yearEnd: string,
): Promise<SeasonSummaryStats> {
  const [sessionsRow, matchesRow, goalsRow, assistsRow, defensesRow, avgAttRow] = await Promise.all([
    // 총 세션 수
    db.prepare(`
      SELECT COUNT(*) as cnt FROM sessions
      WHERE session_date BETWEEN ? AND ? AND club_id = ?
    `).bind(yearStart, yearEnd, clubId).first(),

    // 총 경기 수
    db.prepare(`
      SELECT COUNT(*) as cnt FROM matches m
      JOIN sessions s ON m.session_id = s.id
      WHERE s.session_date BETWEEN ? AND ? AND s.club_id = ?
    `).bind(yearStart, yearEnd, clubId).first(),

    // 총 골 (completed/closed만)
    db.prepare(`
      SELECT COALESCE(SUM(pms.goals), 0) as total FROM player_match_stats pms
      JOIN matches m ON pms.match_id = m.id
      JOIN sessions s ON m.session_id = s.id
      WHERE s.session_date BETWEEN ? AND ? AND s.club_id = ?
        AND s.status IN ('completed', 'closed')
    `).bind(yearStart, yearEnd, clubId).first(),

    // 총 어시스트 (completed/closed만)
    db.prepare(`
      SELECT COALESCE(SUM(pms.assists), 0) as total FROM player_match_stats pms
      JOIN matches m ON pms.match_id = m.id
      JOIN sessions s ON m.session_id = s.id
      WHERE s.session_date BETWEEN ? AND ? AND s.club_id = ?
        AND s.status IN ('completed', 'closed')
    `).bind(yearStart, yearEnd, clubId).first(),

    // 총 수비 (completed/closed만)
    db.prepare(`
      SELECT COALESCE(SUM(pms.blocks), 0) as total FROM player_match_stats pms
      JOIN matches m ON pms.match_id = m.id
      JOIN sessions s ON m.session_id = s.id
      WHERE s.session_date BETWEEN ? AND ? AND s.club_id = ?
        AND s.status IN ('completed', 'closed')
    `).bind(yearStart, yearEnd, clubId).first(),

    // 세션당 평균 참석자 수
    db.prepare(`
      SELECT AVG(att_count) as avg FROM (
        SELECT session_id, COUNT(*) as att_count FROM attendance a
        JOIN sessions s ON a.session_id = s.id
        WHERE s.session_date BETWEEN ? AND ? AND s.club_id = ?
        GROUP BY session_id
      )
    `).bind(yearStart, yearEnd, clubId).first(),
  ])

  const totalSessions = (sessionsRow?.cnt as number) || 0
  const totalMatches = (matchesRow?.cnt as number) || 0
  const totalGoals = (goalsRow?.total as number) || 0
  const totalAssists = (assistsRow?.total as number) || 0
  const totalDefenses = (defensesRow?.total as number) || 0
  const avgGoalsPerMatch = totalMatches > 0 ? totalGoals / totalMatches : 0
  const avgAttendancePerSession = (avgAttRow?.avg as number) || 0

  return {
    totalSessions,
    totalMatches,
    totalGoals,
    totalAssists,
    totalDefenses,
    avgGoalsPerMatch,
    avgAttendancePerSession,
  }
}
