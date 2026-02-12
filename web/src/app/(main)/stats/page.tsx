'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  TrendingUp,
  Target,
  Shield,
  Users,
  Calendar,
  Award,
  Flame,
  Trophy,
  Star,
} from 'lucide-react'
import { rankingsApi, settlementsApi } from '@/lib/api'
import { cn } from '@/lib/cn'

export default function StatsPage() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)

  const { data: rankingsData, isLoading: rankingsLoading } = useQuery({
    queryKey: ['rankings', selectedYear],
    queryFn: () => rankingsApi.get(selectedYear),
  })

  const { data: settlementData, isLoading: settlementLoading } = useQuery({
    queryKey: ['settlements-summary', selectedYear],
    queryFn: () => settlementsApi.summary(selectedYear),
  })

  const rankings = rankingsData?.data || {}
  const summary = settlementData?.summary || {}

  const isLoading = rankingsLoading || settlementLoading

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
            통계 대시보드
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            코너킥스 시즌 통계를 한눈에 확인하세요
          </p>
        </div>

        {/* 연도 선택 */}
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {[currentYear, currentYear - 1, currentYear - 2].map((year) => (
            <option key={year} value={year}>
              {year}년 시즌
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20 mb-2" />
              <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-16" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* 핵심 통계 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={<Calendar className="w-5 h-5" />}
              label="총 세션"
              value={summary.totalSessions || 0}
              suffix="회"
              color="blue"
            />
            <StatCard
              icon={<Users className="w-5 h-5" />}
              label="참여 선수"
              value={rankings.totalPlayers || 0}
              suffix="명"
              color="emerald"
            />
            <StatCard
              icon={<Target className="w-5 h-5" />}
              label="총 골"
              value={rankings.totalGoals || 0}
              suffix="골"
              color="red"
            />
            <StatCard
              icon={<Trophy className="w-5 h-5" />}
              label="총 상금"
              value={summary.totalPot || 0}
              suffix="원"
              color="amber"
              isAmount
            />
          </div>

          {/* 랭킹 카드들 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* MVP 랭킹 (횟수 기반) */}
            <RankingCard
              title="MVP 랭킹"
              icon={<Star className="w-5 h-5 text-amber-500" />}
              items={(rankings.mvpRanking || []).slice(0, 5)}
              valueKey="mvpCount"
              valueLabel="회"
              emptyMessage="MVP 데이터가 없습니다"
            />

            {/* 득점 랭킹 */}
            <RankingCard
              title="득점 랭킹"
              icon={<Target className="w-5 h-5 text-red-500" />}
              items={(rankings.goalRanking || []).slice(0, 5)}
              valueKey="goals"
              valueLabel="골"
              emptyMessage="득점 데이터가 없습니다"
            />

            {/* 어시스트 랭킹 */}
            <RankingCard
              title="어시스트 랭킹"
              icon={<TrendingUp className="w-5 h-5 text-blue-500" />}
              items={(rankings.assistRanking || []).slice(0, 5)}
              valueKey="assists"
              valueLabel="도움"
              emptyMessage="어시스트 데이터가 없습니다"
            />

            {/* 수비 랭킹 */}
            <RankingCard
              title="수비 랭킹"
              icon={<Shield className="w-5 h-5 text-emerald-500" />}
              items={(rankings.defenseRanking || []).slice(0, 5)}
              valueKey="defenses"
              valueLabel="수비"
              emptyMessage="수비 데이터가 없습니다"
            />

            {/* 출석 랭킹 */}
            <RankingCard
              title="출석 랭킹"
              icon={<Flame className="w-5 h-5 text-orange-500" />}
              items={(rankings.attendanceRanking || []).slice(0, 5)}
              valueKey="attendance"
              valueLabel="회"
              emptyMessage="출석 데이터가 없습니다"
            />

            {/* 우승률 랭킹 */}
            <RankingCard
              title="우승률 랭킹"
              icon={<Award className="w-5 h-5 text-purple-500" />}
              items={(rankings.winRateRanking || []).slice(0, 5)}
              valueKey="winRate"
              valueLabel="%"
              emptyMessage="우승률 데이터가 없습니다"
            />
          </div>

          {/* 득점 분포 차트 (간단 바) */}
          <div className="mt-8 bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              득점 분포
            </h3>

            {(rankings.goalRanking || []).length === 0 ? (
              <p className="text-center text-slate-500 py-8">득점 데이터가 없습니다</p>
            ) : (
              <div className="space-y-3">
                {(rankings.goalRanking || []).slice(0, 10).map((player: any, index: number) => {
                  const maxGoals = Math.max(...(rankings.goalRanking || []).map((p: any) => p.goals || 0))
                  const percentage = ((player.goals || 0) / maxGoals) * 100

                  return (
                    <div key={player.id} className="flex items-center gap-4">
                      <span className="w-6 text-sm text-slate-500 dark:text-slate-400">
                        {index + 1}
                      </span>
                      <span className="w-20 text-sm font-medium text-slate-900 dark:text-white truncate">
                        {player.name}
                      </span>
                      <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                          style={{ width: `${Math.max(percentage, 10)}%` }}
                        >
                          <span className="text-xs font-bold text-white">
                            {player.goals}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 시즌 요약 - 카테고리별 */}
          <div className="mt-8 space-y-6">
            {/* 경기 통계 */}
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-red-500" />
                경기 통계
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryItem
                  label="총 경기 수"
                  value={`${rankings.totalMatches || 0}경기`}
                />
                <SummaryItem
                  label="총 골"
                  value={`${rankings.totalGoals || 0}골`}
                />
                <SummaryItem
                  label="총 어시스트"
                  value={`${rankings.totalAssists || 0}개`}
                />
                <SummaryItem
                  label="총 수비"
                  value={`${rankings.totalDefenses || 0}회`}
                />
              </div>
            </div>

            {/* 평균 통계 */}
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                평균 통계
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryItem
                  label="경기당 평균 골"
                  value={(rankings.avgGoalsPerMatch || 0).toFixed(1)}
                />
                <SummaryItem
                  label="세션당 평균 참석"
                  value={`${(rankings.avgAttendancePerSession || 0).toFixed(1)}명`}
                />
                <SummaryItem
                  label="세션당 평균 경기"
                  value={rankings.totalSessions > 0 ? ((rankings.totalMatches || 0) / rankings.totalSessions).toFixed(1) : '0.0'}
                />
                <SummaryItem
                  label="선수당 평균 골"
                  value={rankings.totalPlayers > 0 ? ((rankings.totalGoals || 0) / rankings.totalPlayers).toFixed(1) : '0.0'}
                />
              </div>
            </div>

            {/* 참여 통계 */}
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                참여 통계
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryItem
                  label="총 세션"
                  value={`${summary.totalSessions || rankings.totalSessions || 0}회`}
                />
                <SummaryItem
                  label="참여 선수"
                  value={`${rankings.totalPlayers || 0}명`}
                />
                <SummaryItem
                  label="최다 출석"
                  value={rankings.attendanceRanking?.[0] ? `${rankings.attendanceRanking[0].name} (${rankings.attendanceRanking[0].attendance}회)` : '-'}
                />
                <SummaryItem
                  label="최다 득점"
                  value={rankings.goalRanking?.[0] ? `${rankings.goalRanking[0].name} (${rankings.goalRanking[0].goals}골)` : '-'}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  suffix,
  color,
  isAmount = false,
}: {
  icon: React.ReactNode
  label: string
  value: number
  suffix: string
  color: 'blue' | 'emerald' | 'red' | 'amber'
  isAmount?: boolean
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
  }

  return (
    <div className={cn('rounded-2xl p-5 border', colorClasses[color])}>
      <div className="flex items-center gap-2 mb-2 opacity-80">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="text-2xl font-bold">
        {isAmount ? value.toLocaleString() : value}{suffix}
      </p>
    </div>
  )
}

function RankingCard({
  title,
  icon,
  items,
  valueKey,
  valueLabel,
  emptyMessage,
}: {
  title: string
  icon: React.ReactNode
  items: any[]
  valueKey: string
  valueLabel: string
  emptyMessage: string
}) {
  return (
    <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800/50 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        {icon}
        <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
      </div>

      <div className="p-4">
        {items.length === 0 ? (
          <p className="text-center text-slate-500 dark:text-slate-400 py-4 text-sm">
            {emptyMessage}
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item: any, index: number) => (
              <div key={item.id} className="flex items-center gap-3">
                <span className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                  index === 0 && 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
                  index === 1 && 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
                  index === 2 && 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400',
                  index > 2 && 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                )}>
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {item.name || item.player_name}
                  </p>
                </div>
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                  {item[valueKey]}{valueLabel}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  )
}
