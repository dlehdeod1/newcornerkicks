'use client'

import { useState, useRef, useEffect } from 'react'
import { Users, ArrowLeftRight, Check, X, Sparkles, ChevronDown, ChevronUp, Palette, Wand2, Pencil, Trash2, Star, Lightbulb, AlertTriangle } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { sessionsApi } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Props {
  teams: any[]
  sessionId: number
  session: any
  attendance: any[]
  onRefetch: () => void
}

// AI 분석 결과 타입
interface TeamAnalysis {
  teamName: string
  color: string
  type: string
  avgOverall: string
  avgAttack: string
  avgDefense: string
  keyPlayer?: string
  keyPlayerReason?: string
  aiStrategy?: string
  watchOut?: string
}

// 조끼색 팔레트
const teamColors: Record<string, {
  light: string
  dark: string
  badge: string
  name: string
  emoji: string
}> = {
  yellow: {
    light: 'bg-yellow-50 border-yellow-400 text-slate-900',
    dark: 'dark:bg-yellow-500/15 dark:border-yellow-500/50 dark:text-white',
    badge: 'bg-yellow-400 text-yellow-950',
    name: '노랑',
    emoji: '🟡',
  },
  orange: {
    light: 'bg-orange-50 border-orange-400 text-slate-900',
    dark: 'dark:bg-orange-500/15 dark:border-orange-500/50 dark:text-white',
    badge: 'bg-orange-400 text-orange-950',
    name: '주황',
    emoji: '🟠',
  },
  white: {
    light: 'bg-slate-50 border-slate-300 text-slate-900',
    dark: 'dark:bg-slate-700/50 dark:border-slate-500/50 dark:text-white',
    badge: 'bg-white text-slate-800 border border-slate-300',
    name: '하양',
    emoji: '⚪',
  },
  red: {
    light: 'bg-red-50 border-red-400 text-slate-900',
    dark: 'dark:bg-red-500/15 dark:border-red-500/50 dark:text-white',
    badge: 'bg-red-500 text-white',
    name: '빨강',
    emoji: '🔴',
  },
  blue: {
    light: 'bg-blue-50 border-blue-400 text-slate-900',
    dark: 'dark:bg-blue-500/15 dark:border-blue-500/50 dark:text-white',
    badge: 'bg-blue-500 text-white',
    name: '파랑',
    emoji: '🔵',
  },
  green: {
    light: 'bg-emerald-50 border-emerald-400 text-slate-900',
    dark: 'dark:bg-emerald-500/15 dark:border-emerald-500/50 dark:text-white',
    badge: 'bg-emerald-500 text-white',
    name: '초록',
    emoji: '🟢',
  },
  purple: {
    light: 'bg-purple-50 border-purple-400 text-slate-900',
    dark: 'dark:bg-purple-500/15 dark:border-purple-500/50 dark:text-white',
    badge: 'bg-purple-500 text-white',
    name: '보라',
    emoji: '🟣',
  },
  pink: {
    light: 'bg-pink-50 border-pink-400 text-slate-900',
    dark: 'dark:bg-pink-500/15 dark:border-pink-500/50 dark:text-white',
    badge: 'bg-pink-400 text-pink-950',
    name: '핑크',
    emoji: '🩷',
  },
}

// 기존 색상 매핑 (이전 데이터 호환)
const colorMapping: Record<string, string> = {
  red: 'red',
  blue: 'blue',
  green: 'green',
  yellow: 'yellow',
  orange: 'orange',
  white: 'white',
  purple: 'purple',
  pink: 'pink',
}

