'use client'

import { Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MessageSquare, Pin, Plus, Image as ImageIcon, MessageCircle, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { postsApi, announcementsApi } from '@/lib/api'
import { cn } from '@/lib/cn'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cornerkicks-api.conerkicks.workers.dev'

const categories = [
  { key: 'notice', label: '공지', color: 'purple' },
  { key: 'free', label: '자유', color: 'emerald' },
  { key: 'review', label: '경기 후기', color: 'amber' },
  { key: 'schedule', label: '일정 논의', color: 'blue' },
] as const

type CategoryKey = typeof categories[number]['key']

function formatDate(ts: number) {
  const d = new Date(ts * 1000)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

const categoryBadgeColors: Record<string, string> = {
  free: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  review: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
  schedule: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
  notice: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
}

export default function BoardPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BoardContent />
    </Suspense>
  )
}

function BoardContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { isLoggedIn, token } = useAuthStore()

  const initialTab = (searchParams.get('tab') as CategoryKey) || 'free'
  const [activeTab, setActiveTab] = useState<CategoryKey>(initialTab)

  const isNoticeTab = activeTab === 'notice'

  // Fetch announcements for notice tab
  const { data: announcementsData, isLoading: announcementsLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => announcementsApi.list(token!),
    enabled: isLoggedIn && !!token && isNoticeTab,
  })

  // Fetch posts for other tabs
  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['posts', activeTab],
    queryFn: () => postsApi.list(token!, { category: activeTab }),
    enabled: isLoggedIn && !!token && !isNoticeTab,
  })

  const isLoading = isNoticeTab ? announcementsLoading : postsLoading

  const handleTabChange = (key: CategoryKey) => {
    setActiveTab(key)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', key)
    window.history.replaceState(null, '', url.toString())
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            게시판
          </h1>
        </div>
        {!isNoticeTab && (
          <Link
            href={`/board/write?category=${activeTab}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            글 작성
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => handleTabChange(cat.key)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap',
              activeTab === cat.key
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isNoticeTab ? (
        <NoticeList announcements={announcementsData?.data || []} />
      ) : (
        <PostList posts={postsData?.data || []} />
      )}
    </div>
  )
}

function NoticeList({ announcements }: { announcements: any[] }) {
  if (announcements.length === 0) {
    return (
      <div className="text-center py-20">
        <MessageSquare className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
        <p className="text-slate-500 dark:text-slate-400">공지사항이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {announcements.map((a: any) => (
        <Link
          key={a.id}
          href={`/announcements/${a.id}`}
          className="block bg-white/80 dark:bg-slate-900/50 backdrop-blur rounded-2xl p-5 border border-slate-200 dark:border-slate-800/50 shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-4">
            {a.image_url && (
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-800">
                <img src={`${API_BASE}${a.image_url}`} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {a.is_pinned === 1 && <Pin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-full">
                  공지
                </span>
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                {a.title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {a.author_name || '관리자'} · {formatDate(a.created_at)}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors flex-shrink-0 mt-2" />
          </div>
        </Link>
      ))}
    </div>
  )
}

function PostList({ posts }: { posts: any[] }) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-20">
        <MessageSquare className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
        <p className="text-slate-500 dark:text-slate-400">게시글이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {posts.map((post: any) => (
        <Link
          key={post.id}
          href={`/board/${post.id}`}
          className="block bg-white/80 dark:bg-slate-900/50 backdrop-blur rounded-2xl p-5 border border-slate-200 dark:border-slate-800/50 shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-4">
            {post.image_url && (
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-800">
                <img src={`${API_BASE}${post.image_url}`} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {post.is_pinned === 1 && <Pin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                <span className={cn(
                  'px-2 py-0.5 text-xs font-medium rounded-full',
                  categoryBadgeColors[post.category] || categoryBadgeColors.free
                )}>
                  {categories.find(c => c.key === post.category)?.label || post.category}
                </span>
                {post.image_url && !post.image_url && (
                  <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                )}
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                {post.title}
              </h3>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-1">
                <span>{post.author_name}</span>
                <span>·</span>
                <span>{formatDate(post.created_at)}</span>
                {(post.comment_count > 0) && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5" />
                      {post.comment_count}
                    </span>
                  </>
                )}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors flex-shrink-0 mt-2" />
          </div>
        </Link>
      ))}
    </div>
  )
}
