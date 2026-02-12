'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { X, Wand2, Users, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { playersApi } from '@/lib/api'
import { cn } from '@/lib/cn'

interface Props {
  sessionId: number
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

interface ParsedTeam {
  name: string
  color: 'yellow' | 'orange' | 'white'
  members: { name: string; playerId: number | null; isGuest: boolean }[]
}

// 조끼색 매핑
const colorKeywords: Record<string, 'yellow' | 'orange' | 'white'> = {
  '노란': 'yellow',
  '노랑': 'yellow',
  '황색': 'yellow',
  '주황': 'orange',
  '오렌지': 'orange',
  '빨간': 'orange', // 빨간조끼 -> 주황으로 매핑 (실제 조끼가 주황일 수 있음)
  '빨강': 'orange',
  '흰': 'white',
  '흰색': 'white',
  '하얀': 'white',
  '하양': 'white',
  '백색': 'white',
}

const teamColors = {
  yellow: { bg: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-300', name: '노랑', emoji: '🟡' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-300', name: '주황', emoji: '🟠' },
  white: { bg: 'bg-slate-100 dark:bg-slate-700/50', text: 'text-slate-700 dark:text-slate-300', name: '하양', emoji: '⚪' },
}

export function TeamParserModal({ sessionId, isOpen, onClose, onSave }: Props) {
  const { token } = useAuthStore()
  const [text, setText] = useState('')
  const [parsedTeams, setParsedTeams] = useState<ParsedTeam[]>([])
  const [isParsed, setIsParsed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 전체 선수 목록 조회
  const { data: playersData } = useQuery({
    queryKey: ['players'],
    queryFn: () => playersApi.list(),
    enabled: isOpen,
  })

  const players = playersData?.players || []

  // 선수 이름으로 ID 찾기
  const findPlayer = (name: string) => {
    const normalizedName = name.trim()
    return players.find((p: any) =>
      p.name === normalizedName ||
      p.nickname === normalizedName
    )
  }

  // 카카오톡 텍스트 파싱
  const parseText = () => {
    setError(null)
    const lines = text.trim().split('\n')
    const teams: ParsedTeam[] = []
    let currentTeam: ParsedTeam | null = null

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // 팀 헤더 감지 (예: "상상팀 흰색조끼", "호규팀 노란조끼")
      const teamMatch = trimmed.match(/^(.+?팀)\s*(.+?조끼)?/i)
      if (teamMatch) {
        // 이전 팀 저장
        if (currentTeam && currentTeam.members.length > 0) {
          teams.push(currentTeam)
        }

        // 팀 이름
        const teamName = teamMatch[1]

        // 조끼색 파싱
        let color: 'yellow' | 'orange' | 'white' = 'yellow'
        const colorPart = teamMatch[2] || ''

        for (const [keyword, colorValue] of Object.entries(colorKeywords)) {
          if (colorPart.includes(keyword)) {
            color = colorValue
            break
          }
        }

        currentTeam = { name: teamName, color, members: [] }
        continue
      }

      // 멤버 라인 (팀 헤더 다음 줄)
      if (currentTeam) {
        // 공백으로 분리된 이름들
        const names = trimmed.split(/\s+/).filter(n => {
          // 숫자만 있거나, 조끼, 명 등 키워드 제외
          if (/^\d+$/.test(n)) return false
          if (/^\d+명$/.test(n)) return false
          if (n.includes('조끼')) return false
          if (n.length < 2) return false
          return true
        })

        for (const name of names) {
          const player = findPlayer(name)
          currentTeam.members.push({
            name,
            playerId: player?.id || null,
            isGuest: !player,
          })
        }
      }
    }

    // 마지막 팀 저장
    if (currentTeam && currentTeam.members.length > 0) {
      teams.push(currentTeam)
    }

    if (teams.length === 0) {
      setError('팀 정보를 찾을 수 없습니다. 형식을 확인해주세요.\n예: "상상팀 흰색조끼\\n상엽 상훈 민호"')
      return
    }

    setParsedTeams(teams)
    setIsParsed(true)
  }

  // 팀 저장
  const saveMutation = useMutation({
    mutationFn: async () => {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

      // 팀 생성 요청
      const response = await fetch(`${API_URL}/sessions/${sessionId}/teams/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ teams: parsedTeams }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '팀 생성에 실패했습니다.')
      }

      return response.json()
    },
    onSuccess: () => {
      onSave()
      handleClose()
    },
    onError: (error: Error) => {
      setError(error.message)
    },
  })

  const handleClose = () => {
    setText('')
    setParsedTeams([])
    setIsParsed(false)
    setError(null)
    onClose()
  }

  // 팀 색상 변경
  const changeTeamColor = (index: number, newColor: 'yellow' | 'orange' | 'white') => {
    setParsedTeams(prev => prev.map((team, i) =>
      i === index ? { ...team, color: newColor } : team
    ))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col mx-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-500" />
            카카오톡 팀 구성 파싱
          </h2>
          <button onClick={handleClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6">
          {!isParsed ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  카카오톡 메시지 붙여넣기
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`예시:
상상팀 흰색조끼
상엽 상훈 민호 효범 익현 동영

호규팀 노란조끼
호규 주현 용호 성호 준호 준호

훈락팀 빨간조끼
훈락 반석 호재 요셉 세준 세준`}
                  className="w-full h-64 px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none font-mono text-sm"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-100 dark:bg-red-500/10 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="whitespace-pre-line">{error}</span>
                </div>
              )}

              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 text-sm text-slate-600 dark:text-slate-400">
                <p className="font-medium mb-2">💡 파싱 팁</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>팀 이름은 "OO팀" 형식으로 작성</li>
                  <li>조끼색: 노란/주황/빨간/흰색 등 자동 인식</li>
                  <li>멤버는 공백으로 구분</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                파싱 결과를 확인하고 저장하세요. 조끼색을 클릭하면 변경할 수 있습니다.
              </p>

              {parsedTeams.map((team, index) => (
                <div
                  key={index}
                  className={cn(
                    'rounded-xl p-4 border-2',
                    teamColors[team.color].bg,
                    'border-current'
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={cn('font-bold flex items-center gap-2', teamColors[team.color].text)}>
                      {teamColors[team.color].emoji} {team.name}
                      <span className="text-sm font-normal">({team.members.length}명)</span>
                    </h3>

                    {/* 조끼색 선택 */}
                    <div className="flex gap-1">
                      {(Object.keys(teamColors) as Array<'yellow' | 'orange' | 'white'>).map(color => (
                        <button
                          key={color}
                          onClick={() => changeTeamColor(index, color)}
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center text-lg transition-all',
                            team.color === color
                              ? 'ring-2 ring-offset-2 ring-blue-500 scale-110'
                              : 'opacity-50 hover:opacity-100'
                          )}
                        >
                          {teamColors[color].emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {team.members.map((member, mIndex) => (
                      <span
                        key={mIndex}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-sm',
                          member.isGuest
                            ? 'bg-amber-200/80 dark:bg-amber-500/30 text-amber-800 dark:text-amber-300'
                            : 'bg-white/80 dark:bg-slate-800/80 text-slate-800 dark:text-white'
                        )}
                      >
                        {member.name}
                        {member.isGuest && ' (용병)'}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-100 dark:bg-red-500/10 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
          {!isParsed ? (
            <>
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                취소
              </Button>
              <Button className="flex-1" onClick={parseText} disabled={!text.trim()}>
                <Wand2 className="w-4 h-4 mr-1.5" />
                파싱하기
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="flex-1" onClick={() => setIsParsed(false)}>
                다시 입력
              </Button>
              <Button
                className="flex-1"
                onClick={() => saveMutation.mutate()}
                loading={saveMutation.isPending}
              >
                <Check className="w-4 h-4 mr-1.5" />
                팀 생성하기
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
