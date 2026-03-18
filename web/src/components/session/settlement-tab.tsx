'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Coins,
  Trophy,
  Check,
  X,
  Calculator,
  ChevronDown,
  AlertCircle,
  Plus,
  Trash2,
  Banknote,
  Copy,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { settlementsApi, paymentsApi, clubsApi } from '@/lib/api'
import { cn } from '@/lib/cn'

interface Props {
  sessionId: number
  session: any
  teams: any[]
  matches: any[]
  attendance: any[]
  onRefetch: () => void
}

export function SettlementTab({ sessionId, session, teams, matches, attendance, onRefetch }: Props) {
  const { isAdmin, token } = useAuthStore()
  const queryClient = useQueryClient()
  const [showAllPayments, setShowAllPayments] = useState(false)
  const [newExpDesc, setNewExpDesc] = useState('')
  const [newExpAmount, setNewExpAmount] = useState('')
  const [addingExpense, setAddingExpense] = useState(false)
  const [editingDepositor, setEditingDepositor] = useState<number | null>(null)
  const [depositorInput, setDepositorInput] = useState('')
  const [copiedBank, setCopiedBank] = useState(false)

  // 세션 납부 상세 조회
  const { data: paymentData, isLoading } = useQuery({
    queryKey: ['session-payments', sessionId],
    queryFn: () => paymentsApi.sessionDetail(sessionId, token!),
    enabled: !!token && (session.status === 'ended' || session.status === 'completed' || session.status === 'closed'),
  })

  // 클럽 정보 (계좌번호)
  const { data: clubData } = useQuery({
    queryKey: ['club-me'],
    queryFn: () => clubsApi.me(token!),
    enabled: !!token,
  })

  const bankAccount = clubData?.club?.bankAccount

  const payments = (paymentData?.payments || []) as any[]
  const summary = paymentData?.summary || { total: 0, paid: 0, exempt: 0, unpaidAmount: 0, totalAmount: 0, paidAmount: 0, totalExpenses: 0, netRevenue: 0 }
  const expenses = (paymentData?.expenses || []) as any[]

  // 팀별 순위 계산
  const completedMatches = matches.filter((m: any) => m.status === 'completed')
  const teamStats = new Map<number, { wins: number; draws: number; losses: number; points: number }>()
  teams.forEach((team: any) => {
    teamStats.set(team.id, { wins: 0, draws: 0, losses: 0, points: 0 })
  })
  completedMatches.forEach((match: any) => {
    const t1 = teamStats.get(match.team1_id)
    const t2 = teamStats.get(match.team2_id)
    if (t1 && t2) {
      if (match.team1_score > match.team2_score) { t1.wins++; t1.points += 3; t2.losses++ }
      else if (match.team1_score < match.team2_score) { t2.wins++; t2.points += 3; t1.losses++ }
      else { t1.draws++; t2.draws++; t1.points += 1; t2.points += 1 }
    }
  })
  const rankedTeams = [...teams]
    .map((team: any) => ({ ...team, stats: teamStats.get(team.id) || { wins: 0, draws: 0, losses: 0, points: 0 } }))
    .sort((a, b) => b.stats.points - a.stats.points)

  // 납부 확인 mutation
  const paidMutation = useMutation({
    mutationFn: ({ paymentId, paid, depositorName }: { paymentId: number; paid: boolean; depositorName?: string }) =>
      paymentsApi.updatePaid(paymentId, paid, token!, depositorName),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['session-payments', sessionId] }),
  })

  // 면제 mutation
  const exemptMutation = useMutation({
    mutationFn: ({ paymentId, exempt }: { paymentId: number; exempt: boolean }) =>
      paymentsApi.updateExempt(paymentId, exempt, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['session-payments', sessionId] }),
  })

  // 비용 추가 mutation
  const addExpenseMutation = useMutation({
    mutationFn: (data: { description: string; amount: number }) =>
      paymentsApi.addExpense(sessionId, data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-payments', sessionId] })
      setNewExpDesc('')
      setNewExpAmount('')
      setAddingExpense(false)
    },
  })

  // 비용 삭제 mutation
  const deleteExpenseMutation = useMutation({
    mutationFn: (expenseId: number) =>
      paymentsApi.deleteExpense(sessionId, expenseId, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['session-payments', sessionId] }),
  })

  // 정산 완료 mutation
  const completeMutation = useMutation({
    mutationFn: () => settlementsApi.complete(sessionId, undefined, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
      onRefetch()
    },
  })

  const handleComplete = () => {
    if (!window.confirm('정산을 완료하시겠습니까?\n세션이 "완료" 상태로 전환되고 랭킹에 반영됩니다.')) return
    completeMutation.mutate()
  }

  const handlePaidToggle = (payment: any) => {
    if (payment.paid) {
      paidMutation.mutate({ paymentId: payment.id, paid: false })
    } else {
      setEditingDepositor(payment.id)
      setDepositorInput(payment.depositor_name || '')
    }
  }

  const handleConfirmPaid = (paymentId: number) => {
    paidMutation.mutate({
      paymentId,
      paid: true,
      depositorName: depositorInput || undefined,
    })
    setEditingDepositor(null)
    setDepositorInput('')
  }

  const handleCopyBank = () => {
    if (!bankAccount) return
    const text = `${bankAccount.bankName} ${bankAccount.accountNumber} (${bankAccount.holderName})`
    navigator.clipboard.writeText(text)
    setCopiedBank(true)
    setTimeout(() => setCopiedBank(false), 2000)
  }

  // 아직 정산 전이면 안내 표시
  if (!['ended', 'completed', 'closed'].includes(session.status)) {
    return (
      <div className="text-center py-12">
        <Calculator className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
        <p className="text-slate-500 dark:text-slate-400">세션이 종료되면 정산 정보가 표시됩니다.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
    )
  }

  const paidPayments = payments.filter((p: any) => p.paid === 1 && !p.exempt)
  const unpaidPayments = payments.filter((p: any) => p.paid === 0 && !p.exempt)
  const exemptPayments = payments.filter((p: any) => p.exempt === 1)
  const displayPayments = showAllPayments ? payments : unpaidPayments.concat(paidPayments.slice(0, 3))

  return (
    <div className="space-y-6">
      {/* 납부 요약 카드 */}
      <div className="bg-gradient-to-br from-emerald-100 to-teal-50 dark:from-emerald-500/20 dark:to-teal-500/10 rounded-2xl p-6 border border-emerald-200 dark:border-emerald-500/30">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-3">
          <Coins className="w-5 h-5" />
          <span className="font-medium">납부 현황</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {summary.paidAmount?.toLocaleString() ?? 0}원
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
              입금 완료 ({summary.paid}/{summary.total - summary.exempt}명)
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-500">
              {summary.unpaidAmount?.toLocaleString() ?? 0}원
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              미입금 ({summary.total - summary.exempt - summary.paid}명)
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {summary.totalAmount?.toLocaleString() ?? 0}원
            </p>
            <p className="text-xs text-slate-500 mt-0.5">총 참가비</p>
          </div>
        </div>
      </div>

      {/* 계좌 정보 */}
      {bankAccount && bankAccount.accountNumber && (
        <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Banknote className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {bankAccount.bankName} {bankAccount.accountNumber}
                </p>
                <p className="text-xs text-slate-500">{bankAccount.holderName}</p>
              </div>
            </div>
            <button
              onClick={handleCopyBank}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
            >
              {copiedBank ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedBank ? '복사됨' : '복사'}
            </button>
          </div>
        </div>
      )}

      {/* 순위 */}
      {rankedTeams.length > 0 && (
        <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              팀 순위
            </h3>
          </div>
          <div className="p-4 space-y-2">
            {rankedTeams.map((team: any, idx: number) => (
              <div
                key={team.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-xl',
                  idx === 0 ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-slate-50 dark:bg-slate-800/50'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}위`}</span>
                  <div>
                    <p className="font-medium text-sm text-slate-900 dark:text-white">{team.name}</p>
                    <p className="text-xs text-slate-500">{team.stats.wins}승 {team.stats.draws}무 {team.stats.losses}패 ({team.stats.points}점)</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 개인별 납부 내역 */}
      {payments.length > 0 && (
        <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-500" />
              납부 내역
            </h3>
            {payments.length > 5 && (
              <button
                onClick={() => setShowAllPayments(!showAllPayments)}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
              >
                {showAllPayments ? '접기' : `전체 보기 (${payments.length}명)`}
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showAllPayments && 'rotate-180')} />
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {displayPayments.map((payment: any) => (
              <div key={payment.id} className="px-6 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {payment.player_name}
                    </p>
                    {payment.team_rank && (
                      <span className="text-xs text-slate-400">{payment.team_rank}위</span>
                    )}
                    {payment.exempt === 1 && (
                      <span className="text-xs px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded">면제</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-slate-500">
                      {payment.amount?.toLocaleString()}원
                    </p>
                    {payment.depositor_name && (
                      <span className="text-xs text-blue-500">입금자: {payment.depositor_name}</span>
                    )}
                  </div>
                </div>

                {/* 입금자명 입력 모달 (인라인) */}
                {editingDepositor === payment.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={depositorInput}
                      onChange={e => setDepositorInput(e.target.value)}
                      placeholder="입금자명 (선택)"
                      className="w-24 px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleConfirmPaid(payment.id)
                        if (e.key === 'Escape') { setEditingDepositor(null); setDepositorInput('') }
                      }}
                    />
                    <button
                      onClick={() => handleConfirmPaid(payment.id)}
                      className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { setEditingDepositor(null); setDepositorInput('') }}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {isAdmin && !payment.exempt && (
                      <button
                        onClick={() => handlePaidToggle(payment)}
                        disabled={paidMutation.isPending}
                        className={cn(
                          'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                          payment.paid
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30'
                            : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/30'
                        )}
                      >
                        {payment.paid ? '입금됨' : '미입금'}
                      </button>
                    )}
                    {isAdmin && !payment.exempt && !payment.paid && (
                      <button
                        onClick={() => exemptMutation.mutate({ paymentId: payment.id, exempt: true })}
                        className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        면제
                      </button>
                    )}
                    {!isAdmin && (
                      <span className={cn(
                        'px-2 py-1 text-xs rounded-lg',
                        payment.paid
                          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                          : payment.exempt
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                      )}>
                        {payment.paid ? '입금됨' : payment.exempt ? '면제' : '미입금'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 비용 기록 */}
      <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Calculator className="w-5 h-5 text-purple-500" />
            비용 기록
          </h3>
          {isAdmin && (
            <button
              onClick={() => setAddingExpense(!addingExpense)}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              비용 추가
            </button>
          )}
        </div>

        <div className="p-4 space-y-3">
          {/* 비용 추가 폼 */}
          {addingExpense && (
            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <input
                type="text"
                value={newExpDesc}
                onChange={e => setNewExpDesc(e.target.value)}
                placeholder="설명 (예: 구장비)"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <input
                type="number"
                value={newExpAmount}
                onChange={e => setNewExpAmount(e.target.value)}
                placeholder="금액"
                className="w-28 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (!newExpDesc || !newExpAmount) return
                  addExpenseMutation.mutate({ description: newExpDesc, amount: Number(newExpAmount) })
                }}
                disabled={addExpenseMutation.isPending}
              >
                추가
              </Button>
            </div>
          )}

          {expenses.length === 0 && !addingExpense ? (
            <p className="text-center text-sm text-slate-400 py-4">기록된 비용이 없습니다</p>
          ) : (
            expenses.map((exp: any) => (
              <div key={exp.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm text-slate-900 dark:text-white">{exp.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {exp.amount?.toLocaleString()}원
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        if (confirm('이 비용을 삭제할까요?')) deleteExpenseMutation.mutate(exp.id)
                      }}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

          {/* 수입/지출 요약 */}
          {(summary.totalAmount > 0 || expenses.length > 0) && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">총 수입 (참가비)</span>
                <span className="text-slate-900 dark:text-white">{summary.totalAmount?.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">총 지출 (비용)</span>
                <span className="text-red-500">-{summary.totalExpenses?.toLocaleString() ?? 0}원</span>
              </div>
              <div className="flex justify-between text-sm font-semibold pt-1.5 border-t border-slate-100 dark:border-slate-800">
                <span className="text-slate-700 dark:text-slate-300">순수익</span>
                <span className={cn(
                  (summary.netRevenue ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                )}>
                  {(summary.netRevenue ?? 0).toLocaleString()}원
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 에러 메시지 */}
      {completeMutation.isError && (
        <div className="bg-red-50 dark:bg-red-500/10 rounded-2xl p-4 border border-red-200 dark:border-red-500/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">
            {(completeMutation.error as Error)?.message || '정산 처리 중 오류가 발생했습니다.'}
          </p>
        </div>
      )}

      {/* 정산 완료 버튼 - ended 상태에서만 표시 */}
      {isAdmin && session.status === 'ended' && (
        <div className="bg-blue-50 dark:bg-blue-500/10 rounded-2xl p-6 border border-blue-200 dark:border-blue-500/30">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="font-medium text-blue-700 dark:text-blue-400">정산 준비 완료</h4>
              <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                세션이 종료되었습니다. 정산을 완료하면 랭킹에 반영됩니다.
              </p>
            </div>
            <Button
              onClick={handleComplete}
              loading={completeMutation.isPending}
              className="shrink-0"
            >
              <Check className="w-4 h-4" />
              정산 완료
            </Button>
          </div>
        </div>
      )}

      {/* 정산 완료 상태 표시 */}
      {session.status === 'completed' && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl p-6 border border-emerald-200 dark:border-emerald-500/30 text-center">
          <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-white" />
          </div>
          <h4 className="font-semibold text-emerald-700 dark:text-emerald-400">정산 완료</h4>
          <p className="text-sm text-emerald-600 dark:text-emerald-300 mt-1">
            이 세션의 정산이 완료되어 랭킹에 반영되었습니다.
          </p>
        </div>
      )}
    </div>
  )
}
