'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Users,
  Copy,
  Check,
  Settings,
  Crown,
  Shield,
  RefreshCw,
  Calendar,
  Trophy,
  ChevronRight,
  AlertCircle,
  Zap,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { clubsApi } from '@/lib/api'
import { cn } from '@/lib/cn'

export default function ClubPage() {
  const router = useRouter()
  const { isLoggedIn, club: storeClub, token, isAdmin, setClub } = useAuthStore()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['club-me'],
    queryFn: () => clubsApi.me(token!),
    enabled: !!token && isLoggedIn,
  })

  const club = data?.club ?? null

  if (!isLoggedIn) {
    router.push('/login')
    return null
  }

  const handleCopyInviteCode = async () => {
    if (!club?.inviteCode) return
    await navigator.clipboard.writeText(club.inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerateCode = async () => {
    if (!confirm('초대 코드를 새로 발급하면 기존 코드는 사용할 수 없게 됩니다. 계속할까요?')) return
    setRegenerating(true)
    try {
      const res = await clubsApi.regenerateInviteCode(token!)
      queryClient.invalidateQueries({ queryKey: ['club-me'] })
      if (storeClub) setClub({ ...storeClub, inviteCode: res.inviteCode })
    } catch (e: any) {
      alert(e.message || '실패했습니다.')
    } finally {
      setRegenerating(false)
    }
  }

  const roleLabel = (role: string) => {
    if (role === 'owner') return '오너'
    if (role === 'admin') return '관리자'
    return '멤버'
  }

  const roleColor = (role: string) => {
    if (role === 'owner') return 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
    if (role === 'admin') return 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
    return 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">내 클럽</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">클럽 정보와 초대 코드를 확인하세요</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !club ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">소속 클럽이 없습니다</h2>
          <p className="text-slate-500 mb-6">초대 코드를 받아 클럽에 가입하거나, 새 클럽을 만드세요.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 클럽 헤더 카드 */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-500/20">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {club.isPro ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">
                      <Zap className="w-3 h-3" />
                      {club.planType === 'developer' ? 'Developer' : 'PRO'}
                    </span>
                  ) : (
                    <span className="inline-flex px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">
                      FREE
                    </span>
                  )}
                  <span className={cn(
                    'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                    club.myRole === 'owner'
                      ? 'bg-white/30'
                      : club.myRole === 'admin'
                      ? 'bg-white/20'
                      : 'bg-white/10'
                  )}>
                    {roleLabel(club.myRole)}
                  </span>
                </div>
                <h2 className="text-2xl font-bold">{club.name}</h2>
                {club.description && (
                  <p className="text-white/80 text-sm mt-1">{club.description}</p>
                )}
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                ⚽
              </div>
            </div>

            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/20 text-sm text-white/80">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                멤버 {club.memberCount}명
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                시즌 {club.seasonStartMonth}월 시작
              </span>
            </div>
          </div>

          {/* 초대 코드 카드 */}
          <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
              초대 코드
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-50 dark:bg-slate-800/80 rounded-xl px-5 py-4 border border-slate-200 dark:border-slate-700">
                <span className="text-2xl font-bold tracking-[0.25em] text-slate-900 dark:text-white font-mono">
                  {club.inviteCode}
                </span>
              </div>
              <button
                onClick={handleCopyInviteCode}
                className={cn(
                  'flex items-center gap-2 px-4 py-4 rounded-xl font-medium text-sm transition-all',
                  copied
                    ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400'
                )}
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                {copied ? '복사됨' : '복사'}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
              이 코드를 공유하면 누구든 이 클럽에 가입할 수 있어요
            </p>
            {isAdmin && (
              <button
                onClick={handleRegenerateCode}
                disabled={regenerating}
                className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', regenerating && 'animate-spin')} />
                코드 재발급
              </button>
            )}
          </div>

          {/* 바로가기 메뉴 */}
          <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-white">바로가기</h3>
            </div>
            <div className="p-2">
              <ClubMenuItem
                icon={<Users className="w-5 h-5" />}
                label="선수 목록"
                description="클럽 소속 선수 확인"
                href="/ranking"
                color="blue"
              />
              <ClubMenuItem
                icon={<Calendar className="w-5 h-5" />}
                label="세션 일정"
                description="경기 일정과 출석"
                href="/sessions"
                color="emerald"
              />
              <ClubMenuItem
                icon={<Trophy className="w-5 h-5" />}
                label="랭킹"
                description="이번 시즌 순위"
                href="/ranking"
                color="amber"
              />
              {isAdmin && (
                <ClubMenuItem
                  icon={<Settings className="w-5 h-5" />}
                  label="클럽 설정"
                  description="회비, 기록 항목, 클럽 정보 관리"
                  href="/admin"
                  color="purple"
                />
              )}
              {!club.isPro && (
                <ClubMenuItem
                  icon={<Crown className="w-5 h-5" />}
                  label="PRO 업그레이드"
                  description="AI 팀 편성, 다중 관리자 등 프리미엄 기능"
                  href="/upgrade"
                  color="emerald"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ClubMenuItem({
  icon,
  label,
  description,
  href,
  color,
}: {
  icon: React.ReactNode
  label: string
  description: string
  href: string
  color: 'blue' | 'emerald' | 'amber' | 'purple'
}) {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
    purple: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
    >
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', colorClasses[color])}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 dark:text-white">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 flex-shrink-0 transition-colors" />
    </Link>
  )
}
