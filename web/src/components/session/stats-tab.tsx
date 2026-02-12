'use client'

import { useQueries } from '@tanstack/react-query'
import { Trophy, Target, Shield, Award, Crown, Sparkles } from 'lucide-react'
import { matchesApi } from '@/lib/api'

interface Props {
  sessionId: number
  matches: any[]
  attendance?: any[]
  sessionStatus?: string
  teams?: any[]
}

export function StatsTab({ sessionId, matches, attendance = [], sessionStatus = 'recruiting', teams = [] }: Props) {
  // 전체 경기 이벤트 수집
  const completedMatches = matches.filter((m: any) => m.status === 'completed')

  // 각 경기별 이벤트 조회 (useQueries 사용 - React Hooks 규칙 준수)
  const matchQueries = useQueries({
    queries: completedMatches.map((match: any) => ({
      queryKey: ['match', match.id],
      queryFn: () => matchesApi.get(match.id),
    })),
  })

  const isLoading = matchQueries.some((q) => q.isLoading)

  // 선수별 스탯 집계
  const playerStats = new Map<number, {
    id: number
    name: string
    goals: number
    assists: number
    defenses: number
    mvpScore: number
  }>()

  matchQueries.forEach((query) => {
    if (!query.data) return

    const events = query.data.events || []
    events.forEach((event: any) => {
      // 용병은 제외 (player_id가 없거나 guest_name이 있으면 용병)
      if (!event.player_id || event.guest_name) return

      if (!playerStats.has(event.player_id)) {
        playerStats.set(event.player_id, {
          id: event.player_id,
          name: event.player_name,
          goals: 0,
          assists: 0,
          defenses: 0,
          mvpScore: 0,
        })
      }

      const stats = playerStats.get(event.player_id)!

      if (event.event_type === 'GOAL') {
        stats.goals++
        stats.mvpScore += 2
      } else if (event.event_type === 'DEFENSE') {
        stats.defenses++
        stats.mvpScore += 0.5
      }

      // 어시스트 (용병 제외)
      if (event.assister_id && event.event_type === 'GOAL') {
        if (!playerStats.has(event.assister_id)) {
          playerStats.set(event.assister_id, {
            id: event.assister_id,
            name: event.assister_name,
            goals: 0,
            assists: 0,
            defenses: 0,
            mvpScore: 0,
          })
        }
        const assisterStats = playerStats.get(event.assister_id)!
        assisterStats.assists++
        assisterStats.mvpScore += 1
      }
    })
  })

  // 팀 순위 계산 (승점 기준)
  const teamStandings = new Map<number, { points: number; goalsFor: number; members: number[] }>()

  teams.forEach((team: any) => {
    teamStandings.set(team.id, { points: 0, goalsFor: 0, members: team.members?.map((m: any) => m.player_id) || [] })
  })

  completedMatches.forEach((match: any) => {
    const team1 = teamStandings.get(match.team1_id)
    const team2 = teamStandings.get(match.team2_id)

    if (team1 && team2) {
      // 득점
      team1.goalsFor += match.team1_score || 0
      team2.goalsFor += match.team2_score || 0

      // 승점
      if (match.team1_score > match.team2_score) {
        team1.points += 3
      } else if (match.team1_score < match.team2_score) {
        team2.points += 3
      } else {
        team1.points += 1
        team2.points += 1
      }
    }
  })

  // 우승팀 찾기 (승점 > 득점 순)
  const sortedTeams = Array.from(teamStandings.entries())
    .sort((a, b) => b[1].points - a[1].points || b[1].goalsFor - a[1].goalsFor)
  const winningTeamId = sortedTeams[0]?.[0]
  const winningTeamMembers = new Set(sortedTeams[0]?.[1]?.members || [])

  // 우승팀 멤버에게 1.5점 보너스
  playerStats.forEach((stats, playerId) => {
    if (winningTeamMembers.has(playerId)) {
      stats.mvpScore += 1.5
    }
  })

  const sortedStats = Array.from(playerStats.values()).sort((a, b) => b.mvpScore - a.mvpScore)

  // 최고 점수를 10점으로 환산 (상대 점수)
  const maxScore = sortedStats[0]?.mvpScore || 1
  const normalizedStats = sortedStats.map(player => ({
    ...player,
    normalizedScore: maxScore > 0 ? (player.mvpScore / maxScore) * 10 : 0
  }))

  // 상위권 추출
  const topScorer = [...sortedStats].sort((a, b) => b.goals - a.goals)[0]
  const topAssister = [...sortedStats].sort((a, b) => b.assists - a.assists)[0]
  const topDefender = [...sortedStats].sort((a, b) => b.defenses - a.defenses)[0]
  const mvp = normalizedStats[0]

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* MVP 투표 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* 하이라이트 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <HighlightCard
              icon={<Award className="w-6 h-6 text-yellow-500 dark:text-yellow-400" />}
              title="MVP"
              player={mvp?.name}
              value={mvp ? `${mvp.normalizedScore.toFixed(1)}점` : '-'}
              color="yellow"
            />
            <HighlightCard
              icon={<Target className="w-6 h-6 text-green-500 dark:text-green-400" />}
              title="득점왕"
              player={topScorer?.name}
              value={topScorer ? `${topScorer.goals}골` : '-'}
              color="green"
            />
            <HighlightCard
              icon={<Trophy className="w-6 h-6 text-blue-500 dark:text-blue-400" />}
              title="도움왕"
              player={topAssister?.name}
              value={topAssister ? `${topAssister.assists}도움` : '-'}
              color="blue"
            />
        <HighlightCard
              icon={<Shield className="w-6 h-6 text-purple-500 dark:text-purple-400" />}
              title="수비왕"
              player={topDefender?.name}
              value={topDefender ? `${topDefender.defenses}수비` : '-'}
              color="purple"
            />
          </div>

          {/* 전체 스탯 테이블 */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white">세션 기록</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">선수</th>
                <th className="px-4 py-3 text-center">골</th>
                <th className="px-4 py-3 text-center">도움</th>
                <th className="px-4 py-3 text-center">수비</th>
                <th className="px-4 py-3 text-center">MVP점수</th>
              </tr>
            </thead>
            <tbody>
              {normalizedStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    완료된 경기가 없습니다.
                  </td>
                </tr>
              ) : (
                normalizedStats.map((player, idx) => (
                  <tr key={player.id} className="border-b border-slate-100 dark:border-slate-700/50">
                    <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white max-w-[120px] truncate">{player.name}</td>
                    <td className="px-4 py-3 text-center text-green-600 dark:text-green-400">{player.goals}</td>
                    <td className="px-4 py-3 text-center text-blue-600 dark:text-blue-400">{player.assists}</td>
                    <td className="px-4 py-3 text-center text-purple-600 dark:text-purple-400">{player.defenses}</td>
                    <td className="px-4 py-3 text-center font-semibold text-yellow-600 dark:text-yellow-400">
                      {player.normalizedScore.toFixed(1)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
        </div>

        {/* MVP 점수 사이드바 (기록 기반) */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            {/* 헤더 */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-500/10 dark:to-yellow-500/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <Trophy className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                    오늘의 MVP
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    골2점 어시1점 수비0.5점 우승1.5점
                  </p>
                </div>
              </div>
            </div>

            {/* MVP 1위 표시 */}
            {mvp ? (
              <div className="p-4">
                <div className="relative bg-gradient-to-br from-amber-100 via-yellow-50 to-amber-100 dark:from-amber-500/20 dark:via-yellow-500/10 dark:to-amber-500/20 rounded-xl p-4 text-center overflow-hidden">
                  <Sparkles className="absolute top-2 right-2 w-4 h-4 text-amber-400 animate-pulse" />
                  <div className="relative inline-block mb-2">
                    <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-xl shadow-amber-500/30">
                      <span className="text-xl text-white font-bold">
                        {mvp.name?.charAt(0)}
                      </span>
                    </div>
                    <Crown className="absolute -top-2 -right-2 w-6 h-6 text-amber-500" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                    {mvp.name}
                  </h4>
                  <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                    {mvp.normalizedScore.toFixed(1)}점
                  </p>
                  <div className="flex justify-center gap-3 mt-2 text-xs text-slate-500">
                    {mvp.goals > 0 && <span className="text-green-600">{mvp.goals}골</span>}
                    {mvp.assists > 0 && <span className="text-blue-600">{mvp.assists}도움</span>}
                    {mvp.defenses > 0 && <span className="text-purple-600">{mvp.defenses}수비</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">
                경기 기록이 없습니다
              </div>
            )}

            {/* 순위 리스트 (2~5위) */}
            {normalizedStats.length > 1 && (
              <div className="px-4 pb-4">
                <div className="space-y-1.5">
                  {normalizedStats.slice(1, 5).map((player, index) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                          {index + 2}
                        </span>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {player.name}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                        {player.normalizedScore.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function HighlightCard({
  icon,
  title,
  player,
  value,
  color,
}: {
  icon: React.ReactNode
  title: string
  player?: string
  value: string
  color: 'yellow' | 'green' | 'blue' | 'purple'
}) {
  const colors = {
    yellow: 'bg-yellow-100 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20',
    green: 'bg-green-100 dark:bg-green-500/10 border-green-200 dark:border-green-500/20',
    blue: 'bg-blue-100 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
    purple: 'bg-purple-100 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20',
  }

  return (
    <div className={`rounded-xl p-4 border shadow-sm overflow-hidden ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2 min-w-0">
        <span className="shrink-0">{icon}</span>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{title}</span>
      </div>
      <p className="text-lg font-bold text-slate-900 dark:text-white truncate">{player || '-'}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white truncate">{value}</p>
    </div>
  )
}
