'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, CheckCheck, Trash2, ExternalLink, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { notificationsApi } from '@/lib/api'
import { cn } from '@/lib/cn'

const notificationTypeConfig: Record<string, { icon: string; color: string; label: string }> = {
  session_created: { icon: '📅', color: 'bg-blue-500', label: '새 세션' },
  team_assigned: { icon: '👕', color: 'bg-emerald-500', label: '팀 배정' },
  match_result: { icon: '⚽', color: 'bg-amber-500', label: '경기 결과' },
  settlement: { icon: '💰', color: 'bg-green-500', label: '정산' },
  badge_earned: { icon: '🏆', color: 'bg-purple-500', label: '배지 획득' },
  announcement: { icon: '📢', color: 'bg-red-500', label: '공지' },
}

export default function NotificationsPage() {
  const router = useRouter()
  const { isLoggedIn, token } = useAuthStore()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-all'],
    queryFn: () => notificationsApi.list(token!, { limit: 50 }),
    enabled: isLoggedIn && !!token,
  })

  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markAsRead(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] })
    },
  })

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.delete(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] })
    },
  })

  if (!isLoggedIn) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Bell className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          로그인이 필요합니다
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          알림을 확인하려면 로그인하세요.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
        >
          로그인하기
        </Link>
      </div>
    )
  }

  const notifications = data?.notifications || []
  const unreadCount = data?.unreadCount || 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">알림</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                읽지 않은 알림 {unreadCount}개
              </p>
            )}
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsReadMutation.mutate()}
            className="flex items-center gap-2 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            모두 읽음
          </button>
        )}
      </div>

      {/* 알림 목록 */}
      <div className="bg-white dark:bg-slate-900/50 backdrop-blur rounded-2xl border border-slate-200 dark:border-slate-800/50 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex gap-4">
                <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              알림이 없습니다
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              새로운 알림이 도착하면 여기에 표시됩니다.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.map((notification: any) => {
              const config = notificationTypeConfig[notification.type] || {
                icon: '📌',
                color: 'bg-slate-500',
                label: '알림',
              }

              const content = (
                <div
                  className={cn(
                    'flex gap-4 p-4 sm:p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group',
                    !notification.is_read && 'bg-emerald-50/50 dark:bg-emerald-500/5'
                  )}
                  onClick={() => {
                    if (!notification.is_read) {
                      markAsReadMutation.mutate(notification.id)
                    }
                  }}
                >
                  {/* 아이콘 */}
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0',
                    config.color + '/20'
                  )}>
                    {config.icon}
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        config.color + '/20',
                        notification.type === 'session_created' && 'text-blue-600 dark:text-blue-400',
                        notification.type === 'team_assigned' && 'text-emerald-600 dark:text-emerald-400',
                        notification.type === 'match_result' && 'text-amber-600 dark:text-amber-400',
                        notification.type === 'settlement' && 'text-green-600 dark:text-green-400',
                        notification.type === 'badge_earned' && 'text-purple-600 dark:text-purple-400',
                        notification.type === 'announcement' && 'text-red-600 dark:text-red-400',
                      )}>
                        {config.label}
                      </span>
                      {!notification.is_read && (
                        <div className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />
                      )}
                    </div>
                    <p className={cn(
                      'text-base mb-1',
                      notification.is_read
                        ? 'text-slate-600 dark:text-slate-400'
                        : 'text-slate-900 dark:text-white font-medium'
                    )}>
                      {notification.title}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-500 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-600 mt-2">
                      {formatTimeAgo(notification.created_at)}
                    </p>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex flex-col items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notification.is_read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          markAsReadMutation.mutate(notification.id)
                        }}
                        className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                        title="읽음 표시"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteMutation.mutate(notification.id)
                      }}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )

              if (notification.link_url) {
                return (
                  <Link key={notification.id} href={notification.link_url}>
                    {content}
                  </Link>
                )
              }

              return <div key={notification.id}>{content}</div>
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function formatTimeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp

  if (diff < 60) return '방금 전'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`

  const date = new Date(timestamp * 1000)
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`
}
