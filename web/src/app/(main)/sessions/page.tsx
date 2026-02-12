'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Calendar, MapPin, Plus, ChevronRight, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { sessionsApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import { CreateSessionModal } from '@/components/session/create-session-modal'

export default function SessionsPage() {
  const { isAdmin } = useAuthStore()
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionsApi.list(),
  })

  const sessions = data?.sessions || []

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
            일정
          </h1>
          <p className="text-slate-500 mt-2">코너킥스 풋살 일정을 확인하세요</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4" />
            새 일정
          </Button>
        )}
      </div>

      {/* 세션 목록 */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900/50 backdrop-blur rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50 animate-pulse shadow-sm">
              <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/3 mb-4" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/2" />
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-slate-400 dark:text-slate-600" />
          </div>
          <p className="text-slate-500 mb-6">아직 등록된 일정이 없습니다.</p>
          {isAdmin && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4" />
              첫 일정 만들기
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session: any) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}

      {/* 생성 모달 */}
      {showCreateModal && (
        <CreateSessionModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            refetch()
          }}
        />
      )}
    </div>
  )
}

function SessionCard({ session }: { session: any }) {
  const statusConfig = {
    recruiting: {
      bg: 'bg-emerald-100 dark:bg-emerald-500/10',
      border: 'border-emerald-200 dark:border-emerald-500/30',
      text: 'text-emerald-600 dark:text-emerald-400',
      dot: 'bg-emerald-500 dark:bg-emerald-400',
      label: '모집중',
    },
    closed: {
      bg: 'bg-slate-100 dark:bg-slate-500/10',
      border: 'border-slate-200 dark:border-slate-500/30',
      text: 'text-slate-600 dark:text-slate-400',
      dot: 'bg-slate-500 dark:bg-slate-400',
      label: '마감',
    },
  }

  const status = statusConfig[session.status as keyof typeof statusConfig] || statusConfig.closed
  const date = new Date(session.session_date)
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
  const isUpcoming = date >= new Date()

  return (
    <Link
      href={`/sessions/${session.id}`}
      className="group block bg-white dark:bg-slate-900/50 backdrop-blur hover:bg-slate-50 dark:hover:bg-slate-900/80 rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50 hover:border-emerald-300 dark:hover:border-emerald-500/30 transition-all duration-300 shadow-sm"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* 상태 + 날짜 */}
          <div className="flex items-center gap-3 mb-4">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border',
                status.bg,
                status.border,
                status.text
              )}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', status.dot)} />
              {status.label}
            </span>
            {isUpcoming && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full">
                <Clock className="w-3 h-3" />
                예정
              </span>
            )}
          </div>

          {/* 날짜 */}
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {session.session_date}
            </span>
            <span className="text-sm text-slate-500">({dayOfWeek}요일)</span>
          </div>

          {/* 제목 */}
          <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-4">
            {session.title || '코너킥스 정기 풋살'}
          </h3>

          {/* 정보 */}
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              <span>수성대 풋살장 2번구장</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>21:00 ~ 23:00</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/50 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20 transition-colors">
          <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
        </div>
      </div>
    </Link>
  )
}
