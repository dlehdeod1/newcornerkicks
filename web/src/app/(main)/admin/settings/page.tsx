'use client'

import { useState, useCallback, Suspense } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Settings,
  AlertCircle,
  ChevronLeft,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { clubsApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import BasicInfoTab from './components/basic-info-tab'
import FeeTab from './components/fee-tab'
import EventsTab from './components/events-tab'
import WeightsTab from './components/weights-tab'

const TABS = [
  { key: 'info', label: '기본 정보' },
  { key: 'fees', label: '참가비' },
  { key: 'events', label: '기록 설정' },
  { key: 'weights', label: '평점 가중치' },
] as const

type TabKey = typeof TABS[number]['key']

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AdminSettingsContent />
    </Suspense>
  )
}

function AdminSettingsContent() {
  const { isLoggedIn, isAdmin, token } = useAuthStore()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  const activeTab = (searchParams.get('tab') as TabKey) || 'info'
  const [dirtyTab, setDirtyTab] = useState<TabKey | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['club-me'],
    queryFn: () => clubsApi.me(token!),
    enabled: !!token && isLoggedIn,
  })

  const club = data?.club ?? null

  const handleTabChange = (tab: TabKey) => {
    if (tab === activeTab) return
    if (dirtyTab && dirtyTab === activeTab) {
      if (!confirm('저장하지 않은 변경사항이 있습니다. 탭을 이동할까요?')) return
    }
    setDirtyTab(null)
    router.replace('?tab=' + tab, { scroll: false })
  }

  const handleDirtyChange = useCallback((tab: TabKey) => (dirty: boolean) => {
    setDirtyTab(dirty ? tab : null)
  }, [])

  const handleUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['club-me'] })
  }, [queryClient])

  if (!isLoggedIn || !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">접근 권한이 없습니다</h2>
        <p className="text-slate-500 mb-6">관리자만 접근할 수 있습니다.</p>
        <Link href="/" className="text-emerald-600 hover:underline">홈으로 돌아가기</Link>
      </div>
    )
  }

  if (isLoading || !club) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-3">
          <ChevronLeft className="w-4 h-4" />
          관리자 대시보드
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Settings className="w-8 h-8 text-slate-500" />
          클럽 설정
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">클럽 로고, 초대 코드, 기능 설정을 관리하세요</p>
      </div>

      {/* 탭 바 */}
      <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800/50 rounded-xl p-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={cn(
              'flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors relative',
              activeTab === key
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            {label}
            {dirtyTab === key && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'info' && (
        <BasicInfoTab club={club} token={token!} onUpdate={handleUpdate} onDirtyChange={handleDirtyChange('info')} />
      )}
      {activeTab === 'fees' && (
        <FeeTab club={club} token={token!} onUpdate={handleUpdate} onDirtyChange={handleDirtyChange('fees')} />
      )}
      {activeTab === 'events' && (
        <EventsTab club={club} token={token!} onUpdate={handleUpdate} onDirtyChange={handleDirtyChange('events')} />
      )}
      {activeTab === 'weights' && (
        <WeightsTab club={club} token={token!} onUpdate={handleUpdate} onDirtyChange={handleDirtyChange('weights')} />
      )}
    </div>
  )
}
