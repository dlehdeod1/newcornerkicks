# 상/하반기 + 연간 랭킹·결산 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 랭킹을 연간(full)/상반기(h1)/하반기(h2) 단위로 조회하고, 웹 랭킹 페이지에 기간 필터와 시상식형 TOP3 결산 섹션을 추가한다.

**Architecture:** `rankings_cache`에 `period` 컬럼을 추가해 (club, year, period)별로 캐시한다. 기간 계산은 `getPeriodDateRange` 헬퍼 하나로 집중하고, 기존 집계 함수(`buildAndCacheRankings`, `getSeasonSummaryStats`)는 이미 날짜 범위를 인자로 받으므로 그대로 재사용한다. 웹은 기간 세그먼트 + 신규 `PeriodAwards` 컴포넌트(응답의 정렬 배열 슬라이스)로 구현한다.

**Tech Stack:** Hono + Cloudflare Workers + D1(SQLite), Next.js + TanStack Query

## Global Constraints

- period 값: `'full' | 'h1' | 'h2'`, 기본 `'full'` (하위호환 100% — period 미지정 요청은 기존과 동일 동작)
- h1 = `{year}-01-01 ~ {year}-06-30`, h2 = `{year}-07-01 ~ {year}-12-31` (달력 고정), full = 기존 `season_start_month` 로직
- API 에러 메시지는 한국어, 응답은 `{ data: T }` / `{ error: string }`
- 모든 쿼리에 `club_id` 조건 필수 (멀티테넌시)
- 웹: hex 하드코딩 금지, 시맨틱 클래스(`text-primary` 등), 다크/라이트 모두 확인
- API에는 단위테스트 프레임워크 없음 — 검증은 `npx tsc --noEmit` + 로컬 마이그레이션 + `wrangler dev` 수동 호출, 웹은 `npm run build`
- 승률왕 최소 5경기 조건은 기존 `winRateRanking` 필터 유지

---

### Task 1: DB 마이그레이션 (period 컬럼)

**Files:**
- Create: `api/migrations/0027_rankings_period.sql`
- Modify: `docs/migration-manifest.md`

**Interfaces:**
- Produces: `rankings_cache.period TEXT NOT NULL DEFAULT 'full'`, UNIQUE 인덱스 `(club_id, year, period)`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- rankings_cache에 기간(period) 추가: 'full'(연간) | 'h1'(상반기) | 'h2'(하반기)
ALTER TABLE rankings_cache ADD COLUMN period TEXT NOT NULL DEFAULT 'full';
CREATE UNIQUE INDEX IF NOT EXISTS idx_rankings_cache_club_year_period
  ON rankings_cache(club_id, year, period);
```

- [ ] **Step 2: manifest 갱신** — `docs/migration-manifest.md` 목록 끝에 추가 (누락돼 있던 0024도 함께):

```
0024_default_stats.sql       ← (기존 누락분 추가)
0027_rankings_period.sql     ← rankings_cache.period ('full'|'h1'|'h2') + UNIQUE(club_id,year,period)
```

- [ ] **Step 3: 로컬 적용 및 확인**

Run: `cd api; npm run db:migrate`
Expected: `0027_rankings_period.sql` 적용 성공
Run: `npx wrangler d1 execute conerkicks-db --local --command "PRAGMA table_info(rankings_cache)"`
Expected: `period` 컬럼 존재, dflt_value `'full'`

- [ ] **Step 4: Commit** — `git commit -m "feat(api): rankings_cache에 period 컬럼 추가 (상/하반기 캐시)"`

---

### Task 2: 기간 계산 헬퍼 (`season.ts`)

**Files:**
- Modify: `api/src/utils/season.ts`

**Interfaces:**
- Produces: `type RankingPeriod = 'full' | 'h1' | 'h2'`, `getPeriodDateRange(year: number, period: RankingPeriod, seasonStartMonth: number): { yearStart: string; yearEnd: string }`

- [ ] **Step 1: 파일 끝에 추가**

```typescript
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
```

- [ ] **Step 2: 타입 체크** — Run: `cd api; npx tsc --noEmit` / Expected: 에러 없음

- [ ] **Step 3: Commit** — `git commit -m "feat(api): getPeriodDateRange 헬퍼 — 달력 고정 반기 기간 계산"`

---

### Task 3: rankings API period 지원

**Files:**
- Modify: `api/src/routes/rankings.ts` — GET `/` (12-77행), POST `/refresh` (80-126행), hall-of-fame (165-232행), `buildAndCacheRankings` (677-683행)

**Interfaces:**
- Consumes: Task 2의 `RankingPeriod`, `isRankingPeriod`, `getPeriodDateRange`
- Produces: `GET /rankings?year&period`, `POST /rankings/refresh?year&period` — 응답 구조 변화 없음. `buildAndCacheRankings(db, clubId, year, yearStart, yearEnd, updatedBy, period = 'full')`

- [ ] **Step 1: import 교체** (5행)

```typescript
import { getSeasonDateRange, getClubSeasonStartMonth, getPeriodDateRange, isRankingPeriod, type RankingPeriod } from '../utils/season'
```
(참고: `getSeasonDateRange`는 fun-stats 외 다른 곳에서 계속 쓰이면 유지, 안 쓰이면 제거)

- [ ] **Step 2: GET `/` 핸들러** — period 파싱/검증 + 캐시 쿼리에 period 조건:

```typescript
  const year = Number(c.req.query('year')) || new Date().getFullYear()
  const periodParam = c.req.query('period') || 'full'
  if (!isRankingPeriod(periodParam)) {
    return c.json({ error: '올바르지 않은 기간입니다. (full/h1/h2)' }, 400)
  }
  const period: RankingPeriod = periodParam
  // ...
  const seasonStartMonth = await getClubSeasonStartMonth(c.env.DB, clubId)
  const { yearStart, yearEnd } = getPeriodDateRange(year, period, seasonStartMonth)

  let cache = await c.env.DB.prepare(`
    SELECT * FROM rankings_cache WHERE year = ? AND club_id = ? AND period = ?
  `).bind(year, clubId, period).first()

  if (!cache) {
    await buildAndCacheRankings(c.env.DB, clubId, year, yearStart, yearEnd, 'auto', period)
    cache = await c.env.DB.prepare(`
      SELECT * FROM rankings_cache WHERE year = ? AND club_id = ? AND period = ?
    `).bind(year, clubId, period).first()
  }
