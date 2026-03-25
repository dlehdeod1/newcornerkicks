'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Trophy,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Target,
  Shield,
  Flame,
  LayoutList,
  Table2,
} from 'lucide-react'
import { useAuthStore, useAuthHydrated } from '@/stores/auth'
import { rankingsApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import { StatCard } from '@/components/ui/stat-card'
import { CompactPlayerList } from '@/components/ranking/compact-player-list'
import { SortChips, type SortChip } from '@/components/ui/sort-chips'

const EVENT_CHIP_MAP: { event: string; chip: SortChip }[] = [
  { event: 'DEFENSE', chip: { key: 'defenses', label: '수비' } },
  { event: 'TACKLE', chip: { key: 'tackles', label: '태클' } },
  { event: 'INTERCEPTION', chip: { key: 'interceptions', label: '인터셉트' } },
  { event: 'CLEARANCE', chip: { key: 'clearances', label: '클리어런스' } },
  { event: 'SAVE', chip: { key: 'saves', label: '선방' } },
  { event: 'KEY_PASS', chip: { key: 'keyPasses', label: '키패스' } },
  { event: 'DRIBBLE', chip: { key: 'dribbles', label: '돌파' } },
  { event: 'SHOT_ON', chip: { key: 'shotsOn', label: '유효슈팅' } },
  { event: 'SHOT_OFF', chip: { key: 'shotsOff', label: '무효슈팅' } },
]

export default function AdminRankingsPage() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [sortBy, setSortBy] = useState('mvpCount')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card')
  const hydrated = useAuthHydrated()
  const { isAdmin, isLoggedIn, token, club } = useAuthStore()
  const queryClient = useQueryClient()

  const enabledEvents: string[] = club?.enabledEvents ?? ['GOAL', 'DEFENSE']

  // hooks는 조건부 return 전에 모두 선언 (React hooks 규칙)
  const { data, isLoading } = useQuery({
    queryKey: ['rankings', selectedYear],
    queryFn: () => rankingsApi.get(selectedYear, token ?? undefined),
    enabled: hydrated && isLoggedIn && isAdmin,
  })

  const refreshMutation = useMutation({
    mutationFn: () => rankingsApi.refresh(selectedYear, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rankings', selectedYear] })
    },
  })

  const handleSort = (key: string) => {
    if (sortBy === key) setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')
    else { setSortBy(key); setSortOrder('desc') }
  }

  if (!hydrated) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isLoggedIn || !isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">접근 권한이 없습니다</h2>
        <Link href="/" className="text-brand-green hover:underline">홈으로 돌아가기</Link>
      </div>
    )
  }

  const rankingsData = data?.data || {}
  const rankings = rankingsData.rankings || []
  const updatedAt = data?.updatedAt

  // Build chip list dynamically based on enabledEvents
  const chips: SortChip[] = [
    { key: 'mvpCount', label: 'MVP' },
    { key: 'goals', label: '득점' },
    { key: 'assists', label: '도움' },
    { key: 'attackPoints', label: '공격P' },
    ...EVENT_CHIP_MAP.filter(e => enabledEvents.includes(e.event)).map(e => e.chip),
    { key: 'games', label: '경기' },
    { key: 'winRate', label: '승률' },
    { key: 'mvpScore', label: '평점합계' },
    { key: 'contribution', label: '공헌도' },
  ]

  // Sort rankings
  const sorted = [...rankings].sort((a: any, b: any) => {
    let av: number, bv: number
    if (sortBy === 'attackPoints') {
      av = (a.goals || 0) + (a.assists || 0)
      bv = (b.goals || 0) + (b.assists || 0)
    } else if (sortBy === 'winRate') {
      av = parseFloat(a.winRate || '0')
      bv = parseFloat(b.winRate || '0')
    } else if (sortBy === 'contribution') {
      av = a.games > 0 ? (a.goals + a.assists) / a.games : 0
      bv = b.games > 0 ? (b.goals + b.assists) / b.games : 0
    } else {
      av = a[sortBy] || 0
      bv = b[sortBy] || 0
    }
    return sortOrder === 'desc' ? bv - av : av - bv
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            랭킹 관리
          </h1>
          <p className="text-slate-500 mt-1">시즌 랭킹을 새로고침하고 관리하세요</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((year) => (
              <option key={year} value={year}>{year}년</option>
            ))}
          </select>
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', refreshMutation.isPending && 'animate-spin')} />
            랭킹 새로고침
          </button>
        </div>
      </div>

      {/* 마지막 갱신 시간 */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <Clock className="w-4 h-4" />
          <span className="text-sm">
            마지막 갱신: {updatedAt ? new Date(updatedAt).toLocaleString('ko-KR') : '아직 갱신되지 않음'}
          </span>
        </div>
        {refreshMutation.isSuccess && (
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm">
            <CheckCircle className="w-4 h-4" />
            갱신 완료
          </span>
        )}
      </div>

      {/* 통계 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="총 선수"
          value={rankingsData.totalPlayers || 0}
          color="blue"
          variant="flat"
        />
        <StatCard
          icon={<Target className="w-5 h-5" />}
          label="총 골"
          value={rankingsData.totalGoals || 0}
          color="red"
          variant="flat"
        />
        <StatCard
          icon={<Shield className="w-5 h-5" />}
          label="총 어시스트"
          value={rankingsData.totalAssists || 0}
          color="emerald"
          variant="flat"
        />
        <StatCard
          icon={<Flame className="w-5 h-5" />}
          label="총 세션"
          value={rankingsData.totalSessions || 0}
          color="amber"
          variant="flat"
        />
      </div>

      {/* 정렬 칩 + 뷰 토글 */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1">
          <SortChips chips={chips} activeKey={sortBy} onSelect={handleSort} />
        </div>
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => setViewMode('card')}
            className={cn('p-1.5 rounded-md transition-colors', viewMode === 'card' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600')}
            title="카드 뷰"
          >
            <LayoutList className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={cn('p-1.5 rounded-md transition-colors', viewMode === 'table' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600')}
            title="테이블 뷰"
          >
            <Table2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 랭킹 리스트 */}
      {isLoading ? (
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
      ) : rankings.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
          <Trophy className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500 mb-4">랭킹 데이터가 없습니다.</p>
          <button
            onClick={() => refreshMutation.mutate()}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
          >
            랭킹 생성하기
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <RankingTable rankings={sorted} sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} enabledEvents={enabledEvents} />
      ) : (
        <CompactPlayerList
          rankings={sorted}
          sortBy={sortBy}
          enabledEvents={enabledEvents}
        />
      )}
    </div>
  )
}

// ── 테이블 뷰 ─────────────────────────────────────
const TABLE_COLS: { key: string; label: string; event?: string }[] = [
  { key: 'goals', label: '득점' },
  { key: 'assists', label: '도움' },
  { key: 'attackPoints', label: '공격P' },
  { key: 'games', label: '경기' },
  { key: 'sessionWins', label: '승' },
  { key: 'sessionLosses', label: '패' },
  { key: 'winRate', label: '승률' },
  { key: 'mvpScore', label: '평점' },
  { key: 'mvpCount', label: 'MVP' },
  { key: 'defenses', label: '수비', event: 'DEFENSE' },
  { key: 'tackles', label: '태클', event: 'TACKLE' },
  { key: 'interceptions', label: '인터셉트', event: 'INTERCEPTION' },
  { key: 'clearances', label: '클리어런스', event: 'CLEARANCE' },
  { key: 'saves', label: '선방', event: 'SAVE' },
  { key: 'keyPasses', label: '키패스', event: 'KEY_PASS' },
  { key: 'dribbles', label: '돌파', event: 'DRIBBLE' },
  { key: 'shotsOn', label: '유효슈팅', event: 'SHOT_ON' },
  { key: 'shotsOff', label: '무효슈팅', event: 'SHOT_OFF' },
]

function getCellValue(player: any, key: string): string {
  if (key === 'attackPoints') return String((player.goals || 0) + (player.assists || 0))
  if (key === 'winRate') return player.winRate ? player.winRate + '%' : '-'
  if (key === 'mvpScore') return player.mvpScore != null ? Number(player.mvpScore).toFixed(1) : '0.0'
  return String(player[key] ?? 0)
}

function RankingTable({ rankings, sortBy, sortOrder, onSort, enabledEvents }: {
  rankings: any[]; sortBy: string; sortOrder: 'asc' | 'desc'; onSort: (key: string) => void; enabledEvents: string[]
}) {
  const visibleCols = TABLE_COLS.filter(c => !c.event || enabledEvents.includes(c.event))

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 w-10">#</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 min-w-[100px]">선수</th>
            {visibleCols.map(col => (
              <th
                key={col.key}
                onClick={() => onSort(col.key)}
                className={cn(
                  'px-2 py-2.5 text-center text-xs font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors whitespace-nowrap',
                  sortBy === col.key ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'text-slate-500'
                )}
              >
                {col.label}
                {sortBy === col.key && (
                  <span className="ml-0.5">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rankings.map((player, i) => {
            const rank = i + 1
            return (
              <tr
                key={player.id}
                className={cn(
                  'border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors',
                  rank <= 3 && 'bg-amber-50/30 dark:bg-amber-500/5'
                )}
              >
                <td className="px-3 py-2.5 text-center">
                  <span className={cn(
                    'inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold',
                    rank === 1 ? 'bg-amber-500 text-white' : rank === 2 ? 'bg-slate-400 text-white' : rank === 3 ? 'bg-amber-700 text-white' : 'text-slate-400'
                  )}>
                    {rank}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <Link href={`/ranking/${player.id}`} className="text-sm font-semibold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                    {player.name}
                  </Link>
                </td>
                {visibleCols.map(col => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-2 py-2.5 text-center text-sm tabular-nums',
                      sortBy === col.key
                        ? 'font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/5'
                        : 'text-slate-700 dark:text-slate-300'
                    )}
                  >
                    {getCellValue(player, col.key)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
