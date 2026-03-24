'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { MessageSquare, Pin, Plus, MessageCircle, ChevronRight, Globe, Filter, Users } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { postsApi, announcementsApi, communityApi } from '@/lib/api'
import { cn } from '@/lib/cn'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cornerkicks-api.conerkicks.workers.dev'

// === Club Board categories ===
const clubCategories = [
  { key: 'notice', label: '공지', color: 'purple' },
  { key: 'free', label: '자유', color: 'emerald' },
  { key: 'review', label: '경기 후기', color: 'amber' },
  { key: 'schedule', label: '일정 논의', color: 'blue' },
] as const

type ClubCategoryKey = typeof clubCategories[number]['key']

// === Community categories ===
const communityCategories = [
  { key: 'free', label: '자유', color: 'emerald' },
  { key: 'recruit', label: '팀 모집', color: 'amber' },
  { key: 'mercenary', label: '용병 모집', color: 'rose' },
  { key: 'match', label: '매칭', color: 'blue' },
  { key: 'review', label: '경기 후기', color: 'purple' },
] as const

type CommunityCategoryKey = typeof communityCategories[number]['key']

const regions = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']
const dayLabels: Record<string, string> = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' }
const timeSlotLabels: Record<string, string> = { morning: '오전', afternoon: '오후', evening: '저녁', night: '심야' }
const skillLabels: Record<string, string> = { beginner: '입문', low: '초급', mid: '중급', high: '상급' }

const badgeColors: Record<string, string> = {
  emerald: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
  blue: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
  purple: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
  rose: 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
}

function formatDate(ts: number) {
  const d = new Date(ts * 1000)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

function formatRelativeDate(ts: number) {
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

type Scope = 'club' | 'community'

const SCOPE_STORAGE_KEY = 'cornerkicks-board-scope'

function getInitialScope(): Scope {
  if (typeof window === 'undefined') return 'club'
  try {
    const params = new URLSearchParams(window.location.search)
    const urlScope = params.get('scope')
    if (urlScope === 'club' || urlScope === 'community') return urlScope
    const stored = localStorage.getItem(SCOPE_STORAGE_KEY)
    if (stored === 'club' || stored === 'community') return stored
  } catch {}
  return 'club'
}

export default function BoardPage() {
  const { isLoggedIn, token } = useAuthStore()
  const [scope, setScope] = useState<Scope>('club')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setScope(getInitialScope())
    setMounted(true)
  }, [])

  const handleScopeChange = (s: Scope) => {
    setScope(s)
    try { localStorage.setItem(SCOPE_STORAGE_KEY, s) } catch {}
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">게시판</h1>
        </div>
      </div>

      {/* Scope Tabs: 클럽 / 커뮤니티 */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl mb-6 w-fit">
        <button
          onClick={() => handleScopeChange('club')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            scope === 'club'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          )}
        >
          <Users className="w-4 h-4" />
          클럽 게시판
        </button>
        <button
          onClick={() => handleScopeChange('community')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            scope === 'community'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          )}
        >
          <Globe className="w-4 h-4" />
          전체 커뮤니티
        </button>
      </div>

      {mounted && (scope === 'club' ? (
        <ClubBoardSection token={token} isLoggedIn={isLoggedIn} />
      ) : (
        <CommunitySection token={token} />
      ))}
    </div>
  )
}

// ===================== Club Board Section =====================

function ClubBoardSection({ token, isLoggedIn }: { token: string | null; isLoggedIn: boolean }) {
  const [activeTab, setActiveTab] = useState<ClubCategoryKey>('free')
  const isNoticeTab = activeTab === 'notice'

  const { data: announcementsData, isLoading: announcementsLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => announcementsApi.list(token!),
    enabled: isLoggedIn && !!token && isNoticeTab,
  })

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['posts', activeTab],
    queryFn: () => postsApi.list(token!, { category: activeTab }),
    enabled: isLoggedIn && !!token && !isNoticeTab,
  })

  const isLoading = isNoticeTab ? announcementsLoading : postsLoading

  const handleTabChange = (key: ClubCategoryKey) => {
    setActiveTab(key)
  }

  return (
    <>
      {/* Write button + Tabs row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {clubCategories.map((cat) => (
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
        {!isNoticeTab && (
          <Link
            href={`/board/write?category=${activeTab}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors flex-shrink-0 ml-4"
          >
            <Plus className="w-4 h-4" />
            글 작성
          </Link>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : isNoticeTab ? (
        <NoticeList announcements={announcementsData?.data || []} />
      ) : (
        <ClubPostList posts={postsData?.data || []} />
      )}
    </>
  )
}

// ===================== Community Section =====================

function CommunitySection({ token }: { token: string | null }) {
  const [activeTab, setActiveTab] = useState<CommunityCategoryKey>('free')
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
  const currentCategory = communityCategories.find(c => c.key === activeTab)

  const toggleDay = (day: string) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  const handleTabChange = (key: CommunityCategoryKey) => {
    setActiveTab(key)
  }

  return (
    <>
      {/* Tabs + Write button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {communityCategories.map(cat => {
            const color = badgeColors[cat.color]
            return (
              <button
                key={cat.key}
                onClick={() => handleTabChange(cat.key)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
                  activeTab === cat.key
                    ? color
                    : 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50'
                )}
              >
                {cat.label}
              </button>
            )
          })}
        </div>
        <Link
          href={`/community/write?category=${activeTab}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-sm font-medium shadow-sm transition-all flex-shrink-0 ml-4"
        >
          <Plus className="w-4 h-4" />
          글 작성
        </Link>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur rounded-2xl p-5 border border-slate-200 dark:border-slate-800/50 shadow-sm mb-6">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
            <Filter className="w-4 h-4" />
            필터
          </div>
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">지역</label>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">전체</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
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

      {/* Posts */}
      {isLoading ? (
        <LoadingSpinner />
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
            const cat = communityCategories.find(c => c.key === post.category)
            const colors = cat ? badgeColors[cat.color] : badgeColors.emerald
            const isRecruitOrMatch = post.category === 'recruit' || post.category === 'match' || post.category === 'mercenary'

            return (
              <Link
                key={post.id}
                href={`/community/${post.id}`}
                className="block bg-white/80 dark:bg-slate-900/50 backdrop-blur rounded-2xl p-5 border border-slate-200 dark:border-slate-800/50 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', colors)}>
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
                {isRecruitOrMatch && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {post.region && (
                      <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md">{post.region}</span>
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
                  <span>{formatRelativeDate(post.created_at)}</span>
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
    </>
  )
}

// ===================== Shared Components =====================

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
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

function ClubPostList({ posts }: { posts: any[] }) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-20">
        <MessageSquare className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
        <p className="text-slate-500 dark:text-slate-400">게시글이 없습니다.</p>
      </div>
    )
  }

  const clubCategoryBadgeColors: Record<string, string> = {
    free: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    review: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
    schedule: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
    notice: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
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
                  clubCategoryBadgeColors[post.category] || clubCategoryBadgeColors.free
                )}>
                  {clubCategories.find(c => c.key === post.category)?.label || post.category}
                </span>
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
