'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, CheckCheck, Trash2, ExternalLink, Calendar, Shirt, Circle, DollarSign, Trophy, Megaphone, Pin } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth'
import { notificationsApi } from '@/lib/api'
import { cn } from '@/lib/cn'

const notificationTypeConfig: Record<string, { icon: ReactNode; color: string }> = {
  session_created: { icon: <Calendar className="w-5 h-5" />, color: 'bg-blue-500' },
  team_assigned: { icon: <Shirt className="w-5 h-5" />, color: 'bg-primary' },
  match_result: { icon: <Circle className="w-5 h-5" />, color: 'bg-amber-500' },
  settlement: { icon: <DollarSign className="w-5 h-5" />, color: 'bg-green-500' },
  badge_earned: { icon: <Trophy className="w-5 h-5" />, color: 'bg-purple-500' },
  announcement: { icon: <Megaphone className="w-5 h-5" />, color: 'bg-red-500' },
}

export function NotificationDropdown() {
  const { isLoggedIn, token } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  // 외부 클릭 감지
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 알림 목록 조회
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(token!, { limit: 10 }),
    enabled: isLoggedIn && !!token,
    refetchInterval: 30000, // 30초마다 새로고침
  })

  // 알림 읽음 처리
  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markAsRead(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // 모든 알림 읽음 처리
  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // 알림 삭제
  const deleteMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.delete(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  if (!isLoggedIn) return null

  const notifications = data?.notifications || []
  const unreadCount = data?.unreadCount || 0

  const handleNotificationClick = (notification: any) => {
    if (!notification.is_read) {
      markAsReadMutation.mutate(notification.id)
    }
    if (notification.link_url) {
      setIsOpen(false)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 알림 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* 드롭다운 */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-white">알림</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsReadMutation.mutate()}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" />
                모두 읽음
              </button>
            )}
          </div>

          {/* 알림 목록 */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex gap-3">
                    <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  새로운 알림이 없습니다
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.map((notification: any) => {
                  const config = notificationTypeConfig[notification.type] || {
                    icon: <Pin className="w-5 h-5" />,
                    color: 'bg-slate-500',
                  }

                  const content = (
                    <div
                      className={cn(
                        'flex gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group',
                        !notification.is_read && 'bg-primary/5'
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {/* 아이콘 */}
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                        config.color + '/20'
                      )}>
                        {config.icon}
                      </div>

                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 min-w-0">
                          <p className={cn(
                            'text-sm truncate',
                            notification.is_read
                              ? 'text-slate-600 dark:text-slate-400'
                              : 'text-slate-900 dark:text-white font-medium'
                          )}>
                            {notification.title}
                          </p>
                          {!notification.is_read && (
                            <div className="w-2 h-2 bg-primary rounded-full shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">
                          {formatTimeAgo(notification.created_at)}
                        </p>
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {notification.link_url && (
                          <ExternalLink className="w-4 h-4 text-slate-400" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteMutation.mutate(notification.id)
                          }}
                          className="p-1 text-slate-400 hover:text-red-500 rounded"
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

          {/* 푸터 */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800">
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="text-sm text-primary hover:underline block text-center"
              >
                모든 알림 보기
              </Link>
            </div>
          )}
        </div>
      )}
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
  return `${date.getMonth() + 1}/${date.getDate()}`
}
