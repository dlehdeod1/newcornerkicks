'use client'

export const runtime = 'edge'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, Calendar, Trophy, Star, Crown, MessageSquare, Send, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { clubProfileApi } from '@/lib/api'
import { cn } from '@/lib/cn'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cornerkicks-api.conerkicks.workers.dev'

function formatDate(ts: number) {
  const d = new Date(ts * 1000)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

function timeSince(ts: number) {
  const now = Math.floor(Date.now() / 1000)
  const days = Math.floor((now - ts) / 86400)
  if (days < 30) return `${days}일`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}개월`
  const years = Math.floor(months / 12)
  const remainMonths = months % 12
  return remainMonths > 0 ? `${years}년 ${remainMonths}개월` : `${years}년`
}

export default function ClubProfilePage() {
  const params = useParams()
  const queryClient = useQueryClient()
  const { token, user } = useAuthStore()
  const slug = params.slug as string

  const [reviewRating, setReviewRating] = useState(0)
  const [reviewContent, setReviewContent] = useState('')
  const [hoverRating, setHoverRating] = useState(0)
  const [showReviewForm, setShowReviewForm] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['club-profile', slug],
    queryFn: () => clubProfileApi.get(slug, token!),
    enabled: !!token && !!slug,
  })

  const reviewMutation = useMutation({
    mutationFn: () => clubProfileApi.createReview(slug, { rating: reviewRating, content: reviewContent.trim() || undefined }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-profile', slug] })
      setShowReviewForm(false)
      setReviewRating(0)
      setReviewContent('')
    },
  })

  const deleteReviewMutation = useMutation({
    mutationFn: () => clubProfileApi.deleteReview(slug, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['club-profile', slug] }),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const club = data?.club
  if (!club) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-500">클럽을 찾을 수 없습니다.</p>
        <Link href="/clubs" className="text-primary hover:underline mt-4 inline-block">돌아가기</Link>
      </div>
    )
  }

  const reviews = data?.reviews || []
  const myReview = data?.myReview
  const isMember = data?.isMember

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href="/clubs"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        클럽 목록
      </Link>

      {/* Club Header Card */}
      <div className="bg-white/80 dark:bg-card backdrop-blur rounded-2xl border border-slate-200 dark:border-border shadow-sm overflow-hidden mb-6">
        {/* Hero gradient */}
        <div className="h-24 bg-gradient-to-r from-primary to-teal-500 relative">
          {club.isPro && (
            <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 bg-amber-500/90 backdrop-blur rounded-full text-xs font-bold text-white">
              <Crown className="w-3 h-3" />
              PRO
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          {/* Avatar */}
          <div className="-mt-10 mb-4">
            {club.logoUrl ? (
              <img
                src={`${API_BASE}${club.logoUrl}`}
                alt={club.name}
                className="w-20 h-20 rounded-2xl border-4 border-white dark:border-slate-900 object-cover shadow-lg"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl border-4 border-white dark:border-slate-900 bg-gradient-to-br from-primary to-teal-600 flex items-center justify-center shadow-lg">
                <span className="text-2xl font-bold text-white">{club.name.charAt(0)}</span>
              </div>
            )}
          </div>

          {/* Name + description */}
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{club.name}</h1>
          {club.description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{club.description}</p>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Users className="w-4 h-4" />} label="멤버" value={`${club.memberCount}명`} />
            <StatCard icon={<Calendar className="w-4 h-4" />} label="활동 기간" value={timeSince(club.createdAt)} />
            <StatCard icon={<Trophy className="w-4 h-4" />} label="총 세션" value={`${club.totalSessions}회`} />
            <StatCard
              icon={<Star className="w-4 h-4" />}
              label="평점"
              value={club.avgRating ? `${club.avgRating} / 5` : '-'}
              sub={club.reviewCount > 0 ? `(${club.reviewCount}개)` : ''}
            />
          </div>

          {/* Last session */}
          {club.lastSessionDate && (
            <p className="text-xs text-slate-400 mt-4">
              마지막 세션: {club.lastSessionDate}
            </p>
          )}

          {/* Member badge */}
          {isMember && (
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
              <Users className="w-3 h-3" />
              소속 멤버 ({data?.myRole === 'owner' ? '오너' : data?.myRole === 'admin' ? '관리자' : '멤버'})
            </div>
          )}
        </div>
      </div>

      {/* Reviews Section */}
      <div className="bg-white/80 dark:bg-card backdrop-blur rounded-2xl p-6 border border-slate-200 dark:border-border shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            리뷰 {reviews.length > 0 && `(${club.reviewCount})`}
          </h2>
          {!myReview && !showReviewForm && (
            <button
              onClick={() => setShowReviewForm(true)}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-medium transition-colors"
            >
              리뷰 작성
            </button>
          )}
        </div>

        {/* My review or form */}
        {myReview && !showReviewForm && (
          <div className="mb-6 p-4 bg-primary/5 rounded-xl border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">내 리뷰</span>
                <StarRating rating={myReview.rating} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowReviewForm(true)
                    setReviewRating(myReview.rating)
                    setReviewContent(myReview.content || '')
                  }}
                  className="text-xs text-slate-500 hover:text-primary transition-colors"
                >
                  수정
                </button>
                <button
                  onClick={() => deleteReviewMutation.mutate()}
                  className="text-xs text-slate-500 hover:text-red-500 transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
            {myReview.content && (
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{myReview.content}</p>
            )}
          </div>
        )}

        {showReviewForm && (
          <div className="mb-6 p-4 bg-slate-50 dark:bg-card-elevated rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">평점</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setReviewRating(n)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={cn(
                        'w-6 h-6 transition-colors',
                        (hoverRating || reviewRating) >= n
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300 dark:text-slate-600'
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={reviewContent}
              onChange={(e) => setReviewContent(e.target.value)}
              placeholder="클럽에 대한 솔직한 후기를 남겨주세요 (선택)"
              rows={3}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => reviewMutation.mutate()}
                disabled={!reviewRating || reviewMutation.isPending}
                className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
              >
                {reviewMutation.isPending ? '저장 중...' : myReview ? '수정' : '등록'}
              </button>
              <button
                onClick={() => { setShowReviewForm(false); setReviewRating(0); setReviewContent('') }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* Reviews list */}
        {reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review: any) => (
              <div key={review.id} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 flex-shrink-0">
                  {(review.author_name || '?')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {review.author_name}
                    </span>
                    <StarRating rating={review.rating} />
                    <span className="text-xs text-slate-400">{formatDate(review.created_at)}</span>
                  </div>
                  {review.content && (
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{review.content}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">
            아직 리뷰가 없습니다. 첫 번째 리뷰를 남겨보세요!
          </p>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-50 dark:bg-card-elevated rounded-xl p-3 text-center">
      <div className="flex items-center justify-center text-slate-400 mb-1">{icon}</div>
      <div className="text-lg font-bold text-slate-900 dark:text-white">
        {value}
        {sub && <span className="text-xs font-normal text-slate-400 ml-0.5">{sub}</span>}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            'w-3.5 h-3.5',
            n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'
          )}
        />
      ))}
    </div>
  )
}
