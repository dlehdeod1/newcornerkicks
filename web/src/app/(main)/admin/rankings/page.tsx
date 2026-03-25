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

      {/* 정렬 칩 */}
      <div className="mb-4">
        <SortChips chips={chips} activeKey={sortBy} onSelect={handleSort} />
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
