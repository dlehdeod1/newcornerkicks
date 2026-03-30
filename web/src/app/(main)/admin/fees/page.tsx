'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronLeft, AlertCircle, Banknote } from 'lucide-react'
import { useAuthStore, useAuthHydrated } from '@/stores/auth'
import { clubsApi } from '@/lib/api'
import FeeTab from '../settings/components/fee-tab'

export default function AdminFeesPage() {
  const hydrated = useAuthHydrated()
  const { isAdmin, isLoggedIn, token } = useAuthStore()
  const queryClient = useQueryClient()

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

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-3">
          <ChevronLeft className="w-4 h-4" />
          관리자 대시보드
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Banknote className="w-8 h-8 text-slate-500" />
          참가비 설정
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">세션 참가비 규칙을 설정하세요</p>
      </div>

      <FeeTab
        club={club}
        token={token!}
        onUpdate={() => queryClient.invalidateQueries({ queryKey: ['club-me'] })}
      />
    </div>
  )
}
