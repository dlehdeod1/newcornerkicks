'use client'

import { useAuthStore } from '@/stores/auth'

export const runtime = 'edge'

import { use, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, Trophy, Target, Handshake, Shield, Calendar, TrendingUp, User, Gamepad2, ChevronDown, ChevronUp } from 'lucide-react'
import { playersApi, rankingsApi } from '@/lib/api'
import { cn } from '@/lib/cn'

type LogTab = 'goals' | 'assists' | 'defenses' | 'mvp' | 'placements'

export default function PlayerStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { token } = useAuthStore()
  const { id } = use(params)
  const currentYear = new Date().getFullYear()
  const [activeLogTab, setActiveLogTab] = useState<LogTab>('goals')

  const { data: playerData, isLoading: playerLoading } = useQuery({
    queryKey: ['player', id],
    queryFn: () => playersApi.get(Number(id)),
  })

  const { data: rankingsData } = useQuery({
    queryKey: ['rankings', currentYear],
    queryFn: () => rankingsApi.get(currentYear, token ?? undefined),
  })

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['player-event-logs', id, currentYear],
    queryFn: () => playersApi.eventLogs(Number(id), currentYear),
  })

  const player = playerData?.player
  const rankings = rankingsData?.data?.rankings || []
  const sortedRankings = [...rankings].sort((a: any, b: any) => (b.mvpCount || 0) - (a.mvpCount || 0))
  const playerRank = sortedRankings.findIndex((p: any) => p.id === Number(id)) + 1 || null
  const playerStats = rankings.find((p: any) => p.id === Number(id))

  if (playerLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-32 mb-8" />
          <div className="bg-white dark:bg-slate-900/50 rounded-3xl p-8 border border-slate-200 dark:border-slate-800/50">
            <div className="flex items-center gap-6 mb-8">
              <div className="w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
              <div className="flex-1">
                <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-48 mb-2" />
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-32" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-slate-400 dark:text-slate-600" />
          </div>
          <p className="text-slate-500 mb-4">선수를 찾을 수 없습니다.</p>
          <Link href="/ranking" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300">
            랭킹으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  const goals = logsData?.goals || []
  const assists = logsData?.assists || []
  const defenses = logsData?.defenses || []
  const mvpRecords = logsData?.mvpRecords || []
  const placements = logsData?.placements || []

  const logTabs: { key: LogTab; label: string; icon: string; count: number; color: string }[] = [
    { key: 'goals', label: '득점', icon: '⚽', count: goals.length, color: 'amber' },
    { key: 'assists', label: '도움', icon: '⚡', count: assists.length, color: 'blue' },
    { key: 'defenses', label: '수비', icon: '🛡️', count: defenses.length, color: 'purple' },
    { key: 'mvp', label: 'MVP', icon: '🏆', count: mvpRecords.length, color: 'emerald' },
    { key: 'placements', label: '순위', icon: '🏅', count: placements.length, color: 'orange' },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 뒤로가기 */}
      <Link
        href="/ranking"
        className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        선수/랭킹
      </Link>

      {/* 프로필 카드 */}
      <div className="bg-white dark:bg-slate-900/50 backdrop-blur rounded-3xl p-8 border border-slate-200 dark:border-slate-800/50 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <div className="relative">
            <div className="w-28 h-28 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 rounded-2xl flex items-center justify-center border border-slate-300 dark:border-slate-700 shadow-xl">
              {player.photo_url ? (
                <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <span className="text-5xl text-slate-600 dark:text-slate-300">{player.name.charAt(0)}</span>
              )}
            </div>
            {playerRank && playerRank <= 3 && (
              <div className="absolute -top-3 -right-3 text-2xl">
                {playerRank === 1 ? '🥇' : playerRank === 2 ? '🥈' : '🥉'}
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{player.name}</h1>
              {player.nickname && (
                <span className="text-lg text-slate-500">({player.nickname})</span>
              )}
            </div>

            {playerRank && (
              <div className="flex items-center gap-2 mb-4">
                <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full text-sm font-medium border border-emerald-200 dark:border-emerald-500/30">
                  MVP 순위 {playerRank}위
                </span>
                <span className="text-sm text-slate-500">{currentYear}년 시즌</span>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <StatBadge icon={<Trophy className="w-5 h-5" />} label="MVP" value={`${playerStats?.mvpCount || 0}회`} color="emerald" />
              <StatBadge icon={<Target className="w-5 h-5" />} label="득점" value={playerStats?.goals || 0} color="amber" />
              <StatBadge icon={<Handshake className="w-5 h-5" />} label="도움" value={playerStats?.assists || 0} color="blue" />
              <StatBadge icon={<Shield className="w-5 h-5" />} label="수비" value={playerStats?.defenses || 0} color="purple" />
              <StatBadge icon={<Gamepad2 className="w-5 h-5" />} label="경기" value={`${playerStats?.games || 0}경기`} color="slate" />
            </div>
          </div>
        </div>
      </div>

      {/* 시즌 스탯 상세 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-slate-900/50 backdrop-blur rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            공격 스탯
          </h2>
          <div className="space-y-4">
            <StatRow label="득점" value={playerStats?.goals || 0} max={30} color="amber" />
            <StatRow label="도움" value={playerStats?.assists || 0} max={20} color="blue" />
            <StatRow label="경기당 득점" value={playerStats?.games ? (playerStats.goals / playerStats.games).toFixed(2) : '0'} max={2} color="emerald" isDecimal />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 backdrop-blur rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-500 dark:text-purple-400" />
            수비 & 경기 기록
          </h2>
          <div className="space-y-4">
            <StatRow label="수비 포인트" value={playerStats?.defenses || 0} max={50} color="purple" />
            <StatRow label="경기 참여" value={playerStats?.games || 0} max={50} color="slate" />
            <StatRow label="승리" value={playerStats?.wins || 0} max={30} color="emerald" />
          </div>
        </div>
      </div>

      {/* 기록 근거 로그 */}
      <div className="bg-white dark:bg-slate-900/50 backdrop-blur rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50 shadow-sm mb-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          기록 상세 로그
        </h2>

        {/* 탭 */}
        <div className="flex flex-wrap gap-2 mb-4">
          {logTabs.map((tab) => {
            const colorMap: Record<string, string> = {
              amber: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30',
              blue: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/30',
              purple: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-500/30',
              emerald: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30',
              orange: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-500/30',
            }
            const isActive = activeLogTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveLogTab(tab.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                  isActive
                    ? colorMap[tab.color]
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                )}
              >
                <span>{tab.icon}</span>
                {tab.label}
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded-full',
                  isActive ? 'bg-white/30 dark:bg-black/20' : 'bg-slate-200 dark:bg-slate-700'
                )}>{tab.count}</span>
              </button>
            )
          })}
        </div>

        {/* 로그 내용 */}
        {logsLoading ? (
          <div className="py-8 text-center text-slate-400">로딩 중...</div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {activeLogTab === 'goals' && (
              goals.length === 0 ? <EmptyLog message="득점 기록이 없습니다" /> :
                goals.map((g: any, i: number) => (
                  <EventRow key={i}
                    icon="⚽" date={g.session_date}
                    main={`${g.match_no}경기 골`}
                    sub={g.assister_name ? `어시스트: ${g.assister_name}` : '단독 득점'}
                    match={`${g.team1_name} ${g.team1_score}-${g.team2_score} ${g.team2_name}`}
                    sessionId={g.session_id}
                  />
                ))
            )}
            {activeLogTab === 'assists' && (
              assists.length === 0 ? <EmptyLog message="도움 기록이 없습니다" /> :
                assists.map((a: any, i: number) => (
                  <EventRow key={i}
                    icon="⚡" date={a.session_date}
                    main={`${a.match_no}경기 어시스트`}
                    sub={`득점자: ${a.scorer_name}`}
                    match={`${a.team1_name} ${a.team1_score}-${a.team2_score} ${a.team2_name}`}
                    sessionId={a.session_id}
                  />
                ))
            )}
            {activeLogTab === 'defenses' && (
              defenses.length === 0 ? <EmptyLog message="수비 기록이 없습니다" /> :
                defenses.map((d: any, i: number) => (
                  <EventRow key={i}
                    icon="🛡️" date={d.session_date}
                    main={`${d.match_no}경기 수비`}
                    sub=""
                    match={`${d.team1_name} ${d.team1_score}-${d.team2_score} ${d.team2_name}`}
                    sessionId={d.session_id}
                  />
                ))
            )}
            {activeLogTab === 'mvp' && (
              mvpRecords.length === 0 ? <EmptyLog message="MVP 기록이 없습니다" /> :
                mvpRecords.map((m: any, i: number) => (
                  <EventRow key={i}
                    icon="🏆" date={m.session_date}
                    main="세션 MVP"
                    sub={m.title || '코너킥스 정기 풋살'}
                    match=""
                    sessionId={m.session_id}
                  />
                ))
            )}
            {activeLogTab === 'placements' && (
              placements.length === 0 ? <EmptyLog message="순위 기록이 없습니다" /> :
                placements.map((p: any, i: number) => {
                  const medal = p.team_rank === 1 ? '🥇' : p.team_rank === 2 ? '🥈' : '🥉'
                  return (
                    <EventRow key={i}
                      icon={medal} date={p.session_date}
                      main={`${p.team_rank}등 (${p.team_name})`}
                      sub={`승점 ${p.points}`}
                      match={p.title || '코너킥스 정기 풋살'}
                      sessionId={p.session_id}
                    />
                  )
                })
            )}
          </div>
        )}
      </div>

      {/* 능력치 보기 링크 */}
      <div className="mt-6 text-center">
        <Link
          href={`/abilities/${id}`}
          className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 font-medium transition-colors"
        >
          <TrendingUp className="w-4 h-4" />
          개인 능력치 보기 →
        </Link>
      </div>
    </div>
  )
}

