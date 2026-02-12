'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import {
  ArrowLeft,
  Calendar,
  FileText,
  Sparkles,
  Check,
} from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth'
import { sessionsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

export default function NewSessionPage() {
  const router = useRouter()
  const { token, isAdmin } = useAuthStore()

  const [sessionDate, setSessionDate] = useState('')
  const [title, setTitle] = useState('')

  const createMutation = useMutation({
    mutationFn: (data: { sessionDate: string; title?: string }) =>
      sessionsApi.create(data, token!),
    onSuccess: (data) => {
      router.push(`/sessions/${data.id}`)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionDate) return

    createMutation.mutate({
      sessionDate,
      title: title || undefined,
    })
  }

  // 빠른 날짜 선택 (다음 주 수요일)
  const getNextWednesday = () => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const daysUntilWednesday = (3 - dayOfWeek + 7) % 7 || 7
    const nextWednesday = new Date(today)
    nextWednesday.setDate(today.getDate() + daysUntilWednesday)
    return nextWednesday.toISOString().split('T')[0]
  }

  const quickDates = [
    { label: '다음 수요일', value: getNextWednesday() },
    { label: '오늘', value: new Date().toISOString().split('T')[0] },
    { label: '내일', value: new Date(Date.now() + 86400000).toISOString().split('T')[0] },
  ]

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-500">관리자만 접근할 수 있습니다.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* 뒤로가기 */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        관리자 대시보드
      </Link>

      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          새 세션 만들기
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          새로운 풋살 세션을 생성합니다
        </p>
      </div>

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 날짜 선택 */}
        <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50">
          <label className="block mb-4">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              세션 날짜 *
            </span>
          </label>

          {/* 빠른 선택 */}
          <div className="flex flex-wrap gap-2 mb-4">
            {quickDates.map((qd) => (
              <button
                key={qd.value}
                type="button"
                onClick={() => setSessionDate(qd.value)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                  sessionDate === qd.value
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                )}
              >
                {qd.label}
              </button>
            ))}
          </div>

          <input
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            required
          />
        </div>

        {/* 제목 */}
        <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50">
          <label className="block mb-4">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              세션 제목 (선택)
            </span>
          </label>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="코너킥스 정기 풋살"
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
          <p className="text-xs text-slate-500 mt-2">
            비워두면 "코너킥스 정기 풋살"로 자동 설정됩니다
          </p>
        </div>

        {/* 미리보기 */}
        {sessionDate && (
          <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl p-6 border border-emerald-200 dark:border-emerald-500/30">
            <h3 className="font-semibold text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              미리보기
            </h3>
            <div className="bg-white dark:bg-slate-900/50 rounded-xl p-4">
              <p className="font-medium text-slate-900 dark:text-white">
                {title || '코너킥스 정기 풋살'}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {formatDate(sessionDate)}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                ✓ 모집중 상태로 생성됩니다
              </p>
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {createMutation.isError && (
          <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm">
            세션 생성에 실패했습니다. 다시 시도해주세요.
          </div>
        )}

        {/* 제출 버튼 */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => router.back()}
          >
            취소
          </Button>
          <Button
            type="submit"
            className="flex-1"
            loading={createMutation.isPending}
            disabled={!sessionDate}
          >
            <Check className="w-4 h-4" />
            세션 생성
          </Button>
        </div>
      </form>
    </div>
  )
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`
}
