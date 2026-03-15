'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { X, Search, Plus, Trash2, User, UserPlus, Check, MessageSquare, MousePointerClick } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { playersApi, sessionsApi } from '@/lib/api'
import { cn } from '@/lib/cn'

interface Props {
  sessionId: number
  currentAttendance: any[]
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export function AttendanceEditorModal({
  sessionId,
  currentAttendance,
  isOpen,
  onClose,
  onSave,
}: Props) {
  const { token } = useAuthStore()
  const [mode, setMode] = useState<'manual' | 'parse'>('manual')
  const [search, setSearch] = useState('')
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([])
  const [guestNames, setGuestNames] = useState<string[]>([])
  const [newGuestName, setNewGuestName] = useState('')

  // 파싱 모드 상태
  const [kakaoText, setKakaoText] = useState('')
  const [parseResult, setParseResult] = useState<any>(null)
  const [parseError, setParseError] = useState('')

  // 전체 선수 목록 조회
  const { data: playersData } = useQuery({
    queryKey: ['players', token],
    queryFn: () => playersApi.list(token ?? undefined),
    enabled: isOpen && !!token,
  })

  const players = playersData?.players || []

  // 현재 참석자 초기화
  useEffect(() => {
    if (isOpen && currentAttendance) {
      const playerIds = currentAttendance
        .filter((a: any) => a.player_id)
        .map((a: any) => a.player_id)
      setSelectedPlayerIds(playerIds)

      const guests = currentAttendance
        .filter((a: any) => !a.player_id && a.guest_name)
        .map((a: any) => a.guest_name)
      setGuestNames(guests)
    }
  }, [isOpen, currentAttendance])

  // 참석자 저장 mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const attendees = [
        ...selectedPlayerIds.map(id => ({ playerId: id, isGuest: false })),
        ...guestNames.map(name => ({ playerId: null, isGuest: true, guestName: name })),
      ]
      return sessionsApi.saveAttendance(sessionId, attendees, token!)
    },
    onSuccess: () => {
      onSave()
      onClose()
    },
  })

  // 카카오톡 파싱 mutation
  const parseMutation = useMutation({
    mutationFn: () => sessionsApi.parse(sessionId, kakaoText, token!),
    onSuccess: (data) => {
      setParseResult(data)
      setParseError('')
    },
    onError: (err: any) => {
      setParseError(err.message)
    },
  })

  // 파싱 결과 적용
  const applyParseResult = () => {
    if (!parseResult) return

    const newPlayerIds: number[] = []
    const newGuests: string[] = []

    parseResult.attendees.forEach((a: any) => {
      if (a.playerId) {
        newPlayerIds.push(a.playerId)
      } else if (a.isGuest) {
        newGuests.push(a.name)
      }
    })

    setSelectedPlayerIds(newPlayerIds)
    setGuestNames(newGuests)
    setMode('manual')
    setParseResult(null)
    setKakaoText('')
  }

  // 검색 필터링
  const filteredPlayers = players.filter((p: any) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      p.name?.toLowerCase().includes(searchLower) ||
      p.nickname?.toLowerCase().includes(searchLower)
    )
  })

  // 선수 토글
  const togglePlayer = (playerId: number) => {
    setSelectedPlayerIds(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    )
  }

  // 용병 추가
  const addGuest = () => {
    if (newGuestName.trim()) {
      setGuestNames(prev => [...prev, newGuestName.trim()])
      setNewGuestName('')
    }
  }

  // 용병 삭제
  const removeGuest = (index: number) => {
    setGuestNames(prev => prev.filter((_, i) => i !== index))
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
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col mx-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-500" />
            참석자 수정
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setMode('manual')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
              mode === 'manual'
                ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            <MousePointerClick className="w-4 h-4" />
            직접 선택
          </button>
          <button
            onClick={() => setMode('parse')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
              mode === 'parse'
                ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            <MessageSquare className="w-4 h-4" />
            카카오 파싱
          </button>
        </div>

        {/* ── 직접 선택 모드 ── */}
        {mode === 'manual' && (
          <>
            {/* 현재 선택된 참석자 */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  선택된 참석자
                </span>
                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                  {selectedPlayerIds.length + guestNames.length}명
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedPlayerIds.length === 0 && guestNames.length === 0 ? (
                  <p className="text-sm text-slate-400">아직 선택된 참석자가 없습니다.</p>
                ) : (
                  <>
                    {selectedPlayerIds.map(playerId => {
                      const player = players.find((p: any) => p.id === playerId)
                      return (
                        <div
                          key={playerId}
                          className="flex items-center gap-1 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm"
                        >
                          <span>{player?.name || player?.nickname}</span>
                          <button
                            onClick={() => togglePlayer(playerId)}
                            className="hover:text-red-500 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    })}
                    {guestNames.map((name, index) => (
                      <div
                        key={`guest-${index}`}
                        className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-lg text-sm"
                      >
                        <span>{name} (용병)</span>
                        <button
                          onClick={() => removeGuest(index)}
                          className="hover:text-red-500 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* 검색 */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="선수 검색..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            {/* 선수 목록 */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                선수 목록 ({players.filter((p: any) => !p.is_guest).length}명)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filteredPlayers.filter((p: any) => !p.is_guest).map((player: any) => {
                  const isSelected = selectedPlayerIds.includes(player.id)
                  return (
                    <button
                      key={player.id}
                      onClick={() => togglePlayer(player.id)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all',
                        isSelected
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      )}
                    >
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                      )}>
                        {isSelected ? <Check className="w-3.5 h-3.5" /> : player.name?.charAt(0)}
                      </div>
                      <span className="text-sm font-medium truncate">
                        {player.name}
                        {player.nickname && (
                          <span className={cn(
                            'ml-1',
                            isSelected ? 'text-white/70' : 'text-slate-400'
                          )}>
                            ({player.nickname})
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 용병 추가 */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                용병 추가
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGuestName}
                  onChange={(e) => setNewGuestName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addGuest()}
                  placeholder="용병 이름"
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
                <Button onClick={addGuest} disabled={!newGuestName.trim()}>
                  <Plus className="w-4 h-4" />
                  추가
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── 카카오 파싱 모드 ── */}
        {mode === 'parse' && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {!parseResult ? (
              /* 텍스트 입력 화면 */
              <div className="flex-1 px-6 py-5 flex flex-col gap-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  카카오톡 투표 결과를 붙여넣으면 참석자를 자동으로 인식합니다.
                  <br />
                  두 글자 이름만 파싱되며, 동명이인은 용병으로 처리됩니다.
                </p>
                <textarea
                  className="flex-1 min-h-[200px] px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                  placeholder={`예시:\n2/11(수)\n민호 준모 호규 호재 상훈 상훈 주현 12명`}
                  value={kakaoText}
                  onChange={(e) => setKakaoText(e.target.value)}
                />
                {parseError && (
                  <p className="text-sm text-red-500">{parseError}</p>
                )}
                <Button
                  onClick={() => parseMutation.mutate()}
                  loading={parseMutation.isPending}
                  disabled={!kakaoText.trim()}
                  className="w-full"
                >
                  <MessageSquare className="w-4 h-4" />
                  파싱하기
                </Button>
              </div>
            ) : (
              /* 파싱 결과 확인 화면 */
              <div className="flex-1 px-6 py-5 flex flex-col gap-4">
                {/* 요약 */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3">
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{parseResult.totalCount}</p>
                    <p className="text-xs text-slate-500 mt-0.5">총 인원</p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-3">
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{parseResult.playerCount}</p>
                    <p className="text-xs text-slate-500 mt-0.5">정회원</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3">
                    <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{parseResult.guestCount}</p>
                    <p className="text-xs text-slate-500 mt-0.5">용병</p>
                  </div>
                </div>

                {/* 참석자 목록 */}
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">파싱된 참석자</p>
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl max-h-48 overflow-y-auto">
                    {parseResult.attendees.map((a: any, i: number) => (
                      <span
                        key={i}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-sm font-medium',
                          a.isGuest
                            ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                            : a.playerId
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                              : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                        )}
                      >
                        {a.name}
                        {!a.playerId && !a.isGuest && ' (미등록)'}
                      </span>
                    ))}
                  </div>
                  {parseResult.unknownCount > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                      ⚠ 미등록 선수 {parseResult.unknownCount}명은 저장 시 제외됩니다.
                    </p>
                  )}
                </div>

                <div className="flex gap-2 mt-auto">
                  <Button variant="outline" className="flex-1" onClick={() => setParseResult(null)}>
                    다시 파싱
                  </Button>
                  <Button className="flex-1" onClick={applyParseResult}>
                    <Check className="w-4 h-4" />
                    적용하기
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 푸터 (직접 선택 모드에서만) */}
        {mode === 'manual' && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              취소
            </Button>
            <Button
              className="flex-1"
              onClick={() => saveMutation.mutate()}
              loading={saveMutation.isPending}
            >
              <Check className="w-4 h-4" />
              저장하기
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
