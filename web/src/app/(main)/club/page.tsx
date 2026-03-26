'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Users,
  Copy,
  Check,
  Settings,
  Crown,
  Calendar,
  Trophy,
  ChevronRight,
  AlertCircle,
  Zap,
  Target,
  Handshake,
  Shield,
  Star,
  Gamepad2,
  TrendingUp,
  MessageSquare,
  Bell,
} from 'lucide-react'
import { useAuthStore, useAuthHydrated } from '@/stores/auth'
import { clubsApi, rankingsApi, subscriptionsApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import Image from 'next/image'

export default function ClubPage() {
  const router = useRouter()
  const hydrated = useAuthHydrated()
  const { isLoggedIn, club: storeClub, player, token, isAdmin } = useAuthStore()
  const [copied, setCopied] = useState(false)
  const [subInfo, setSubInfo] = useState<any>(null)
  const currentYear = new Date().getFullYear()

  const { data, isLoading } = useQuery({
    queryKey: ['club-me'],
    queryFn: () => clubsApi.me(token!),
    enabled: !!token && isLoggedIn,
  })

  const { data: rankingsData } = useQuery({
    queryKey: ['rankings', currentYear],
    queryFn: () => rankingsApi.get(currentYear, token ?? undefined),
    enabled: !!player?.id,
  })

  const { data: membersData } = useQuery({
    queryKey: ['club-members'],
    queryFn: () => clubsApi.members(token!),
    enabled: !!token && isLoggedIn,
  })

  useEffect(() => {
    if (token) {
      subscriptionsApi.me(token).then((d: any) => setSubInfo(d)).catch(() => {})
    }
  }, [token])

  const rankings = rankingsData?.data?.rankings || []
  const sortedRankings = [...rankings].sort((a: any, b: any) => (b.mvpCount || 0) - (a.mvpCount || 0))
  const playerRank = player ? sortedRankings.findIndex((p: any) => p.id === player.id) + 1 : null
  const playerStats = player ? rankings.find((p: any) => p.id === player.id) : null

  const club = data?.club ?? null
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cornerkicks-api.conerkicks.workers.dev'

  const rawMembers: Array<{ user_id: string; username: string; name: string; role: string; photo_url?: string | null; player_id?: number | null }> = membersData?.members || []
  const sortedMembers = [...rawMembers].sort((a, b) => {
    const order = { owner: 0, admin: 1, member: 2 }
    return (order[a.role as keyof typeof order] ?? 2) - (order[b.role as keyof typeof order] ?? 2)
  })

  if (!hydrated) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

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
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
          <div className="bg-gradient-to-br from-primary to-teal-600 rounded-2xl p-6 text-white shadow-lg shadow-primary/20">
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
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-2xl overflow-hidden">
                {club.logoUrl ? (
                  <Image src={`${process.env.NEXT_PUBLIC_API_URL}${club.logoUrl}`} alt="클럽 로고" width={56} height={56} className="object-cover w-full h-full" />
                ) : (
                  '⚽'
                )}
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
                    ? 'bg-primary/10 text-primary'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-primary/5 hover:text-primary'
                )}
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                {copied ? '복사됨' : '복사'}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
              이 코드를 공유하면 누구든 이 클럽에 가입할 수 있어요
            </p>
          </div>

          {/* 내 시즌 스탯 */}
          {player && (
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  {currentYear}년 시즌 스탯
                </h3>
                {playerRank ? (
                  <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full text-xs font-medium">
                    MVP {playerRank}위
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MiniStatCard icon={<Star className="w-4 h-4" />} label="MVP" value={`${playerStats?.mvpCount || 0}회`} color="emerald" />
                <MiniStatCard icon={<Target className="w-4 h-4" />} label="득점" value={playerStats?.goals || 0} color="amber" />
                <MiniStatCard icon={<Handshake className="w-4 h-4" />} label="도움" value={playerStats?.assists || 0} color="blue" />
                <MiniStatCard icon={<Shield className="w-4 h-4" />} label="수비" value={playerStats?.defenses || 0} color="purple" />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                    <Gamepad2 className="w-3.5 h-3.5" />
                    <span className="text-xs">경기</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{playerStats?.games || 0}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                    <Trophy className="w-3.5 h-3.5" />
                    <span className="text-xs">우승</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{playerStats?.sessionWins || 0}회</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Link
                  href={`/ranking/${player.id}`}
                  className="text-sm text-primary hover:text-primary-hover font-medium"
                >
                  상세 기록 보기 →
                </Link>
              </div>
            </div>
          )}

          {/* 구독 플랜 */}
          <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" />
              플랜
            </h3>
            {club.isPro ? (
              <div className="flex items-center justify-between">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-primary/20 to-teal-500/20 text-primary rounded-full text-sm font-medium border border-primary/30">
                    <Zap className="w-3.5 h-3.5" />
                    {club.planType === 'developer' ? 'Developer' : 'PRO'}
                  </span>
                  {subInfo?.subscription && club.planType !== 'developer' && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {subInfo.subscription.billingCycle === 'yearly' ? '연간' : '월간'} · 만료: {new Date(subInfo.subscription.expiresAt * 1000).toLocaleDateString('ko-KR')}
                    </p>
                  )}
                </div>
                {club.planType !== 'developer' && (
                  <Link href="/upgrade" className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">관리 →</Link>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <span className="inline-flex px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full text-sm font-medium">FREE</span>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">AI 팀 편성 등 프리미엄 기능을 사용해보세요</p>
                </div>
                <Link href="/upgrade" className="ml-4 flex-shrink-0 px-4 py-2 bg-gradient-to-r from-primary to-teal-600 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity">
                  업그레이드
                </Link>
              </div>
            )}
          </div>

          {/* 멤버 목록 */}
          <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                멤버
              </h3>
              {sortedMembers.length > 0 && (
                <span className="ml-auto text-xs text-slate-400">{sortedMembers.length}명</span>
              )}
            </div>
            <div className="space-y-2">
              {sortedMembers.map((member) => {
                const content = (
                  <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {member.photo_url ? (
                        <Image
                          src={`${API_BASE}${member.photo_url}`}
                          alt={member.name}
                          width={40}
                          height={40}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-primary">
                          {member.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{member.name}</p>
                      <p className="text-xs text-slate-500 truncate">@{member.username}</p>
                    </div>
                    {member.role === 'owner' && (
                      <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 font-medium">
                        👑 오너
                      </span>
                    )}
                    {member.role === 'admin' && (
                      <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 font-medium">
                        🛡️ 관리자
                      </span>
                    )}
                  </div>
                )
                return member.player_id ? (
                  <Link key={member.user_id} href={`/players/${member.player_id}`}>
                    {content}
                  </Link>
                ) : (
                  <div key={member.user_id}>{content}</div>
                )
              })}
              {sortedMembers.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">멤버 정보를 불러오는 중...</p>
              )}
            </div>
          </div>

          {/* 바로가기 메뉴 */}
          <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-white">바로가기</h3>
            </div>
            <div className="p-2">
              <ClubMenuItem
                icon={<Bell className="w-5 h-5" />}
                label="공지사항"
                description="클럽 및 시스템 공지"
                href="/announcements"
                color="purple"
              />
              <ClubMenuItem
                icon={<MessageSquare className="w-5 h-5" />}
                label="게시판"
                description="클럽 내 커뮤니티"
                href="/board"
                color="emerald"
              />
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
                  description="로고, 초대코드, MVP 투표, 클럽 정보 관리"
                  href="/admin/settings"
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
    emerald: 'bg-primary/10 text-primary',
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

function MiniStatCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode; label: string; value: string | number; color: 'emerald' | 'amber' | 'blue' | 'purple'
}) {
  const colorClasses = {
    emerald: 'bg-primary/10 text-primary border-primary/20',
    amber: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
    blue: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
    purple: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30',
  }
  return (
    <div className={cn('rounded-xl p-3 border', colorClasses[color])}>
      <div className="flex items-center gap-1.5 mb-0.5">{icon}<span className="text-xs">{label}</span></div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}
