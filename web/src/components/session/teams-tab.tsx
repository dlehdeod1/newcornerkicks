'use client'

import { useState } from 'react'
import { Users, ArrowLeftRight, Check, X, Sparkles, ChevronDown, ChevronUp, Palette } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'

interface Props {
  teams: any[]
  sessionId: number
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

// 조끼색: 노랑, 주황, 하양
const teamColors: Record<string, {
  light: string
  dark: string
  badge: string
  name: string
  emoji: string
}> = {
  yellow: {
    light: 'bg-yellow-100 border-yellow-300 text-yellow-800',
    dark: 'dark:bg-yellow-500/20 dark:border-yellow-500/40 dark:text-yellow-300',
    badge: 'bg-yellow-400 text-yellow-900',
    name: '노랑',
    emoji: '🟡',
  },
  orange: {
    light: 'bg-orange-100 border-orange-300 text-orange-800',
    dark: 'dark:bg-orange-500/20 dark:border-orange-500/40 dark:text-orange-300',
    badge: 'bg-orange-400 text-orange-900',
    name: '주황',
    emoji: '🟠',
  },
  white: {
    light: 'bg-slate-50 border-slate-300 text-slate-800',
    dark: 'dark:bg-slate-700/50 dark:border-slate-500/40 dark:text-slate-200',
    badge: 'bg-white text-slate-800 border border-slate-300',
    name: '하양',
    emoji: '⚪',
  },
}

// 기존 색상 매핑 (red, blue, green -> 새 색상)
const colorMapping: Record<string, string> = {
  red: 'yellow',
  blue: 'orange',
  green: 'white',
  yellow: 'yellow',
  orange: 'orange',
  white: 'white',
}

export function TeamsTab({ teams, sessionId, onRefetch }: Props) {
  const { isAdmin } = useAuthStore()
  const [editMode, setEditMode] = useState(false)
  const [selectedMember, setSelectedMember] = useState<{ member: any; fromTeamId: number } | null>(null)
  const [aiAnalysis, setAiAnalysis] = useState<Map<string, TeamAnalysis>>(new Map())
  const [isAnalyzing, setIsAnalyzing] = useState(false)

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

  const handleAiAnalysis = async () => {
    setIsAnalyzing(true)
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

      const response = await fetch(`${API_URL}/sessions/${sessionId}/ai-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        const data = await response.json()
        // 팀별로 분석 결과를 Map에 저장 (팀 이름으로 매핑)
        const analysisMap = new Map<string, TeamAnalysis>()
        data.analysis?.forEach((analysis: TeamAnalysis) => {
          analysisMap.set(analysis.teamName, analysis)
        })
        setAiAnalysis(analysisMap)
      }
    } catch (err) {
      console.error('AI analysis error:', err)
    } finally {
      setIsAnalyzing(false)
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAiAnalysis}
              loading={isAnalyzing}
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              {aiAnalysis.size > 0 ? 'AI 재분석' : 'AI 분석'}
            </Button>
            {isAdmin && (
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
            )}
          </div>
        </div>
      )}

      {/* 팀 카드들 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team: any) => (
          <TeamCard
            key={team.id}
            team={team}
            editMode={editMode}
            selectedMember={selectedMember}
            onMemberClick={handleMemberClick}
            onChangeColor={handleChangeColor}
            isAdmin={isAdmin}
            analysis={aiAnalysis.get(team.name)}
          />
        ))}
      </div>

      {/* 선택된 멤버 표시 */}
      {selectedMember && (
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
      )}
    </div>
  )
}

function TeamCard({
  team,
  editMode,
  selectedMember,
  onMemberClick,
  onChangeColor,
  isAdmin,
  analysis,
}: {
  team: any
  editMode: boolean
  selectedMember: { member: any; fromTeamId: number } | null
  onMemberClick: (member: any, teamId: number) => void
  onChangeColor: (teamId: number, newColor: string) => void
  isAdmin: boolean
  analysis?: TeamAnalysis
}) {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(true)
  const mappedColor = colorMapping[team.vest_color] || 'yellow'
  const colors = teamColors[mappedColor] || teamColors.yellow
  const isDropTarget = selectedMember && selectedMember.fromTeamId !== team.id

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

          <h3 className="text-lg font-bold truncate">{team.name}</h3>
          <span className={cn('px-2 py-0.5 text-[10px] font-bold rounded', colors.badge)}>
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
                <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-2 flex gap-1 z-20">
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
          <span>{team.members?.length || 0}명</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {team.members?.map((member: any) => {
            const isSelected = selectedMember?.member.id === member.id && selectedMember?.fromTeamId === team.id
            const isGuest = !member.player_id

            return (
              <button
                key={member.id}
                onClick={(e) => {
                  e.stopPropagation()
                  onMemberClick(member, team.id)
                }}
                disabled={!editMode}
                className={cn(
                  'px-2.5 py-1 text-sm rounded-lg transition-all',
                  editMode && 'cursor-pointer hover:scale-105 active:scale-95',
                  !editMode && 'cursor-default',
                  isSelected
                    ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                    : isGuest
                    ? 'bg-amber-200/80 dark:bg-amber-500/30 text-amber-800 dark:text-amber-300'
                    : 'bg-black/10 dark:bg-white/15'
                )}
              >
                {member.name || member.guest_name}
                {member.name === team.key_player && ' ⭐'}
              </button>
            )
          })}
        </div>
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
                      style={{ width: `${(parseFloat(analysis.avgOverall) / 10) * 100}%` }}
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
                      style={{ width: `${(parseFloat(analysis.avgAttack) / 10) * 100}%` }}
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
                      style={{ width: `${(parseFloat(analysis.avgDefense) / 10) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* AI 분석 내용 */}
              {analysis.keyPlayer && (
                <p className="text-xs">
                  <span className="text-amber-600 dark:text-amber-400">⭐</span>{' '}
                  <span className="font-medium">{analysis.keyPlayer}</span>
                  {analysis.keyPlayerReason && (
                    <span className="opacity-60"> - {analysis.keyPlayerReason}</span>
                  )}
                </p>
              )}
              {analysis.aiStrategy && (
                <p className="text-xs opacity-75">
                  <span className="text-purple-600 dark:text-purple-400">💡</span> {analysis.aiStrategy}
                </p>
              )}
              {analysis.watchOut && (
                <p className="text-xs opacity-75">
                  <span className="text-orange-600 dark:text-orange-400">⚠️</span> {analysis.watchOut}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
