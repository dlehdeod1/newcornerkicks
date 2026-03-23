'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Edit, Trash2, MessageCircle, Send, Globe } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { communityApi } from '@/lib/api'
import { cn } from '@/lib/cn'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cornerkicks-api.conerkicks.workers.dev'

const categories = [
  { key: 'free', label: '자유', color: 'emerald' },
  { key: 'recruit', label: '팀 모집', color: 'amber' },
  { key: 'match', label: '매칭', color: 'blue' },
  { key: 'review', label: '경기 후기', color: 'purple' },
] as const

const dayLabels: Record<string, string> = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' }
const timeSlotLabels: Record<string, string> = { morning: '오전', afternoon: '오후', evening: '저녁', night: '심야' }
const skillLabels: Record<string, string> = { beginner: '입문', low: '초급', mid: '중급', high: '상급' }

const categoryColorMap: Record<string, { badge: string; text: string }> = {
  emerald: { badge: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400' },
  amber: { badge: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400' },
  blue: { badge: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' },
  purple: { badge: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400' },
}

export default function CommunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const postId = Number(id)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { token, user } = useAuthStore()
  const [comment, setComment] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['community', postId, token],
    queryFn: () => communityApi.get(postId, token!),
    enabled: !!token,
  })

  const deleteMutation = useMutation({
    mutationFn: () => communityApi.delete(postId, token!),
    onSuccess: () => router.push('/community'),
  })

  const toggleStatusMutation = useMutation({
    mutationFn: () => {
      const newStatus = post.status === 'open' ? 'closed' : 'open'
      return communityApi.update(postId, { status: newStatus }, token!)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community', postId] }),
  })

  const addCommentMutation = useMutation({
    mutationFn: (content: string) => communityApi.addComment(postId, content, token!),
    onSuccess: () => {
      setComment('')
      queryClient.invalidateQueries({ queryKey: ['community', postId] })
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: number) => communityApi.deleteComment(postId, commentId, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community', postId] }),
  })

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-8 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-40 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
        </div>
      </div>
    )
  }

  const post = data?.data
  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <Globe className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
        <p className="text-slate-500">게시글을 찾을 수 없습니다</p>
        <Link href="/community" className="text-sm text-emerald-600 dark:text-emerald-400 mt-4 inline-block">
          목록으로 돌아가기
        </Link>
      </div>
    )
  }

  const cat = categories.find(c => c.key === post.category)
  const colors = cat ? categoryColorMap[cat.color] : categoryColorMap.emerald
  const isAuthor = user?.id === post.author_id
  const isRecruitOrMatch = post.category === 'recruit' || post.category === 'match'
  const comments = post.comments || []

  const handleDelete = () => {
    if (confirm('정말 삭제하시겠습니까?')) {
      deleteMutation.mutate()
    }
  }

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) return
    addCommentMutation.mutate(comment.trim())
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back link */}
      <Link
        href="/community"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        목록으로
      </Link>

      {/* Post */}
      <article className="bg-white/80 dark:bg-slate-900/50 backdrop-blur rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50 shadow-sm mb-6">
        {/* Category + status */}
        <div className="flex items-center gap-2 mb-3">
          <span className={cn('px-2.5 py-0.5 text-xs font-medium rounded-full', colors.badge, colors.text)}>
            {cat?.label || post.category}
          </span>
          {isRecruitOrMatch && post.status === 'open' && (
            <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              모집중
            </span>
          )}
          {isRecruitOrMatch && post.status === 'closed' && (
            <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
              마감
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{post.title}</h1>

        {/* Author info */}
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-5 pb-5 border-b border-slate-100 dark:border-slate-800">
          <span className="font-medium text-slate-700 dark:text-slate-300">{post.author_name}</span>
          {post.club_name && (
            <>
              <span>·</span>
              <span>{post.club_name}</span>
            </>
          )}
          <span>·</span>
          <span>{formatFullDate(post.created_at)}</span>
        </div>

        {/* Metadata for recruit/match */}
        {isRecruitOrMatch && (
          <div className="flex flex-wrap gap-2 mb-5 pb-5 border-b border-slate-100 dark:border-slate-800">
            {post.region && (
              <span className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                {post.region}
              </span>
            )}
            {post.day_of_week && post.day_of_week.split(',').map((d: string) => (
              <span key={d} className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                {dayLabels[d.trim()] || d}요일
              </span>
            ))}
            {post.time_slot && (
              <span className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                {timeSlotLabels[post.time_slot] || post.time_slot}
              </span>
            )}
            {post.skill_level && (
              <span className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                {skillLabels[post.skill_level] || post.skill_level}
              </span>
            )}
            {post.headcount && (
              <span className="px-3 py-1 text-sm bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg font-medium">
                {post.headcount}명 모집
              </span>
            )}
          </div>
        )}

        {/* Image */}
        {post.image_url && (
          <div className="mb-5">
            <img
              src={post.image_url.startsWith('http') ? post.image_url : `${API_BASE}${post.image_url}`}
              alt=""
              className="w-full rounded-xl object-cover max-h-96"
            />
          </div>
        )}

        {/* Content */}
        <div className="prose prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
          {post.content}
        </div>

        {/* Author actions */}
        {isAuthor && (
          <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
            {isRecruitOrMatch && (
              <button
                onClick={() => toggleStatusMutation.mutate()}
                disabled={toggleStatusMutation.isPending}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                  post.status === 'open'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30'
                )}
              >
                {post.status === 'open' ? '모집 마감하기' : '모집 재개하기'}
              </button>
            )}
            <Link
              href={`/community/write?edit=${post.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              <Edit className="w-3.5 h-3.5" />
              수정
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              삭제
            </button>
          </div>
        )}
      </article>

      {/* Comments */}
      <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white mb-4">
          <MessageCircle className="w-4 h-4" />
          댓글 {comments.length > 0 && `(${comments.length})`}
        </h2>

        {/* Comment form */}
        <form onSubmit={handleSubmitComment} className="flex gap-2 mb-6">
          <input
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="댓글을 입력하세요..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
          <button
            type="submit"
            disabled={!comment.trim() || addCommentMutation.isPending}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Comments list */}
        {comments.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-6">아직 댓글이 없습니다</p>
        ) : (
          <div className="space-y-4">
            {comments.map((c: any) => (
              <div key={c.id} className="flex gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{c.author_name}</span>
                    <span className="text-xs text-slate-400">{formatDate(c.created_at)}</span>
                    {user?.id === c.author_id && (
                      <button
                        onClick={() => {
                          if (confirm('댓글을 삭제하시겠습니까?')) {
                            deleteCommentMutation.mutate(c.id)
                          }
                        }}
                        className="text-xs text-red-400 hover:text-red-500 ml-auto"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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

function formatFullDate(ts: number) {
  const d = new Date(ts * 1000)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
