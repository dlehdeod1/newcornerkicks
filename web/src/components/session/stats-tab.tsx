'use client'

import { useRef, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Trophy, Target, Shield, Award, Crown, Sparkles, Copy, Check, Download, Circle } from 'lucide-react'
import { matchesApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import html2canvas from 'html2canvas'

interface Props {
  sessionId: number
  matches: any[]
  attendance?: any[]
  sessionStatus?: string
  teams?: any[]
  sessionDate?: string
}

export function StatsTab({ sessionId, matches, attendance = [], sessionStatus = 'recruiting', teams = [], sessionDate }: Props) {
  const captureRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const { club } = useAuthStore()
  const clubName = club?.name || 'CornerKicks'

  const completedMatches = matches.filter((m: any) => m.status === 'completed')

  // 클럽 가중치 설정
  const cw = club?.mvpWeights || {}
  const wGoal = cw.GOAL ?? 2
  const wAssist = cw.ASSIST ?? 1.5
  const wDefense = cw.DEFENSE ?? 0.5
  const wSessionWin = cw.SESSION_WIN ?? 1.5

  const matchQueries = useQueries({
    queries: completedMatches.map((match: any) => ({
      queryKey: ['match', match.id],
      queryFn: () => matchesApi.get(match.id),
    })),
  })

  const isLoading = matchQueries.some((q) => q.isLoading)

  // 선수별 스탯 집계
  const playerStats = new Map<number, {
    id: number
    name: string
    goals: number
    assists: number
    defenses: number
    mvpScore: number
  }>()

  matchQueries.forEach((query) => {
    if (!query.data) return

    const events = query.data.events || []
    events.forEach((event: any) => {
      if (!event.player_id || event.guest_name || event.player_is_guest) return

      if (!playerStats.has(event.player_id)) {
        playerStats.set(event.player_id, {
          id: event.player_id,
          name: event.player_name,
          goals: 0,
          assists: 0,
          defenses: 0,
          mvpScore: 0,
        })
      }

      const stats = playerStats.get(event.player_id)!

      if (event.event_type === 'GOAL') {
        stats.goals++
        stats.mvpScore += wGoal
      } else if (event.event_type === 'DEFENSE') {
        stats.defenses++
        stats.mvpScore += wDefense
      }

      if (event.assister_id && !event.assister_is_guest && event.event_type === 'GOAL') {
        if (!playerStats.has(event.assister_id)) {
          playerStats.set(event.assister_id, {
            id: event.assister_id,
            name: event.assister_name,
            goals: 0,
            assists: 0,
            defenses: 0,
            mvpScore: 0,
          })
        }
        const assisterStats = playerStats.get(event.assister_id)!
        assisterStats.assists++
        assisterStats.mvpScore += wAssist
      }
    })
  })

  // 팀 순위 계산
  const teamStandings = new Map<number, { points: number; goalsFor: number; wins: number; draws: number; losses: number; members: number[] }>()

  teams.forEach((team: any) => {
    teamStandings.set(team.id, { points: 0, goalsFor: 0, wins: 0, draws: 0, losses: 0, members: team.members?.map((m: any) => m.player_id) || [] })
  })

  completedMatches.forEach((match: any) => {
    const team1 = teamStandings.get(match.team1_id)
    const team2 = teamStandings.get(match.team2_id)

    if (team1 && team2) {
      team1.goalsFor += match.team1_score || 0
      team2.goalsFor += match.team2_score || 0

      if (match.team1_score > match.team2_score) {
        team1.points += 3; team1.wins++; team2.losses++
      } else if (match.team1_score < match.team2_score) {
        team2.points += 3; team2.wins++; team1.losses++
      } else {
        team1.points += 1; team2.points += 1; team1.draws++; team2.draws++
      }
    }
  })

  const rankedTeams = teams
    .map((team: any) => ({
      ...team,
      standing: teamStandings.get(team.id) || { points: 0, goalsFor: 0, wins: 0, draws: 0, losses: 0, members: [] }
    }))
    .sort((a: any, b: any) => b.standing.points - a.standing.points || b.standing.goalsFor - a.standing.goalsFor)

  const winningTeamId = rankedTeams[0]?.id
  const winningTeamMembers = new Set(rankedTeams[0]?.standing?.members || [])

  // 우승팀 멤버에게 SESSION_WIN 보너스
  playerStats.forEach((stats, playerId) => {
    if (winningTeamMembers.has(playerId)) {
      stats.mvpScore += wSessionWin
    }
  })

  const sortedStats = Array.from(playerStats.values()).sort((a, b) => b.mvpScore - a.mvpScore)

  const topScorer = [...sortedStats].sort((a, b) => b.goals - a.goals)[0]
  const topAssister = [...sortedStats].sort((a, b) => b.assists - a.assists)[0]
  const topDefender = [...sortedStats].sort((a, b) => b.defenses - a.defenses)[0]
  const mvp = sortedStats[0]
  const top3Mvp = sortedStats.slice(0, 3)

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
    )
  }

  // 이미지 캡처
  const handleCaptureImage = async () => {
    if (!captureRef.current || capturing) return
    setCapturing(true)
    try {
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: '#0f172a',
        scale: 2,
        useCORS: true,
        logging: false,
      })
      const link = document.createElement('a')
      const dateStr = sessionDate ? new Date(sessionDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
      link.download = `${clubName}_결과_${dateStr}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('이미지 캡처 실패:', err)
    } finally {
      setCapturing(false)
    }
  }

  // 텍스트 복사
  const handleCopyText = async () => {
    const lines: string[] = []
    const sd = sessionDate ? new Date(sessionDate) : new Date()
    const dateStr = `${String(sd.getFullYear()).slice(2)}년 ${sd.getMonth() + 1}월 ${sd.getDate()}일`
    lines.push(`${dateStr} ${clubName} 경기결과`)
    lines.push('')
    rankedTeams.forEach((team: any) => {
      const memberNames = (team.members || []).map((m: any) => m.name || m.player_name || m.guest_name || '').filter(Boolean).join(' ')
      const s = team.standing
      lines.push(`${team.name} (${s.wins}승${s.draws}무${s.losses}패 ${s.points}점)`)
      lines.push(memberNames)
    })
    lines.push('')
    top3Mvp.forEach((p, idx) => {
      const medal = idx === 0 ? '🏆' : idx === 1 ? '🥈' : '🥉'
      const details = []
      if (p.goals > 0) details.push(`${p.goals}골`)
      if (p.assists > 0) details.push(`${p.assists}도움`)
      lines.push(`${medal} MVP${idx + 1}: ${p.name} - ${details.join(' ') || '우승팀'}`)
    })
    lines.push('')
    lines.push('오늘도 고생하셨습니다!!!')
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('복사 실패:', err)
    }
  }

  // 팀 카드 색상 (vest_color 기반)
  const vestColorStyles: Record<string, { border: string; bg: string; accent: string }> = {
    yellow: { border: 'border-yellow-400/60', bg: 'bg-yellow-500/10', accent: '#eab308' },
    orange: { border: 'border-orange-400/60', bg: 'bg-orange-500/10', accent: '#f97316' },
    white: { border: 'border-slate-400/40', bg: 'bg-slate-500/10', accent: '#94a3b8' },
    red: { border: 'border-red-400/60', bg: 'bg-red-500/10', accent: '#ef4444' },
    blue: { border: 'border-blue-400/60', bg: 'bg-blue-500/10', accent: '#3b82f6' },
    green: { border: 'border-emerald-400/60', bg: 'bg-emerald-500/10', accent: '#10b981' },
    purple: { border: 'border-purple-400/60', bg: 'bg-purple-500/10', accent: '#a855f7' },
    pink: { border: 'border-pink-400/60', bg: 'bg-pink-500/10', accent: '#ec4899' },
  }
  const defaultStyles = [
    { border: 'border-amber-400/60', bg: 'bg-amber-500/10', accent: '#fbbf24' },
    { border: 'border-slate-400/40', bg: 'bg-slate-500/10', accent: '#94a3b8' },
    { border: 'border-purple-400/40', bg: 'bg-purple-500/10', accent: '#c084fc' },
    { border: 'border-blue-400/60', bg: 'bg-blue-500/10', accent: '#3b82f6' },
    { border: 'border-emerald-400/60', bg: 'bg-emerald-500/10', accent: '#10b981' },
    { border: 'border-red-400/60', bg: 'bg-red-500/10', accent: '#ef4444' },
    { border: 'border-pink-400/60', bg: 'bg-pink-500/10', accent: '#ec4899' },
    { border: 'border-orange-400/60', bg: 'bg-orange-500/10', accent: '#f97316' },
  ]

  const formatDate = () => {
    const sd = sessionDate ? new Date(sessionDate) : new Date()
    return `${sd.getFullYear().toString().slice(2)}년 ${sd.getMonth() + 1}월 ${sd.getDate()}일`
  }

  return (
    <div className="space-y-6">
      {/* 공유 버튼 */}
      {sortedStats.length > 0 && (
        <div className="flex justify-end gap-2">
          <button
            onClick={handleCopyText}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {copied ? '복사됨!' : '텍스트 복사'}
          </button>
          <button
            onClick={handleCaptureImage}
            disabled={capturing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {capturing ? '캡처 중...' : '이미지 저장'}
          </button>
        </div>
      )}

      {/* 이미지 캡처 영역 - 공유 카드 */}
      <div ref={captureRef} className="overflow-hidden" style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1a2744 50%, #0f172a 100%)', position: 'absolute', left: '-9999px', width: '420px' }}>
        <div style={{ padding: '24px 20px' }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #10b981, #14b8a6)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Circle style={{ width: '18px', height: '18px' }} />
              </div>
              <div>
                <p style={{ color: '#ffffff', fontWeight: '700', fontSize: '15px', lineHeight: '1.2', margin: '0' }}>{clubName}</p>
                <p style={{ color: '#64748b', fontSize: '11px', lineHeight: '1.2', margin: '2px 0 0 0' }}>MATCH DAY</p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: '#ffffff', fontWeight: '600', fontSize: '13px', lineHeight: '1.2', margin: '0' }}>{formatDate()}</p>
              <p style={{ color: '#64748b', fontSize: '11px', lineHeight: '1.2', margin: '2px 0 0 0' }}>경기 결과</p>
            </div>
          </div>

          {/* 구분선 */}
          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #334155, transparent)', marginBottom: '16px' }} />

          {/* 팀 카드 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rankedTeams.map((team: any, idx: number) => {
              const colors = vestColorStyles[team.vest_color] || defaultStyles[idx] || defaultStyles[0]
              const s = team.standing
              const memberNames = (team.members || []).map((m: any) => m.name || m.player_name || m.guest_name || '').filter(Boolean)
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'

              return (
                <div key={team.id} style={{
                  border: `1px solid ${idx === 0 ? 'rgba(251,191,36,0.4)' : idx === 1 ? 'rgba(148,163,184,0.3)' : 'rgba(192,132,252,0.3)'}`,
                  background: idx === 0 ? 'rgba(251,191,36,0.08)' : idx === 1 ? 'rgba(148,163,184,0.06)' : 'rgba(192,132,252,0.06)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  ...(idx === 0 ? { boxShadow: '0 0 20px rgba(251,191,36,0.1)' } : {}),
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px', lineHeight: '1' }}>{medal}</span>
                      <span style={{ color: '#ffffff', fontWeight: '700', fontSize: '14px', lineHeight: '1.2' }}>{team.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ color: '#94a3b8', fontSize: '11px', lineHeight: '1' }}>{s.wins}승 {s.draws}무 {s.losses}패</span>
                      <span style={{ color: colors.accent, fontWeight: '800', fontSize: '18px', lineHeight: '1' }}>{s.points}</span>
                      <span style={{ color: '#64748b', fontSize: '10px', lineHeight: '1' }}>점</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}>
                    {memberNames.map((name: string, i: number) => (
                      <span key={i} style={{ color: '#94a3b8', fontSize: '11px', lineHeight: '1.4' }}>{name}</span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* MVP 상위 3명 */}
          {top3Mvp.length > 0 && (
            <div style={{ marginTop: '14px', background: 'rgba(30,41,59,0.7)', borderRadius: '12px', padding: '12px 14px', border: '1px solid rgba(51,65,85,0.5)' }}>
              <p style={{ color: '#94a3b8', fontSize: '10px', fontWeight: '600', letterSpacing: '1px', marginBottom: '8px', lineHeight: '1' }}>MVP</p>
              {top3Mvp.map((p, idx) => {
                const medal = idx === 0 ? '🏆' : idx === 1 ? '🥈' : '🥉'
                const details = []
                if (p.goals > 0) details.push(`${p.goals}골`)
                if (p.assists > 0) details.push(`${p.assists}도움`)
                if (p.defenses > 0) details.push(`${p.defenses}수비`)
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: idx > 0 ? '4px' : '0' }}>
                    <span style={{ fontSize: '14px', lineHeight: '1' }}>{medal}</span>
                    <span style={{ fontWeight: '700', fontSize: '13px', color: idx === 0 ? '#fbbf24' : '#cbd5e1', lineHeight: '1.2' }}>
                      {p.name}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '11px', lineHeight: '1.2' }}>
                      {p.mvpScore.toFixed(1)}점 {details.length > 0 ? `(${details.join(' ')})` : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* 푸터 */}
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, #334155)' }} />
            <span style={{ color: '#475569', fontSize: '10px', letterSpacing: '0.5px', lineHeight: '1' }}>#{clubName.replace(/\s/g, '')} #경기결과</span>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, #334155, transparent)' }} />
          </div>
        </div>
      </div>

      {/* 하이라이트 + 테이블 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <HighlightCard
              icon={<Award className="w-6 h-6 text-yellow-500 dark:text-yellow-400" />}
              title="MVP"
              player={mvp?.name}
              value={mvp ? `${mvp.mvpScore.toFixed(1)}점` : '-'}
              color="yellow"
            />
            <HighlightCard
              icon={<Target className="w-6 h-6 text-green-500 dark:text-green-400" />}
              title="득점왕"
              player={topScorer?.name}
              value={topScorer ? `${topScorer.goals}골` : '-'}
              color="green"
            />
            <HighlightCard
              icon={<Trophy className="w-6 h-6 text-blue-500 dark:text-blue-400" />}
              title="도움왕"
              player={topAssister?.name}
              value={topAssister ? `${topAssister.assists}도움` : '-'}
              color="blue"
            />
            <HighlightCard
              icon={<Shield className="w-6 h-6 text-purple-500 dark:text-purple-400" />}
              title="수비왕"
              player={topDefender?.name}
              value={topDefender ? `${topDefender.defenses}수비` : '-'}
              color="purple"
            />
          </div>

          <div className="bg-white dark:bg-card-elevated rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white">세션 기록</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">선수</th>
                    <th className="px-4 py-3 text-center">골</th>
                    <th className="px-4 py-3 text-center">도움</th>
                    <th className="px-4 py-3 text-center">수비</th>
                    <th className="px-4 py-3 text-center">MVP점수</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStats.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                        완료된 경기가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    sortedStats.map((player, idx) => (
                      <tr key={player.id} className="border-b border-slate-100 dark:border-slate-700/50">
                        <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white max-w-[120px] truncate">{player.name}</td>
                        <td className="px-4 py-3 text-center text-green-600 dark:text-green-400">{player.goals}</td>
                        <td className="px-4 py-3 text-center text-blue-600 dark:text-blue-400">{player.assists}</td>
                        <td className="px-4 py-3 text-center text-purple-600 dark:text-purple-400">{player.defenses}</td>
                        <td className="px-4 py-3 text-center font-semibold text-yellow-600 dark:text-yellow-400">
                          {player.mvpScore.toFixed(1)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* MVP 점수 사이드바 */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-500/10 dark:to-yellow-500/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <Trophy className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                    오늘의 MVP
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {(() => {
                      const weights = club?.mvpWeights || {}
                      const enabled = new Set(club?.enabledEvents || [])
                      const labels: Record<string, string> = {
                        GOAL: '골', ASSIST: '어시', SESSION_WIN: '우승',
                        DEFENSE: '수비', TACKLE: '태클', INTERCEPTION: '인터셉트',
                        CLEARANCE: '클리어', SAVE: '세이브', KEY_PASS: '키패스',
                        DRIBBLE: '드리블', SHOT_ON: '유효슈팅', SHOT_OFF: '슈팅',
                      }
                      const parts: string[] = []
                      const order = ['GOAL', 'ASSIST', 'SESSION_WIN', 'DEFENSE', 'TACKLE', 'INTERCEPTION', 'CLEARANCE', 'SAVE', 'KEY_PASS', 'DRIBBLE', 'SHOT_ON', 'SHOT_OFF']
                      const defaults: Record<string, number> = {
                        GOAL: 2.0, ASSIST: 1.5, SESSION_WIN: 1.5, DEFENSE: 0.5,
                        TACKLE: 0.6, INTERCEPTION: 0.6, CLEARANCE: 0.6, SAVE: 0.8,
                        KEY_PASS: 0.7, DRIBBLE: 0.5, SHOT_ON: 0.4, SHOT_OFF: 0.1,
                      }
                      for (const key of order) {
                        if (key === 'ASSIST' || key === 'SESSION_WIN' || enabled.has(key)) {
                          const w = weights[key] ?? defaults[key] ?? 0
                          if (w > 0) parts.push(`${labels[key]}${w}점`)
                        }
                      }
                      return parts.join(' ') || '골2점 어시1.5점 우승3점'
                    })()}
                  </p>
                </div>
              </div>
            </div>

            {mvp ? (
              <div className="p-4">
                <div className="relative bg-gradient-to-br from-amber-100 via-yellow-50 to-amber-100 dark:from-amber-500/20 dark:via-yellow-500/10 dark:to-amber-500/20 rounded-xl p-4 text-center overflow-hidden">
                  <Sparkles className="absolute top-2 right-2 w-4 h-4 text-amber-400 animate-pulse" />
                  <div className="relative inline-block mb-2">
                    <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-xl shadow-amber-500/30">
                      <span className="text-xl text-white font-bold">
                        {mvp.name?.charAt(0)}
                      </span>
                    </div>
                    <Crown className="absolute -top-2 -right-2 w-6 h-6 text-amber-500" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                    {mvp.name}
                  </h4>
                  <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                    {mvp.mvpScore.toFixed(1)}점
                  </p>
                  <div className="flex justify-center gap-3 mt-2 text-xs text-slate-500">
                    {mvp.goals > 0 && <span className="text-green-600">{mvp.goals}골</span>}
                    {mvp.assists > 0 && <span className="text-blue-600">{mvp.assists}도움</span>}
                    {mvp.defenses > 0 && <span className="text-purple-600">{mvp.defenses}수비</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">
                경기 기록이 없습니다
              </div>
            )}

            {sortedStats.length > 1 && (
              <div className="px-4 pb-4">
                <div className="space-y-1.5">
                  {sortedStats.slice(1, 5).map((player, index) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-card-elevated rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                          {index + 2}
                        </span>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {player.name}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                        {player.mvpScore.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function HighlightCard({
  icon,
  title,
  player,
  value,
  color,
}: {
  icon: React.ReactNode
  title: string
  player?: string
  value: string
  color: 'yellow' | 'green' | 'blue' | 'purple'
}) {
  const colors = {
    yellow: 'bg-yellow-100 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20',
    green: 'bg-green-100 dark:bg-green-500/10 border-green-200 dark:border-green-500/20',
    blue: 'bg-blue-100 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
    purple: 'bg-purple-100 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20',
  }

  return (
    <div className={`rounded-xl p-4 border shadow-sm overflow-hidden ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2 min-w-0">
        <span className="shrink-0">{icon}</span>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{title}</span>
      </div>
      <p className="text-lg font-bold text-slate-900 dark:text-white truncate">{player || '-'}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white truncate">{value}</p>
    </div>
  )
}
