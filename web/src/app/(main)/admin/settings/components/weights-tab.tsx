'use client'

import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  Check,
} from 'lucide-react'
import { clubsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import type { SettingsTabProps } from './basic-info-tab'

const DEFAULT_WEIGHTS: Record<string, number> = {
  GOAL: 2, ASSIST: 1.5, DEFENSE: 0.5,
  TACKLE: 0.3, INTERCEPTION: 0.3, CLEARANCE: 0.3,
  SAVE: 0.5, KEY_PASS: 0.5, DRIBBLE: 0.3,
  SHOT_ON: 0.2, SHOT_OFF: 0.1, SESSION_WIN: 1.5,
}

export default function WeightsTab({ club, token, onUpdate, onDirtyChange }: SettingsTabProps) {
  const queryClient = useQueryClient()

  const [mvpWeights, setMvpWeights] = useState<Record<string, number>>(DEFAULT_WEIGHTS)
  const [weightsSaving, setWeightsSaving] = useState(false)
  const [weightsSaved, setWeightsSaved] = useState(false)

  const initialRef = useRef<Record<string, number>>(DEFAULT_WEIGHTS)

  const enabledEvents: string[] = club?.enabledEvents ?? ['GOAL', 'DEFENSE']

  useEffect(() => {
    if (!club) return
    const w = club.mvpWeights ?? DEFAULT_WEIGHTS
    initialRef.current = w
    setMvpWeights(w)
  }, [club])

  useEffect(() => {
    if (!onDirtyChange) return
    const i = initialRef.current
    const dirty = JSON.stringify(mvpWeights) !== JSON.stringify(i)
    onDirtyChange(dirty)
  }, [mvpWeights, onDirtyChange])

  const handleSaveWeights = async () => {
    if (!token) return
    setWeightsSaving(true)
    try {
      await clubsApi.updateSettings({ mvpWeights }, token)
      queryClient.invalidateQueries({ queryKey: ['club-me'] })
      initialRef.current = { ...mvpWeights }
      onDirtyChange?.(false)
      setWeightsSaved(true)
      setTimeout(() => setWeightsSaved(false), 2000)
      onUpdate()
    } catch (err: any) {
      alert(err.message || '저장에 실패했습니다.')
    } finally {
      setWeightsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          평점 가중치
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">각 이벤트별 평점 반영 비율을 설정하세요</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { key: 'GOAL', label: '\u26BD 골', always: true },
            { key: 'ASSIST', label: '\uD83C\uDD70\uFE0F 어시스트', always: true },
            { key: 'DEFENSE', label: '\uD83D\uDEE1\uFE0F 수비' },
            { key: 'TACKLE', label: '\uD83E\uDDB6 태클' },
            { key: 'INTERCEPTION', label: '\u270B 인터셉트' },
            { key: 'CLEARANCE', label: '\uD83E\uDDF9 클리어런스' },
            { key: 'SAVE', label: '\uD83E\uDDE4 선방' },
            { key: 'KEY_PASS', label: '\u26A1 키패스' },
            { key: 'DRIBBLE', label: '\uD83D\uDCA8 돌파' },
            { key: 'SHOT_ON', label: '\uD83C\uDFAF 유효슈팅' },
            { key: 'SHOT_OFF', label: '\uD83D\uDCAB 무효슈팅' },
            { key: 'SESSION_WIN', label: '\uD83C\uDFC6 세션 승리', always: true },
          ].filter(w => w.always || enabledEvents.includes(w.key)).map(w => (
            <div key={w.key} className="flex flex-col gap-1 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">{w.label}</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={mvpWeights[w.key] ?? 0}
                onChange={e => setMvpWeights({ ...mvpWeights, [w.key]: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={handleSaveWeights} disabled={weightsSaving}>
            {weightsSaved ? <><Check className="w-4 h-4" /> 저장됨</> : weightsSaving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  )
}
