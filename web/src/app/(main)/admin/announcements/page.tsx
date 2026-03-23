'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Bell, Pin, Trash2, Pencil, Plus, ArrowLeft, ImageIcon, X, AlertCircle } from 'lucide-react'
import { useAuthStore, useAuthHydrated } from '@/stores/auth'
import { announcementsApi, uploadsApi } from '@/lib/api'
import { cn } from '@/lib/cn'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cornerkicks-api.conerkicks.workers.dev'

function formatDate(ts: number) {
  const d = new Date(ts * 1000)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function AdminAnnouncementsPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AdminAnnouncementsContent />
    </Suspense>
  )
}

function AdminAnnouncementsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const hydrated = useAuthHydrated()
  const { isLoggedIn, isAdmin, token } = useAuthStore()

  const editId = searchParams.get('edit') ? Number(searchParams.get('edit')) : null

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isPinned, setIsPinned] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => announcementsApi.list(token!),
    enabled: hydrated && isLoggedIn && isAdmin && !!token,
  })

  // Load announcement for editing
  const { data: editData } = useQuery({
    queryKey: ['announcements', editId],
    queryFn: () => announcementsApi.get(editId!, token!),
    enabled: hydrated && isLoggedIn && isAdmin && !!token && !!editId,
  })

  useEffect(() => {
    if (editData?.data) {
      const a = editData.data
      setTitle(a.title)
      setContent(a.content)
      setImageUrl(a.image_url || null)
      setIsPinned(a.is_pinned === 1)
    }
  }, [editData])

  const createMutation = useMutation({
    mutationFn: (data: { title: string; content: string; imageUrl?: string; isPinned?: boolean }) =>
      announcementsApi.create(data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { title?: string; content?: string; imageUrl?: string | null; isPinned?: boolean }) =>
      announcementsApi.update(editId!, data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      resetForm()
      router.push('/admin/announcements')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => announcementsApi.delete(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      setDeleteTarget(null)
    },
  })

  function resetForm() {
    setTitle('')
    setContent('')
    setImageUrl(null)
    setIsPinned(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setUploading(true)
    try {
      const result = await uploadsApi.uploadImage(file, 'announcements', token)
      setImageUrl(result.url)
    } catch (err: any) {
      alert(err.message || '이미지 업로드 실패')
    } finally {
      setUploading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return

    const payload: any = { title: title.trim(), content: content.trim(), isPinned }
    if (imageUrl) payload.imageUrl = imageUrl

    if (editId) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  if (!hydrated) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isLoggedIn || !isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          접근 권한이 없습니다
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          관리자만 접근할 수 있는 페이지입니다.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-brand-green hover:bg-[#27AE60] text-white rounded-xl transition-colors"
        >
          홈으로 돌아가기
        </Link>
      </div>
    )
  }

  const announcements = data?.data || []
  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center">
          <Bell className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          공지 관리
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white/80 dark:bg-slate-900/50 backdrop-blur rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50 shadow-sm mb-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          {editId ? '공지 수정' : '새 공지 작성'}
        </h2>

        {/* Title */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            제목
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="공지 제목을 입력하세요"
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
            required
          />
        </div>

        {/* Content */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            내용
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="공지 내용을 입력하세요"
            rows={6}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors resize-y"
            required
          />
        </div>

        {/* Image upload */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            이미지 (선택)
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              <ImageIcon className="w-4 h-4" />
              {uploading ? '업로드 중...' : '이미지 선택'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            {imageUrl && (
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                className="text-red-500 hover:text-red-600 text-sm flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                제거
              </button>
            )}
          </div>
          {imageUrl && (
            <div className="mt-3 rounded-xl overflow-hidden max-w-xs">
              <img
                src={`${API_BASE}${imageUrl}`}
                alt="Preview"
                className="w-full rounded-xl"
              />
            </div>
          )}
        </div>

        {/* Pin toggle */}
        <div className="mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-emerald-500 focus:ring-emerald-500/50"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Pin className="w-4 h-4" />
              상단 고정
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSaving || !title.trim() || !content.trim()}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? '저장 중...' : editId ? '수정 완료' : '공지 등록'}
          </button>
          {editId && (
            <button
              type="button"
              onClick={() => {
                resetForm()
                router.push('/admin/announcements')
              }}
              className="px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors"
            >
              취소
            </button>
          )}
        </div>
      </form>

      {/* Existing announcements list */}
      <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            공지 목록 ({announcements.length})
          </h2>
        </div>

        {announcements.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            등록된 공지가 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {announcements.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {a.is_pinned === 1 && <Pin className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">{a.title}</p>
                    <p className="text-xs text-slate-500">{formatDate(a.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <Link
                    href={`/admin/announcements?edit=${a.id}`}
                    className="p-2 text-slate-400 hover:text-emerald-500 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => setDeleteTarget(a.id)}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm dialog */}
      {deleteTarget !== null && (
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
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget)}
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
