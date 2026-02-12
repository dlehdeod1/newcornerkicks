'use client'

import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X, Calendar, MapPin, Clock, Coins, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/api'

interface Props {
  session: any
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export function SessionEditModal({ session, isOpen, onClose, onSave }: Props) {
  const { token } = useAuthStore()

  const [title, setTitle] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [location, setLocation] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [baseFee, setBaseFee] = useState(6000)
  const [potTotal, setPotTotal] = useState(120000)
  const [status, setStatus] = useState('recruiting')

  // 초기값 설정
  useEffect(() => {
    if (isOpen && session) {
      setTitle(session.title || '')
      setSessionDate(session.session_date || '')
      setLocation(session.location || '수성대 풋살장 2번구장')
      setStartTime(session.start_time || '20:00')
      setEndTime(session.end_time || '22:00')
      setBaseFee(session.base_fee || 6000)
      setPotTotal(session.pot_total || 120000)
      setStatus(session.status || 'recruiting')
    }
  }, [isOpen, session])

  const updateMutation = useMutation({
    mutationFn: (data: any) =>
      api(`/sessions/${session.id}`, { method: 'PUT', body: data, token: token! }),
    onSuccess: () => {
      onSave()
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate({
      title,
      sessionDate,
      location,
      startTime,
      endTime,
      baseFee,
      potTotal,
      status,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 백드롭 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="relative w-full max-w-lg max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col mx-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-500" />
            세션 정보 수정
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              세션 제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="코너킥스 정기 풋살"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {/* 날짜 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              날짜
            </label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {/* 장소 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              장소
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="수성대 풋살장 2번구장"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {/* 시간 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                시작 시간
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                종료 시간
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          {/* 참가비 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <Coins className="w-4 h-4 inline mr-1" />
                참가비
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={baseFee}
                  onChange={(e) => setBaseFee(Number(e.target.value))}
                  step={1000}
                  className="w-full px-4 py-3 pr-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">원</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                상금 풀
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={potTotal}
                  onChange={(e) => setPotTotal(Number(e.target.value))}
                  step={10000}
                  className="w-full px-4 py-3 pr-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">원</span>
              </div>
            </div>
          </div>

          {/* 상태 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              상태
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'recruiting', label: '모집중', color: 'emerald' },
                { value: 'closed', label: '마감', color: 'amber' },
                { value: 'completed', label: '완료', color: 'slate' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    status === opt.value
                      ? opt.color === 'emerald'
                        ? 'bg-emerald-500 text-white'
                        : opt.color === 'amber'
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 에러 */}
          {updateMutation.isError && (
            <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm">
              수정에 실패했습니다. 다시 시도해주세요.
            </div>
          )}
        </form>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            취소
          </Button>
          <Button
            type="submit"
            className="flex-1"
            onClick={handleSubmit}
            loading={updateMutation.isPending}
          >
            <Check className="w-4 h-4" />
            저장하기
          </Button>
        </div>
      </div>
    </div>
  )
}
