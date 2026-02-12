'use client'

import { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth'
import { sessionsApi } from '@/lib/api'

// 다음 수요일 날짜 계산
function getNextWednesday(): string {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0=일, 1=월, ..., 3=수, ...
  const daysUntilWed = (3 - dayOfWeek + 7) % 7 || 7 // 오늘이 수요일이면 다음주 수요일
  const nextWed = new Date(today)
  nextWed.setDate(today.getDate() + daysUntilWed)
  return nextWed.toISOString().split('T')[0]
}

interface Props {
  onClose: () => void
  onCreated: () => void
}

export function CreateSessionModal({ onClose, onCreated }: Props) {
  const { token } = useAuthStore()
  const [step, setStep] = useState<'date' | 'parse' | 'preview'>('date')
  const [sessionDate, setSessionDate] = useState(getNextWednesday())
  const [title, setTitle] = useState('코너킥스 정기 풋살 (21:00-23:00)')
  const [kakaoText, setKakaoText] = useState('')
  const [parseResult, setParseResult] = useState<any>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 1단계: 세션 생성
  const handleCreateSession = async () => {
    if (!sessionDate) {
      setError('날짜를 선택해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const data = await sessionsApi.create({ sessionDate, title }, token!)
      setSessionId(data.id)
      setStep('parse')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // 2단계: 카카오톡 파싱
  const handleParse = async () => {
    if (!kakaoText.trim()) {
      setError('카카오톡 투표 내용을 붙여넣어주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const data = await sessionsApi.parse(sessionId!, kakaoText, token!)
      setParseResult(data)
      setStep('preview')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // 3단계: 참석자 저장
  const handleSave = async () => {
    setLoading(true)
    setError('')

    try {
      const attendees = parseResult.attendees.map((a: any) => ({
        playerId: a.playerId,
        isGuest: a.isGuest,
        guestName: a.isGuest ? a.name : null,
        name: a.name,
      }))

      await sessionsApi.saveAttendance(sessionId!, attendees, token!)
      onCreated()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {step === 'date' && '새 일정 만들기'}
            {step === 'parse' && '참석자 입력'}
            {step === 'preview' && '참석자 확인'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6">
          {/* Step 1: 날짜 선택 */}
          {step === 'date' && (
            <div className="space-y-4">
              <Input
                id="date"
                type="date"
                label="일정 날짜"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
              />
              <Input
                id="title"
                type="text"
                label="제목"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          )}

          {/* Step 2: 카카오톡 파싱 */}
          {step === 'parse' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                  카카오톡 투표 내용
                </label>
                <textarea
                  className="w-full h-40 px-4 py-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`예시:\n2/11(수)\n민호 준모 호규 호재 상훈 주현 용호 성호 훈락 상엽 재진 세준 12명`}
                  value={kakaoText}
                  onChange={(e) => setKakaoText(e.target.value)}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-500">
                카카오톡 투표 결과를 그대로 복사해서 붙여넣으세요.
                두 글자 이름은 정회원, 그 외는 용병으로 처리됩니다.
              </p>
            </div>
          )}

          {/* Step 3: 미리보기 */}
          {step === 'preview' && parseResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-3">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{parseResult.totalCount}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">총 인원</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-3">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{parseResult.playerCount}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">정회원</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-3">
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{parseResult.guestCount}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">용병</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">참석자 목록</h4>
                <div className="max-h-48 overflow-y-auto bg-slate-100 dark:bg-slate-900 rounded-lg p-3">
                  <div className="flex flex-wrap gap-2">
                    {parseResult.attendees.map((a: any, i: number) => (
                      <span
                        key={i}
                        className={`px-2 py-1 text-sm rounded ${
                          a.isGuest
                            ? 'bg-yellow-200 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
                            : a.playerId
                            ? 'bg-blue-200 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                            : 'bg-red-200 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                        }`}
                      >
                        {a.name}
                        {!a.playerId && !a.isGuest && ' (미등록)'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {parseResult.unknownCount > 0 && (
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  ⚠️ {parseResult.unknownCount}명의 미등록 선수가 있습니다.
                  저장 시 자동으로 등록됩니다.
                </p>
              )}
            </div>
          )}

          {/* 에러 */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          {step !== 'date' && (
            <Button
              variant="secondary"
              onClick={() => setStep(step === 'preview' ? 'parse' : 'date')}
            >
              이전
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          {step === 'date' && (
            <Button onClick={handleCreateSession} loading={loading}>
              다음
            </Button>
          )}
          {step === 'parse' && (
            <Button onClick={handleParse} loading={loading}>
              파싱하기
            </Button>
          )}
          {step === 'preview' && (
            <Button onClick={handleSave} loading={loading}>
              저장
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
