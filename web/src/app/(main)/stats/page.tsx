'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp,
  Target,
  Shield,
  Users,
  Calendar,
  Award,
  Flame,
  Trophy,
  Star,
  Heart,
  Swords,
  Handshake,
  Zap,
  User,
} from 'lucide-react'
import { rankingsApi, settlementsApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/stores/auth'

export default function StatsPage() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const { player, isLoggedIn, token } = useAuthStore()
  const myName = player?.name || null

  const { data: rankingsData, isLoading: rankingsLoading } = useQuery({
    queryKey: ['rankings', selectedYear, token],
    queryFn: () => rankingsApi.get(selectedYear, token ?? undefined),
  })

  const { data: settlementData, isLoading: settlementLoading } = useQuery({
    queryKey: ['settlements-summary', selectedYear, token],
    queryFn: () => settlementsApi.summary(selectedYear, token ?? undefined),
  })

  const { data: funStatsData, isLoading: funStatsLoading } = useQuery({
    queryKey: ['fun-stats', selectedYear, token],
    queryFn: () => rankingsApi.funStats(selectedYear, token ?? undefined),
  })

  const { data: myStatsData, isLoading: myStatsLoading } = useQuery({
    queryKey: ['my-stats', selectedYear, player?.id],
    queryFn: () => rankingsApi.myStats(player!.id, selectedYear, token ?? undefined),
    enabled: !!player,
  })

  const rankings = rankingsData?.data || {}
  const summary = settlementData?.summary || {}
  const funStats = funStatsData || {}
  const myStats = myStatsData || null

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
              myName={myName}
            />

            {/* 득점 랭킹 */}
            <RankingCard
              title="득점 랭킹"
              icon={<Target className="w-5 h-5 text-red-500" />}
              items={(rankings.goalRanking || []).slice(0, 5)}
              valueKey="goals"
              valueLabel="골"
              emptyMessage="득점 데이터가 없습니다"
              myName={myName}
            />

            {/* 어시스트 랭킹 */}
            <RankingCard
              title="어시스트 랭킹"
              icon={<TrendingUp className="w-5 h-5 text-blue-500" />}
              items={(rankings.assistRanking || []).slice(0, 5)}
              valueKey="assists"
              valueLabel="도움"
              emptyMessage="어시스트 데이터가 없습니다"
              myName={myName}
            />

            {/* 수비 랭킹 */}
            <RankingCard
              title="수비 랭킹"
              icon={<Shield className="w-5 h-5 text-emerald-500" />}
              items={(rankings.defenseRanking || []).slice(0, 5)}
              valueKey="defenses"
              valueLabel="수비"
              emptyMessage="수비 데이터가 없습니다"
              myName={myName}
            />

            {/* 출석 랭킹 */}
            <RankingCard
              title="출석 랭킹"
              icon={<Flame className="w-5 h-5 text-orange-500" />}
              items={(rankings.attendanceRanking || []).slice(0, 5)}
              valueKey="attendance"
              valueLabel="회"
              emptyMessage="출석 데이터가 없습니다"
              myName={myName}
            />

            {/* 우승률 랭킹 */}
            <RankingCard
              title="우승률 랭킹"
              icon={<Award className="w-5 h-5 text-purple-500" />}
              items={(rankings.winRateRanking || []).slice(0, 5)}
              valueKey="winRate"
              valueLabel="%"
              emptyMessage="우승률 데이터가 없습니다"
              myName={myName}
            />
          </div>

          {/* 재미 통계 */}
          {!funStatsLoading && (
            <div className="mt-8 space-y-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                재미 통계
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 최고의 듀오 */}
                <FunStatCard
                  title="⚡ 최고의 골+어시 듀오"
                  description="서로 골·어시스트 주고받은 횟수 합산"
                  icon={<Handshake className="w-5 h-5 text-amber-500" />}
                  items={(funStats.goalDuos || []).map((d: any) => ({
                    label: `${d.player1} & ${d.player2}`,
                    value: `${d.combo_count}회 콤비`,
                    highlight: d.combo_count >= 3,
                  }))}
                  emptyMessage="어시스트 데이터가 부족합니다"
                  accentColor="amber"
                  myName={myName}
                />

                {/* 베스트 파트너 */}
                <FunStatCard
                  title="🤝 베스트 파트너"
                  description="같은 팀에서 승률이 높은 조합 (최소 6경기)"
                  icon={<Heart className="w-5 h-5 text-rose-500" />}
                  items={(funStats.bestPartners || []).map((d: any) => ({
                    label: `${d.player1} & ${d.player2}`,
                    value: `승률 ${d.win_rate}% (${d.games_together}경기)`,
                    highlight: d.win_rate >= 70,
                  }))}
                  emptyMessage="데이터가 부족합니다"
                  accentColor="rose"
                  myName={myName}
                />

                {/* 최악의 궁합 */}
                <FunStatCard
                  title="💀 최악의 궁합"
                  description="같은 팀에서 승률이 낮은 조합 (최소 6경기)"
                  icon={<Users className="w-5 h-5 text-slate-500" />}
                  items={(funStats.worstPartners || []).map((d: any) => ({
                    label: `${d.player1} & ${d.player2}`,
                    value: `승률 ${d.win_rate}% (${d.games_together}경기)`,
                    highlight: false,
                  }))}
                  emptyMessage="데이터가 부족합니다"
                  accentColor="blue"
                  myName={myName}
                />

                {/* 천적 관계 */}
                <FunStatCard
                  title="⚔️ 천적 관계"
                  description="상대팀에서 만났을 때 골을 많이 넣은 선수"
                  icon={<Swords className="w-5 h-5 text-purple-500" />}
                  items={(funStats.rivals || []).map((d: any) => ({
                    label: `${d.scorer}이 ${d.opponent} 상대로`,
                    value: `${d.goals_against}골 (${d.matches_faced}경기)`,
                    highlight: d.goals_against >= 5,
                  }))}
                  emptyMessage="데이터가 부족합니다"
                  accentColor="purple"
                  myName={myName}
                />
              </div>
            </div>
          )}

          {/* 내 개인 통계 - 로그인 시 표시 */}
          {isLoggedIn && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-500" />
                  {player ? `${player.name}의 개인 통계` : '내 개인 통계'}
                </h2>
                <span className="text-xs bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-semibold">
                  나만의 통계
                </span>
              </div>

              {!player || myStatsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 animate-pulse border border-slate-200 dark:border-slate-800/50">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-40 mb-4" />
                      <div className="space-y-2">
                        {[1, 2, 3].map((j) => (
                          <div key={j} className="h-9 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 함께할 때 잘 이기는 팀원 */}
                  <MyStatCard
                    title="🏆 함께하면 최강 팀원"
                    description="같은 팀일 때 승률이 높은 팀원 (최소 3경기)"
                    items={(myStats?.teammates || []).map((d: any) => ({
                      label: d.teammate,
                      value: `승률 ${d.win_rate}% (${d.games_together}경기)`,
                    }))}
                    emptyMessage="아직 데이터가 부족합니다 (최소 3경기 필요)"
                    accentColor="emerald"
                  />

                  {/* 함께하면 망하는 팀원 */}
                  <MyStatCard
                    title="💀 함께하면 망하는 팀원"
                    description="같은 팀일 때 승률이 낮은 팀원 (최소 3경기)"
                    items={(myStats?.worstTeammates || []).map((d: any) => ({
                      label: d.teammate,
                      value: `승률 ${d.win_rate}% (${d.games_together}경기)`,
                    }))}
                    emptyMessage="아직 데이터가 부족합니다"
                    accentColor="red"
                  />

                  {/* 나한테 어시스트 많이 해준 선수 */}
                  <MyStatCard
                    title="🅰️ 나한테 어시스트 많이 해준 선수"
                    description="내 골을 도와준 고마운 팀원"
                    items={(myStats?.assistedToMe || []).map((d: any) => ({
                      label: d.assister,
                      value: `${d.assist_count}회`,
                    }))}
                    emptyMessage="아직 어시스트 데이터가 없습니다"
                    accentColor="blue"
                  />

                  {/* 내가 어시스트 많이 해준 선수 */}
                  <MyStatCard
                    title="⚡ 내가 어시스트 많이 해준 선수"
                    description="내 패스로 골을 넣은 선수"
                    items={(myStats?.myAssists || []).map((d: any) => ({
                      label: d.scorer,
                      value: `${d.assist_count}회`,
                    }))}
                    emptyMessage="아직 어시스트 데이터가 없습니다"
                    accentColor="amber"
                  />
                </div>
              )}
            </div>
          )}

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
  myName,
}: {
  title: string
  icon: React.ReactNode
  items: any[]
  valueKey: string
  valueLabel: string
  emptyMessage: string
  myName?: string | null
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
            {items.map((item: any, index: number) => {
              const itemName = item.name || item.player_name
              const isMe = myName ? itemName === myName : false
              return (
              <div key={item.id} className={cn(
                'flex items-center gap-3 px-2 py-1 rounded-xl transition-colors',
                isMe && 'bg-emerald-50 dark:bg-emerald-500/10 ring-1 ring-emerald-400 dark:ring-emerald-500'
              )}>
                <span className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                  isMe
                    ? 'bg-emerald-200 dark:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : index === 0 && 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
                  !isMe && index === 1 && 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
                  !isMe && index === 2 && 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400',
                  !isMe && index > 2 && 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                )}>
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0 flex items-center gap-1">
                  <p className={cn(
                    'text-sm font-medium truncate',
                    isMe ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-900 dark:text-white'
                  )}>
                    {itemName}
                  </p>
                  {isMe && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">← 나</span>}
                </div>
                <span className={cn(
                  'text-sm font-bold shrink-0',
                  isMe ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'
                )}>
                  {item[valueKey]}{valueLabel}
                </span>
              </div>
              )
            })}
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

