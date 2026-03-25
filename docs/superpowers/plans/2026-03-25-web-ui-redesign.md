# Web UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 랭킹 페이지 리디자인(컴팩트 리스트+정렬 칩), admin 사이드바 레이아웃, settings 탭 분리, 공유 컴포넌트 정리.

**Architecture:** 공유 컴포넌트를 먼저 추출한 뒤, 각 영역을 독립적으로 개선. 기존 페이지 기능은 100% 유지하면서 UI만 교체.

**Tech Stack:** Next.js 14 (App Router), React, Tailwind CSS, Zustand, React Query, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-24-web-ui-redesign.md`

---

## File Structure

### 신규 파일
| 파일 | 역할 |
|------|------|
| `web/src/components/ui/stat-card.tsx` | 통합 StatCard — 2 variants: `boxed` (admin 대시보드), `flat` (admin 랭킹) |
| `web/src/components/ui/status-badge.tsx` | 세션 상태 뱃지 (recruiting/ended/completed/closed) |
| `web/src/components/ui/sort-chips.tsx` | 정렬 칩 바 컴포넌트 |
| `web/src/components/ranking/compact-player-list.tsx` | 컴팩트 리스트 + 인라인 확장 |
| `web/src/app/(main)/admin/layout.tsx` | admin 사이드바 레이아웃 |
| `web/src/app/(main)/admin/settings/components/basic-info-tab.tsx` | 설정: 기본 정보 탭 |
| `web/src/app/(main)/admin/settings/components/fee-tab.tsx` | 설정: 참가비 탭 |
| `web/src/app/(main)/admin/settings/components/events-tab.tsx` | 설정: 기록 설정 탭 |
| `web/src/app/(main)/admin/settings/components/weights-tab.tsx` | 설정: 평점 가중치 탭 |

### 수정 파일
| 파일 | 변경 내용 |
|------|-----------|
| `web/src/app/globals.css` | `.scrollbar-hide` 유틸리티 클래스 추가 |
| `web/src/app/(main)/ranking/page.tsx` | 컴팩트 리스트 기본 뷰 + 칩 정렬 + 테이블 토글 |
| `web/src/app/(main)/admin/page.tsx` | 관리 메뉴 섹션 제거, StatCard 공유 컴포넌트 사용 |
| `web/src/app/(main)/admin/rankings/page.tsx` | CompactPlayerList 재사용, 기존 테이블 삭제 |
| `web/src/app/(main)/admin/settings/page.tsx` | 탭 구조로 리팩터 |

### 변경하지 않는 파일
| 파일 | 이유 |
|------|------|
| `web/src/app/(main)/page.tsx` | home StatCard는 gradient 스타일이 달라서 공유 불가 — 유지 |

---

## Task 1: 공유 컴포넌트 — StatCard, StatusBadge + globals.css

**Files:**
- Create: `web/src/components/ui/stat-card.tsx`
- Create: `web/src/components/ui/status-badge.tsx`
- Modify: `web/src/app/globals.css`
- Modify: `web/src/app/(main)/admin/page.tsx`
- Modify: `web/src/app/(main)/admin/rankings/page.tsx`

- [ ] **Step 1: globals.css에 scrollbar-hide 유틸리티 추가**

`web/src/app/globals.css` 하단에 추가:
```css
/* scrollbar hide utility */
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
```

- [ ] **Step 2: StatCard 공유 컴포넌트 생성 (2 variants)**

`web/src/components/ui/stat-card.tsx` — 기존 사용처의 두 가지 스타일을 모두 지원:

**variant `boxed`** (admin/page.tsx 대시보드용): 흰색 카드 배경 + 컬러 아이콘 박스 + 값/라벨
**variant `flat`** (admin/rankings 통계용): 전체 컬러 배경 + 아이콘+라벨 + 값

```tsx
import { cn } from '@/lib/cn'

