'use client'

import { useState } from 'react'
import { Users, Wand2, Pencil, MessageSquare, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { sessionsApi } from '@/lib/api'
import { AttendanceEditorModal } from './attendance-editor-modal'
import { TeamParserModal } from './team-parser-modal'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Props {
  session: any
  attendance: any[]
  teams: any[]
  onRefetch: () => void
}

export function OverviewTab({ session, attendance, teams, onRefetch }: Props) {
  const { isAdmin, token, club } = useAuthStore()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isParserOpen, setIsParserOpen] = useState(false)

  const hasTeams = teams && teams.length > 0
  const isPro = club?.isPro ?? false
  const aiRemaining = 3 - (session.ai_team_count || 0)

  const buildAttendees = () =>
    attendance.map((a: any) => ({
      playerId: a.player_id ?? null,
      name: a.display_name || a.name || a.guest_name,
      guestName: a.guest_name || null,
      isGuest: !a.player_id,
    }))

  const handleCreateTeams = async () => {
    if (!window.confirm('팀을 자동 편성하시겠습니까?')) return

    setLoading(true)
    try {
      const result = await sessionsApi.createTeams(session.id, { attendees: buildAttendees(), useAI: false }, token!)
      if (result?.limitReached) {
        toast.error(result.message || 'AI 편성 한도에 도달했습니다.')
        return
      }
      if (result?.locked) {
        router.push('/upgrade')
        return
      }
      toast.success('팀이 편성되었습니다.')
      onRefetch()
    } catch (err: any) {
      toast.error(err.message || '팀 편성에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTeamsAI = async () => {
    if (aiRemaining <= 0) {
      toast.error('이번 달 AI 팀 편성 횟수를 모두 사용했습니다.')
      return
    }
    if (!window.confirm(`AI로 팀을 편성하시겠습니까? (잔여 ${aiRemaining}회)`)) return

    setAiLoading(true)
    try {
      const result = await sessionsApi.createTeams(session.id, { attendees: buildAttendees(), useAI: true }, token!)
      if (result?.limitReached) {
        toast.error(result.message || 'AI 편성 한도에 도달했습니다.')
        return
      }
      if (result?.locked) {
        router.push('/upgrade')
        return
      }
      toast.success('AI 팀이 편성되었습니다.')
      onRefetch()
    } catch (err: any) {
      toast.error(err.message || 'AI 팀 편성에 실패했습니다.')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 관리자 컨트롤 패널 */}
      {isAdmin && !hasTeams && (
        <div className="bg-purple-100 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-medium text-purple-700 dark:text-purple-400">팀 편성하기</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                카카오톡 메시지를 붙여넣거나, AI 자동 편성을 이용하세요.
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto flex-wrap">
              <Button
                variant="outline"
                onClick={() => setIsParserOpen(true)}
                className="flex-1 sm:flex-none"
              >
                <MessageSquare className="w-4 h-4 mr-1.5" />
                카톡 파싱
              </Button>
              {attendance.length > 0 && (
                <>
                  <Button
                    onClick={handleCreateTeams}
                    loading={loading}
                    className="flex-1 sm:flex-none bg-primary hover:bg-primary-hover text-white"
                  >
                    <Wand2 className="w-4 h-4 mr-1.5" />
                    팀 편성
                  </Button>
                  {isPro && (
                    <Button
                      onClick={handleCreateTeamsAI}
                      loading={aiLoading}
                      disabled={aiRemaining <= 0}
                      className="flex-1 sm:flex-none bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4 mr-1.5" />
                      AI 팀 편성 ({aiRemaining}회)
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 참석자 명단 */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            <h3 className="font-semibold text-slate-900 dark:text-white">참석자 ({attendance.length}명)</h3>
          </div>
          {isAdmin && !hasTeams && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditorOpen(true)}
            >
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              수정
            </Button>
          )}
        </div>

        {attendance.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              아직 참석자가 없습니다.
            </p>
            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => setIsEditorOpen(true)}
              >
                <Users className="w-4 h-4 mr-2" />
                참석자 추가하기
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {attendance.map((a: any) => (
              <div
                key={a.id}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-lg text-sm text-slate-700 dark:text-white"
              >
                {a.display_name || a.name || a.nickname || a.guest_name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 참석자 수정 모달 */}
      <AttendanceEditorModal
        sessionId={session.id}
        currentAttendance={attendance}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={onRefetch}
      />

      {/* 카카오톡 파싱 모달 */}
      <TeamParserModal
        sessionId={session.id}
        isOpen={isParserOpen}
        onClose={() => setIsParserOpen(false)}
        onSave={onRefetch}
      />

      {/* 세션 정보 */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">세션 정보</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">참가비</p>
            <p className="text-lg font-medium text-slate-900 dark:text-white">
              {session.base_fee?.toLocaleString() || '10,000'}원
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">상금 풀</p>
            <p className="text-lg font-medium text-slate-900 dark:text-white">
              {session.pot_total?.toLocaleString() || '120,000'}원
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