function highlightMyName(label: string, myName: string | null) {
  if (!myName || !label.includes(myName)) return <span>{label}</span>
  const parts = label.split(myName)
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span className="font-bold text-emerald-600 dark:text-emerald-400 underline underline-offset-2">
              {myName}
            </span>
          )}
        </span>
      ))}
    </>
  )
}

function MyStatCard({
  title,
  description,
  items,
  emptyMessage,
  accentColor,
}: {
  title: string
  description?: string
  items: { label: string; value: string }[]
  emptyMessage: string
  accentColor: 'emerald' | 'red' | 'blue' | 'amber'
}) {
  const accentClasses = {
    emerald: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15',
    red: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15',
    blue: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15',
    amber: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15',
  }

  const medalClasses = [
    'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
    'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400',
  ]

  return (
    <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800/50 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
        {description && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{description}</p>
        )}
      </div>
      <div className="p-4">
        {items.length === 0 ? (
          <p className="text-center text-slate-500 dark:text-slate-400 py-4 text-sm">{emptyMessage}</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-center justify-between px-3 py-2.5 rounded-xl',
                  index === 0 ? accentClasses[accentColor] : 'bg-slate-50 dark:bg-slate-800/50'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className={cn(
                    'text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                    index === 0
                      ? 'bg-white/60 dark:bg-black/20'
                      : index < 3
                        ? medalClasses[index]
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                  )}>
                    {index + 1}
                  </span>
                  <span className={cn(
                    'text-sm font-semibold',
                    index === 0 ? '' : 'text-slate-900 dark:text-white'
                  )}>
                    {item.label}
                  </span>
                </div>
                <span className={cn(
                  'text-sm font-bold shrink-0',
                  index === 0 ? '' : 'text-slate-500 dark:text-slate-400'
                )}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FunStatCard({
  title,
  description,
  icon,
  items,
  emptyMessage,
  accentColor,
  myName,
}: {
  title: string
  description?: string
  icon: React.ReactNode
  items: { label: string; value: string; highlight: boolean }[]
  emptyMessage: string
  accentColor: 'amber' | 'rose' | 'blue' | 'purple'
  myName?: string | null
}) {
  const accentClasses = {
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10',
    rose: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10',
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10',
  }

  return (
    <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800/50 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
        </div>
        {description && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{description}</p>
        )}
      </div>
      <div className="p-4">
        {items.length === 0 ? (
          <p className="text-center text-slate-500 dark:text-slate-400 py-4 text-sm">{emptyMessage}</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, index) => {
              const isMe = myName ? item.label.includes(myName) : false
              return (
                <div key={index} className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-xl ring-1 ring-transparent transition-colors',
                  isMe
                    ? 'ring-emerald-400 dark:ring-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                    : index === 0
                      ? accentClasses[accentColor]
                      : 'bg-slate-50 dark:bg-slate-800/50'
                )}>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center',
                      isMe
                        ? 'bg-emerald-200 dark:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                        : index === 0
                          ? 'bg-white/60 dark:bg-black/20'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    )}>
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {highlightMyName(item.label, myName ?? null)}
                    </span>
                    {isMe && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">← 나</span>}
                  </div>
                  <span className={cn(
                    'text-sm font-bold',
                    isMe ? 'text-emerald-600 dark:text-emerald-400' : index === 0 ? '' : 'text-slate-600 dark:text-slate-300'
                  )}>
                    {item.value}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