export function TeamsTab({ teams, sessionId, session, attendance, onRefetch }: Props) {
  const { isAdmin, token, club } = useAuthStore()
  const router = useRouter()
  const [editMode, setEditMode] = useState(false)
  const [selectedMember, setSelectedMember] = useState<{ member: any; fromTeamId: number } | null>(null)
  const [aiAnalysis, setAiAnalysis] = useState<Map<string, TeamAnalysis>>(new Map())
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isReforming, setIsReforming] = useState(false)
  const [isAiReforming, setIsAiReforming] = useState(false)
  const [isDisbanding, setIsDisbanding] = useState(false)

  const isPro = club?.isPro ?? false
  const aiRemaining = 3 - (session?.ai_team_count || 0)

  // 페이지 로드 시 DB에 저장된 AI 분석 결과 자동 로드
  useEffect(() => {
    const loadSavedAnalysis = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'
        const response = await fetch(`${API_URL}/sessions/${sessionId}/ai-analysis`)
        if (response.ok) {
          const data = await response.json()
          if (data.hasAnalysis && data.analysis?.length > 0) {
            const analysisMap = new Map<string, TeamAnalysis>()
            data.analysis.forEach((analysis: TeamAnalysis) => {
              analysisMap.set(analysis.teamName, analysis)
            })
            setAiAnalysis(analysisMap)
          }
        }
      } catch (err) {
        console.error('Load saved analysis error:', err)
      }
    }
    if (teams.length > 0) loadSavedAnalysis()
  }, [sessionId, teams.length])

  const handleMemberClick = (member: any, teamId: number) => {
    if (!editMode) return

    if (selectedMember) {
      if (selectedMember.fromTeamId === teamId) {
        setSelectedMember(null)
      } else {
        handleMovePlayer(selectedMember.member, selectedMember.fromTeamId, teamId)
        setSelectedMember(null)
      }
    } else {
      setSelectedMember({ member, fromTeamId: teamId })
    }
  }

  const handleMovePlayer = async (member: any, fromTeamId: number, toTeamId: number) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'
      const token = useAuthStore.getState().token

      await fetch(`${API_URL}/teams/${fromTeamId}/members/${member.id}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ toTeamId }),
      })

      onRefetch()
    } catch (err) {
      console.error('Move player error:', err)
    }
  }

  const handleChangeColor = async (teamId: number, newColor: string) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'
      const token = useAuthStore.getState().token

      await fetch(`${API_URL}/teams/${teamId}/color`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ vestColor: newColor }),
      })

      onRefetch()
    } catch (err) {
      console.error('Change color error:', err)
    }
  }

  const buildAttendees = () =>
    (attendance || []).map((a: any) => ({
      playerId: a.player_id ?? null,
      name: a.display_name || a.name || a.guest_name,
      guestName: a.guest_name || null,
      isGuest: !a.player_id,
    }))

  const handleReformTeams = async () => {
    if (!window.confirm('팀을 다시 편성하시겠습니까?\n기존 팀과 경기 기록이 초기화됩니다.')) return

    setIsReforming(true)
    try {
      if (!token) { toast.error('로그인이 필요합니다.'); return }
      const attendees = buildAttendees()
      if (attendees.length === 0) { toast.error('참석자가 없어 팀을 편성할 수 없습니다.'); return }
      const result = await sessionsApi.createTeams(sessionId, { attendees, useAI: false }, token)
      if (result?.limitReached) { toast.error(result.message || 'AI 편성 한도에 도달했습니다.'); return }
      if (result?.locked) { router.push('/upgrade'); return }
      setAiAnalysis(new Map())
      toast.success('팀이 재편성되었습니다.')
      onRefetch()
    } catch (err: any) {
      console.error('Reform teams error:', err)
      toast.error(err.message || '팀 재편성에 실패했습니다.')
    } finally {
      setIsReforming(false)
    }
  }

  const handleReformTeamsAI = async () => {
    if (aiRemaining <= 0) {
      toast.error('이번 달 AI 팀 편성 횟수를 모두 사용했습니다.')
      return
    }
    if (!window.confirm(`AI로 팀을 다시 편성하시겠습니까? (잔여 ${aiRemaining}회)\n기존 팀과 경기 기록이 초기화됩니다.`)) return

    setIsAiReforming(true)
    try {
      if (!token) { toast.error('로그인이 필요합니다.'); return }
      const attendees = buildAttendees()
      if (attendees.length === 0) { toast.error('참석자가 없어 팀을 편성할 수 없습니다.'); return }
      const result = await sessionsApi.createTeams(sessionId, { attendees, useAI: true }, token)
      if (result?.limitReached) { toast.error(result.message || 'AI 편성 한도에 도달했습니다.'); return }
      if (result?.locked) { router.push('/upgrade'); return }
      setAiAnalysis(new Map())
      toast.success('AI 팀이 재편성되었습니다.')
      onRefetch()
    } catch (err: any) {
      console.error('Reform teams AI error:', err)
      toast.error(err.message || 'AI 팀 재편성에 실패했습니다.')
    } finally {
      setIsAiReforming(false)
    }
  }

  const handleAiAnalysis = async () => {
    setIsAnalyzing(true)
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

      const response = await fetch(`${API_URL}/sessions/${sessionId}/ai-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: '알 수 없는 오류' }))
        throw new Error(err.error || `분석 실패 (${response.status})`)
      }

      const data = await response.json()
      console.log('AI Analysis API response:', JSON.stringify(data, null, 2))

      // 에러가 있으면 표시
      if (data.error) {
        console.warn('AI Analysis error from server:', data.error)
        toast.error(`AI 분석 오류: ${data.error}`)
      }

      // 팀별로 분석 결과를 Map에 저장 (팀 이름으로 매핑)
      const analysisMap = new Map<string, TeamAnalysis>()
      data.analysis?.forEach((analysis: TeamAnalysis) => {
        console.log(`Team "${analysis.teamName}" analysis:`, {
          keyPlayer: analysis.keyPlayer,
          aiStrategy: analysis.aiStrategy,
          watchOut: analysis.watchOut,
        })
        analysisMap.set(analysis.teamName, analysis)
      })
      setAiAnalysis(analysisMap)
    } catch (err: any) {
      console.error('AI analysis error:', err)
      toast.error(err.message || 'AI 분석에 실패했습니다.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleDisbandTeams = async () => {
    console.log('handleDisbandTeams called!')
    if (!window.confirm('팀 편성을 해체하시겠습니까?\n팀, 경기 일정이 모두 삭제됩니다.\n(참석자 명단은 유지됩니다)')) return

    setIsDisbanding(true)
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'
      const response = await fetch(`${API_URL}/sessions/${sessionId}/teams`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: '알 수 없는 오류' }))
        throw new Error(err.error || `해체 실패 (${response.status})`)
      }

      setAiAnalysis(new Map())
      toast.success('팀이 해체되었습니다.')
      onRefetch()
    } catch (err: any) {
      toast.error(err.message || '팀 해체에 실패했습니다.')
    } finally {
      setIsDisbanding(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 컨트롤 패널 */}
      {teams.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {editMode ? '선수를 클릭하고 이동할 팀을 클릭하세요' : ''}
          </p>
          <div className="flex gap-2 flex-wrap">
            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAiAnalysis}
                  loading={isAnalyzing}
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  {aiAnalysis.size > 0 ? 'AI 재분석' : 'AI 분석'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReformTeams}
                  loading={isReforming}
                  className="bg-primary hover:bg-primary-hover text-white border-0"
                >
                  <Wand2 className="w-4 h-4 mr-1.5" />
                  재편성
                </Button>
                {isPro && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReformTeamsAI}
                    loading={isAiReforming}
                    disabled={aiRemaining <= 0}
                    className="bg-purple-500 hover:bg-purple-600 text-white border-0 disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4 mr-1.5" />
                    AI 재편성 ({aiRemaining}회)
                  </Button>
                )}
                <Button
                  variant={editMode ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setEditMode(!editMode)
                    setSelectedMember(null)
                  }}
                >
                  {editMode ? (
                    <>
                      <Check className="w-4 h-4 mr-1.5" />
                      완료
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight className="w-4 h-4 mr-1.5" />
                      팀 편집
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisbandTeams}
                  loading={isDisbanding}
                  className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  팀 해체
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team: any) => (
          <TeamCard
            key={team.id}
            team={team}
            editMode={editMode}
            selectedMember={selectedMember}
            onMemberClick={handleMemberClick}
            onChangeColor={handleChangeColor}
            onRefetch={onRefetch}
            isAdmin={isAdmin}
            analysis={aiAnalysis.get(team.name)}
          />
        ))}
      </div>

      {/* 선택된 멤버 표시 */}
      {
        selectedMember && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 z-50">
            <span className="text-sm font-medium">
              {selectedMember.member.name || selectedMember.member.guest_name} 선택됨
            </span>
            <button
              onClick={() => setSelectedMember(null)}
              className="p-1 hover:bg-blue-500 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      }
    </div >
  )
}

