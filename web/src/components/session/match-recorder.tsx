'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Play, Pause, Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { matchesApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/cn'

interface Props {
  match: any
  teams: any[]
  onClose: () => void
  onRefetch: () => void
}

export function MatchRecorder({ match, teams, onClose, onRefetch }: Props) {
  const { token } = useAuthStore()

  const { data, refetch } = useQuery({
    queryKey: ['match', match.id],
    queryFn: () => matchesApi.get(match.id),
    refetchInterval: 5000,
  })

  const matchData = data?.match
  const events = data?.events || []
  const team1Members = data?.team1Members || []
  const team2Members = data?.team2Members || []

  const [timer, setTimer] = useState(0)
  const [isRunning, setIsRunning] = useState(match.status === 'playing')

  // 어시스트 입력 모드
  const [assistMode, setAssistMode] = useState<{
    teamId: number
    scorerId: number | null
    scorerGuestName?: string
  } | null>(null)

  useEffect(() => {
    if (match.status === 'playing' && match.played_at) {
      const startTime = match.played_at * 1000
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      setTimer(elapsed)
      setIsRunning(true)
    }
  }, [match])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRunning) {
      interval = setInterval(() => setTimer((t) => t + 1), 1000)
    }
    return () => clearInterval(interval)
  }, [isRunning])

  const addEventMutation = useMutation({
    mutationFn: (event: any) => matchesApi.addEvent(match.id, event, token || undefined),
    onSuccess: () => {
      refetch()
      onRefetch()
    },
  })

  const deleteEventMutation = useMutation({
    mutationFn: (eventId: number) => matchesApi.deleteEvent(match.id, eventId, token || undefined),
    onSuccess: () => {
      refetch()
      onRefetch()
    },
  })

  const updateMatchMutation = useMutation({
    mutationFn: (data: any) => matchesApi.update(match.id, data, token || undefined),
    onSuccess: () => {
      refetch()
      onRefetch()
    },
  })

  const handleStart = () => {
    updateMatchMutation.mutate({ status: 'playing' })
    setIsRunning(true)
  }

  const handleComplete = () => {
    if (!window.confirm('경기를 완료 처리하시겠습니까?')) return
    updateMatchMutation.mutate({ status: 'completed' })
    setIsRunning(false)
  }

  const handleGoalClick = (member: any, teamId: number) => {
    setAssistMode({
      teamId,
      scorerId: member.player_id,
      scorerGuestName: member.guest_name,
    })
  }

  const handleAssistSelect = (assister: any | null) => {
    if (!assistMode) return
    addEventMutation.mutate({
      eventType: 'GOAL',
      playerId: assistMode.scorerId,
      guestName: assistMode.scorerGuestName,
      teamId: assistMode.teamId,
      assisterId: assister?.player_id || null,
      eventTime: timer,
    })
    setAssistMode(null)
  }

  const handleDefenseClick = (member: any, teamId: number) => {
    addEventMutation.mutate({
      eventType: 'DEFENSE',
      playerId: member.player_id,
      guestName: member.guest_name,
      teamId: teamId,
      eventTime: timer,
    })
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const team1 = teams.find((t: any) => t.id === match.team1_id)
  const team2 = teams.find((t: any) => t.id === match.team2_id)

  const currentScore = {
    team1: events.filter((e: any) => e.event_type === 'GOAL' && e.team_id === match.team1_id).length,
    team2: events.filter((e: any) => e.event_type === 'GOAL' && e.team_id === match.team2_id).length,
  }

  const getPlayerGoals = (playerId: number | null, guestName?: string) => {
    return events.filter((e: any) =>
      e.event_type === 'GOAL' &&
      (playerId ? e.player_id === playerId : e.guest_name === guestName)
    ).length
  }

  const getPlayerDefense = (playerId: number | null, guestName?: string) => {
    return events.filter((e: any) =>
      e.event_type === 'DEFENSE' &&
      (playerId ? e.player_id === playerId : e.guest_name === guestName)
    ).length
  }

  const isEditable = matchData?.status === 'playing' || matchData?.status === 'pending' || matchData?.status === 'completed'

  // 이름 2글자로 자르기 (용병 등 3글자 이상인 경우: 1번째+3번째 글자)
  const shortName = (name: string) => {
    if (!name) return ''
    if (name.length <= 2) return name
    // 3글자 이상이면 1번째 + 3번째 글자 (예: 세준용병1 -> 세용)
    return name[0] + name[2]
  }

  const getAssistCandidates = () => {
    if (!assistMode) return []
    const members = assistMode.teamId === match.team1_id ? team1Members : team2Members
    return members.filter((m: any) =>
      m.player_id !== assistMode.scorerId ||
      (m.guest_name && m.guest_name !== assistMode.scorerGuestName)
    )
  }

  // 선수 버튼 렌더링
  const PlayerButton = ({
    member,
    type,
    teamId,
    color,
  }: {
    member: any
    type: 'goal' | 'defense'
    teamId: number
    color: 'green' | 'blue' | 'orange' | 'sky'
  }) => {
    const count = type === 'goal'
      ? getPlayerGoals(member.player_id, member.guest_name)
      : getPlayerDefense(member.player_id, member.guest_name)

    const colorClasses = {
      green: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-800',
      orange: 'bg-orange-50 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-900 dark:text-orange-100 hover:bg-orange-100 dark:hover:bg-orange-800',
      blue: 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-100 hover:bg-indigo-100 dark:hover:bg-indigo-800',
      sky: 'bg-sky-50 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700 text-sky-900 dark:text-sky-100 hover:bg-sky-100 dark:hover:bg-sky-800',
    }[color]

    const badgeColor = {
      green: 'bg-emerald-500',
      orange: 'bg-orange-500',
      blue: 'bg-indigo-500',
      sky: 'bg-sky-500',
    }[color]

    return (
      <button
        onClick={() => type === 'goal'
          ? handleGoalClick(member, teamId)
          : handleDefenseClick(member, teamId)
        }
        disabled={addEventMutation.isPending}
        className={cn(
          'flex items-center justify-center gap-1 px-2 py-3 rounded-lg border text-xs font-medium transition-all active:scale-95 disabled:opacity-50 min-w-0',
          colorClasses
        )}
      >
        {shortName(member.name || member.guest_name)}
        {count > 0 && (
          <span className={cn('shrink-0 text-[10px] text-white px-1 rounded', badgeColor)}>
            {count}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col h-full max-h-screen overflow-hidden">
      {/* 헤더 - 고정 */}
      <div className="shrink-0 flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
          {match.match_no}경기: {team1?.name} vs {team2?.name}
        </h2>
      </div>

      {/* 스코어보드 - 고정 */}
      <div className="shrink-0 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-xl p-3 mt-3 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate">{team1?.name}</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{currentScore.team1}</p>
          </div>
          <div className="text-center px-3 shrink-0">
            <p className="text-xl font-mono font-bold text-cyan-600 dark:text-cyan-400 mb-1">
              {formatTime(timer)}
            </p>
            <div className="flex items-center gap-1.5">
              {matchData?.status === 'pending' && (
                <Button onClick={handleStart} size="sm" className="text-xs px-2 py-1 h-7">
                  <Play className="w-3 h-3 mr-1" />시작
                </Button>
              )}
              {matchData?.status === 'playing' && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => setIsRunning(!isRunning)} className="p-1.5 h-7 w-7">
                    {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  </Button>
                  <Button onClick={handleComplete} size="sm" className="text-xs px-2 py-1 h-7">
                    <Check className="w-3 h-3 mr-1" />완료
                  </Button>
                </>
              )}
              {matchData?.status === 'completed' && (
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded text-xs">완료</span>
              )}
            </div>
          </div>
          <div className="text-center flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate">{team2?.name}</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{currentScore.team2}</p>
          </div>
        </div>
      </div>

      {/* 기록 영역 - 스크롤 가능 */}
      {isEditable && (
        <div className="flex-1 overflow-y-auto mt-3 space-y-3 pb-3">
          {matchData?.status === 'completed' && (
            <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">수정 모드 — 완료된 경기의 이벤트를 추가/삭제할 수 있습니다</p>
            </div>
          )}

          {/* 골 기록 섹션 */}
          <div className={cn(
            'rounded-xl border p-3 transition-colors',
            assistMode
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
              : 'border-slate-200 dark:border-slate-700'
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className={cn(
                'text-xs font-bold',
                assistMode ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'
              )}>
                {assistMode ? '⚽ 어시스트 선택' : '⚽ 골 기록'}
              </span>
              {assistMode && (
                <button onClick={() => setAssistMode(null)} className="text-xs text-amber-600 hover:underline">
                  취소
                </button>
              )}
            </div>

            {assistMode ? (
              <div className="space-y-2">
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  득점: {shortName(team1Members.concat(team2Members).find((m: any) =>
                    m.player_id === assistMode.scorerId || m.guest_name === assistMode.scorerGuestName
                  )?.name || assistMode.scorerGuestName)}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleAssistSelect(null)}
                    disabled={addEventMutation.isPending}
                    className="col-span-2 px-2 py-2 rounded-lg text-xs font-medium bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-300"
                  >
                    단독 득점
                  </button>
                  {getAssistCandidates().map((member: any) => (
                    <button
                      key={member.id}
                      onClick={() => handleAssistSelect(member)}
                      disabled={addEventMutation.isPending}
                      className="px-2 py-2.5 rounded-lg text-xs font-medium bg-white dark:bg-amber-800/50 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100"
                    >
                      {shortName(member.name || member.guest_name)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {/* 팀1 (왼쪽) - 에메랄드 */}
                <div className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 mb-2 truncate text-center">{team1?.name}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {team1Members.map((member: any) => (
                      <PlayerButton key={member.id} member={member} type="goal" teamId={match.team1_id} color="green" />
                    ))}
                  </div>
                </div>
                {/* 팀2 (오른쪽) - 오렌지 */}
                <div className="flex-1 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 border border-orange-200 dark:border-orange-800">
                  <p className="text-[10px] font-bold text-orange-700 dark:text-orange-400 mb-2 truncate text-center">{team2?.name}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {team2Members.map((member: any) => (
                      <PlayerButton key={member.id} member={member} type="goal" teamId={match.team2_id} color="orange" />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 수비 기록 섹션 */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">🛡️ 수비 기록</span>
            <div className="flex gap-2">
              {/* 팀1 (왼쪽) - 인디고 */}
              <div className="flex-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-2 border border-indigo-200 dark:border-indigo-800">
                <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 mb-2 truncate text-center">{team1?.name}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {team1Members.map((member: any) => (
                    <PlayerButton key={member.id} member={member} type="defense" teamId={match.team1_id} color="blue" />
                  ))}
                </div>
              </div>
              {/* 팀2 (오른쪽) - 스카이 */}
              <div className="flex-1 bg-sky-50 dark:bg-sky-900/20 rounded-lg p-2 border border-sky-200 dark:border-sky-800">
                <p className="text-[10px] font-bold text-sky-700 dark:text-sky-400 mb-2 truncate text-center">{team2?.name}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {team2Members.map((member: any) => (
                    <PlayerButton key={member.id} member={member} type="defense" teamId={match.team2_id} color="sky" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 이벤트 로그 - 타임라인 스타일 */}
      <div className="shrink-0 mt-auto bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-xs font-semibold text-slate-900 dark:text-white">기록 ({events.length})</h3>
        </div>
        <div className="max-h-40 overflow-y-auto">
          {events.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-slate-500">아직 기록이 없습니다.</p>
          ) : (
            <div className="relative py-2">
              {/* 중앙 타임라인 */}
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700 -translate-x-1/2" />

              {[...events].reverse().slice(0, 10).map((event: any) => {
                const isTeam1 = event.team_id === match.team1_id

                return (
                  <div key={event.id} className="relative flex items-center px-2 py-1.5 group">
                    {/* 왼쪽 (팀1) */}
                    <div className="flex-1 flex items-center gap-1 justify-end pr-2">
                      {isTeam1 ? (
                        <>
                          {isEditable && (
                            <button
                              onClick={() => deleteEventMutation.mutate(event.id)}
                              className="p-0.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 shrink-0"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          )}
                          {event.assister_name && (
                            <span className="text-[10px] text-slate-400">({shortName(event.assister_name)})</span>
                          )}
                          <span className="text-xs font-medium text-slate-900 dark:text-white">
                            {shortName(event.player_name || event.guest_name)}
                          </span>
                        </>
                      ) : (
                        <span className="invisible text-xs">-</span>
                      )}
                    </div>

                    {/* 중앙 아이콘 + 시간 (항상 고정) */}
                    <div className="shrink-0 flex flex-col items-center z-10 w-14">
                      <div className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[10px]',
                        event.event_type === 'GOAL'
                          ? 'bg-green-100 dark:bg-green-900/50'
                          : 'bg-blue-100 dark:bg-blue-900/50'
                      )}>
                        {event.event_type === 'GOAL' ? '⚽' : '🛡️'}
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                        {formatTime(event.event_time || 0)}
                      </span>
                    </div>

                    {/* 오른쪽 (팀2) */}
                    <div className="flex-1 flex items-center gap-1 justify-start pl-2">
                      {!isTeam1 ? (
                        <>
                          <span className="text-xs font-medium text-slate-900 dark:text-white">
                            {shortName(event.player_name || event.guest_name)}
                          </span>
                          {event.assister_name && (
                            <span className="text-[10px] text-slate-400">({shortName(event.assister_name)})</span>
                          )}
                          {isEditable && (
                            <button
                              onClick={() => deleteEventMutation.mutate(event.id)}
                              className="p-0.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 shrink-0"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="invisible text-xs">-</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
