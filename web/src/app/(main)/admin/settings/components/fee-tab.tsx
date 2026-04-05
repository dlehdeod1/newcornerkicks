'use client'

import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  HelpCircle,
  Check,
} from 'lucide-react'
import { clubsApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import type { SettingsTabProps } from './basic-info-tab'

export default function FeeTab({ club, token, onUpdate, onDirtyChange }: SettingsTabProps) {
  const queryClient = useQueryClient()

  const [baseAmount, setBaseAmount] = useState(0)
  const [splitEnabled, setSplitEnabled] = useState(false)
  const [splitTotal, setSplitTotal] = useState(0)
  const [splitRoundUp, setSplitRoundUp] = useState(100)
  const [rankDiffEnabled, setRankDiffEnabled] = useState(false)
  const [rankDiffAmount, setRankDiffAmount] = useState(500)
  const [feeSaving, setFeeSaving] = useState(false)
  const [feeSaved, setFeeSaved] = useState(false)

  const initialRef = useRef({ baseAmount: 0, splitEnabled: false, splitTotal: 0, splitRoundUp: 100, rankDiffEnabled: false, rankDiffAmount: 500 })

  useEffect(() => {
    if (!club) return
    const fc = club.feeConfig || {}
    const init = {
      baseAmount: fc.baseAmount ?? 0,
      splitEnabled: fc.splitEnabled ?? false,
      splitTotal: fc.splitTotal ?? 0,
      splitRoundUp: fc.splitRoundUp ?? 100,
      rankDiffEnabled: fc.rankDiffEnabled ?? false,
      rankDiffAmount: fc.rankDiffAmount ?? 500,
    }
    initialRef.current = init
    setBaseAmount(init.baseAmount)
    setSplitEnabled(init.splitEnabled)
    setSplitTotal(init.splitTotal)
    setSplitRoundUp(init.splitRoundUp)
    setRankDiffEnabled(init.rankDiffEnabled)
    setRankDiffAmount(init.rankDiffAmount)
  }, [club])

  useEffect(() => {
    if (!onDirtyChange) return
    const i = initialRef.current
    const dirty =
      baseAmount !== i.baseAmount ||
      splitEnabled !== i.splitEnabled ||
      splitTotal !== i.splitTotal ||
      splitRoundUp !== i.splitRoundUp ||
      rankDiffEnabled !== i.rankDiffEnabled ||
      rankDiffAmount !== i.rankDiffAmount
    onDirtyChange(dirty)
  }, [baseAmount, splitEnabled, splitTotal, splitRoundUp, rankDiffEnabled, rankDiffAmount, onDirtyChange])

  const handleSaveFeeConfig = async () => {
    if (!token) return
    setFeeSaving(true)
    try {
      await clubsApi.updateSettings({
        feeConfig: { baseAmount, splitEnabled, splitTotal, splitRoundUp, rankDiffEnabled, rankDiffAmount },
      }, token)
      queryClient.invalidateQueries({ queryKey: ['club-me'] })
      initialRef.current = { baseAmount, splitEnabled, splitTotal, splitRoundUp, rankDiffEnabled, rankDiffAmount }
      onDirtyChange?.(false)
      setFeeSaved(true)
      setTimeout(() => setFeeSaved(false), 2000)
      onUpdate()
    } catch (err: any) {
      alert(err.message || '저장에 실패했습니다.')
    } finally {
      setFeeSaving(false)
    }
  }

  const baseAmountFormatted = baseAmount.toLocaleString()
  const baseMinusDiff = (baseAmount - 500).toLocaleString()
  const basePlusDiff = (baseAmount + 500).toLocaleString()

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Banknote className="w-4 h-4" />
          참가비 설정
        </h3>

        {/* 기본 참가비 */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">기본 참가비</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={baseAmount}
              onChange={e => setBaseAmount(Number(e.target.value))}
              className="w-32 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
            <span className="text-sm text-slate-500">원</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">토글을 둘 다 끄면 이 금액이 모든 참가자에게 동일 적용됩니다</p>
        </div>

        {/* 총액 분할 토글 */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className="font-medium text-slate-900 dark:text-white text-sm">총액 분할</p>
            </div>
            <button
              onClick={() => setSplitEnabled(!splitEnabled)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                splitEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
              )}
            >
              <span className={cn(
                'inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm',
                splitEnabled ? 'translate-x-6' : 'translate-x-1'
              )} />
            </button>
          </div>
          {splitEnabled && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg p-3">
                <HelpCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  구장비 등 총 금액을 참가 인원으로 나눕니다. 예: 총 18만원 / 15명 = 12,000원
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">총액</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={splitTotal}
                      onChange={e => setSplitTotal(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                    <span className="text-xs text-slate-500 whitespace-nowrap">원</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">올림 단위</label>
                  <select
                    value={splitRoundUp}
                    onChange={e => setSplitRoundUp(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value={10}>10원</option>
                    <option value={100}>100원</option>
                    <option value={1000}>1,000원</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 순위별 차등 토글 */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className="font-medium text-slate-900 dark:text-white text-sm">순위별 차등</p>
            </div>
            <button
              onClick={() => setRankDiffEnabled(!rankDiffEnabled)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                rankDiffEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
              )}
            >
              <span className={cn(
                'inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm',
                rankDiffEnabled ? 'translate-x-6' : 'translate-x-1'
              )} />
            </button>
          </div>
          {rankDiffEnabled && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg p-3">
                <HelpCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  {'중간 순위를 기준으로, 높은 순위는 덜 내고 낮은 순위는 더 냅니다. '}
                  {splitEnabled
                    ? '예: 기본 12,000원 / 차등 500원 → 1위 11,500원, 2위 12,000원, 3위 12,500원'
                    : '예: 기본 ' + baseAmountFormatted + '원 / 차등 500원 → 1위 ' + baseMinusDiff + '원, 2위 ' + baseAmountFormatted + '원, 3위 ' + basePlusDiff + '원'
                  }
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">순위당 차등 금액</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={rankDiffAmount}
                    onChange={e => setRankDiffAmount(Number(e.target.value))}
                    className="w-32 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                  <span className="text-sm text-slate-500">원</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 조합 설명 */}
        {splitEnabled && rankDiffEnabled && (
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg p-3 mb-4">
            <HelpCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>총액 분할 + 순위별 차등</strong>: 총액을 인원수로 나눈 금액을 기준으로 순위별 차등이 적용됩니다.
              인원수가 달라져도 총액 기준으로 자동 계산되며, 순위에 따라 금액이 조정됩니다.
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <Button size="sm" onClick={handleSaveFeeConfig} disabled={feeSaving}>
            {feeSaved ? <><Check className="w-4 h-4" /> 저장됨</> : feeSaving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  )
}
