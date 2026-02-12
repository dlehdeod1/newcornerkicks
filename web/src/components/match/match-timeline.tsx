'use client'

import { useState } from 'react'
import { Goal, Shield, Users, Clock, ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { cn } from '@/lib/cn'

interface MatchEvent {
  id: number
  event_type: 'GOAL' | 'ASSIST' | 'BLOCK'
  player_id: number
  player_name: string
  team_id: number
  minute?: number
  assist_player_id?: number
  assist_player_name?: string
}

interface Team {
  id: number
  team_name: string
  color_primary: string
}

interface Match {
  id: number
  match_no: number
  team1_id: number
  team2_id: number
  team1_score: number
  team2_score: number
  status: string
}

interface MatchTimelineProps {
  match: Match
  teams: Team[]
  events: MatchEvent[]
  className?: string
}

const eventIcons = {
  GOAL: Goal,
  ASSIST: Users,
  BLOCK: Shield,
}

const eventColors = {
  GOAL: 'text-red-500 bg-red-100 dark:bg-red-500/20',
  ASSIST: 'text-blue-500 bg-blue-100 dark:bg-blue-500/20',
  BLOCK: 'text-green-500 bg-green-100 dark:bg-green-500/20',
}

const eventLabels = {
  GOAL: '골',
  ASSIST: '어시스트',
  BLOCK: '수비',
}

export function MatchTimeline({ match, teams, events, className }: MatchTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const team1 = teams.find(t => t.id === match.team1_id)
  const team2 = teams.find(t => t.id === match.team2_id)

  // 골 이벤트만 타임라인에 표시 (어시스트는 골에 포함)
  const goalEvents = events
    .filter(e => e.event_type === 'GOAL')
    .sort((a, b) => (a.minute || 0) - (b.minute || 0))

  // 팀별 이벤트 그룹화
  const team1Events = events.filter(e => e.team_id === match.team1_id)
  const team2Events = events.filter(e => e.team_id === match.team2_id)

  const isTeam1Winner = match.team1_score > match.team2_score
  const isTeam2Winner = match.team2_score > match.team1_score
  const isDraw = match.team1_score === match.team2_score

  return (
    <div className={cn(
      'bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden',
      className
    )}>
      {/* 헤더 - 스코어보드 */}
      <div
        className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Zap className="w-3 h-3" />
            {match.match_no}경기
          </span>
          <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center justify-between gap-4">
          {/* Team 1 */}
          <div className={cn(
            'flex-1 text-center transition-all',
            isTeam1Winner && 'scale-105'
          )}>
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2 text-white font-bold text-lg shadow-lg"
              style={{ backgroundColor: team1?.color_primary || '#3B82F6' }}
            >
              {team1?.team_name?.charAt(0) || 'A'}
            </div>
            <p className="font-medium text-slate-900 dark:text-white text-sm truncate">
              {team1?.team_name || '팀 A'}
            </p>
          </div>

          {/* Score */}
          <div className="flex items-center gap-3 shrink-0">
            <span className={cn(
              'text-4xl font-black',
              isTeam1Winner
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-400 dark:text-slate-500'
            )}>
              {match.team1_score}
            </span>
            <span className="text-2xl text-slate-300 dark:text-slate-600">:</span>
            <span className={cn(
              'text-4xl font-black',
              isTeam2Winner
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-400 dark:text-slate-500'
            )}>
              {match.team2_score}
            </span>
          </div>

          {/* Team 2 */}
          <div className={cn(
            'flex-1 text-center transition-all',
            isTeam2Winner && 'scale-105'
          )}>
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2 text-white font-bold text-lg shadow-lg"
              style={{ backgroundColor: team2?.color_primary || '#EF4444' }}
            >
              {team2?.team_name?.charAt(0) || 'B'}
            </div>
            <p className="font-medium text-slate-900 dark:text-white text-sm truncate">
              {team2?.team_name || '팀 B'}
            </p>
          </div>
        </div>

        {/* 결과 뱃지 */}
        {match.status === 'DONE' && (
          <div className="mt-3 text-center">
            {isDraw ? (
              <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium rounded-full">
                무승부
              </span>
            ) : (
              <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium rounded-full">
                {isTeam1Winner ? team1?.team_name : team2?.team_name} 승리
              </span>
            )}
          </div>
        )}
      </div>

      {/* 타임라인 */}
      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-slate-800">
          {goalEvents.length === 0 ? (
            <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-sm">
              아직 기록된 이벤트가 없습니다
            </div>
          ) : (
            <div className="relative">
              {/* 중앙 라인 */}
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700 transform -translate-x-1/2" />

              {/* 이벤트들 */}
              <div className="py-4 space-y-0">
                {goalEvents.map((event, index) => {
                  const isTeam1 = event.team_id === match.team1_id
                  const Icon = eventIcons[event.event_type]

                  return (
                    <div
                      key={event.id}
                      className={cn(
                        'relative flex items-center gap-4 px-4 py-3',
                        isTeam1 ? 'flex-row' : 'flex-row-reverse'
                      )}
                    >
                      {/* 이벤트 카드 */}
                      <div className={cn(
                        'flex-1 flex gap-3',
                        isTeam1 ? 'justify-end' : 'justify-start'
                      )}>
                        <div className={cn(
                          'bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 max-w-[200px]',
                          'border border-slate-100 dark:border-slate-700'
                        )}>
                          <div className="flex items-center gap-2 mb-1">
                            <div className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center',
                              eventColors[event.event_type]
                            )}>
                              <Icon className="w-3 h-3" />
                            </div>
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              {eventLabels[event.event_type]}
                            </span>
                          </div>
                          <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                            ⚽ {event.player_name}
                          </p>
                          {event.assist_player_name && (
                            <p className="text-xs text-blue-500 dark:text-blue-400 mt-1 truncate">
                              🅰️ {event.assist_player_name}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 중앙 점 */}
                      <div className="relative z-10">
                        <div
                          className="w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 shadow-sm"
                          style={{
                            backgroundColor: isTeam1
                              ? team1?.color_primary || '#3B82F6'
                              : team2?.color_primary || '#EF4444'
                          }}
                        />
                      </div>

                      {/* 빈 공간 */}
                      <div className="flex-1" />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 하단 통계 요약 */}
          <div className="border-t border-slate-200 dark:border-slate-800 p-4 overflow-hidden">
            <div className="grid grid-cols-2 gap-4">
              {/* Team 1 Stats */}
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 truncate">
                  {team1?.team_name} 통계
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                    <Goal className="w-3 h-3 text-red-500" />
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    골: {team1Events.filter(e => e.event_type === 'GOAL').length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                    <Users className="w-3 h-3 text-blue-500" />
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    어시스트: {team1Events.filter(e => e.event_type === 'GOAL' && e.assist_player_id).length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                    <Shield className="w-3 h-3 text-green-500" />
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    수비: {team1Events.filter(e => e.event_type === 'DEFENSE').length}
                  </span>
                </div>
              </div>

              {/* Team 2 Stats */}
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 truncate">
                  {team2?.team_name} 통계
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                    <Goal className="w-3 h-3 text-red-500" />
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    골: {team2Events.filter(e => e.event_type === 'GOAL').length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                    <Users className="w-3 h-3 text-blue-500" />
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    어시스트: {team2Events.filter(e => e.event_type === 'GOAL' && e.assist_player_id).length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                    <Shield className="w-3 h-3 text-green-500" />
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    수비: {team2Events.filter(e => e.event_type === 'DEFENSE').length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 세션의 모든 경기를 보여주는 타임라인 리스트
interface SessionTimelineProps {
  matches: Match[]
  teams: Team[]
  eventsByMatch: Record<number, MatchEvent[]>
}

export function SessionTimeline({ matches, teams, eventsByMatch }: SessionTimelineProps) {
  return (
    <div className="space-y-4">
      {matches.map((match) => (
        <MatchTimeline
          key={match.id}
          match={match}
          teams={teams}
          events={eventsByMatch[match.id] || []}
        />
      ))}
    </div>
  )
}
