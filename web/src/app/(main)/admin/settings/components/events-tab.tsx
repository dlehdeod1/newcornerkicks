'use client'

import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  Check,
} from 'lucide-react'
import { clubsApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import type { SettingsTabProps } from './basic-info-tab'

export default function EventsTab({ club, token, onUpdate, onDirtyChange }: SettingsTabProps) {
  const queryClient = useQueryClient()

  const [enabledEvents, setEnabledEvents] = useState<string[]>(['GOAL', 'DEFENSE'])
  const [eventsSaving, setEventsSaving] = useState(false)
  const [eventsSaved, setEventsSaved] = useState(false)
  const [mvpToggling, setMvpToggling] = useState(false)
  const [notifToggling, setNotifToggling] = useState<string | null>(null)

  const initialRef = useRef<string[]>(['GOAL', 'DEFENSE'])

  useEffect(() => {
    if (!club) return
    const events = club.enabledEvents ?? ['GOAL', 'DEFENSE']
    initialRef.current = events
    setEnabledEvents(events)
  }, [club])

  useEffect(() => {
    if (!onDirtyChange) return
    const i = initialRef.current
    const dirty = JSON.stringify([...enabledEvents].sort()) !== JSON.stringify([...i].sort())
    onDirtyChange(dirty)
  }, [enabledEvents, onDirtyChange])

  const toggleEvent = (event: string) => {
    setEnabledEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    )
  }

  const handleSaveEvents = async () => {
    if (!token) return
    setEventsSaving(true)
    try {
      await clubsApi.updateSettings({ enabledEvents }, token)
      queryClient.invalidateQueries({ queryKey: ['club-me'] })
      initialRef.current = enabledEvents
      onDirtyChange?.(false)
      setEventsSaved(true)
      setTimeout(() => setEventsSaved(false), 2000)
      onUpdate()
    } catch (err: any) {
      alert(err.message || '저장에 실패했습니다.')
    } finally {
      setEventsSaving(false)
    }
  }

  const handleMvpToggle = async () => {
    if (!token || !club) return
    setMvpToggling(true)
    try {
      await clubsApi.updateSettings({ mvpVoteEnabled: !club.mvpVoteEnabled }, token)
      queryClient.invalidateQueries({ queryKey: ['club-me'] })
      onUpdate()
    } catch (err: any) {
      alert(err.message || '설정 변경에 실패했습니다.')
    } finally {
      setMvpToggling(false)
    }
  }

  const handleNotifToggle = async (key: string) => {
    if (!token || !club) return
    setNotifToggling(key)
    try {
      const nc = club.notificationConfig || { sessionCreated: true, sessionDayRemind: true, settlementRemind: true }
      const updated = { ...nc, [key]: !nc[key] }
      await clubsApi.updateSettings({ notificationConfig: updated }, token)
      queryClient.invalidateQueries({ queryKey: ['club-me'] })
      onUpdate()
    } catch (err: any) {
      alert(err.message || '설정 변경에 실패했습니다.')
    } finally {
      setNotifToggling(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* 기능 토글 */}
      <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
          기능 설정
        </h3>
        <div className="space-y-4">
          {[
            { key: 'mvp', label: 'MVP 투표', desc: '세션 종료 후 24시간 내 MVP 투표 진행', value: club.mvpVoteEnabled, handler: handleMvpToggle, loading: mvpToggling },
            { key: 'sessionCreated', label: '세션 생성 알림', desc: '새 세션이 생성되면 멤버에게 알림', value: club.notificationConfig?.sessionCreated ?? true, handler: () => handleNotifToggle('sessionCreated'), loading: notifToggling === 'sessionCreated' },
            { key: 'settlementRemind', label: '자동 정산 알림', desc: '세션 종료 후 정산 알림 발송', value: club.notificationConfig?.settlementRemind ?? true, handler: () => handleNotifToggle('settlementRemind'), loading: notifToggling === 'settlementRemind' },
            { key: 'sessionDayRemind', label: '경기일 리마인드', desc: '경기 당일 참석 리마인드 알림', value: club.notificationConfig?.sessionDayRemind ?? true, handler: () => handleNotifToggle('sessionDayRemind'), loading: notifToggling === 'sessionDayRemind' },
          ].map(({ key, label, desc, value, handler, loading }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
              </div>
              <button
                onClick={handler}
                disabled={!!loading}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  value ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm',
                  value ? 'translate-x-6' : 'translate-x-1'
                )} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 기록 이벤트 설정 */}
      <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          기록 이벤트
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">현황판에서 기록할 이벤트 종류를 선택하세요</p>

        {/* 공격 이벤트 */}
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">공격</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { key: 'GOAL', label: '득점', icon: '\u26BD', desc: '골 + 어시스트 기록' },
            { key: 'KEY_PASS', label: '키패스', icon: '\u26A1', desc: '결정적 패스' },
            { key: 'DRIBBLE', label: '돌파', icon: '\uD83D\uDCA8', desc: '드리블 돌파 성공' },
            { key: 'SHOT_ON', label: '유효슈팅', icon: '\uD83C\uDFAF', desc: '골대 방향 슈팅' },
            { key: 'SHOT_OFF', label: '무효슈팅', icon: '\uD83D\uDCAB', desc: '빗나간 슈팅' },
          ].map(({ key, label, icon, desc }) => {
            const active = enabledEvents.includes(key)
            return (
              <button
                key={key}
                onClick={() => toggleEvent(key)}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
                  active
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                )}
              >
                <span className="text-xl">{icon}</span>
                <div>
                  <p className={cn(
                    'text-sm font-medium',
                    active ? 'text-primary' : 'text-slate-700 dark:text-slate-300'
                  )}>{label}</p>
                  <p className="text-xs text-slate-400">{desc}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* 골키퍼 이벤트 */}
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">골키퍼</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { key: 'SAVE', label: '선방', icon: '\uD83E\uDDE4', desc: '골키퍼 세이브' },
          ].map(({ key, label, icon, desc }) => {
            const active = enabledEvents.includes(key)
            return (
              <button
                key={key}
                onClick={() => toggleEvent(key)}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
                  active
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                )}
              >
                <span className="text-xl">{icon}</span>
                <div>
                  <p className={cn(
                    'text-sm font-medium',
                    active ? 'text-primary' : 'text-slate-700 dark:text-slate-300'
                  )}>{label}</p>
                  <p className="text-xs text-slate-400">{desc}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* 수비 이벤트 */}
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">수비</p>
        <p className="text-xs text-slate-400 mb-2">간편(수비 1개로 통합) 또는 상세(태클/인터셉트/클리어런스 개별 기록) 중 선택</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'DEFENSE', label: '수비 (간편)', icon: '\uD83D\uDEE1\uFE0F', desc: '수비 기록 통합' },
            { key: 'TACKLE', label: '태클', icon: '\uD83E\uDDB6', desc: '볼 탈취 시도' },
            { key: 'INTERCEPTION', label: '인터셉트', icon: '\u270B', desc: '패스 차단' },
            { key: 'CLEARANCE', label: '클리어런스', icon: '\uD83E\uDDF9', desc: '위험 지역 걷어내기' },
          ].map(({ key, label, icon, desc }) => {
            const active = enabledEvents.includes(key)
            const isDetail = key === 'TACKLE' || key === 'INTERCEPTION' || key === 'CLEARANCE'
            const isSimple = key === 'DEFENSE'
            const hasSimple = enabledEvents.includes('DEFENSE')
            const hasDetail = enabledEvents.some(e => ['TACKLE', 'INTERCEPTION', 'CLEARANCE'].includes(e))
            const disabled = (isSimple && hasDetail) || (isDetail && hasSimple)
            return (
              <button
                key={key}
                onClick={() => !disabled && toggleEvent(key)}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
                  disabled
                    ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-700'
                    : active
                      ? 'border-primary bg-primary/5'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                )}
              >
                <span className="text-xl">{icon}</span>
                <div>
                  <p className={cn(
                    'text-sm font-medium',
                    active ? 'text-primary' : 'text-slate-700 dark:text-slate-300'
                  )}>{label}</p>
                  <p className="text-xs text-slate-400">{desc}</p>
                </div>
              </button>
            )
          })}
        </div>
        {enabledEvents.length === 0 && (
          <p className="text-xs text-red-500 mt-2">최소 1개 이상의 이벤트를 선택해야 합니다</p>
        )}
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={handleSaveEvents} disabled={eventsSaving || enabledEvents.length === 0}>
            {eventsSaved ? <><Check className="w-4 h-4" /> 저장됨</> : eventsSaving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  )
}