function EventRow({ icon, date, main, sub, match, sessionId }: {
  icon: string; date: string; main: string; sub: string; match: string; sessionId: number
}) {
  const d = new Date(date)
  const dateStr = `${d.getMonth() + 1}/${d.getDate()}`

  return (
    <Link
      href={`/sessions/${sessionId}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
    >
      <span className="text-lg shrink-0">{icon}</span>
      <span className="text-xs text-slate-400 dark:text-slate-500 w-12 shrink-0 font-mono">{dateStr}</span>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-slate-900 dark:text-white">{main}</span>
        {sub && <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">{sub}</span>}
      </div>
      {match && (
        <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 hidden sm:inline">{match}</span>
      )}
    </Link>
  )
}

function EmptyLog({ message }: { message: string }) {
  return <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-8">{message}</p>
}

function StatBadge({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string | number
  color: 'emerald' | 'amber' | 'blue' | 'purple' | 'slate'
}) {
  const colorClasses = {
    emerald: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
    amber: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
    blue: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
    purple: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30',
    slate: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-500/30',
  }

  return (
    <div className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl border', colorClasses[color])}>
      {icon}
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  )
}

function StatRow({ label, value, max, color, isDecimal = false }: {
  label: string; value: number | string; max: number
  color: 'amber' | 'blue' | 'purple' | 'emerald' | 'slate'; isDecimal?: boolean
}) {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  const percentage = Math.min((numValue / max) * 100, 100)

  const barColors = { amber: 'bg-amber-500', blue: 'bg-blue-500', purple: 'bg-purple-500', emerald: 'bg-emerald-500', slate: 'bg-slate-500' }
  const textColors = {
    amber: 'text-amber-600 dark:text-amber-400', blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400', emerald: 'text-emerald-600 dark:text-emerald-400',
    slate: 'text-slate-600 dark:text-slate-300',
  }

  return (
    <div className="flex items-center gap-4">
      <span className="w-24 text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <div className="flex-1 h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', barColors[color])} style={{ width: `${percentage}%` }} />
      </div>
      <span className={cn('w-12 text-right font-bold text-lg', textColors[color])}>{value}</span>
    </div>
  )
}