```
나머지(정렬 배열, summary — `getSeasonSummaryStats(c.env.DB, clubId, yearStart, yearEnd)`)는 기간 범위가 이미 반영되므로 그대로.

- [ ] **Step 3: POST `/refresh`** — 동일하게 period 파싱/검증(400 응답 포함) 후:

```typescript
  const { yearStart, yearEnd } = getPeriodDateRange(year, period, seasonStartMonth)
  // MVP 재계산 DELETE/SELECT는 기존 그대로 (yearStart/yearEnd가 이미 기간 반영)
  const enrichedRankings = await buildAndCacheRankings(c.env.DB, clubId, year, yearStart, yearEnd, userId || 'admin', period)
```

- [ ] **Step 4: `buildAndCacheRankings` 시그니처 + INSERT**

```typescript
async function buildAndCacheRankings(db: D1Database, clubId: number, year: number, yearStart: string, yearEnd: string, updatedBy: string, period: RankingPeriod = 'full') {
  // ... (본문 동일)
  const now = new Date().toISOString()
  // full은 기존 id 규칙 유지(기존 행 덮어쓰기), 반기는 충돌 없는 새 규칙
  const cacheId = period === 'full'
    ? clubId * 10000 + year
    : clubId * 100000 + year * 10 + (period === 'h1' ? 1 : 2)
  await db.prepare(`INSERT OR REPLACE INTO rankings_cache (id, club_id, data, updated_at, updated_by, year, period) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(cacheId, clubId, JSON.stringify(enrichedRankings), now, updatedBy, year, period).run()
  return enrichedRankings
}
```

- [ ] **Step 5: hall-of-fame에 period='full' 필터 (필수 버그 예방)** — 170-172행, 178-180행 두 쿼리 모두:

```typescript
  const years = await c.env.DB.prepare(`
    SELECT DISTINCT year FROM rankings_cache WHERE club_id = ? AND period = 'full' ORDER BY year DESC
  `).bind(clubId).all()
  // ...
    const cache = await c.env.DB.prepare(`
      SELECT data FROM rankings_cache WHERE year = ? AND club_id = ? AND period = 'full'
    `).bind(year, clubId).first()
```

- [ ] **Step 6: 타입 체크** — Run: `cd api; npx tsc --noEmit` / Expected: 에러 없음

- [ ] **Step 7: 로컬 동작 확인** — `npx wrangler dev` (로컬 모드) 후:

```bash
curl "http://localhost:8787/rankings?year=2026&period=h1" -H "X-Club-Id: 1"
curl "http://localhost:8787/rankings?year=2026&period=bad" -H "X-Club-Id: 1"   # → 400 한국어 에러
curl "http://localhost:8787/rankings?year=2026" -H "X-Club-Id: 1"             # → 기존과 동일 (full)
curl "http://localhost:8787/rankings/hall-of-fame" -H "X-Club-Id: 1"          # → 연도 중복 없음
```
Expected: h1/h2/full 각각 캐시 행 분리 생성, period 미지정 시 기존 응답 유지

- [ ] **Step 8: Commit** — `git commit -m "feat(api): 랭킹 조회/갱신 period(full/h1/h2) 지원 + 명예의전당 full 필터"`

---

### Task 4: 웹 API 클라이언트

**Files:**
- Modify: `web/src/lib/api.ts:231-246` (`rankingsApi`)

**Interfaces:**
- Produces: `rankingsApi.get(year?, period?, token?)`, `rankingsApi.refresh(year, period, token)` — period는 `'full' | 'h1' | 'h2'`

- [ ] **Step 1: rankingsApi 수정** (호출부 시그니처 순서 주의 — 기존 `get(year, token)` 호출부는 Task 5에서 함께 수정)

```typescript
export type RankingPeriod = 'full' | 'h1' | 'h2'

// Rankings API
export const rankingsApi = {
  get: (year?: number, period?: RankingPeriod, token?: string) =>
    api(`/rankings?year=${year ?? new Date().getFullYear()}&period=${period ?? 'full'}`, token ? { token } : {}),

  refresh: (year: number, period: RankingPeriod, token: string) =>
    api(`/rankings/refresh?year=${year}&period=${period}`, { method: 'POST', token }),
  // hallOfFame / funStats / myStats 기존 유지
}
```

- [ ] **Step 2: 다른 호출부 확인** — Run: `cd web; npx tsc --noEmit` (또는 grep `rankingsApi.get(`, `rankingsApi.refresh(`)
stats 페이지 등 기존 `rankingsApi.get(year, token)` 호출부가 있으면 `rankingsApi.get(year, 'full', token)`으로 수정.
Expected: 타입 에러 없음

- [ ] **Step 3: Commit** — `git commit -m "feat(web): rankingsApi period 파라미터 추가"`

---

### Task 5: 랭킹 페이지 기간 세그먼트

**Files:**
- Modify: `web/src/app/(main)/ranking/page.tsx`

**Interfaces:**
- Consumes: `rankingsApi.get(year, period, token)`, `RankingPeriod`
- Produces: `selectedPeriod` state — Task 6의 `PeriodAwards`에 rankings 데이터와 함께 전달

- [ ] **Step 1: state + 쿼리 수정**

```typescript
import { rankingsApi, exportApi, awardsApi, type RankingPeriod } from '@/lib/api'

const PERIOD_OPTIONS: { value: RankingPeriod; label: string }[] = [
  { value: 'full', label: '연간' },
  { value: 'h1', label: '상반기' },
  { value: 'h2', label: '하반기' },
]

// RankingPage 컴포넌트 내:
const [selectedPeriod, setSelectedPeriod] = useState<RankingPeriod>('full')

const { data, isLoading } = useQuery({
  queryKey: ['rankings', selectedYear, selectedPeriod, token],
  queryFn: () => rankingsApi.get(selectedYear, selectedPeriod, token ?? undefined),
  enabled: !!token,
})
```

- [ ] **Step 2: 헤더 라벨 + 세그먼트 UI** — 137-139행 부제를 `{selectedYear}년 {PERIOD_OPTIONS.find(p => p.value === selectedPeriod)?.label}`로. 연도 select 아래(검색창 위)에 세그먼트 추가:

```tsx
{/* 기간 세그먼트 */}
<div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5 mb-4">
  {PERIOD_OPTIONS.map((opt) => (
    <button
      key={opt.value}
      onClick={() => setSelectedPeriod(opt.value)}
      className={cn(
        'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors',
        selectedPeriod === opt.value
          ? 'bg-primary text-white'
          : 'text-slate-600 dark:text-slate-400 hover:text-primary'
      )}
    >
      {opt.label}
    </button>
  ))}
</div>
```

- [ ] **Step 3: 연간 전용 섹션 가드**
  - CSV 버튼(142-149행): `{club?.isPro && selectedPeriod === 'full' && (...)}` — export API는 연 단위라 반기 CSV는 이번 범위 제외
  - `<SeasonAwards ... />`(314행): `{selectedPeriod === 'full' && <SeasonAwards data={awardsData} year={selectedYear} />}` — season_awards는 연 단위 데이터

- [ ] **Step 4: 빌드** — Run: `cd web; npm run build` / Expected: 성공

- [ ] **Step 5: Commit** — `git commit -m "feat(web): 랭킹 페이지 연간/상반기/하반기 기간 필터"`

---

### Task 6: 시상식형 TOP3 결산 컴포넌트

**Files:**
- Create: `web/src/components/ranking/period-awards.tsx`
- Modify: `web/src/app/(main)/ranking/page.tsx` (Podium 섹션 아래 삽입)

**Interfaces:**
- Consumes: rankings 응답 `data.data` (goalRanking/assistRanking/defenseRanking/attendanceRanking/winRateRanking/mvpRanking/rankings), `enabledEvents`
- Produces: `<PeriodAwards data={data?.data} enabledEvents={enabledEvents} periodLabel={...} />`

- [ ] **Step 1: 컴포넌트 작성** — 7개 부문 × TOP3, 명예의전당과 동일 카테고리/아이콘:

```tsx
'use client'

import { Medal } from 'lucide-react'
import { cn } from '@/lib/cn'

type Entry = { id: number; name: string; value: number | string }

const MEDALS = ['\u{1F947}', '\u{1F948}', '\u{1F949}']

export function PeriodAwards({ data, enabledEvents, periodLabel }: {
  data: any
  enabledEvents: string[]
  periodLabel: string
}) {
  if (!data) return null
  const rankings: any[] = data.rankings || []

  const top3 = (list: any[], key: string, format?: (v: number) => string): Entry[] =>
    (list || []).slice(0, 3).map((p) => ({ id: p.id, name: p.name, value: format ? format(p[key]) : p[key] }))

  const attackPointRanking = [...rankings]
    .map((p) => ({ ...p, attackPoints: (p.goals || 0) + (p.assists || 0) }))
    .filter((p) => p.attackPoints > 0)
    .sort((a, b) => b.attackPoints - a.attackPoints)

  const categories: { name: string; icon: string; entries: Entry[]; show: boolean }[] = [
    { name: '득점왕', icon: '⚽', entries: top3(data.goalRanking, 'goals'), show: true },
    { name: '도움왕', icon: '\u{1F170}️', entries: top3(data.assistRanking, 'assists'), show: true },
    { name: '공격포인트왕', icon: '⚡', entries: top3(attackPointRanking, 'attackPoints'), show: true },
    { name: '수비왕', icon: '\u{1F6E1}️', entries: top3(data.defenseRanking, 'defenses'), show: enabledEvents.includes('DEFENSE') },
    { name: 'MVP', icon: '\u{1F3C6}', entries: top3(data.mvpRanking, 'mvpCount'), show: true },
    { name: '승률왕', icon: '\u{1F4C8}', entries: top3(data.winRateRanking, 'winRate', (v) => `${v}%`), show: true },
    { name: '출석왕', icon: '\u{1F4C5}', entries: top3(data.attendanceRanking, 'attendance'), show: true },
  ].filter((c) => c.show && c.entries.length > 0)

  if (categories.length === 0) return null

  return (
    <div className="mt-8">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Medal className="w-5 h-5 text-primary" />
        {periodLabel} 결산 TOP3
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map((cat) => (
          <div key={cat.name} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-sm font-bold text-slate-900 dark:text-white mb-3">
              <span className="mr-1.5">{cat.icon}</span>{cat.name}
            </p>
            <ul className="space-y-1.5">
              {cat.entries.map((e, i) => (
                <li key={e.id} className="flex items-center justify-between text-sm">
                  <span className={cn('flex items-center gap-1.5 truncate', i === 0 ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400')}>
                    <span>{MEDALS[i]}</span>{e.name}
                  </span>
                  <span className={cn('font-semibold shrink-0', i === 0 ? 'text-primary' : 'text-slate-500 dark:text-slate-400')}>{e.value}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 페이지 삽입** — `ranking/page.tsx`의 Podium 섹션(195-199행) 아래:

```tsx
import { PeriodAwards } from '@/components/ranking/period-awards'
// ...
{/* 기간 결산 TOP3 */}
{!search && (
  <div className="mb-8">
    <PeriodAwards
      data={data?.data}
      enabledEvents={enabledEvents}
      periodLabel={`${selectedYear}년 ${PERIOD_OPTIONS.find(p => p.value === selectedPeriod)?.label}`}
    />
  </div>
)}
```

- [ ] **Step 3: 빌드** — Run: `cd web; npm run build` / Expected: 성공

- [ ] **Step 4: Commit** — `git commit -m "feat(web): 시상식형 기간 결산 TOP3 섹션 (PeriodAwards)"`

---

### Task 7: 통합 검증 + 독립 리뷰

- [ ] **Step 1:** `cd api; npx tsc --noEmit` + `cd web; npm run build` 모두 통과 확인
- [ ] **Step 2:** wrangler dev 로컬로 period 3종 + 잘못된 period(400) + 미지정(하위호환) + hall-of-fame 중복 없음 재확인
- [ ] **Step 3:** 독립 code-reviewer 에이전트로 전체 diff 검토 (셀프 검수 금지 — 사용자 워크플로 규칙)
- [ ] **Step 4:** 리뷰 반영 후 최종 커밋·푸시
- [ ] **주의:** 프로덕션 D1 마이그레이션(`npm run db:migrate:prod`)은 **사용자 확인 후에만** 실행

## 범위 제외 (스펙과 동일)

- Flutter 앱, 시즌 기준 반기, fun-stats/my-stats의 season_start_month 하드코딩 버그, 반기 CSV export
