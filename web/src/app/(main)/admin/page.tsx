'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  Users,
  Trophy,
  Bell,
  Settings,
  Plus,
  ChevronRight,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth'
import { sessionsApi, playersApi, rankingsApi } from '@/lib/api'
import { cn } from '@/lib/cn'

export default function AdminDashboardPage() {
  const router = useRouter()
  const { isAdmin, isLoggedIn } = useAuthStore()

  // 권한 체크
  if (!isLoggedIn || !isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          접근 권한이 없습니다
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          관리자만 접근할 수 있는 페이지입니다.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
        >
          홈으로 돌아가기
        </Link>
      </div>
    )
  }

  const { data: sessionsData } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionsApi.list(),
  })

  const { data: playersData } = useQuery({
    queryKey: ['players'],
    queryFn: () => playersApi.list(),
  })

  const sessions = sessionsData?.sessions || []
  const players = playersData?.players || []

  const recentSessions = sessions.slice(0, 5)
  const recruitingSessions = sessions.filter((s: any) => s.status === 'recruiting')
  const pendingLinkPlayers = players.filter((p: any) => p.link_status === 'PENDING')

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent flex items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-emerald-500" />
          관리자 대시보드
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          코너킥스 FC 운영을 한눈에 관리하세요
        </p>
      </div>

      {/* 퀵 액션 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <QuickActionCard
          icon={<Calendar className="w-6 h-6" />}
          label="새 세션 만들기"
          href="/admin/sessions/new"
          color="emerald"
        />
        <QuickActionCard
          icon={<Users className="w-6 h-6" />}
          label="선수 등록"
          href="/admin/players/new"
          color="blue"
        />
        <QuickActionCard
          icon={<Bell className="w-6 h-6" />}
          label="공지 발송"
          href="/admin/notifications"
          color="amber"
        />
        <QuickActionCard
          icon={<Trophy className="w-6 h-6" />}
          label="랭킹 새로고침"
          href="/admin/rankings"
          color="purple"
        />
      </div>

      {/* 대시보드 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 주요 통계 + 최근 세션 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 통계 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="총 선수"
              value={players.length}
              icon={<Users className="w-5 h-5" />}
              color="blue"
            />
            <StatCard
              label="총 세션"
              value={sessions.length}
              icon={<Calendar className="w-5 h-5" />}
              color="emerald"
            />
            <StatCard
              label="모집 중"
              value={recruitingSessions.length}
              icon={<Clock className="w-5 h-5" />}
              color="amber"
            />
            <StatCard
              label="연동 대기"
              value={pendingLinkPlayers.length}
              icon={<AlertCircle className="w-5 h-5" />}
              color="red"
            />
          </div>

          {/* 최근 세션 */}
          <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-500" />
                최근 세션
              </h2>
              <Link
                href="/admin/sessions"
                className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                전체 보기
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentSessions.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  아직 세션이 없습니다.
                </div>
              ) : (
                recentSessions.map((session: any) => (
                  <Link
                    key={session.id}
                    href={`/sessions/${session.id}`}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        session.status === 'recruiting'
                          ? 'bg-amber-100 dark:bg-amber-500/20'
                          : session.status === 'completed'
                          ? 'bg-emerald-100 dark:bg-emerald-500/20'
                          : 'bg-slate-100 dark:bg-slate-800'
                      )}>
                        {session.status === 'recruiting' ? (
                          <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        ) : session.status === 'completed' ? (
                          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Calendar className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {session.title || '코너킥스 정기 풋살'}
                        </p>
                        <p className="text-sm text-slate-500">{session.session_date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={session.status} />
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 오른쪽: 빠른 관리 */}
        <div className="space-y-6">
          {/* 연동 대기 선수 */}
          {pendingLinkPlayers.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-200 dark:border-amber-500/30 p-5">
              <h3 className="font-semibold text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                연동 승인 대기
              </h3>
              <div className="space-y-2">
                {pendingLinkPlayers.slice(0, 3).map((player: any) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between bg-white dark:bg-slate-900/50 p-3 rounded-xl"
                  >
                    <span className="font-medium text-slate-900 dark:text-white">
                      {player.name}
                    </span>
                    <Link
                      href={`/admin/players/${player.id}`}
                      className="text-sm text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      승인하기
                    </Link>
                  </div>
                ))}
              </div>
              {pendingLinkPlayers.length > 3 && (
                <Link
                  href="/admin/players?filter=pending"
                  className="block text-center text-sm text-amber-600 dark:text-amber-400 hover:underline mt-3"
                >
                  +{pendingLinkPlayers.length - 3}명 더 보기
                </Link>
              )}
            </div>
          )}

          {/* 관리 메뉴 */}
          <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-500" />
                관리 메뉴
              </h3>
            </div>
            <div className="p-2">
              <AdminMenuItem
                icon={<Calendar className="w-5 h-5" />}
                label="세션 관리"
                description="세션 생성, 수정, 팀 편성"
                href="/admin/sessions"
              />
              <AdminMenuItem
                icon={<Users className="w-5 h-5" />}
                label="선수 관리"
                description="선수 등록, 연동 승인"
                href="/admin/players"
              />
              <AdminMenuItem
                icon={<Trophy className="w-5 h-5" />}
                label="랭킹 관리"
                description="랭킹 새로고침, 배지 관리"
                href="/admin/rankings"
              />
              <AdminMenuItem
                icon={<Bell className="w-5 h-5" />}
                label="알림 관리"
                description="공지 발송, 알림 템플릿"
                href="/admin/notifications"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function QuickActionCard({
  icon,
  label,
  href,
  color,
}: {
  icon: React.ReactNode
  label: string
  href: string
  color: 'emerald' | 'blue' | 'amber' | 'purple'
}) {
  const colorClasses = {
    emerald: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25',
    blue: 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/25',
    amber: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/25',
    purple: 'bg-purple-500 hover:bg-purple-600 shadow-purple-500/25',
  }

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 p-4 rounded-2xl text-white shadow-lg transition-all hover:scale-[1.02]',
        colorClasses[color]
      )}
    >
      {icon}
      <span className="font-medium text-sm">{label}</span>
    </Link>
  )
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: 'blue' | 'emerald' | 'amber' | 'red'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
  }

  return (
    <div className="bg-white dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800/50">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-3', colorClasses[color])}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    recruiting: {
      label: '모집중',
      className: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
    },
    closed: {
      label: '마감',
      className: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400',
    },
    completed: {
      label: '완료',
      className: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    },
  }

  const { label, className } = config[status] || config.closed

  return (
    <span className={cn('px-2 py-1 rounded-lg text-xs font-medium', className)}>
      {label}
    </span>
  )
}

function AdminMenuItem({
  icon,
  label,
  description,
  href,
}: {
  icon: React.ReactNode
  label: string
  description: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
    >
      <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:text-emerald-500 transition-colors">
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-medium text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
          {label}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
    </Link>
  )
}
