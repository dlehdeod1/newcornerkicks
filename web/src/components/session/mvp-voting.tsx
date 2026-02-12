'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trophy, Check, Vote, Crown, Sparkles, Target, Shield, Zap } from 'lucide-react'
import { cn } from '@/lib/cn'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'

interface Props {
  sessionId: number
  attendance: any[]
  sessionStatus: string
  matches?: any[]
  events?: any[]
}

// MVP 점수 계산 (골 2점, 어시 1점, 수비 0.5점, 투표 3점)
const SCORE_WEIGHTS = {
  GOAL: 2,
  ASSIST: 1,
  DEFENSE: 0.5,
  VOTE: 3,
}

export function MvpVoting({ sessionId, attendance, sessionStatus, matches = [], events = [] }: Props) {
  const { isLoggedIn, token, isAdmin } = useAuthStore()
  const queryClient = useQueryClient()
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)

  // 투표 현황 조회
  const { data, isLoading } = useQuery({
    queryKey: ['mvp-votes', sessionId],
    queryFn: () => api(`/sessions/${sessionId}/mvp-votes`),
  })

  // 내 투표 조회
  const { data: myVoteData } = useQuery({
    queryKey: ['mvp-votes-me', sessionId],
    queryFn: () => api(`/sessions/${sessionId}/mvp-votes/me`, { token: token! }),
    enabled: isLoggedIn && !!token,
  })

  // 경기 이벤트 조회
  const { data: sessionData } = useQuery({
    queryKey: ['session-events', sessionId],
    queryFn: () => api(`/sessions/${sessionId}`),
  })

  // 투표하기
  const voteMutation = useMutation({
    mutationFn: (playerId: number) =>
      api(`/sessions/${sessionId}/mvp-votes`, {
        method: 'POST',
        body: { playerId },
        token: token!,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mvp-votes', sessionId] })
      queryClient.invalidateQueries({ queryKey: ['mvp-votes-me', sessionId] })
      setSelectedPlayerId(null)
    },
  })

  // MVP 확정 (관리자)
  const confirmMutation = useMutation({
    mutationFn: (data: { playerId: number; voteCount: number }) =>
      api(`/sessions/${sessionId}/mvp-result`, {
        method: 'POST',
        body: data,
        token: token!,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mvp-votes', sessionId] })
    },
  })

  const votes = data?.votes || []
  const totalVotes = data?.totalVotes || 0
  const mvpResult = data?.mvpResult
  const myVote = myVoteData?.myVote
  const isVotingClosed = !!mvpResult

  // 투표 결과를 map으로 변환
  const voteMap = useMemo(() => {
    const map: Record<number, number> = {}
    votes.forEach((v: any) => {
      map[v.voted_player_id] = v.vote_count
    })
    return map
  }, [votes])

  // 선수별 MVP 점수 계산
  const playerScores = useMemo(() => {
    const allEvents = sessionData?.events || []
    const scoreMap: Record<number, {
      playerId: number
      name: string
      goals: number
      assists: number
      defenses: number
      voteCount: number
      rawScore: number
    }> = {}

    // 참석자 초기화
    attendance.forEach((a: any) => {
      if (a.player_id) {
        scoreMap[a.player_id] = {
          playerId: a.player_id,
          name: a.display_name || a.name,
          goals: 0,
          assists: 0,
          defenses: 0,
          voteCount: voteMap[a.player_id] || 0,
          rawScore: 0,
        }
      }
    })

    // 이벤트에서 점수 집계
    allEvents.forEach((e: any) => {
      if (e.player_id && scoreMap[e.player_id]) {
        if (e.event_type === 'GOAL') {
          scoreMap[e.player_id].goals++
        } else if (e.event_type === 'DEFENSE') {
          scoreMap[e.player_id].defenses++
        }
      }
      // 어시스트
      if (e.assister_id && scoreMap[e.assister_id]) {
        scoreMap[e.assister_id].assists++
      }
    })

    // 원점수 계산
    Object.values(scoreMap).forEach((p) => {
      p.rawScore =
        p.goals * SCORE_WEIGHTS.GOAL +
        p.assists * SCORE_WEIGHTS.ASSIST +
        p.defenses * SCORE_WEIGHTS.DEFENSE +
        p.voteCount * SCORE_WEIGHTS.VOTE
    })

    // 정렬
    const sorted = Object.values(scoreMap).sort((a, b) => b.rawScore - a.rawScore)

    // 최고 점수 기준 10점 만점으로 환산
    const maxScore = sorted[0]?.rawScore || 1
    return sorted.map((p) => ({
      ...p,
      finalScore: maxScore > 0 ? Math.min(10, (p.rawScore / maxScore) * 10) : 0,
    }))
  }, [attendance, sessionData?.events, voteMap])

  const topPlayer = playerScores[0]

  // 투표 가능한 선수 목록
  const eligiblePlayers = attendance
    .filter((a: any) => a.player_id)
    .map((a: any) => ({
      id: a.player_id,
      name: a.display_name || a.name,
    }))

  const handleVote = () => {
    if (!selectedPlayerId) return
    voteMutation.mutate(selectedPlayerId)
  }

  const handleConfirmMvp = () => {
    if (!topPlayer) return
    confirmMutation.mutate({
      playerId: topPlayer.playerId,
      voteCount: topPlayer.voteCount,
    })
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 animate-pulse">
        <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
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
              {isVotingClosed ? 'MVP 결정!' : `골2점 어시1점 수비0.5점 투표3점`}
            </p>
          </div>
          {!isVotingClosed && myVote && (
            <span className="shrink-0 px-2 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium rounded-full flex items-center gap-1">
              <Check className="w-2.5 h-2.5" />투표완료
            </span>
          )}
        </div>
      </div>

      {/* MVP 확정 결과 */}
      {mvpResult ? (
        <div className="p-4">
          <div className="relative bg-gradient-to-br from-amber-100 via-yellow-50 to-amber-100 dark:from-amber-500/20 dark:via-yellow-500/10 dark:to-amber-500/20 rounded-xl p-4 text-center overflow-hidden">
            <Sparkles className="absolute top-2 right-2 w-4 h-4 text-amber-400 animate-pulse" />
            <div className="relative inline-block mb-2">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-xl shadow-amber-500/30">
                <span className="text-xl text-white font-bold">
                  {mvpResult.player_name?.charAt(0)}
                </span>
              </div>
              <Crown className="absolute -top-2 -right-2 w-6 h-6 text-amber-500" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">
              {mvpResult.player_name}
            </h4>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              MVP 선정
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* 순위 리스트 */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              MVP 점수 순위
            </h4>
            {playerScores.length === 0 ? (
              <p className="text-center text-slate-400 py-6 text-sm">경기 기록이 없습니다</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {playerScores.slice(0, 10).map((player, index) => (
                  <div
                    key={player.playerId}
                    className={cn(
                      'relative rounded-lg p-2.5 overflow-hidden',
                      index === 0
                        ? 'bg-gradient-to-r from-amber-100 to-yellow-50 dark:from-amber-500/20 dark:to-yellow-500/10 border border-amber-200 dark:border-amber-500/30'
                        : 'bg-slate-50 dark:bg-slate-800/50'
                    )}
                  >
                    {/* 배경 프로그레스 */}
                    <div
                      className={cn(
                        'absolute inset-0 opacity-20',
                        index === 0 ? 'bg-amber-400' : 'bg-slate-300 dark:bg-slate-600'
                      )}
                      style={{ width: `${player.finalScore * 10}%` }}
                    />

                    <div className="relative flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={cn(
                          'shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                          index === 0 ? 'bg-amber-500 text-white' :
                          index === 1 ? 'bg-slate-400 text-white' :
                          index === 2 ? 'bg-amber-700 text-white' :
                          'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                        )}>
                          {index + 1}
                        </span>
                        <span className={cn(
                          'font-medium text-sm truncate',
                          index === 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-700 dark:text-slate-300'
                        )}>
                          {player.name}
                        </span>
                      </div>

                      {/* 스탯 아이콘 */}
                      <div className="shrink-0 flex items-center gap-1.5 text-[10px]">
                        {player.goals > 0 && (
                          <span className="flex items-center gap-0.5 text-green-600">
                            <Target className="w-3 h-3" />{player.goals}
                          </span>
                        )}
                        {player.assists > 0 && (
                          <span className="flex items-center gap-0.5 text-blue-600">
                            A{player.assists}
                          </span>
                        )}
                        {player.defenses > 0 && (
                          <span className="flex items-center gap-0.5 text-purple-600">
                            <Shield className="w-3 h-3" />{player.defenses}
                          </span>
                        )}
                        {player.voteCount > 0 && (
                          <span className="flex items-center gap-0.5 text-amber-600">
                            <Vote className="w-3 h-3" />{player.voteCount}
                          </span>
                        )}
                      </div>

                      {/* 점수 */}
                      <span className={cn(
                        'shrink-0 font-bold text-sm',
                        index === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'
                      )}>
                        {player.finalScore.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 투표하기 */}
          {isLoggedIn ? (
            <div className="p-4">
              <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                {myVote ? '투표 변경' : '투표하기'} (+3점)
              </h4>
              <div className="grid grid-cols-3 gap-1.5 mb-3 max-h-24 overflow-y-auto">
                {eligiblePlayers.map((player: any) => (
                  <button
                    key={player.id}
                    onClick={() => setSelectedPlayerId(player.id)}
                    className={cn(
                      'px-2 py-1.5 rounded-lg text-xs font-medium transition-all border truncate',
                      selectedPlayerId === player.id
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : myVote?.voted_player_id === player.id
                        ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    )}
                  >
                    {player.name}
                  </button>
                ))}
              </div>
              <Button
                onClick={handleVote}
                disabled={!selectedPlayerId || voteMutation.isPending}
                className="w-full h-8 text-xs"
              >
                {voteMutation.isPending ? '투표 중...' : myVote ? '투표 변경' : '투표하기'}
              </Button>
            </div>
          ) : (
            <div className="p-4 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">로그인 후 투표 가능</p>
            </div>
          )}

          {/* 관리자: MVP 확정 */}
          {isAdmin && topPlayer && sessionStatus === 'completed' && (
            <div className="px-4 pb-4">
              <Button
                variant="outline"
                onClick={handleConfirmMvp}
                disabled={confirmMutation.isPending}
                className="w-full h-8 text-xs border-amber-300 text-amber-600 hover:bg-amber-50"
              >
                <Crown className="w-3.5 h-3.5 mr-1.5" />
                {confirmMutation.isPending ? '확정 중...' : `${topPlayer.name} MVP 확정`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
