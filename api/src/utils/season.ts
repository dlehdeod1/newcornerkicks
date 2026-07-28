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

export type RankingPeriod = 'full' | 'h1' | 'h2'

export function isRankingPeriod(v: unknown): v is RankingPeriod {
  return v === 'full' || v === 'h1' || v === 'h2'
}

// 상/하반기는 달력 고정(1~6월/7~12월), 연간(full)은 클럽 시즌 시작월 기준
export function getPeriodDateRange(year: number, period: RankingPeriod, seasonStartMonth: number): { yearStart: string; yearEnd: string } {
  if (period === 'h1') return { yearStart: `${year}-01-01`, yearEnd: `${year}-06-30` }
  if (period === 'h2') return { yearStart: `${year}-07-01`, yearEnd: `${year}-12-31` }
  return getSeasonDateRange(year, seasonStartMonth)
}

export function getCurrentSeasonYear(startMonth: number): number {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  if (startMonth <= 1) return currentYear
  return currentMonth >= startMonth ? currentYear : currentYear - 1
}
