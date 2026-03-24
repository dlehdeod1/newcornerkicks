'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ImageIcon, X, Pin, BarChart3, Plus, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { postsApi, uploadsApi } from '@/lib/api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cornerkicks-api.conerkicks.workers.dev'

const categoryOptions = [
  { key: 'free', label: '자유' },
  { key: 'review', label: '경기 후기' },
  { key: 'schedule', label: '일정 논의' },
]

export default function BoardWritePage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BoardWriteContent />
    </Suspense>
  )
}

function BoardWriteContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isLoggedIn, isAdmin, token } = useAuthStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editId = searchParams.get('edit') ? Number(searchParams.get('edit')) : null
  const initialCategory = searchParams.get('category') || 'free'

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState(initialCategory)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isPinned, setIsPinned] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [showPoll, setShowPoll] = useState(false)
  const [pollTitle, setPollTitle] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false)

  // Load post for editing
  const { data: editData } = useQuery({
    queryKey: ['posts', editId],
    queryFn: () => postsApi.get(editId!, token!),
    enabled: isLoggedIn && !!token && !!editId,
  })

  useEffect(() => {
    if (editData?.data) {
      const p = editData.data
      setTitle(p.title)
      setContent(p.content)
      setCategory(p.category || 'free')
      setImageUrl(p.image_url || null)
      setIsPinned(p.is_pinned === 1)
    }
  }, [editData])

  const createMutation = useMutation({
    mutationFn: (data: { title: string; content: string; category: string; imageUrl?: string; isPinned?: boolean }) =>
      postsApi.create(data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      router.push('/board')
    },
    onError: (err: Error) => setError(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: (data: { title?: string; content?: string; category?: string; imageUrl?: string | null; isPinned?: boolean }) =>
      postsApi.update(editId!, data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      router.push(`/board/${editId}`)
    },
    onError: (err: Error) => setError(err.message),
  })

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await uploadsApi.uploadImage(file, 'community', token!)
      setImageUrl(res.url)
    } catch (err: any) {
      setError(err.message || '이미지 업로드 실패')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!title.trim()) {
      setError('제목을 입력해주세요.')
      return
    }
    if (!content.trim()) {
      setError('내용을 입력해주세요.')
      return
    }

    const payload: any = {
      title: title.trim(),
      content: content.trim(),
      category,
    }
    if (imageUrl) payload.imageUrl = imageUrl
    if (isAdmin) payload.isPinned = isPinned

    // 투표 첨부
    if (showPoll && pollTitle.trim() && !editId) {
      const validOptions = pollOptions.map(o => o.trim()).filter(Boolean)
      if (validOptions.length >= 2) {
        payload.poll = {
          title: pollTitle.trim(),
          options: validOptions,
          allowMultiple: pollAllowMultiple,
        }
      }
    }

    if (editId) {
      if (!imageUrl && editData?.data?.image_url) {
        payload.imageUrl = null
      }
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

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

      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
        {editId ? '게시글 수정' : '새 게시글'}
      </h1>

      <form onSubmit={handleSubmit} className="bg-white/80 dark:bg-slate-900/50 backdrop-blur rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800/50 shadow-sm space-y-5">
        {/* Category select */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            카테고리
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            {categoryOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            제목
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            내용
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력하세요"
            rows={10}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-y"
          />
        </div>

        {/* Image upload */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            이미지 (선택)
          </label>
          {imageUrl ? (
            <div className="relative inline-block">
              <img
                src={`${API_BASE}${imageUrl}`}
                alt="미리보기"
                className="max-h-48 rounded-xl border border-slate-200 dark:border-slate-700"
              />
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              <ImageIcon className="w-4 h-4" />
              {uploading ? '업로드 중...' : '이미지 첨부'}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

        {/* Poll section (new post only) */}
        {!editId && (
          <div>
            {!showPoll ? (
              <button
                type="button"
                onClick={() => setShowPoll(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-medium transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                투표 추가
              </button>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-500" />
                    투표
                  </label>
                  <button
                    type="button"
                    onClick={() => { setShowPoll(false); setPollTitle(''); setPollOptions(['', '']); setPollAllowMultiple(false) }}
                    className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                  >
                    투표 제거
                  </button>
                </div>

                <input
                  type="text"
                  value={pollTitle}
                  onChange={(e) => setPollTitle(e.target.value)}
                  placeholder="투표 제목 (예: 다음 주 시간 투표)"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />

                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const next = [...pollOptions]
                        next[i] = e.target.value
                        setPollOptions(next)
                      }}
                      placeholder={`선택지 ${i + 1}`}
                      className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                {pollOptions.length < 10 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions([...pollOptions, ''])}
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    선택지 추가
                  </button>
                )}

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pollAllowMultiple}
                    onChange={(e) => setPollAllowMultiple(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">복수 선택 허용</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Pin toggle (admin only) */}
        {isAdmin && (
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className={`relative w-10 h-6 rounded-full transition-colors ${isPinned ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
              onClick={() => setIsPinned(!isPinned)}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isPinned ? 'left-5' : 'left-1'}`} />
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Pin className="w-4 h-4" />
              상단 고정
            </span>
          </label>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isPending ? '저장 중...' : editId ? '수정' : '작성'}
          </button>
          <Link
            href="/board"
            className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors"
          >
            취소
          </Link>
        </div>
      </form>
    </div>
  )
}
