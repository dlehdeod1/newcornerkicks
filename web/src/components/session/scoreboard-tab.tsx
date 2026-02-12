'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Trophy, Play, List, Zap, Plus, Trash2, RefreshCw, X, Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { matchesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { MatchRecorder } from './match-recorder'
import { MatchTimeline } from '@/components/match/match-timeline'
import { useAuthStore } from '@/stores/auth'

type ViewMode = 'table' | 'timeline'

interface Props {
  sessionId: number
  teams: any[]
  matches: any[]
  onRefetch: () => void
}

export function ScoreboardTab({ sessionId, teams, matches, onRefetch }: Props) {
  const { token } = useAuthStore()
  const [selectedMatch, setSelectedMatch] = useState<any>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [showMatchManager, setShowMatchManager] = useState(false)

  // 각 경기의 이벤트 데이터 가져오기
  const { data: matchEventsData } = useQuery({
    queryKey: ['session-match-events', sessionId, matches.map((m: any) => m.id)],
    queryFn: async () => {
      const eventsMap: Record<number, any[]> = {}
      for (const match of matches) {
        try {
          const data = await matchesApi.get(match.id)
          eventsMap[match.id] = data.events || []
        } catch {
          eventsMap[match.id] = []
        }
      }
      return eventsMap
    },
    enabled: matches.length > 0 && viewMode === 'timeline',
  })

  // 리그 테이블 계산
  const leagueTable = useMemo(() => {
    const table = teams.map((team: any) => ({
      id: team.id,
      name: team.name,
      color: team.vest_color,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    }))

    const teamMap = new Map(table.map(t => [t.id, t]))

    matches.forEach((match: any) => {
      if (match.status !== 'completed') return

      const team1 = teamMap.get(match.team1_id)
      const team2 = teamMap.get(match.team2_id)

      if (!team1 || !team2) return

      team1.played++
      team2.played++

      team1.goalsFor += match.team1_score
      team1.goalsAgainst += match.team2_score
      team2.goalsFor += match.team2_score
      team2.goalsAgainst += match.team1_score

      if (match.team1_score > match.team2_score) {
        team1.won++
        team1.points += 3
        team2.lost++
      } else if (match.team1_score < match.team2_score) {
        team2.won++
        team2.points += 3
        team1.lost++
      } else {
        team1.drawn++
        team2.drawn++
        team1.points += 1
        team2.points += 1
      }
    })

    // 정렬: 승점 > 득실차 > 다득점
    return table.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      const gdA = a.goalsFor - a.goalsAgainst
      const gdB = b.goalsFor - b.goalsAgainst
      if (gdB !== gdA) return gdB - gdA
      return b.goalsFor - a.goalsFor
    })
  }, [teams, matches])

  if (selectedMatch) {
    return (
      <MatchRecorder
        match={selectedMatch}
        teams={teams}
        onClose={() => {
          setSelectedMatch(null)
          onRefetch()
        }}
        onRefetch={onRefetch}
      />
    )
  }

  if (showMatchManager) {
    return (
      <MatchManager
        sessionId={sessionId}
        teams={teams}
        matches={matches}
        onClose={() => {
          setShowMatchManager(false)
          onRefetch()
        }}
        onRefetch={onRefetch}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* 뷰 모드 전환 + 경기 관리 버튼 */}
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowMatchManager(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          경기 일정 관리
        </Button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('table')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              viewMode === 'table'
                ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            )}
          >
            <List className="w-4 h-4" />
            테이블 뷰
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              viewMode === 'timeline'
                ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            )}
          >
            <Zap className="w-4 h-4" />
            하이라이트 뷰
          </button>
        </div>
      </div>

      {viewMode === 'timeline' ? (
        /* 타임라인 뷰 */
        <div className="space-y-4">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
              경기 하이라이트
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              각 경기의 골과 주요 이벤트를 타임라인으로 확인하세요
            </p>
          </div>
          {matches.map((match: any) => (
            <MatchTimeline
              key={match.id}
              match={{
                id: match.id,
                match_no: match.match_no,
                team1_id: match.team1_id,
                team2_id: match.team2_id,
                team1_score: match.team1_score,
                team2_score: match.team2_score,
                status: match.status === 'completed' ? 'DONE' : match.status,
              }}
              teams={teams.map((t: any) => ({
                id: t.id,
                team_name: t.name,
                color_primary: t.vest_color || '#3B82F6',
              }))}
              events={(matchEventsData?.[match.id] || []).map((e: any) => ({
                id: e.id,
                event_type: e.event_type,
                player_id: e.player_id,
                player_name: e.player_name,
                team_id: e.team_id,
                assist_player_id: e.assister_id,
                assist_player_name: e.assister_name,
              }))}
            />
          ))}
        </div>
      ) : (
        <>
      {/* 리그 테이블 */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
            <h3 className="font-semibold text-slate-900 dark:text-white">리그 순위</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">팀</th>
                <th className="px-4 py-3 text-center">경기</th>
                <th className="px-4 py-3 text-center">승</th>
                <th className="px-4 py-3 text-center">무</th>
                <th className="px-4 py-3 text-center">패</th>
                <th className="px-4 py-3 text-center">득</th>
                <th className="px-4 py-3 text-center">실</th>
                <th className="px-4 py-3 text-center">득실</th>
                <th className="px-4 py-3 text-center font-semibold">승점</th>
              </tr>
            </thead>
            <tbody>
              {leagueTable.map((team, idx) => (
                <tr
                  key={team.id}
                  className={cn(
                    'border-b border-slate-100 dark:border-slate-700/50',
                    idx === 0 && 'bg-yellow-50 dark:bg-yellow-500/10'
                  )}
                >
                  <td className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white max-w-[100px] truncate">{team.name}</td>
                  <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">{team.played}</td>
                  <td className="px-4 py-3 text-center text-green-600 dark:text-green-400">{team.won}</td>
                  <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">{team.drawn}</td>
                  <td className="px-4 py-3 text-center text-red-600 dark:text-red-400">{team.lost}</td>
                  <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">{team.goalsFor}</td>
                  <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">{team.goalsAgainst}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        team.goalsFor - team.goalsAgainst > 0
                          ? 'text-green-600 dark:text-green-400'
                          : team.goalsFor - team.goalsAgainst < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-slate-500 dark:text-slate-400'
                      )}
                    >
                      {team.goalsFor - team.goalsAgainst > 0 && '+'}
                      {team.goalsFor - team.goalsAgainst}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-white">{team.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 경기 목록 */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white">경기 일정</h3>
        </div>
        {matches.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-slate-500 dark:text-slate-400 mb-4">아직 경기 일정이 없습니다.</p>
            <Button onClick={() => setShowMatchManager(true)}>
              <Plus className="w-4 h-4 mr-2" />
              경기 일정 만들기
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {matches.map((match: any) => (
              <MatchRow
                key={match.id}
                match={match}
                onClick={() => setSelectedMatch(match)}
              />
            ))}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  )
}

function MatchRow({ match, onClick }: { match: any; onClick: () => void }) {
  const statusColors = {
    pending: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400',
    playing: 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400',
    completed: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
  }

  const statusLabels = {
    pending: '예정',
    playing: '진행중',
    completed: '완료',
  }

  return (
    <button
      onClick={onClick}
      className="w-full px-4 sm:px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left gap-2 min-w-0"
    >
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        <span className="text-xs sm:text-sm text-slate-500 shrink-0">{match.match_no}경기</span>
        <div className="flex items-center gap-1 sm:gap-3 min-w-0 flex-1">
          <span className="font-medium text-slate-900 dark:text-white truncate text-xs sm:text-sm flex-1 text-right">
            {match.team1_name}
          </span>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <span className="text-base sm:text-xl font-bold text-slate-900 dark:text-white">{match.team1_score}</span>
            <span className="text-slate-400 dark:text-slate-500">:</span>
            <span className="text-base sm:text-xl font-bold text-slate-900 dark:text-white">{match.team2_score}</span>
          </div>
          <span className="font-medium text-slate-900 dark:text-white truncate text-xs sm:text-sm flex-1">
            {match.team2_name}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={cn(
            'px-2 py-1 text-[10px] sm:text-xs font-medium rounded',
            statusColors[match.status as keyof typeof statusColors] || statusColors.pending
          )}
        >
          {statusLabels[match.status as keyof typeof statusLabels] || match.status}
        </span>
        <Play className="w-4 h-4 text-slate-400 dark:text-slate-500 hidden sm:block" />
      </div>
    </button>
  )
}

// 경기 관리 컴포넌트
function MatchManager({
  sessionId,
  teams,
  matches,
  onClose,
  onRefetch,
}: {
  sessionId: number
  teams: any[]
  matches: any[]
  onClose: () => void
  onRefetch: () => void
}) {
  const { token } = useAuthStore()

  // 단일 경기 생성
  const createMatchMutation = useMutation({
    mutationFn: (data: { team1Id: number; team2Id: number }) =>
      matchesApi.create({ sessionId, ...data }, token || undefined),
    onSuccess: onRefetch,
  })

  // 경기 삭제
  const deleteMatchMutation = useMutation({
    mutationFn: (matchId: number) => matchesApi.delete(matchId, token || undefined),
    onSuccess: onRefetch,
  })

  const handleDeleteMatch = (matchId: number) => {
    if (!window.confirm('이 경기를 삭제하시겠습니까? 관련 기록도 모두 삭제됩니다.')) return
    deleteMatchMutation.mutate(matchId)
  }

  // 빠른 경기 추가 (팀 조합 버튼)
  const handleQuickAdd = (team1Id: number, team2Id: number) => {
    createMatchMutation.mutate({ team1Id, team2Id })
  }

  // 가능한 팀 조합 생성
  const teamCombinations = useMemo(() => {
    const combos: Array<{ team1: any; team2: any }> = []
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        combos.push({ team1: teams[i], team2: teams[j] })
      }
    }
    return combos
  }, [teams])

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">경기 일정 관리</h3>
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 빠른 경기 추가 */}
      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-4 h-4 text-green-600 dark:text-green-400" />
          <span className="text-sm font-bold text-green-700 dark:text-green-400">다음 경기 추가</span>
          <span className="text-xs text-green-600 dark:text-green-500">클릭하면 바로 추가</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {teamCombinations.map((combo, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickAdd(combo.team1.id, combo.team2.id)}
              disabled={createMatchMutation.isPending}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                'bg-white dark:bg-green-800/50 border border-green-300 dark:border-green-700',
                'hover:bg-green-100 dark:hover:bg-green-700 active:scale-95',
                'text-green-800 dark:text-green-200 disabled:opacity-50'
              )}
            >
              {combo.team1.name} vs {combo.team2.name}
            </button>
          ))}
        </div>
      </div>

      {/* 현재 경기 목록 */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
            현재 경기 ({matches.length})
          </h4>
        </div>
        {matches.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
            경기가 없습니다. 위에서 경기를 추가해주세요.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {matches.map((match: any) => (
              <div key={match.id} className="px-4 py-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-xs text-slate-500 shrink-0">{match.match_no}</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {match.team1_name} vs {match.team2_name}
                  </span>
                  <span className={cn(
                    'px-1.5 py-0.5 text-[10px] rounded shrink-0',
                    match.status === 'completed'
                      ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                      : match.status === 'playing'
                      ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                      : 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400'
                  )}>
                    {match.status === 'completed' ? '완료' : match.status === 'playing' ? '진행중' : '예정'}
                  </span>
                </div>
                {match.status === 'pending' && (
                  <button
                    onClick={() => handleDeleteMatch(match.id)}
                    disabled={deleteMatchMutation.isPending}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors disabled:opacity-50 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 닫기 버튼 */}
      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          돌아가기
        </Button>
      </div>
    </div>
  )
}
