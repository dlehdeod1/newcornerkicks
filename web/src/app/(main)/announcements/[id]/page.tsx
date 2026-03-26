'use client'

export const runtime = 'edge'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Bell, Pin, ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { announcementsApi } from '@/lib/api'
import { useState } from 'react'
import { toast } from 'sonner'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cornerkicks-api.conerkicks.workers.dev'

function formatDate(ts: number) {
  const d = new Date(ts * 1000)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function AnnouncementDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isLoggedIn, isAdmin, token } = useAuthStore()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const id = Number(params.id)

  const { data, isLoading } = useQuery({
    queryKey: ['announcements', id],
    queryFn: () => announcementsApi.get(id, token!),
    enabled: isLoggedIn && !!token && !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: () => announcementsApi.delete(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      toast.success('공지가 삭제되었습니다.')
      router.push('/announcements')
    },
    onError: (error: any) => {
      toast.error(error.message || '공지 삭제에 실패했습니다.')
    },
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const announcement = data?.data
  if (!announcement) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-500">공지를 찾을 수 없습니다.</p>
        <Link href="/announcements" className="text-primary hover:underline mt-4 inline-block">
          목록으로 돌아가기
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        href="/announcements"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        공지사항 목록
      </Link>

      {/* Article */}
      <article className="bg-white/80 dark:bg-slate-900/50 backdrop-blur rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800/50 shadow-sm">
        {/* Badges */}
        <div className="flex items-center gap-2 mb-3">
          {announcement.is_pinned === 1 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full">
              <Pin className="w-3 h-3" />
              고정
            </span>
          )}
          {announcement.club_id === null ? (
            <span className="px-2.5 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full">
              시스템
            </span>
          ) : (
            <span className="px-2.5 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full">
              클럽
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-4">
          {announcement.title}
        </h1>

        {/* Meta */}
        <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
          <span>{announcement.author_name || '관리자'}</span>
          <span>·</span>
          <span>{formatDate(announcement.created_at)}</span>
        </div>

        {/* Image */}
        {announcement.image_url && (
          <div className="mb-6 rounded-xl overflow-hidden">
            <img
              src={`${API_BASE}${announcement.image_url}`}
              alt=""
              className="w-full rounded-xl"
            />
          </div>
        )}

        {/* Content */}
        <div className="prose prose-slate dark:prose-invert max-w-none whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed">
          {announcement.content}
        </div>

        {/* Admin actions */}
        {isAdmin && (
          <div className="flex items-center gap-3 mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
            <Link
              href={`/admin/announcements?edit=${announcement.id}`}
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

      {/* Delete confirm dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-700 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              공지 삭제
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              이 공지를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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
    </div>
  )
}
