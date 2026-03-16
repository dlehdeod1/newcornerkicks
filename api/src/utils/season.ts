export function getSeasonDateRange(year: number, startMonth: number): { yearStart: string; yearEnd: string } {
  if (startMonth <= 1) {
    return { yearStart: `${year}-01-01`, yearEnd: `${year}-12-31` }
  }
  const endMonth = startMonth - 1
  const endYear = year + 1
  const endDay = new Date(endYear, endMonth, 0).getDate()
  return {
    yearStart: `${year}-${String(startMonth).padStart(2, '0')}-01`,
    yearEnd: `${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
  }
}

export async function getClubSeasonStartMonth(db: D1Database, clubId: number): Promise<number> {
  const club = await db.prepare('SELECT season_start_month FROM clubs WHERE id = ?').bind(clubId).first<any>()
  return club?.season_start_month ?? 1
}

export function getCurrentSeasonYear(startMonth: number): number {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  if (startMonth <= 1) return currentYear
  return currentMonth >= startMonth ? currentYear : currentYear - 1
}
