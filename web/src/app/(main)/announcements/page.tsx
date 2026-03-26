'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, Pin, ChevronRight, Plus } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { announcementsApi } from '@/lib/api'
import { cn } from '@/lib/cn'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cornerkicks-api.conerkicks.workers.dev'

function formatDate(ts: number) {
  const d = new Date(ts * 1000)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export default function AnnouncementsPage() {
  const { isLoggedIn, isAdmin, token } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => announcementsApi.list(token!),
    enabled: isLoggedIn && !!token,
  })

  const { data: unreadData } = useQuery({
    queryKey: ['announcements', 'unread-count'],
    queryFn: () => announcementsApi.unreadCount(token!),
    enabled: isLoggedIn && !!token,
  })

  const announcements = data?.data || []
  const unreadCount = unreadData?.data?.count || 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              공지사항
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
                  {unreadCount}
                </span>
              )}
            </h1>
          </div>
        </div>
        {isAdmin && (
          <Link
            href="/admin/announcements"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            새 공지 작성
          </Link>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-20">
          <Bell className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400">공지사항이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a: any) => {
            const isUnread = a.is_read === 0
            return (
              <Link
                key={a.id}
                href={`/announcements/${a.id}`}
                className={cn(
                  'block bg-white/80 dark:bg-slate-900/50 backdrop-blur rounded-2xl p-5 border border-slate-200 dark:border-slate-800/50 shadow-sm hover:shadow-md transition-all group',
                  isUnread && 'border-l-4 border-l-primary'
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Image thumbnail */}
                  {a.image_url && (
                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-800">
                      <img
                        src={`${API_BASE}${a.image_url}`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    {/* Badges */}
                    <div className="flex items-center gap-2 mb-1">
                      {a.is_pinned === 1 && (
                        <Pin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      )}
                      {a.club_id === null ? (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full">
                          시스템
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                          클럽
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className={cn(
                      'text-slate-900 dark:text-white group-hover:text-primary transition-colors truncate',
                      isUnread ? 'font-bold' : 'font-medium'
                    )}>
                      {a.title}
                    </h3>

                    {/* Meta */}
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {a.author_name || '관리자'} · {formatDate(a.created_at)}
                    </p>
                  </div>

                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors flex-shrink-0 mt-2" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
