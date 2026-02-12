'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import {
  ArrowLeft,
  Bell,
  Send,
  Users,
  Calendar,
  Trophy,
  Megaphone,
  Check,
} from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

const NOTIFICATION_TYPES = [
  { value: 'announcement', label: '공지사항', icon: Megaphone, color: 'red' },
  { value: 'session_created', label: '새 세션', icon: Calendar, color: 'blue' },
  { value: 'settlement', label: '정산 알림', icon: Trophy, color: 'green' },
]

const TEMPLATES = [
  {
    type: 'announcement',
    title: '공지사항',
    message: '새로운 공지가 있습니다. 확인해주세요!',
  },
  {
    type: 'session_created',
    title: '새 세션 오픈!',
    message: '다음 주 풋살 세션이 열렸습니다. 참가 신청해주세요!',
  },
  {
    type: 'settlement',
    title: '정산 완료',
    message: '이번 세션 정산이 완료되었습니다. 상금을 확인하세요!',
  },
]

export default function AdminNotificationsPage() {
  const router = useRouter()
  const { token, isAdmin } = useAuthStore()

  const [type, setType] = useState('announcement')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [success, setSuccess] = useState(false)

  const broadcastMutation = useMutation({
    mutationFn: (data: { type: string; title: string; message: string; linkUrl?: string }) =>
      api('/notifications/broadcast', { method: 'POST', body: data, token: token! }),
    onSuccess: () => {
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setTitle('')
        setMessage('')
        setLinkUrl('')
      }, 3000)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) return

    broadcastMutation.mutate({
      type,
      title: title.trim(),
      message: message.trim(),
      linkUrl: linkUrl.trim() || undefined,
    })
  }

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    setType(template.type)
    setTitle(template.title)
    setMessage(template.message)
  }

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
          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/20 rounded-xl flex items-center justify-center">
            <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          알림 발송
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          모든 회원에게 알림을 발송합니다
        </p>
      </div>

      {/* 성공 메시지 */}
      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-500/30 mb-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
          <p className="text-emerald-700 dark:text-emerald-400 font-medium">
            알림이 성공적으로 발송되었습니다!
          </p>
        </div>
      )}

      {/* 템플릿 */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          빠른 템플릿
        </h3>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((template) => (
            <button
              key={template.type}
              type="button"
              onClick={() => applyTemplate(template)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 transition-colors"
            >
              {template.title}
            </button>
          ))}
        </div>
      </div>

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 알림 유형 */}
        <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50">
          <label className="block mb-4">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              알림 유형
            </span>
          </label>

          <div className="grid grid-cols-3 gap-3">
            {NOTIFICATION_TYPES.map((nt) => {
              const Icon = nt.icon
              return (
                <button
                  key={nt.value}
                  type="button"
                  onClick={() => setType(nt.value)}
                  className={cn(
                    'p-4 rounded-xl border-2 transition-all text-center',
                    type === nt.value
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  )}
                >
                  <Icon className={cn(
                    'w-6 h-6 mx-auto mb-2',
                    type === nt.value
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400'
                  )} />
                  <span className={cn(
                    'text-sm font-medium',
                    type === nt.value
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-600 dark:text-slate-400'
                  )}>
                    {nt.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 제목 */}
        <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50">
          <label className="block mb-4">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              알림 제목 *
            </span>
          </label>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="알림 제목을 입력하세요"
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            required
          />
        </div>

        {/* 내용 */}
        <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50">
          <label className="block mb-4">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              알림 내용 *
            </span>
          </label>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="알림 내용을 입력하세요"
            rows={4}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
            required
          />
        </div>

        {/* 링크 URL */}
        <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50">
          <label className="block mb-4">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              링크 URL (선택)
            </span>
          </label>

          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="/sessions/123"
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
          <p className="text-xs text-slate-500 mt-2">
            알림 클릭 시 이동할 페이지 경로 (예: /sessions/123)
          </p>
        </div>

        {/* 미리보기 */}
        {title && message && (
          <div className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-6">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              미리보기
            </h3>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/20 rounded-lg flex items-center justify-center text-lg">
                  📢
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{title}</p>
                  <p className="text-sm text-slate-500 mt-1">{message}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {broadcastMutation.isError && (
          <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm">
            알림 발송에 실패했습니다: {(broadcastMutation.error as Error)?.message || '알 수 없는 오류'}
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
            className="flex-1 bg-amber-500 hover:bg-amber-600"
            loading={broadcastMutation.isPending}
            disabled={!title.trim() || !message.trim()}
          >
            <Send className="w-4 h-4" />
            전체 발송
          </Button>
        </div>
      </form>
    </div>
  )
}
