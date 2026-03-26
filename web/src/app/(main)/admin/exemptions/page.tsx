'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronLeft, AlertCircle, ShieldOff, Search, Check } from 'lucide-react'
import { useAuthStore, useAuthHydrated } from '@/stores/auth'
import { clubsApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'

export default function AdminExemptionsPage() {
  const hydrated = useAuthHydrated()
  const { isAdmin, isLoggedIn, token } = useAuthStore()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'exemptions'],
    queryFn: () => clubsApi.getExemptions(token!),
    enabled: !!(isLoggedIn && isAdmin && token),
  })

  const updateMutation = useMutation({
    mutationFn: ({ userId, data: body }: { userId: string; data: any }) =>
      clubsApi.updateExemption(userId, body, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'exemptions'] })
    },
    onError: (err: any) => alert(err.message || '저장 실패'),
  })

  const members: any[] = data?.members || []

  const filtered = members.filter((m: any) => {
    if (!search) return true
    const q = search.toLowerCase()
    return m.username?.toLowerCase().includes(q) || m.player_name?.toLowerCase().includes(q)
  })

  const exemptCount = members.filter((m: any) => m.session_fee_exempt || m.membership_fee_exempt).length

  if (!hydrated) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isLoggedIn || !isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">접근 권한이 없습니다</h2>
        <Link href="/" className="text-brand-green hover:underline">홈으로 돌아가기</Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-1">
        <Link href="/admin" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldOff className="w-6 h-6 text-slate-500" />
          회비 면제 관리
        </h1>
      </div>
      <p className="text-slate-500 text-sm ml-7 mb-6">특정 멤버를 세션 참가비 또는 월 회비에서 면제합니다</p>

      {/* 통계 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{members.length}</p>
          <p className="text-sm text-slate-500">전체 멤버</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-500/10 rounded-xl p-4 border border-purple-200 dark:border-purple-500/30">
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{exemptCount}</p>
          <p className="text-sm text-purple-600 dark:text-purple-400">면제 중</p>
        </div>
      </div>

      {/* 검색 */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="이름 또는 계정 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* 멤버 목록 */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">멤버가 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((member: any) => (
            <MemberExemptCard
              key={member.user_id}
              member={member}
              onUpdate={(data) => updateMutation.mutate({ userId: member.user_id, data })}
              isPending={updateMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function MemberExemptCard({
  member,
  onUpdate,
  isPending,
}: {
  member: any
  onUpdate: (data: any) => void
  isPending: boolean
}) {
  const [reason, setReason] = useState(member.exempt_reason || '')
  const [editingReason, setEditingReason] = useState(false)
  const sessionExempt = !!member.session_fee_exempt
  const membershipExempt = !!member.membership_fee_exempt
  const hasAnyExempt = sessionExempt || membershipExempt

  return (
    <div className={cn(
      'bg-white dark:bg-slate-900/50 rounded-xl p-4 border transition-colors',
      hasAnyExempt
        ? 'border-purple-200 dark:border-purple-500/30'
        : 'border-slate-200 dark:border-slate-800'
    )}>
      <div className="flex items-start justify-between gap-3">
        {/* 멤버 정보 */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
            hasAnyExempt
              ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
          )}>
            {(member.player_name || member.username || '?')[0]}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-900 dark:text-white text-sm truncate">
              {member.player_name || member.username}
            </p>
            <p className="text-xs text-slate-500 truncate">
              @{member.username} · {member.role === 'owner' ? '오너' : member.role === 'admin' ? '관리자' : '멤버'}
            </p>
          </div>
        </div>

        {/* 면제 토글 */}
        <div className="flex flex-col gap-2 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer">
            <button
              onClick={() => onUpdate({ sessionFeeExempt: !sessionExempt })}
              disabled={isPending}
              className={cn(
                'relative w-9 h-5 rounded-full transition-colors',
                sessionExempt ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-600'
              )}
            >
              <div className={cn(
                'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform',
                sessionExempt ? 'left-[18px]' : 'left-0.5'
              )} />
            </button>
            <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">참가비 면제</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <button
              onClick={() => onUpdate({ membershipFeeExempt: !membershipExempt })}
              disabled={isPending}
              className={cn(
                'relative w-9 h-5 rounded-full transition-colors',
                membershipExempt ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-600'
              )}
            >
              <div className={cn(
                'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform',
                membershipExempt ? 'left-[18px]' : 'left-0.5'
              )} />
            </button>
            <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">월회비 면제</span>
          </label>
        </div>
      </div>

      {/* 면제 사유 */}
      {hasAnyExempt && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          {editingReason ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="면제 사유 입력 (선택)"
                className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
              <Button
                size="sm"
                onClick={() => {
                  onUpdate({ exemptReason: reason.trim() || null })
                  setEditingReason(false)
                }}
                disabled={isPending}
              >
                <Check className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setEditingReason(true)}
              className="text-xs text-slate-400 hover:text-purple-500 transition-colors"
            >
              {member.exempt_reason
                ? <span className="text-purple-500 dark:text-purple-400">사유: {member.exempt_reason}</span>
                : '면제 사유 추가...'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
