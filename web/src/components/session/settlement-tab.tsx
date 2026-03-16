'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Coins,
  Trophy,
  Award,
  Check,
  Calculator,
  ChevronDown,
  Sparkles,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { settlementsApi, matchesApi } from '@/lib/api'
import { cn } from '@/lib/cn'

interface Props {
  sessionId: number
  session: any
  teams: any[]
  matches: any[]
  attendance: any[]
  onRefetch: () => void
}

export function SettlementTab({ sessionId, session, teams, matches, attendance, onRefetch }: Props) {
  const { isAdmin, token } = useAuthStore()
  const queryClient = useQueryClient()
  const [showDetails, setShowDetails] = useState(false)

  const completedMatches = matches.filter((m: any) => m.status === 'completed')
  const completedMatchIds = completedMatches.map((m: any) => m.id).sort().join(',')

  // 완료된 경기들의 이벤트를 한 번에 조회
  const { data: matchEventsData, isLoading } = useQuery({
    queryKey: ['match-events', completedMatchIds],
    queryFn: async () => {
      const results = await Promise.all(
        completedMatches.map((match: any) => matchesApi.get(match.id))
      )
      return results
    },
    enabled: completedMatches.length > 0,
  })

  // 정산 계산
  const settlement = useMemo(() => {
    const baseFee = session.base_fee || 10000
    const totalPlayers = attendance.length
    const totalPot = baseFee * totalPlayers

    // 팀별 승점 계산
    const teamStats = new Map<number, { wins: number; draws: number; losses: number; points: number }>()
    teams.forEach((team: any) => {
      teamStats.set(team.id, { wins: 0, draws: 0, losses: 0, points: 0 })
    })

    completedMatches.forEach((match: any) => {
      const team1Stats = teamStats.get(match.team1_id)
      const team2Stats = teamStats.get(match.team2_id)

      if (team1Stats && team2Stats) {
        if (match.team1_score > match.team2_score) {
          team1Stats.wins++
          team1Stats.points += 3
          team2Stats.losses++
        } else if (match.team1_score < match.team2_score) {
          team2Stats.wins++
          team2Stats.points += 3
          team1Stats.losses++
        } else {
          team1Stats.draws++
          team2Stats.draws++
          team1Stats.points += 1
          team2Stats.points += 1
        }
      }
    })

    // 순위 결정
    const rankedTeams = [...teams]
      .map((team: any) => ({
        ...team,
        stats: teamStats.get(team.id) || { wins: 0, draws: 0, losses: 0, points: 0 },
      }))
      .sort((a, b) => b.stats.points - a.stats.points)

    // MVP 계산 (각 경기별 이벤트 수집)
    const playerEvents = new Map<number, { goals: number; assists: number; defenses: number; score: number; name: string }>()

    const matchResults = matchEventsData || []
    matchResults.forEach((matchData: any) => {
      if (!matchData) return
      const events = matchData.events || []

      events.forEach((event: any) => {
        if (!event.player_id) return

        if (!playerEvents.has(event.player_id)) {
          playerEvents.set(event.player_id, {
            goals: 0,
            assists: 0,
            defenses: 0,
            score: 0,
            name: event.player_name,
          })
        }

        const stats = playerEvents.get(event.player_id)!

        if (event.event_type === 'GOAL') {
          stats.goals++
          stats.score += 2
        } else if (event.event_type === 'DEFENSE') {
          stats.defenses++
          stats.score += 0.5
        }

        // 어시스트
        if (event.assister_id && event.event_type === 'GOAL') {
          if (!playerEvents.has(event.assister_id)) {
            playerEvents.set(event.assister_id, {
              goals: 0,
              assists: 0,
              defenses: 0,
              score: 0,
              name: event.assister_name,
            })
          }
          const assisterStats = playerEvents.get(event.assister_id)!
          assisterStats.assists++
          assisterStats.score += 1
        }
      })
    })

    const mvp = [...playerEvents.entries()]
      .sort((a, b) => b[1].score - a[1].score)[0]

    // 상금 분배 (예시: 1등 40%, 2등 25%, MVP 20%, 나머지 15% 운영비)
    const prizes = {
      first: Math.floor(totalPot * 0.4),
      second: Math.floor(totalPot * 0.25),
      mvp: Math.floor(totalPot * 0.2),
      operations: totalPot - Math.floor(totalPot * 0.4) - Math.floor(totalPot * 0.25) - Math.floor(totalPot * 0.2),
    }

    return {
      baseFee,
      totalPlayers,
      totalPot,
      rankedTeams,
      mvp: mvp ? { id: mvp[0], ...mvp[1] } : null,
      prizes,
      isComplete: completedMatches.length === matches.length && matches.length > 0,
    }
  }, [session, attendance, teams, matches, completedMatches, matchEventsData])

  // 정산 완료 mutation
  const completeMutation = useMutation({
    mutationFn: () => settlementsApi.complete(sessionId, undefined, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
      onRefetch()
    },
  })

  const handleComplete = () => {
    if (!window.confirm('정산을 완료하시겠습니까?\n세션이 "완료" 상태로 전환되고 랭킹에 반영됩니다.')) return
    completeMutation.mutate()
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 총 상금 */}
      <div className="bg-gradient-to-br from-amber-100 to-yellow-50 dark:from-amber-500/20 dark:to-yellow-500/10 rounded-2xl p-6 border border-amber-200 dark:border-amber-500/30">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
              <Coins className="w-5 h-5" />
              <span className="font-medium">총 상금 풀</span>
            </div>
            <p className="text-4xl font-bold text-slate-900 dark:text-white">
              {settlement.totalPot.toLocaleString()}원
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
              {settlement.totalPlayers}명 × {settlement.baseFee.toLocaleString()}원
            </p>
          </div>
          <div className="text-6xl">💰</div>
        </div>
      </div>

      {/* 순위 & 상금 */}
      <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            순위 & 상금
          </h3>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
          >
            상세 보기
            <ChevronDown className={cn('w-4 h-4 transition-transform', showDetails && 'rotate-180')} />
          </button>
        </div>

        <div className="p-6">
          {settlement.rankedTeams.length === 0 ? (
            <p className="text-center text-slate-500 py-8">
              아직 팀 편성이 완료되지 않았습니다.
            </p>
          ) : (
            <div className="space-y-4">
              {settlement.rankedTeams.slice(0, showDetails ? undefined : 3).map((team: any, idx: number) => (
                <div
                  key={team.id}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-xl border',
                    idx === 0
                      ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
                      : idx === 1
                      ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                      : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                  )}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <span className="text-2xl shrink-0">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}위`}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">{team.name}</p>
                      <p className="text-sm text-slate-500 truncate">
                        {team.stats.wins}승 {team.stats.draws}무 {team.stats.losses}패 ({team.stats.points}점)
                      </p>
                    </div>
                  </div>
                  {idx < 2 && (
                    <div className="text-right">
                      <p className={cn(
                        'text-lg font-bold',
                        idx === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'
                      )}>
                        {(idx === 0 ? settlement.prizes.first : settlement.prizes.second).toLocaleString()}원
                      </p>
                      <p className="text-xs text-slate-500">
                        인당 {Math.floor((idx === 0 ? settlement.prizes.first : settlement.prizes.second) / (team.members?.length || 1)).toLocaleString()}원
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MVP */}
      {settlement.mvp && (
        <div className="bg-gradient-to-br from-emerald-100 to-teal-50 dark:from-emerald-500/20 dark:to-teal-500/10 rounded-2xl p-6 border border-emerald-200 dark:border-emerald-500/30">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="w-14 h-14 shrink-0 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg">
                <Award className="w-7 h-7 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium truncate">이 경기의 MVP</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white truncate">{settlement.mvp.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                  {settlement.mvp.goals}골 {settlement.mvp.assists}도움 {settlement.mvp.defenses}수비
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {settlement.prizes.mvp.toLocaleString()}원
              </p>
              <p className="text-sm text-slate-500">MVP 상금</p>
            </div>
          </div>
        </div>
      )}

      {/* 상금 분배 요약 */}
      <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-500" />
          상금 분배
        </h3>

        <div className="space-y-3">
          <PrizeRow
            icon={<Trophy className="w-5 h-5 text-amber-500" />}
            label="1등 상금"
            amount={settlement.prizes.first}
            percentage={40}
          />
          <PrizeRow
            icon={<Trophy className="w-5 h-5 text-slate-400" />}
            label="2등 상금"
            amount={settlement.prizes.second}
            percentage={25}
          />
          <PrizeRow
            icon={<Award className="w-5 h-5 text-emerald-500" />}
            label="MVP 상금"
            amount={settlement.prizes.mvp}
            percentage={20}
          />
          <PrizeRow
            icon={<Coins className="w-5 h-5 text-purple-500" />}
            label="운영비"
            amount={settlement.prizes.operations}
            percentage={15}
          />
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <span className="font-medium text-slate-600 dark:text-slate-400">총계</span>
          <span className="text-lg font-bold text-slate-900 dark:text-white">
            {settlement.totalPot.toLocaleString()}원
          </span>
        </div>
      </div>

      {/* 에러 메시지 */}
      {completeMutation.isError && (
        <div className="bg-red-50 dark:bg-red-500/10 rounded-2xl p-4 border border-red-200 dark:border-red-500/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">
            {(completeMutation.error as Error)?.message || '정산 처리 중 오류가 발생했습니다.'}
          </p>
        </div>
      )}

      {/* 정산 완료 버튼 - ended 상태에서만 표시 */}
      {isAdmin && session.status === 'ended' && session.status !== 'completed' && (
        <div className="bg-blue-50 dark:bg-blue-500/10 rounded-2xl p-6 border border-blue-200 dark:border-blue-500/30">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="font-medium text-blue-700 dark:text-blue-400">정산 준비 완료</h4>
              <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                세션이 종료되었습니다. 정산을 완료하면 랭킹에 반영됩니다.
              </p>
            </div>
            <Button
              onClick={handleComplete}
              loading={completeMutation.isPending}
              className="shrink-0"
            >
              <Check className="w-4 h-4" />
              정산 완료
            </Button>
          </div>
        </div>
      )}

      {/* 정산 완료 상태 표시 */}
      {session.status === 'completed' && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl p-6 border border-emerald-200 dark:border-emerald-500/30 text-center">
          <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-white" />
          </div>
          <h4 className="font-semibold text-emerald-700 dark:text-emerald-400">정산 완료</h4>
          <p className="text-sm text-emerald-600 dark:text-emerald-300 mt-1">
            이 세션의 정산이 완료되어 랭킹에 반영되었습니다.
          </p>
        </div>
      )}
    </div>
  )
}

function PrizeRow({
  icon,
  label,
  amount,
  percentage,
}: {
  icon: React.ReactNode
  label: string
  amount: number
  percentage: number
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-slate-600 dark:text-slate-400">{label}</span>
        <span className="text-xs text-slate-400">({percentage}%)</span>
      </div>
      <span className="font-semibold text-slate-900 dark:text-white">
        {amount.toLocaleString()}원
      </span>
    </div>
  )
}