function TeamCard({
  team,
  editMode,
  selectedMember,
  onMemberClick,
  onChangeColor,
  onRefetch,
  isAdmin,
  analysis,
}: {
  team: any
  editMode: boolean
  selectedMember: { member: any; fromTeamId: number } | null
  onMemberClick: (member: any, teamId: number) => void
  onChangeColor: (teamId: number, newColor: string) => void
  onRefetch: () => void
  isAdmin: boolean
  analysis?: TeamAnalysis
}) {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(team.name)
  const [members, setMembers] = useState<any[]>(team.members || [])
  const nameInputRef = useRef<HTMLInputElement>(null)
  const mappedColor = colorMapping[team.vest_color] || 'yellow'
  const colors = teamColors[mappedColor] || teamColors.yellow
  const isDropTarget = selectedMember && selectedMember.fromTeamId !== team.id

  useEffect(() => {
    setMembers(team.members || [])
  }, [team.members])

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newMembers = [...members]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newMembers.length) return
      ;[newMembers[index], newMembers[targetIndex]] = [newMembers[targetIndex], newMembers[index]]
    setMembers(newMembers)
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'
      const token = useAuthStore.getState().token
      await fetch(`${API_URL}/teams/${team.id}/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ memberIds: newMembers.map((m: any) => m.id) }),
      })
    } catch (err) {
      setMembers(team.members || [])
    }
  }

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus()
  }, [editingName])

  const handleNameSave = async () => {
    const trimmed = nameValue.trim()
    if (!trimmed || trimmed === team.name) {
      setNameValue(team.name)
      setEditingName(false)
      return
    }
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'
      const token = useAuthStore.getState().token
      await fetch(`${API_URL}/teams/${team.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: trimmed }),
      })
    } catch (err) {
      setNameValue(team.name)
    } finally {
      setEditingName(false)
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl p-5 border-2 shadow-sm transition-all',
        colors.light,
        colors.dark,
        isDropTarget && 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 cursor-pointer',
        editMode && 'hover:shadow-md'
      )}
      onClick={() => {
        if (isDropTarget) {
          onMemberClick(selectedMember!.member, team.id)
        }
      }}
    >
      {/* 팀 헤더 */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* 조끼색 표시 */}
          <span className="text-2xl shrink-0">{colors.emoji}</span>

          {editingName && isAdmin ? (
            <input
              ref={nameInputRef}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSave()
                if (e.key === 'Escape') { setNameValue(team.name); setEditingName(false) }
              }}
              onClick={(e) => e.stopPropagation()}
              className="text-lg font-bold bg-white/60 dark:bg-slate-700/60 border border-current rounded px-1 w-28 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          ) : (
            <h3
              className={cn(
                'text-lg font-bold truncate',
                isAdmin && editMode && 'cursor-pointer hover:underline'
              )}
              onClick={(e) => {
                if (isAdmin && editMode) { e.stopPropagation(); setEditingName(true) }
              }}
              title={isAdmin && editMode ? '클릭해서 이름 변경' : undefined}
            >
              {nameValue}
            </h3>
          )}
          {isAdmin && editMode && !editingName && (
            <button
              onClick={(e) => { e.stopPropagation(); setEditingName(true) }}
              className="p-0.5 opacity-50 hover:opacity-100 transition-opacity shrink-0"
              title="팀 이름 편집"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          <span className={cn('px-2 py-0.5 text-[10px] font-bold rounded shrink-0', colors.badge)}>
            {colors.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* 조끼색 변경 버튼 - Admin만 보임 */}
          {isAdmin && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowColorPicker(!showColorPicker)
                }}
                className={cn(
                  'p-1.5 rounded-lg transition-all',
                  'bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20',
                  showColorPicker && 'bg-black/20 dark:bg-white/20'
                )}
                title="조끼색 변경"
              >
                <Palette className="w-4 h-4" />
              </button>

              {/* 색상 선택 팝업 */}
              {showColorPicker && (
                <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-2 grid grid-cols-4 gap-1 z-20">
                  {(Object.keys(teamColors) as Array<keyof typeof teamColors>).map(colorKey => (
                    <button
                      key={colorKey}
                      onClick={(e) => {
                        e.stopPropagation()
                        onChangeColor(team.id, colorKey)
                        setShowColorPicker(false)
                      }}
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-lg transition-all hover:scale-110',
                        mappedColor === colorKey && 'ring-2 ring-blue-500 ring-offset-2'
                      )}
                      title={teamColors[colorKey].name}
                    >
                      {teamColors[colorKey].emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {team.rank && (
            <span className="px-2 py-1 text-xs font-medium bg-black/10 dark:bg-white/10 rounded shrink-0">
              {team.rank}위
            </span>
          )}
        </div>
      </div>

      {/* 팀 유형 */}
      {team.type && (
        <p className="text-sm opacity-75 mb-3">{team.type}</p>
      )}

      {/* 멤버 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm opacity-75">
          <Users className="w-4 h-4" />
          <span>{members.length}명</span>
        </div>
        {/* 편집 모드: 순서 변경 리스트 */}
        {editMode && isAdmin ? (
          <div className="flex flex-col gap-1">
            {members.map((member: any, index: number) => {
              const isSelected = selectedMember?.member.id === member.id && selectedMember?.fromTeamId === team.id
              const isGuest = !member.player_id
              return (
                <div key={member.id} className="flex items-center gap-1.5">
                  {/* 순서 버튼 */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMove(index, 'up') }}
                      disabled={index === 0}
                      className="p-0.5 rounded opacity-50 hover:opacity-100 disabled:opacity-20 hover:bg-black/10 dark:hover:bg-white/10 transition-all"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMove(index, 'down') }}
                      disabled={index === members.length - 1}
                      className="p-0.5 rounded opacity-50 hover:opacity-100 disabled:opacity-20 hover:bg-black/10 dark:hover:bg-white/10 transition-all"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                  {/* 선수 버튼 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onMemberClick(member, team.id) }}
                    className={cn(
                      'flex-1 text-left px-2.5 py-1 text-sm rounded-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-95',
                      isSelected
                        ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                        : isGuest
                          ? 'bg-amber-200/80 dark:bg-amber-500/30 text-amber-800 dark:text-amber-300'
                          : 'bg-black/10 dark:bg-white/15'
                    )}
                  >
                    {member.name || member.guest_name}
                    {(member.name || member.guest_name) === team.key_player && <><span> </span><Star className="w-4 h-4 inline" /></>}
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          /* 일반 모드: 기존 태그 형태 */
          <div className="flex flex-wrap gap-1.5">
            {members.map((member: any) => {
              const isGuest = !member.player_id
              return (
                <span
                  key={member.id}
                  className={cn(
                    'px-2.5 py-1 text-sm rounded-lg',
                    isGuest
                      ? 'bg-amber-200/80 dark:bg-amber-500/30 text-amber-800 dark:text-amber-300'
                      : 'bg-black/10 dark:bg-white/15'
                  )}
                >
                  {member.name || member.guest_name}
                  {(member.name || member.guest_name) === team.key_player && <><span> </span><Star className="w-4 h-4 inline" /></>}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* 키플레이어 (분석 없을 때만) */}
      {!analysis && team.key_player && (
        <div className="pt-3 mt-3 border-t border-black/10 dark:border-white/10 overflow-hidden">
          <p className="text-sm truncate">
            <span className="opacity-75">키플레이어:</span>{' '}
            <span className="font-medium">{team.key_player}</span>
          </p>
          {team.key_player_reason && (
            <p className="text-xs opacity-75 mt-1 line-clamp-2">{team.key_player_reason}</p>
          )}
        </div>
      )}

      {/* AI 분석 결과 (팀 카드 내부) */}
      {analysis && (
        <div className="pt-3 mt-3 border-t border-black/10 dark:border-white/10">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowAnalysis(!showAnalysis)
            }}
            className="w-full flex items-center justify-between text-left mb-2"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-400">
              <Sparkles className="w-3.5 h-3.5" />
              AI 분석
            </div>
            {showAnalysis ? (
              <ChevronUp className="w-4 h-4 opacity-50" />
            ) : (
              <ChevronDown className="w-4 h-4 opacity-50" />
            )}
          </button>

          {showAnalysis && (
            <div className="space-y-2">
              {/* 스탯 바 */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="opacity-60">종합</span>
                    <span className="font-bold">{analysis.avgOverall}</span>
                  </div>
                  <div className="h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-500 dark:bg-slate-400 rounded-full"
                      style={{ width: `${parseFloat(analysis.avgOverall)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-red-600 dark:text-red-400">공격</span>
                    <span className="font-bold text-red-600 dark:text-red-400">{analysis.avgAttack}</span>
                  </div>
                  <div className="h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{ width: `${parseFloat(analysis.avgAttack)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-blue-600 dark:text-blue-400">수비</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{analysis.avgDefense}</span>
                  </div>
                  <div className="h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${parseFloat(analysis.avgDefense)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* AI 분석 내용 */}
              {analysis.keyPlayer && (
                <p className="text-xs">
                  <Star className="w-4 h-4 inline text-amber-600 dark:text-amber-400" />{' '}
                  <span className="font-medium">{analysis.keyPlayer}</span>
                  {analysis.keyPlayerReason && (
                    <span className="opacity-60"> - {analysis.keyPlayerReason}</span>
                  )}
                </p>
              )}
              {analysis.aiStrategy && (
                <p className="text-xs opacity-75">
                  <Lightbulb className="w-4 h-4 inline text-purple-600 dark:text-purple-400" /> {analysis.aiStrategy}
                </p>
              )}
              {analysis.watchOut && (
                <p className="text-xs opacity-75">
                  <AlertTriangle className="w-4 h-4 inline text-orange-600 dark:text-orange-400" /> {analysis.watchOut}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
