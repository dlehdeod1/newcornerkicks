'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { MessageSquare, Pin, ArrowLeft, Pencil, Trash2, X, Send } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { postsApi } from '@/lib/api'
import { cn } from '@/lib/cn'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cornerkicks-api.conerkicks.workers.dev'

const categoryLabels: Record<string, string> = {
  free: '자유',
  review: '경기 후기',
  schedule: '일정 논의',
}

const categoryBadgeColors: Record<string, string> = {
  free: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  review: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
  schedule: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
}

function formatDate(ts: number) {
  const d = new Date(ts * 1000)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatShortDate(ts: number) {
  const d = new Date(ts * 1000)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function PostDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isLoggedIn, isAdmin, token, user } = useAuthStore()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [deleteCommentId, setDeleteCommentId] = useState<number | null>(null)

  const id = Number(params.id)

  const { data, isLoading } = useQuery({
    queryKey: ['posts', id],
    queryFn: () => postsApi.get(id, token!),
    enabled: isLoggedIn && !!token && !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: () => postsApi.delete(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      router.push('/board')
    },
  })

  const addCommentMutation = useMutation({
    mutationFn: (content: string) => postsApi.addComment(id, content, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', id] })
      setCommentText('')
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: number) => postsApi.deleteComment(id, commentId, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', id] })
      setDeleteCommentId(null)
    },
  })

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = commentText.trim()
    if (!trimmed) return
    addCommentMutation.mutate(trimmed)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const post = data?.data
  if (!post) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-500">게시글을 찾을 수 없습니다.</p>
        <Link href="/board" className="text-emerald-600 hover:underline mt-4 inline-block">
          목록으로 돌아가기
        </Link>
      </div>
    )
  }

  const isAuthor = user?.id === post.author_id
  const canEdit = isAuthor || isAdmin

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        href="/board"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        게시판 목록
      </Link>

      {/* Article */}
      <article className="bg-white/80 dark:bg-slate-900/50 backdrop-blur rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800/50 shadow-sm">
        {/* Badges */}
        <div className="flex items-center gap-2 mb-3">
          {post.is_pinned === 1 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full">
              <Pin className="w-3 h-3" />
              고정
            </span>
          )}
          <span className={cn(
            'px-2.5 py-1 text-xs font-medium rounded-full',
            categoryBadgeColors[post.category] || categoryBadgeColors.free
          )}>
            {categoryLabels[post.category] || post.category}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-4">
          {post.title}
        </h1>

        {/* Meta */}
        <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
          <span>{post.author_name}</span>
          <span>·</span>
          <span>{formatDate(post.created_at)}</span>
        </div>

        {/* Image */}
        {post.image_url && (
          <div className="mb-6 rounded-xl overflow-hidden">
            <img
              src={`${API_BASE}${post.image_url}`}
              alt=""
              className="w-full rounded-xl"
            />
          </div>
        )}

        {/* Content */}
        <div className="prose prose-slate dark:prose-invert max-w-none whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed">
          {post.content}
        </div>

        {/* Author/admin actions */}
        {canEdit && (
          <div className="flex items-center gap-3 mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
            <Link
              href={`/board/write?edit=${post.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors"
            >
              <Pencil className="w-4 h-4" />
              수정
            </Link>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              삭제
            </button>
          </div>
        )}
      </article>

      {/* Comments section */}
      <div className="mt-6 bg-white/80 dark:bg-slate-900/50 backdrop-blur rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          댓글 {post.comments?.length > 0 && `(${post.comments.length})`}
        </h2>

        {/* Comment list */}
        {post.comments?.length > 0 ? (
          <div className="space-y-4 mb-6">
            {post.comments.map((comment: any) => (
              <div key={comment.id} className="flex items-start gap-3 group">
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 flex-shrink-0">
                  {(comment.author_name || '?')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {comment.author_name}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {formatShortDate(comment.created_at)}
                    </span>
                    {(user?.id === comment.author_id || isAdmin) && (
                      <button
                        onClick={() => setDeleteCommentId(comment.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                        title="삭제"
                      >
                        <X className="w-4 h-4 text-slate-400 hover:text-red-500 transition-colors" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">아직 댓글이 없습니다.</p>
        )}

        {/* Comment input */}
        <form onSubmit={handleSubmitComment} className="flex gap-3">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="댓글을 입력하세요..."
            rows={2}
            className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
          />
          <button
            type="submit"
            disabled={!commentText.trim() || addCommentMutation.isPending}
            className="self-end px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Delete post confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-700 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              게시글 삭제
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              이 게시글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete comment confirm */}
      {deleteCommentId !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-700 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              댓글 삭제
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              이 댓글을 삭제하시겠습니까?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteCommentId(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => deleteCommentMutation.mutate(deleteCommentId)}
                disabled={deleteCommentMutation.isPending}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deleteCommentMutation.isPending ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
