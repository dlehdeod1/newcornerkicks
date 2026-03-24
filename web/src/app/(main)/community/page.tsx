'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Globe, Plus, MessageCircle, Filter } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { communityApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useState } from 'react'

const categories = [
  { key: 'free', label: '자유', color: 'emerald' },
  { key: 'recruit', label: '팀 모집', color: 'amber' },
  { key: 'mercenary', label: '용병 모집', color: 'rose' },
  { key: 'match', label: '매칭', color: 'blue' },
  { key: 'review', label: '경기 후기', color: 'purple' },
] as const

const regions = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']

const dayLabels: Record<string, string> = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' }
const timeSlotLabels: Record<string, string> = { morning: '오전', afternoon: '오후', evening: '저녁', night: '심야' }
const skillLabels: Record<string, string> = { beginner: '입문', low: '초급', mid: '중급', high: '상급' }

const categoryColorMap: Record<string, { badge: string; text: string }> = {
  emerald: { badge: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400' },
  amber: { badge: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400' },
  blue: { badge: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' },
  purple: { badge: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400' },
  rose: { badge: 'bg-rose-100 dark:bg-rose-500/20', text: 'text-rose-600 dark:text-rose-400' },
}

function CommunityContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { token } = useAuthStore()
  const activeTab = searchParams.get('tab') || 'free'

  const [region, setRegion] = useState('')
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [onlyOpen, setOnlyOpen] = useState(false)

  const showFilters = activeTab === 'recruit' || activeTab === 'match' || activeTab === 'mercenary'

  const { data, isLoading } = useQuery({
    queryKey: ['community', activeTab, region, selectedDays, onlyOpen, token],
    queryFn: () => communityApi.list(token!, {
      category: activeTab,
      region: region || undefined,
      dayOfWeek: selectedDays.length > 0 ? selectedDays.join(',') : undefined,
      status: onlyOpen ? 'open' : undefined,
      limit: 50,
    }),
    enabled: !!token,
  })

  const posts = data?.data || []
  const currentCategory = categories.find(c => c.key === activeTab)

  const toggleDay = (day: string) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  const setTab = (key: string) => {
    router.push(`/community?tab=${key}`)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <Globe className="w-7 h-7 text-teal-500" />
          커뮤니티
        </h1>
        <Link
          href={`/community/write?category=${activeTab}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-sm font-medium shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          글 작성
        </Link>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => setTab(cat.key)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
              activeTab === cat.key
                ? `${categoryColorMap[cat.color].badge} ${categoryColorMap[cat.color].text}`
                : 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Filters for recruit/match */}
      {showFilters && (
        <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur rounded-2xl p-5 border border-slate-200 dark:border-slate-800/50 shadow-sm mb-6">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
            <Filter className="w-4 h-4" />
            필터
          </div>

          {/* Region */}
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">지역</label>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">전체</option>
              {regions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Day of Week */}
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">요일</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(dayLabels).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => toggleDay(key)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    selectedDays.includes(key)
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Status toggle */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">상태</label>
            <button
              onClick={() => setOnlyOpen(!onlyOpen)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                onlyOpen
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              )}
            >
              모집중만
            </button>
          </div>
        </div>
      )}

      {/* Posts List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white/80 dark:bg-slate-900/50 rounded-2xl p-5 border border-slate-200 dark:border-slate-800/50 animate-pulse">
              <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
              <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
              <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <Globe className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400 mb-2">
            {currentCategory?.label} 게시글이 없습니다
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500">첫 번째 글을 작성해보세요!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post: any) => {
            const cat = categories.find(c => c.key === post.category)
            const colors = cat ? categoryColorMap[cat.color] : categoryColorMap.emerald
            const isRecruitOrMatch = post.category === 'recruit' || post.category === 'match' || post.category === 'mercenary'

            return (
              <Link
                key={post.id}
                href={`/community/${post.id}`}
                className="block bg-white/80 dark:bg-slate-900/50 backdrop-blur rounded-2xl p-5 border border-slate-200 dark:border-slate-800/50 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', colors.badge, colors.text)}>
                    {cat?.label || post.category}
                  </span>
                  {isRecruitOrMatch && post.status === 'open' && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      모집중
                    </span>
                  )}
                  {isRecruitOrMatch && post.status === 'closed' && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                      마감
                    </span>
                  )}
                </div>

                <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors mb-2 line-clamp-1">
                  {post.title}
                </h3>

                {/* Metadata chips for recruit/match */}
                {isRecruitOrMatch && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {post.region && (
                      <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md">
                        {post.region}
                      </span>
                    )}
                    {post.day_of_week && post.day_of_week.split(',').map((d: string) => (
                      <span key={d} className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md">
                        {dayLabels[d.trim()] || d}
                      </span>
                    ))}
                    {post.time_slot && (
                      <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md">
                        {timeSlotLabels[post.time_slot] || post.time_slot}
                      </span>
                    )}
                    {post.skill_level && (
                      <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md">
                        {skillLabels[post.skill_level] || post.skill_level}
                      </span>
                    )}
                    {post.headcount && (
                      <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md">
                        {post.headcount}명 모집
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{post.author_name}</span>
                  {post.club_name && (
                    <>
                      <span>·</span>
                      <span>{post.club_name}</span>
                    </>
                  )}
                  <span>·</span>
                  <span>{formatDate(post.created_at)}</span>
                  {(post.comment_count ?? 0) > 0 && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        <MessageCircle className="w-3 h-3" />
                        {post.comment_count}
                      </span>
                    </>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatDate(ts: number) {
  const d = new Date(ts * 1000)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}시간 전`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}일 전`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function CommunityPage() {
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="h-8 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    }>
      <CommunityContent />
    </Suspense>
  )
}
