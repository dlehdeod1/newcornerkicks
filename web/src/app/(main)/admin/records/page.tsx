'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronLeft, AlertCircle, BarChart3 } from 'lucide-react'
import { useAuthStore, useAuthHydrated } from '@/stores/auth'
import { clubsApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import EventsTab from '../settings/components/events-tab'
import WeightsTab from '../settings/components/weights-tab'

const TABS = [
  { key: 'events', label: '기록 이벤트' },
  { key: 'weights', label: '평점 가중치' },
] as const

type TabKey = typeof TABS[number]['key']

export default function AdminRecordsPage() {
  const hydrated = useAuthHydrated()
  const { isAdmin, isLoggedIn, token } = useAuthStore()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabKey>('events')

  const { data, isLoading } = useQuery({
    queryKey: ['club-me'],
    queryFn: () => clubsApi.me(token!),
    enabled: !!(token && isLoggedIn),
  })

  const club = data?.club ?? null

  if (!hydrated || isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isLoggedIn || !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">접근 권한이 없습니다</h2>
        <Link href="/" className="text-primary hover:underline">홈으로 돌아가기</Link>
      </div>
    )
  }

  if (!club) return null

  const handleUpdate = () => queryClient.invalidateQueries({ queryKey: ['club-me'] })

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-3">
          <ChevronLeft className="w-4 h-4" />
          관리자 대시보드
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-slate-500" />
          기록 설정
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">기록할 이벤트 종류와 평점 가중치를 관리하세요</p>
      </div>

      {/* 탭 바 */}
      <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800/50 rounded-xl p-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
              activeTab === key
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'events' && (
        <EventsTab club={club} token={token!} onUpdate={handleUpdate} />
      )}
      {activeTab === 'weights' && (
        <WeightsTab club={club} token={token!} onUpdate={handleUpdate} />
      )}
    </div>
  )
}
