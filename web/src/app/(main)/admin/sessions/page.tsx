'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Calendar,
  Plus,
  Search,
  ChevronRight,
  Clock,
  CheckCircle,
  Users,
  AlertCircle,
  Trash2,
  Edit,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { sessionsApi } from '@/lib/api'
import { cn } from '@/lib/cn'

export default function AdminSessionsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const { isAdmin, isLoggedIn, token } = useAuthStore()
  const queryClient = useQueryClient()

  if (!isLoggedIn || !isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">접근 권한이 없습니다</h2>
        <Link href="/" className="text-emerald-600 hover:underline">홈으로 돌아가기</Link>
      </div>
    )
  }

  const { data, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionsApi.list(),
  })

  const sessions = data?.sessions || []

  const filteredSessions = sessions
    .filter((s: any) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (search && !s.title?.toLowerCase().includes(search.toLowerCase()) &&
          !s.session_date?.includes(search)) return false
      return true
    })
    .sort((a: any, b: any) => b.session_date?.localeCompare(a.session_date))

  const statusCounts = {
    all: sessions.length,
    recruiting: sessions.filter((s: any) => s.status === 'recruiting').length,
    closed: sessions.filter((s: any) => s.status === 'closed').length,
    completed: sessions.filter((s: any) => s.status === 'completed').length,
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-emerald-500" />
            세션 관리
          </h1>
          <p className="text-slate-500 mt-1">세션을 생성하고 관리하세요</p>
        </div>
        <Link
          href="/admin/sessions/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          새 세션
        </Link>
      </div>

      {/* 필터 */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="세션 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'recruiting', 'closed', 'completed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                statusFilter === status
                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              )}
            >
              {status === 'all' && '전체'}
              {status === 'recruiting' && '모집중'}
              {status === 'closed' && '마감'}
              {status === 'completed' && '완료'}
              <span className="ml-1 text-xs">({statusCounts[status]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* 세션 목록 */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500">세션이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session: any) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  )
}

function SessionCard({ session }: { session: any }) {
  const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
    recruiting: { icon: Clock, color: 'amber', label: '모집중' },
    closed: { icon: Users, color: 'slate', label: '마감' },
    completed: { icon: CheckCircle, color: 'emerald', label: '완료' },
  }

  const config = statusConfig[session.status] || statusConfig.closed
  const Icon = config.icon

  return (
    <Link
      href={`/sessions/${session.id}`}
      className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/50 transition-colors group"
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center',
          config.color === 'amber' && 'bg-amber-100 dark:bg-amber-500/20',
          config.color === 'slate' && 'bg-slate-100 dark:bg-slate-800',
          config.color === 'emerald' && 'bg-emerald-100 dark:bg-emerald-500/20',
        )}>
          <Icon className={cn(
            'w-6 h-6',
            config.color === 'amber' && 'text-amber-600 dark:text-amber-400',
            config.color === 'slate' && 'text-slate-500',
            config.color === 'emerald' && 'text-emerald-600 dark:text-emerald-400',
          )} />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
            {session.title || '코너킥스 정기 풋살'}
          </h3>
          <p className="text-sm text-slate-500">{session.session_date} • {session.start_time}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={cn(
          'px-2 py-1 rounded-lg text-xs font-medium',
          config.color === 'amber' && 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
          config.color === 'slate' && 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400',
          config.color === 'emerald' && 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
        )}>
          {config.label}
        </span>
        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
      </div>
    </Link>
  )
}
