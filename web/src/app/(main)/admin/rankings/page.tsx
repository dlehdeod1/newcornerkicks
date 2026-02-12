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
import { useAuthStore } from '@/stores/auth'
import { rankingsApi } from '@/lib/api'
import { cn } from '@/lib/cn'

export default function AdminRankingsPage() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const { isAdmin, isLoggedIn, token } = useAuthStore()
  const queryClient = useQueryClient()

  if (!isLoggedIn || !isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">접근 권한이 없습니다</h2>
        <Link href="/" className="text-emerald-600 hover:underline">홈으로 돌아가기</Link>
      </div>
    )
  }

  const { data, isLoading } = useQuery({
    queryKey: ['rankings', selectedYear],
    queryFn: () => rankingsApi.get(selectedYear),
  })

  const refreshMutation = useMutation({
    mutationFn: () => rankingsApi.refresh(selectedYear, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rankings', selectedYear] })
    },
  })

  const rankingsData = data?.data || {}
  const rankings = rankingsData.rankings || []
  const updatedAt = data?.updatedAt

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
        />
        <StatCard
          icon={<Target className="w-5 h-5" />}
          label="총 골"
          value={rankingsData.totalGoals || 0}
          color="red"
        />
        <StatCard
          icon={<Shield className="w-5 h-5" />}
          label="총 어시스트"
          value={rankingsData.totalAssists || 0}
          color="emerald"
        />
        <StatCard
          icon={<Flame className="w-5 h-5" />}
          label="총 세션"
          value={rankingsData.totalSessions || 0}
          color="amber"
        />
      </div>

      {/* 랭킹 테이블 */}
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
        <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">#</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">선수</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">경기</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">골</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">도움</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">수비</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">승/무/패</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">승률</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-amber-500">MVP점수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rankings.slice(0, 20).map((player: any, idx: number) => (
                  <tr key={player.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <span className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                        idx === 0 && 'bg-amber-100 text-amber-600',
                        idx === 1 && 'bg-slate-200 text-slate-600',
                        idx === 2 && 'bg-orange-100 text-orange-600',
                        idx > 2 && 'bg-slate-100 text-slate-500'
                      )}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {player.name}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">
                      {player.games}
                    </td>
                    <td className="px-4 py-3 text-center text-red-600 dark:text-red-400 font-medium">
                      {player.goals}
                    </td>
                    <td className="px-4 py-3 text-center text-blue-600 dark:text-blue-400">
                      {player.assists}
                    </td>
                    <td className="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400">
                      {player.defenses}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400 text-sm">
                      {player.wins}/{player.draws}/{player.losses}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">
                      {player.winRate}%
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-amber-600 dark:text-amber-400">
                      {player.mvpScore?.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: 'blue' | 'red' | 'emerald' | 'amber'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
  }

  return (
    <div className={cn('rounded-xl p-4', colorClasses[color])}>
      <div className="flex items-center gap-2 mb-2 opacity-80">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