const colorMap = {
  blue: { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  red: { bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' },
}

type Color = keyof typeof colorMap

interface StatCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  color: Color
  variant?: 'boxed' | 'flat'
}

export function StatCard({ label, value, icon, color, variant = 'boxed' }: StatCardProps) {
  const c = colorMap[color]

  if (variant === 'flat') {
    return (
      <div className={cn('rounded-xl p-4', c.bg)}>
        <div className={cn('flex items-center gap-2 mb-2 opacity-80', c.text)}>
          {icon}
          <span className="text-sm">{label}</span>
        </div>
        <p className={cn('text-2xl font-bold', c.text)}>{value}</p>
      </div>
    )
  }

  // boxed: white card with colored icon box
  return (
    <div className="bg-white dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800/50">
      {icon && (
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-3', c.bg, c.text)}>
          {icon}
        </div>
      )}
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}
```

- [ ] **Step 3: StatusBadge 공유 컴포넌트 생성**

`web/src/components/ui/status-badge.tsx`:
```tsx
import { cn } from '@/lib/cn'

const statusConfig: Record<string, { label: string; className: string }> = {
  recruiting: { label: '모집중', className: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' },
  ended: { label: '종료', className: 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400' },
  completed: { label: '완료', className: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
  closed: { label: '마감', className: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400' },
}

export function StatusBadge({ status }: { status: string }) {
  const { label, className } = statusConfig[status] || statusConfig.closed
  return (
    <span className={cn('px-2 py-1 rounded-lg text-xs font-medium', className)}>
      {label}
    </span>
  )
}
```

- [ ] **Step 4: admin/page.tsx — 인라인 StatCard/StatusBadge를 공유 컴포넌트로 교체**

`web/src/app/(main)/admin/page.tsx`:
- `import { StatCard } from '@/components/ui/stat-card'`
- `import { StatusBadge } from '@/components/ui/status-badge'`
- 인라인 `StatCard` 함수 삭제 (line ~348-375) — 호출부는 동일 API라 변경 불필요 (variant 기본값 'boxed')
- 인라인 `StatusBadge` 함수 삭제 (line ~377-400)

- [ ] **Step 5: admin/rankings/page.tsx — 인라인 StatCard를 공유 컴포넌트로 교체**

`web/src/app/(main)/admin/rankings/page.tsx`:
- `import { StatCard } from '@/components/ui/stat-card'`
- 호출부에 `variant="flat"` 추가
- 인라인 `StatCard` 함수 삭제 (line ~220-247)

- [ ] **Step 6: 빌드 확인**

Run: `cd web && npm run build`
Expected: 에러 없이 빌드 성공

- [ ] **Step 7: 커밋**

```bash
git add web/src/components/ui/stat-card.tsx web/src/components/ui/status-badge.tsx
git add web/src/app/globals.css
git add web/src/app/(main)/admin/page.tsx web/src/app/(main)/admin/rankings/page.tsx
git commit -m "refactor: extract shared StatCard (boxed/flat) and StatusBadge components"
```

---

## Task 2: 정렬 칩 컴포넌트

**Files:**
- Create: `web/src/components/ui/sort-chips.tsx`

- [ ] **Step 1: SortChips 컴포넌트 생성**

`web/src/components/ui/sort-chips.tsx`:
```tsx
'use client'
import { cn } from '@/lib/cn'

export interface SortChip {
  key: string
  label: string
}

export function SortChips({
  chips, activeKey, onSelect,
}: {
  chips: SortChip[]
  activeKey: string
  onSelect: (key: string) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {chips.map((chip) => (
        <button
          key={chip.key}
          onClick={() => onSelect(chip.key)}
          className={cn(
            'px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors',
            activeKey === chip.key
              ? 'bg-brand-green text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600'
          )}
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add web/src/components/ui/sort-chips.tsx
git commit -m "feat: add SortChips component for ranking page"
```

---

## Task 3: 컴팩트 플레이어 리스트 컴포넌트

**Files:**
- Create: `web/src/components/ranking/compact-player-list.tsx`

- [ ] **Step 1: CompactPlayerList 컴포넌트 생성**

`web/src/components/ranking/compact-player-list.tsx`:

```tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

// --- 스탯 정의 ---
const STAT_LABELS: Record<string, string> = {
  goals: '득점', assists: '도움', mvpScore: '평점', mvpCount: 'MVP',
  attackPoints: '공격P', winRate: '승률', games: '경기',
  defenses: '수비', tackles: '태클', interceptions: '인터셉트',
  clearances: '클리어런스', saves: '선방', keyPasses: '키패스',
  dribbles: '돌파', shotsOn: '유효슈팅', shotsOff: '무효슈팅',
  sessionWins: '승', sessionLosses: '패', contribution: '공헌도',
}

const BASE_STATS = ['goals', 'assists', 'mvpScore']
const FALLBACK_ORDER = ['mvpCount', 'attackPoints', 'winRate', 'games']

function getVisibleStats(sortBy: string): string[] {
  const visible = BASE_STATS.filter(s => s !== sortBy)
  for (const f of FALLBACK_ORDER) {
    if (visible.length >= 3) break
    if (f !== sortBy && !visible.includes(f)) visible.push(f)
  }
  return visible.slice(0, 3)
}

function getStatValue(player: any, key: string): string {
  if (key === 'attackPoints') return String((player.goals || 0) + (player.assists || 0))
  if (key === 'winRate') return player.winRate ? player.winRate + '%' : '-'
  if (key === 'mvpScore') return player.mvpScore != null ? Number(player.mvpScore).toFixed(1) : '0.0'
  if (key === 'contribution') {
    const g = player.games || 0
    return g > 0 ? ((player.goals + player.assists) / g).toFixed(2) : '0.00'
  }
  return String(player[key] || 0)
}

// --- 메인 컴포넌트 ---
interface CompactPlayerListProps {
  rankings: any[]
  sortBy: string
  enabledEvents: string[]
}

export function CompactPlayerList({ rankings, sortBy, enabledEvents }: CompactPlayerListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // 정렬 변경 시 접기
  useEffect(() => { setExpandedId(null) }, [sortBy])

  const visibleStats = getVisibleStats(sortBy)

  return (
    <div className="flex flex-col gap-1.5">
      {rankings.map((player, index) => (
        <CompactRow
          key={player.id}
          player={player}
          rank={index + 1}
          sortBy={sortBy}
          visibleStats={visibleStats}
          enabledEvents={enabledEvents}
          isExpanded={expandedId === player.id}
          onToggle={() => setExpandedId(expandedId === player.id ? null : player.id)}
        />
      ))}
    </div>
  )
}

// --- 행 컴포넌트 ---
function CompactRow({
  player, rank, sortBy, visibleStats, enabledEvents, isExpanded, onToggle,
}: {
  player: any; rank: number; sortBy: string; visibleStats: string[]
  enabledEvents: string[]; isExpanded: boolean; onToggle: () => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const borderColor = rank === 1 ? 'border-l-amber-500' : rank === 2 ? 'border-l-slate-400' : rank === 3 ? 'border-l-amber-700' : 'border-l-transparent'
  const rankBg = rank === 1 ? 'bg-amber-500 text-white' : rank === 2 ? 'bg-slate-400 text-white' : rank === 3 ? 'bg-amber-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'

  return (
    <div className={cn(
      'bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800/50 border-l-[3px] overflow-hidden',
      borderColor
    )}>
      {/* 접힌 행 */}
      <div
        onClick={onToggle}
        className="flex items-center gap-2.5 px-3 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
      >
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0', rankBg)}>
          {rank}
        </div>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="w-7 h-7 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
            {player.photo_url
              ? <img src={player.photo_url} alt="" className="w-full h-full object-cover rounded-lg" />
              : <span className="text-xs font-bold text-slate-500">{player.name?.charAt(0)}</span>
            }
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{player.name}</span>
        </div>
        {/* 정렬 기준 스탯 (강조) */}
        <div className="text-center bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-500/30 shrink-0">
          <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">{STAT_LABELS[sortBy] || sortBy}</div>
          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{getStatValue(player, sortBy)}</div>
        </div>
        {/* 고정 스탯 3개 */}
        {visibleStats.map(key => (
          <div key={key} className="text-center shrink-0 hidden sm:block">
            <div className="text-[9px] text-slate-400">{STAT_LABELS[key]}</div>
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{getStatValue(player, key)}</div>
          </div>
        ))}
        <div className="shrink-0 flex items-center gap-1">
          <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', isExpanded && 'rotate-180')} />
          <Link href={`/ranking/${player.id}`} onClick={e => e.stopPropagation()}>
            <ChevronRight className="w-4 h-4 text-slate-400 hover:text-emerald-500" />
          </Link>
        </div>
      </div>

      {/* 확장 영역 */}
      <div
        ref={contentRef}
        className="transition-all duration-150 ease-in-out overflow-hidden"
        style={{ maxHeight: isExpanded ? contentRef.current?.scrollHeight + 'px' : '0px' }}
      >
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <MiniStat label="경기" value={player.games || 0} />
            <MiniStat label="승/패/무" value={`${player.sessionWins || 0}/${player.sessionLosses || 0}/${player.draws || 0}`} />
            <MiniStat label="승률" value={player.winRate ? player.winRate + '%' : '-'} />
            <MiniStat label="공헌도" value={player.games > 0 ? ((player.goals + player.assists) / player.games).toFixed(2) : '0.00'} />
            <MiniStat label="MVP" value={player.mvpCount || 0} />
            {enabledEvents.includes('DEFENSE') && <MiniStat label="수비" value={player.defenses || 0} />}
            {enabledEvents.includes('TACKLE') && <MiniStat label="태클" value={player.tackles || 0} />}
            {enabledEvents.includes('INTERCEPTION') && <MiniStat label="인터셉트" value={player.interceptions || 0} />}
            {enabledEvents.includes('CLEARANCE') && <MiniStat label="클리어런스" value={player.clearances || 0} />}
            {enabledEvents.includes('SAVE') && <MiniStat label="선방" value={player.saves || 0} />}
            {enabledEvents.includes('KEY_PASS') && <MiniStat label="키패스" value={player.keyPasses || 0} />}
            {enabledEvents.includes('DRIBBLE') && <MiniStat label="돌파" value={player.dribbles || 0} />}
            {enabledEvents.includes('SHOT_ON') && <MiniStat label="유효슈팅" value={player.shotsOn || 0} />}
            {enabledEvents.includes('SHOT_OFF') && <MiniStat label="무효슈팅" value={player.shotsOff || 0} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2 text-center">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{value}</div>
    </div>
  )
}
```

- [ ] **Step 2: 빌드 확인**

Run: `cd web && npm run build`

- [ ] **Step 3: 커밋**

```bash
git add web/src/components/ranking/compact-player-list.tsx
git commit -m "feat: add CompactPlayerList component with inline expand"
```

---

## Task 4: 랭킹 페이지 리디자인

**Files:**
- Modify: `web/src/app/(main)/ranking/page.tsx` (전체 리라이트)

- [ ] **Step 1: ranking/page.tsx 리디자인**

기존 page.tsx를 Write 도구로 전체 재작성. 핵심 변경점:

**State 선언:**
```tsx
const [selectedYear, setSelectedYear] = useState(currentYear)
const [sortBy, setSortBy] = useState('mvpCount')
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
const [search, setSearch] = useState('')
const [viewMode, setViewMode] = useState<'compact' | 'table'>(() => {
  if (typeof window !== 'undefined') return (localStorage.getItem('ranking-view-mode') as any) || 'compact'
  return 'compact'
})
```

**정렬 칩 목록 동적 생성:**
```tsx
const chipList: SortChip[] = [
  { key: 'mvpCount', label: 'MVP' },
  { key: 'goals', label: '득점' },
  { key: 'assists', label: '도움' },
  { key: 'attackPoints', label: '공격P' },
  ...enabledEvents.filter(e => e !== 'GOAL').map(e => {
    const map: Record<string, SortChip> = {
      DEFENSE: { key: 'defenses', label: '수비' },
      TACKLE: { key: 'tackles', label: '태클' },
      // ... etc
    }
    return map[e]
  }).filter(Boolean),
  { key: 'games', label: '경기' },
  { key: 'winRate', label: '승률' },
  { key: 'contribution', label: '공헌도' },
  { key: 'mvpScore', label: '평점' },
]
```

**PPM → 공헌도 변경:**
- sortBy 값 'ppm' → 'contribution'
- 정렬 로직: `(goals + assists) / games`
- Podium의 `getValue` 함수도 'contribution' 케이스 추가

**viewMode 전환:**
```tsx
useEffect(() => {
  localStorage.setItem('ranking-view-mode', viewMode)
}, [viewMode])
```

**JSX 구조:**
```tsx
<SortChips chips={chipList} activeKey={sortBy} onSelect={handleSort} />
{!search && topThree.length >= 3 && <Podium ... />}
{viewMode === 'compact' ? (
  <CompactPlayerList rankings={sortedRankings} sortBy={sortBy} enabledEvents={enabledEvents} />
) : (
  <RankingTable ... />  // 기존 테이블 로직 (SortableHeader + PlayerRow)
)}
<ViewToggle viewMode={viewMode} onToggle={...} />
```

**테이블 뷰 컬럼 그룹핑** (12개 이상일 때):
```tsx
const totalColumns = 11 + enabledEvents.filter(e => e !== 'GOAL').length  // 고정 11 + 이벤트
const showColumnToggle = totalColumns >= 12
const [showAllColumns, setShowAllColumns] = useState(false)
// 핵심 컬럼: MVP, 득점, 도움, 공격P, 경기, 승, 패, 승률, 평점 (9개)
// 확장 컬럼: enabled_events 기반 개별 스탯들
```

**그룹 헤더 (colspan):**
- 공격: 득점, 도움, 공격P, (키패스, 돌파, 유효슈팅, 무효슈팅)
- 수비: (수비, 태클, 인터셉트, 클리어런스, 선방)
- 기록: 경기, 승, 패, 승률, MVP, 평점

기존 컴포넌트 유지: `Podium`, `LoadingSkeleton`, `EmptyState`, `SortableHeader`, `PlayerRow`

- [ ] **Step 2: 빌드 확인**

Run: `cd web && npm run build`

- [ ] **Step 3: 커밋**

```bash
git add web/src/app/(main)/ranking/page.tsx
git commit -m "feat: redesign ranking page with compact list + sort chips + view toggle"
```

---

## Task 5: Admin 사이드바 레이아웃

**Files:**
- Create: `web/src/app/(main)/admin/layout.tsx`
- Modify: `web/src/app/(main)/admin/page.tsx`

- [ ] **Step 1: admin/layout.tsx 생성**

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Calendar, Users, CircleUser, Trophy,
  Bell, BellRing, ShieldOff, Settings, Home, Menu, X
} from 'lucide-react'
import { cn } from '@/lib/cn'

const menuItems = [
  { href: '/admin', label: '대시보드', icon: LayoutDashboard, exact: true },
  { href: '/admin/sessions', label: '세션 관리', icon: Calendar },
  { href: '/admin/players', label: '선수 관리', icon: Users },
  { href: '/admin/users', label: '유저 관리', icon: CircleUser },
  { href: '/admin/rankings', label: '랭킹 관리', icon: Trophy },
  { href: '/admin/announcements', label: '공지 관리', icon: Bell },
  { href: '/admin/notifications', label: '알림 관리', icon: BellRing },
  { href: '/admin/exemptions', label: '회비 면제', icon: ShieldOff },
  { href: '/admin/settings', label: '클럽 설정', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (item: typeof menuItems[0]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href + '/') || pathname === item.href

  const sidebar = (
    <nav className="flex flex-col h-full py-4">
      <div className="flex-1 space-y-1 px-3">
        {menuItems.map(item => (
          <Link key={item.href} href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              isActive(item)
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border-l-2 border-emerald-500 -ml-[2px]'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            )}>
            <item.icon className="w-5 h-5 shrink-0" />
            {item.label}
          </Link>
        ))}
      </div>
      <div className="px-3 pt-4 border-t border-slate-200 dark:border-slate-800">
        <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-500 hover:text-emerald-600 transition-colors">
          <Home className="w-5 h-5" /> 홈으로
        </Link>
      </div>
    </nav>
  )

  return (
    <div className="flex">
      {/* 데스크톱 사이드바 */}
      <aside className="hidden md:block w-60 shrink-0 h-[calc(100vh-64px)] sticky top-16 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 overflow-y-auto">
        {sidebar}
      </aside>
      {/* 모바일 햄버거 + 오버레이 */}
      <button onClick={() => setMobileOpen(true)} className="md:hidden fixed bottom-4 right-4 z-40 w-12 h-12 bg-brand-green text-white rounded-full shadow-lg flex items-center justify-center">
        <Menu className="w-6 h-6" />
      </button>
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-64 z-50 bg-white dark:bg-slate-950 shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <span className="font-semibold text-slate-900 dark:text-white">관리자 메뉴</span>
              <button onClick={() => setMobileOpen(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            {sidebar}
          </aside>
        </>
      )}
      {/* 메인 콘텐츠 */}
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: admin/page.tsx에서 관리 메뉴 섹션 제거**

`web/src/app/(main)/admin/page.tsx`:
- `AdminMenuItem` 컴포넌트 삭제 (line ~402-430)
- "관리 메뉴" div 블록 삭제 (line ~258-309 내 관리 메뉴 부분)
- 우측 칼럼 변경: 연동 대기만 남김
- 레이아웃: `lg:grid-cols-3` → 연동 대기 있으면 `lg:grid-cols-3`, 없으면 전체 너비 (`lg:col-span-3`로 왼쪽 확장)

- [ ] **Step 3: 빌드 확인**

Run: `cd web && npm run build`

- [ ] **Step 4: 커밋**

```bash
git add web/src/app/(main)/admin/layout.tsx web/src/app/(main)/admin/page.tsx
git commit -m "feat: add admin sidebar layout, remove inline menu"
```

---

## Task 6: Admin 랭킹 페이지 개선

**Files:**
- Modify: `web/src/app/(main)/admin/rankings/page.tsx`

- [ ] **Step 1: CompactPlayerList 재사용으로 리디자인**

`web/src/app/(main)/admin/rankings/page.tsx`:
- 기존 테이블 (line ~155-215) 삭제
- `import { CompactPlayerList } from '@/components/ranking/compact-player-list'`
- `import { SortChips } from '@/components/ui/sort-chips'`
- 상단: 헤더 + 새로고침 버튼 + 연도 선택 (기존 유지)
- 중간: 통계 요약 StatCard 4개 유지 (variant="flat")
- 하단: SortChips + CompactPlayerList
- state 추가: `sortBy`, `sortOrder` + 정렬 로직 (ranking/page.tsx에서 가져옴)

- [ ] **Step 2: 빌드 확인**

Run: `cd web && npm run build`

- [ ] **Step 3: 커밋**

```bash
git add web/src/app/(main)/admin/rankings/page.tsx
git commit -m "feat: redesign admin rankings with CompactPlayerList"
```

---

## Task 7: Settings 탭 분리

**Files:**
- Create: `web/src/app/(main)/admin/settings/components/basic-info-tab.tsx`
- Create: `web/src/app/(main)/admin/settings/components/fee-tab.tsx`
- Create: `web/src/app/(main)/admin/settings/components/events-tab.tsx`
- Create: `web/src/app/(main)/admin/settings/components/weights-tab.tsx`
- Modify: `web/src/app/(main)/admin/settings/page.tsx`

- [ ] **Step 1: 기존 settings/page.tsx를 전체 읽고 각 섹션 경계 파악**

각 탭 컴포넌트 공통 props:
```tsx
export interface SettingsTabProps {
  club: any
  token: string
  onUpdate: () => void
}
```

isDirty 패턴 (각 탭 내부):
```tsx
const [initialState, setInitialState] = useState<string>('')
// useEffect: club 로드 시 → setInitialState(JSON.stringify(currentValues))
// 저장 성공 시 → setInitialState(JSON.stringify(currentValues))
// export const isDirty = JSON.stringify(currentValues) !== initialState
```

isDirty를 부모에게 전달: `useImperativeHandle` 또는 `onDirtyChange` 콜백 prop.
간단한 방식: `onDirtyChange: (dirty: boolean) => void` 콜백을 각 탭에 전달.

- [ ] **Step 2: basic-info-tab.tsx 생성**

기존 settings에서 추출할 state: `clubName`, `clubDesc`, `seasonMonth`, `infoSaving`, `infoSaved`, `logoUploading`, `regenerating`, `bankName`, `accountNumber`, `holderName`, `bankSaving`, `bankSaved`, `deleteConfirm`, `deleting`
해당 JSX 블록과 핸들러 함수 함께 이동.

- [ ] **Step 3: fee-tab.tsx 생성**

추출 state: `baseAmount`, `splitEnabled`, `splitTotal`, `splitRoundUp`, `rankDiffEnabled`, `rankDiffAmount`, `feeSaving`, `feeSaved`

- [ ] **Step 4: events-tab.tsx 생성**

추출 state: `enabledEvents`, `eventsSaving`, `eventsSaved`, `mvpToggling`, `notifToggling`

- [ ] **Step 5: weights-tab.tsx 생성**

추출 state: `mvpWeights`, `weightsSaving`, `weightsSaved`

- [ ] **Step 6: settings/page.tsx를 탭 컨테이너로 리팩터**

```tsx
'use client'
import { useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
// ... imports

const TABS = [
  { key: 'info', label: '기본 정보' },
  { key: 'fees', label: '참가비' },
  { key: 'events', label: '기록 설정' },
  { key: 'weights', label: '평점 가중치' },
] as const

export default function AdminSettingsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = searchParams.get('tab') || 'info'
  const [dirtyTab, setDirtyTab] = useState<string | null>(null)

  const handleTabChange = (tab: string) => {
    if (dirtyTab && dirtyTab !== tab) {
      if (!confirm('저장하지 않은 변경사항이 있습니다. 탭을 전환하시겠습니까?')) return
    }
    router.push(`/admin/settings?tab=${tab}`)
    setDirtyTab(null)
  }

  // club 데이터 fetch (기존 useQuery 유지)
  // ...

  return (
    <div>
      {/* 탭 바 */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800 mb-6">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => handleTabChange(tab.key)} className={cn(...)}>
            {tab.label}
          </button>
        ))}
      </div>
      {/* 탭 콘텐츠 */}
      {activeTab === 'info' && <BasicInfoTab club={club} token={token} onUpdate={refetch} onDirtyChange={d => setDirtyTab(d ? 'info' : null)} />}
      {activeTab === 'fees' && <FeeTab ... />}
      {activeTab === 'events' && <EventsTab ... />}
      {activeTab === 'weights' && <WeightsTab ... />}
    </div>
  )
}
```

- [ ] **Step 7: 빌드 확인**

Run: `cd web && npm run build`

- [ ] **Step 8: 커밋**

```bash
git add web/src/app/(main)/admin/settings/
git commit -m "refactor: split settings into 4 tab components"
```

---

## Task 8: 최종 정리 및 확인

- [ ] **Step 1: 전체 빌드 확인**

Run: `cd web && npm run build`

- [ ] **Step 2: 주요 페이지 확인 체크리스트**

- [ ] `/ranking` — 컴팩트 리스트 기본 뷰 + 칩 정렬 작동
- [ ] `/ranking` — 행 클릭 → 아코디언 확장/접힘 + 애니메이션
- [ ] `/ranking` — 테이블 뷰 전환 + localStorage 유지
- [ ] `/ranking` — 포디움 공헌도 표시 (PPM 아님)
- [ ] `/admin` — 사이드바 표시 + active 상태
- [ ] `/admin` — 모바일 햄버거 → 오버레이
- [ ] `/admin/rankings` — CompactPlayerList + 통계 카드 + 새로고침
- [ ] `/admin/settings` — 4개 탭 전환 + URL 반영
- [ ] `/admin/settings` — 미저장 변경 시 탭 전환 경고

- [ ] **Step 3: 최종 커밋**

```bash
git add -A
git commit -m "chore: final cleanup for web UI redesign"
```
