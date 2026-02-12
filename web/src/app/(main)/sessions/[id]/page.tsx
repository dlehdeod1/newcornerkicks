'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Calendar, MapPin, Users, Trophy, BarChart3, Clock, Settings } from 'lucide-react'
import { sessionsApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { OverviewTab } from '@/components/session/overview-tab'
import { TeamsTab } from '@/components/session/teams-tab'
import { ScoreboardTab } from '@/components/session/scoreboard-tab'
import { StatsTab } from '@/components/session/stats-tab'
import { SessionEditModal } from '@/components/session/session-edit-modal'

type Tab = 'overview' | 'teams' | 'scoreboard' | 'stats'

export default function SessionDetailPage() {
  const params = useParams()
  const sessionId = Number(params.id)
  const { isAdmin } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => sessionsApi.get(sessionId),
  })

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
          <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!data?.session) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center py-16">
          <p className="text-slate-500 dark:text-slate-400">세션을 찾을 수 없습니다.</p>
        </div>
      </div>
    )
  }

  const { session, teams, matches, attendance } = data
  const date = new Date(session.session_date)
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
  const hasTeams = teams && teams.length > 0

  const tabs = [
    { id: 'overview' as Tab, label: '개요/참석', icon: Users },
    { id: 'teams' as Tab, label: '팀 구성', icon: Trophy, disabled: !hasTeams },
    { id: 'scoreboard' as Tab, label: '점수판', icon: BarChart3, disabled: !hasTeams },
    { id: 'stats' as Tab, label: '선수 스탯', icon: BarChart3, disabled: !hasTeams },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-full',
                session.status === 'recruiting'
                  ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                  : session.status === 'completed'
                  ? 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400'
                  : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
              )}
            >
              {session.status === 'recruiting' ? '모집중' : session.status === 'completed' ? '완료' : '마감'}
            </span>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
            >
              <Settings className="w-4 h-4 mr-1.5" />
              수정
            </Button>
          )}
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          {session.title || '코너킥스 정기 풋살'}
        </h1>
        <div className="flex flex-wrap items-center gap-4 md:gap-6 text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{session.session_date} ({dayOfWeek})</span>
          </div>
          {(session.start_time || session.end_time) && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{session.start_time || '20:00'} ~ {session.end_time || '22:00'}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span>{session.location || '수성대 풋살장 2번구장'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>{attendance?.length || 0}명 참석</span>
          </div>
        </div>
      </div>

      {/* 세션 수정 모달 */}
      <SessionEditModal
        session={session}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={refetch}
      />

      {/* 탭 */}
      <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
        <div className="flex gap-1 -mb-px overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : tab.disabled
                  ? 'border-transparent text-slate-400 dark:text-slate-600 cursor-not-allowed'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      {activeTab === 'overview' && (
        <OverviewTab
          session={session}
          attendance={attendance}
          teams={teams}
          onRefetch={refetch}
        />
      )}
      {activeTab === 'teams' && hasTeams && (
        <TeamsTab teams={teams} sessionId={sessionId} onRefetch={refetch} />
      )}
      {activeTab === 'scoreboard' && hasTeams && (
        <ScoreboardTab
          sessionId={sessionId}
          teams={teams}
          matches={matches}
          onRefetch={refetch}
        />
      )}
      {activeTab === 'stats' && hasTeams && (
        <StatsTab
          sessionId={sessionId}
          matches={matches}
          attendance={attendance}
          sessionStatus={session.status}
          teams={teams}
        />
      )}
          </div>
  )
}
