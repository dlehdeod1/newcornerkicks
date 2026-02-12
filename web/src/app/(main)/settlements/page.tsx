'use client'

import { useQuery } from '@tanstack/react-query'
import { Coins, Trophy, TrendingUp, Calendar, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth'
import { settlementsApi } from '@/lib/api'
import { cn } from '@/lib/cn'

export default function SettlementsPage() {
  const { isLoggedIn, token } = useAuthStore()
  const currentYear = new Date().getFullYear()

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['settlements-summary', currentYear],
    queryFn: () => settlementsApi.summary(currentYear),
  })

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['settlements-history'],
    queryFn: () => settlementsApi.myHistory(token!),
    enabled: isLoggedIn && !!token,
  })

  const summary = summaryData?.summary
  const history = historyData?.history || []

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
          정산
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          시즌 정산 현황과 개인 수익을 확인하세요
        </p>
      </div>

      {/* 시즌 요약 */}
      <div className="bg-white dark:bg-slate-900/50 backdrop-blur rounded-3xl p-6 border border-slate-200 dark:border-slate-800/50 shadow-sm mb-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
          {currentYear}년 시즌 요약
        </h2>

        {summaryLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="총 세션"
              value={summary?.totalSessions || 0}
              suffix="회"
              color="slate"
            />
            <StatCard
              label="총 상금 풀"
              value={summary?.totalPot || 0}
              suffix="원"
              color="emerald"
              isAmount
            />
            <StatCard
              label="운영비"
              value={summary?.operationFee || 0}
              suffix="원"
              color="amber"
              isAmount
            />
            <StatCard
              label="지급 상금"
              value={summary?.totalPrize || 0}
              suffix="원"
              color="blue"
              isAmount
            />
          </div>
        )}
      </div>

      {/* 개인 정산 이력 */}
      {isLoggedIn ? (
        <div className="bg-white dark:bg-slate-900/50 backdrop-blur rounded-3xl p-6 border border-slate-200 dark:border-slate-800/50 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            내 정산 이력
          </h2>

          {historyLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Coins className="w-8 h-8 text-slate-400 dark:text-slate-600" />
              </div>
              <p className="text-slate-500 dark:text-slate-400">
                아직 정산 이력이 없습니다.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item: any) => (
                <SettlementHistoryItem key={item.id} item={item} />
              ))}
            </div>
          )}

          {/* 총 수익 */}
          {history.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">총 수익</span>
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatAmount(history.reduce((sum: number, item: any) => sum + (item.amount || 0), 0))}원
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900/50 backdrop-blur rounded-3xl p-8 border border-slate-200 dark:border-slate-800/50 shadow-sm text-center">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Coins className="w-8 h-8 text-slate-400 dark:text-slate-600" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            로그인하면 개인 정산 이력을 확인할 수 있습니다.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            로그인하기
          </Link>
        </div>
      )}

      {/* 최근 세션 정산 */}
      <div className="mt-6 bg-white dark:bg-slate-900/50 backdrop-blur rounded-3xl p-6 border border-slate-200 dark:border-slate-800/50 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          최근 세션 정산
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-center py-8">
          세션별 정산 내역이 여기에 표시됩니다.
        </p>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  suffix,
  color,
  isAmount = false,
}: {
  label: string
  value: number
  suffix: string
  color: 'slate' | 'emerald' | 'amber' | 'blue'
  isAmount?: boolean
}) {
  const colorClasses = {
    slate: 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
    blue: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
  }

  return (
    <div className={cn('rounded-xl p-4', colorClasses[color])}>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className="text-xl font-bold">
        {isAmount ? formatAmount(value) : value}{suffix}
      </p>
    </div>
  )
}

function SettlementHistoryItem({ item }: { item: any }) {
  const isPrize = item.type === 'team' || item.type === 'mvp'

  return (
    <Link
      href={`/sessions/${item.sessionId}`}
      className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors group"
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center',
          item.type === 'mvp'
            ? 'bg-amber-100 dark:bg-amber-500/20'
            : 'bg-emerald-100 dark:bg-emerald-500/20'
        )}>
          {item.type === 'mvp' ? (
            <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          ) : (
            <Coins className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          )}
        </div>
        <div>
          <p className="font-medium text-slate-900 dark:text-white">
            {item.sessionDate} {item.type === 'mvp' ? 'MVP 상금' : `${item.rank}등 상금`}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {item.teamName && `${item.teamName} · `}
            {item.type === 'mvp' ? 'MVP 선정' : `팀 ${item.rank}위`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
          +{formatAmount(item.amount)}원
        </span>
        <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-emerald-500 transition-colors" />
      </div>
    </Link>
  )
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR')
}
