'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft, Upload, X, Image as ImageIcon } from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { communityApi, uploadsApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import Link from 'next/link'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cornerkicks-api.conerkicks.workers.dev'

const categories = [
  { key: 'free', label: '자유' },
  { key: 'recruit', label: '팀 모집' },
  { key: 'mercenary', label: '용병 모집' },
  { key: 'match', label: '매칭' },
  { key: 'review', label: '경기 후기' },
  { key: 'patchnote', label: '패치노트' },
]

const regions = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']
const dayLabels: Record<string, string> = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' }
const timeSlots = [
  { key: 'morning', label: '오전' },
  { key: 'afternoon', label: '오후' },
  { key: 'evening', label: '저녁' },
  { key: 'night', label: '심야' },
]
const skillLevels = [
  { key: 'beginner', label: '입문' },
  { key: 'low', label: '초급' },
  { key: 'mid', label: '중급' },
  { key: 'high', label: '상급' },
]

function WriteContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { token } = useAuthStore()

  const editId = searchParams.get('edit')
  const initialCategory = searchParams.get('category') || 'free'
  const isEdit = !!editId

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState(initialCategory)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Recruit/match fields
  const [region, setRegion] = useState('')
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [timeSlot, setTimeSlot] = useState('')
  const [skillLevel, setSkillLevel] = useState('')
  const [headcount, setHeadcount] = useState<number | ''>('')

  const showExtraFields = category === 'recruit' || category === 'match' || category === 'mercenary'

  // Load existing post for edit
  const { data: editData } = useQuery({
    queryKey: ['community', Number(editId), token],
    queryFn: () => communityApi.get(Number(editId), token!),
    enabled: isEdit && !!token,
  })

  useEffect(() => {
    if (editData?.data) {
      const p = editData.data
      setTitle(p.title)
      setContent(p.content)
      setCategory(p.category)
      setImageUrl(p.image_url || null)
      setRegion(p.region || '')
      setSelectedDays(p.day_of_week ? p.day_of_week.split(',') : [])
      setTimeSlot(p.time_slot || '')
      setSkillLevel(p.skill_level || '')
      setHeadcount(p.headcount || '')
    }
  }, [editData])

  const createMutation = useMutation({
    mutationFn: (data: any) => communityApi.create(data, token!),
    onSuccess: () => router.push('/community'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => communityApi.update(Number(editId), data, token!),
    onSuccess: () => router.push(`/community/${editId}`),
  })

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setUploading(true)
    try {
      const res = await uploadsApi.uploadImage(file, 'community', token)
      setImageUrl(res.url)
    } catch (err: any) {
      alert(err.message || '이미지 업로드 실패')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 입력해주세요.')
      return
    }

    const payload: any = {
      title: title.trim(),
      content: content.trim(),
      category,
      imageUrl: imageUrl || undefined,
    }

    if (showExtraFields) {
      if (region) payload.region = region
      if (selectedDays.length > 0) payload.dayOfWeek = selectedDays.join(',')
      if (timeSlot) payload.timeSlot = timeSlot
      if (skillLevel) payload.skillLevel = skillLevel
      if (headcount) payload.headcount = Number(headcount)
    }

    if (isEdit) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  const toggleDay = (day: string) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <Link
        href="/community"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        목록으로
      </Link>

      <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
        {isEdit ? '글 수정' : '글 작성'}
      </h1>

      <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50 shadow-sm space-y-5">
        {/* Category */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">카테고리</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full sm:w-48 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            {categories.map(c => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">제목</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            maxLength={100}
          />
        </div>

        {/* Content */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">내용</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="내용을 입력하세요"
            rows={10}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-y"
          />
        </div>

        {/* Image */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">이미지</label>
          {imageUrl ? (
            <div className="relative inline-block">
              <img
                src={imageUrl.startsWith('http') ? imageUrl : `${API_BASE}${imageUrl}`}
                alt="첨부 이미지"
                className="w-40 h-40 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
              />
              <button
                onClick={() => setImageUrl(null)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {uploading ? (
                <span className="animate-spin w-4 h-4 border-2 border-slate-300 border-t-emerald-500 rounded-full" />
              ) : (
                <ImageIcon className="w-4 h-4" />
              )}
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

        {/* Extra fields for recruit/match */}
        {showExtraFields && (
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">모집 정보</p>

            {/* Region */}
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">지역</label>
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="w-full sm:w-48 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="">선택 안함</option>
                {regions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Day of Week */}
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">요일 (복수 선택)</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(dayLabels).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleDay(key)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
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

            {/* Time Slot */}
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">시간대</label>
              <select
                value={timeSlot}
                onChange={e => setTimeSlot(e.target.value)}
                className="w-full sm:w-48 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="">선택 안함</option>
                {timeSlots.map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Skill Level */}
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">실력</label>
              <select
                value={skillLevel}
                onChange={e => setSkillLevel(e.target.value)}
                className="w-full sm:w-48 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="">선택 안함</option>
                {skillLevels.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Headcount */}
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">모집 인원</label>
              <input
                type="number"
                value={headcount}
                onChange={e => setHeadcount(e.target.value ? Number(e.target.value) : '')}
                placeholder="예: 5"
                min={1}
                max={50}
                className="w-32 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-4">
          <Link
            href="/community"
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            취소
          </Link>
          <button
            onClick={handleSubmit}
            disabled={isPending || !title.trim() || !content.trim()}
            className="px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
          >
            {isPending ? '저장 중...' : isEdit ? '수정하기' : '작성하기'}
          </button>
        </div>

        {/* Error display */}
        {(createMutation.error || updateMutation.error) && (
          <p className="text-sm text-red-500 mt-2">
            {(createMutation.error as Error)?.message || (updateMutation.error as Error)?.message}
          </p>
        )}
      </div>
    </div>
  )
}

export default function CommunityWritePage() {
  return (
    <Suspense fallback={
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-6" />
        <div className="h-96 bg-slate-200 dark:bg-slate-700 rounded-2xl animate-pulse" />
      </div>
    }>
      <WriteContent />
    </Suspense>
  )
}
