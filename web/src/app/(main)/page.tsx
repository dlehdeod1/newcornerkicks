'use client'

import Link from 'next/link'
import { Trophy, Calendar, Users, Star, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { useQuery } from '@tanstack/react-query'
import { sessionsApi, meApi } from '@/lib/api'

export default function HomePage() {
  const { isLoggedIn, user, player, token } = useAuthStore()

  // 내 기록 조회 (로그인 + 선수 연동된 경우)
  const { data: myData, isLoading: myLoading } = useQuery({
    queryKey: ['me', 'stats', token],
    queryFn: () => meApi.getStats(token!),
    enabled: !!token && !!player?.id,
  })

  // 최근 세션 조회 (closed 또는 completed 상태)
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions', 'recent', 'highlight'],
    queryFn: async () => {
      // closed 상태 먼저 조회
      const closedSessions = await sessionsApi.list({ limit: 1, status: 'closed' })
      if (closedSessions?.sessions?.length > 0) {
        return closedSessions
      }
      // 없으면 completed 상태 조회
      return sessionsApi.list({ limit: 1, status: 'completed' })
    },
  })

  const recentSession = sessionsData?.sessions?.[0]
  const myStats = myData?.stats

  // 내 최근 기록 표시 로직
  const getMyRecordDisplay = () => {
    if (!isLoggedIn) {
      return '로그인이 필요합니다'
    }
    if (!player?.id) {
      return '선수 연동이 필요합니다'
    }
    if (myLoading) {
      return '불러오는 중...'
    }
    // 최근 세션 날짜 표시
    if (myStats?.sessionDate) {
      const date = new Date(myStats.sessionDate)
      return `${date.getMonth() + 1}/${date.getDate()} ${player?.name || ''}`
    }
    return player?.name || '내 기록'
  }

  return (
    <div className="min-h-screen">
      {/* 히어로 섹션 */}
      <section className="relative overflow-hidden">
        {/* 배경 그라데이션 */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-100/50 via-slate-50 to-teal-100/50 dark:from-emerald-900/20 dark:via-slate-900 dark:to-teal-900/20" />
        <div className="absolute inset-0">
          <div className="absolute top-20 left-1/4 w-72 h-72 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-1/4 w-72 h-72 bg-teal-500/10 dark:bg-teal-500/20 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            {/* 왼쪽: 텍스트 */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-slate-800/50 backdrop-blur rounded-full text-sm text-slate-600 dark:text-slate-300 mb-8 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                <span className="w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse" />
                매주 수요일 21:00
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight text-slate-900 dark:text-white">
                수요일의{' '}
                <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400 bg-clip-text text-transparent">
                  열정
                </span>
                을<br />
                기록하고 공유하세요
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 max-w-xl mx-auto lg:mx-0">
                매주 수요일, 풋살 경기 기록과 순위를 확인하고 팀원들과 함께 성장하세요.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  href="/sessions"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-2xl font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 active:scale-[0.98]"
                >
                  일정 확인하기
                  <ChevronRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/profile"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl font-semibold text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 transition-all shadow-sm"
                >
                  내 기록 보기
                </Link>
              </div>
            </div>

            {/* 오른쪽: 최근 기록 카드 */}
            <div className="w-full max-w-sm">
              <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-700">
                    <Users className="w-7 h-7 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">
                      {myStats?.sessionDate ? '최근 세션 기록' : '내 최근 기록'}
                    </p>
                    <p className="font-semibold text-slate-900 dark:text-white">{getMyRecordDisplay()}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    label="득점"
                    value={myStats?.goals?.toString() || '-'}
                    icon="⚽"
                    color="emerald"
                  />
                  <StatCard
                    label="도움"
                    value={myStats?.assists?.toString() || '-'}
                    icon="⚡"
                    color="blue"
                  />
                  <StatCard
                    label="수비"
                    value={myStats?.defenses?.toString() || '-'}
                    icon="🛡️"
                    color="purple"
                  />
                  <StatCard
                    label="MVP점수"
                    value={myStats?.mvpScore ? myStats.mvpScore.toFixed(1) : '-'}
                    icon="⭐"
                    color="amber"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 빠른 메뉴 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white mb-6">
          <span className="text-yellow-500">⚡</span>
          빠른 메뉴
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickMenuCard
            href="/sessions"
            icon={<Calendar className="w-6 h-6" />}
            title="경기 결과"
            description="지난 매치 기록 확인"
            color="emerald"
          />
          <QuickMenuCard
            href="/ranking"
            icon={<Trophy className="w-6 h-6" />}
            title="랭킹"
            description="시즌 순위 확인"
            color="amber"
          />
          <QuickMenuCard
            href="/abilities"
            icon={<Star className="w-6 h-6" />}
            title="능력치 평가"
            description="팀원 능력치 평가"
            color="blue"
          />
          <QuickMenuCard
            href="/hall-of-fame"
            icon={<Trophy className="w-6 h-6" />}
            title="명예의 전당"
            description="시즌 챔피언 보기"
            color="purple"
          />
        </div>
      </section>

      {/* 지난 세션 하이라이트 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <span>🕐</span>
            지난 세션 하이라이트
          </h2>
          <Link
            href="/sessions"
            className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 font-medium transition-colors"
          >
            상세 보기
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur rounded-2xl p-8 border border-slate-200 dark:border-slate-800/50 shadow-sm">
          {sessionsLoading ? (
            <p className="text-slate-500 text-center py-8">
              세션 데이터를 불러오는 중...
            </p>
          ) : recentSession ? (
            <RecentSessionHighlight session={recentSession} />
          ) : (
            <p className="text-slate-500 text-center py-8">
              완료된 세션이 없습니다.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

function RecentSessionHighlight({ session }: { session: any }) {
  // 세션 상세 정보 조회
  const { data, isLoading } = useQuery({
    queryKey: ['session', session.id, 'highlight'],
    queryFn: () => sessionsApi.get(session.id),
  })

  if (isLoading) {
    return (
      <p className="text-slate-500 text-center py-8">
        하이라이트를 불러오는 중...
      </p>
    )
  }

  const sessionData = data
  const matches = sessionData?.matches || []
  const completedMatches = matches.filter((m: any) => m.status === 'completed')

  // 득점/도움/수비 집계
  const playerStats = new Map<number, { name: string; goals: number; assists: number; defenses: number }>()

  completedMatches.forEach((match: any) => {
    const events = match.events || []
    events.forEach((event: any) => {
      if (!event.player_id || event.guest_name || event.player_is_guest) return

      if (!playerStats.has(event.player_id)) {
        playerStats.set(event.player_id, {
          name: event.player_name,
          goals: 0,
          assists: 0,
          defenses: 0,
        })
      }

      const stats = playerStats.get(event.player_id)!
      if (event.event_type === 'GOAL') {
        stats.goals++
      } else if (event.event_type === 'DEFENSE') {
        stats.defenses++
      }

      // 어시스트
      if (event.assister_id && event.event_type === 'GOAL' && !event.assister_is_guest) {
        if (!playerStats.has(event.assister_id)) {
          playerStats.set(event.assister_id, {
            name: event.assister_name,
            goals: 0,
            assists: 0,
            defenses: 0,
          })
        }
        playerStats.get(event.assister_id)!.assists++
      }
    })
  })

  const topScorer = Array.from(playerStats.values()).sort((a, b) => b.goals - a.goals)[0]
  const topAssister = Array.from(playerStats.values()).sort((a, b) => b.assists - a.assists)[0]
  const topDefender = Array.from(playerStats.values()).sort((a, b) => b.defenses - a.defenses)[0]

  const sessionDate = new Date(session.session_date)
  const formattedDate = `${sessionDate.getMonth() + 1}월 ${sessionDate.getDate()}일`

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-slate-500 mb-1">{formattedDate}</p>
          <p className="font-semibold text-slate-900 dark:text-white">
            {session.title || `제 ${session.id}회 정기 풋살`}
          </p>
        </div>
        <Link
          href={`/sessions/${session.id}`}
          className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          상세보기 →
        </Link>
      </div>

      {completedMatches.length === 0 ? (
        <p className="text-slate-500 text-center py-4">
          완료된 경기가 없습니다.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
            <p className="text-sm text-slate-500 mb-1">득점왕</p>
            <p className="font-bold text-emerald-600 dark:text-emerald-400">
              {topScorer?.name || '-'}
            </p>
            <p className="text-xs text-slate-400">{topScorer ? `${topScorer.goals}골` : '-'}</p>
          </div>
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl">
            <p className="text-sm text-slate-500 mb-1">도움왕</p>
            <p className="font-bold text-blue-600 dark:text-blue-400">
              {topAssister?.name || '-'}
            </p>
            <p className="text-xs text-slate-400">{topAssister ? `${topAssister.assists}도움` : '-'}</p>
          </div>
          <div className="text-center p-4 bg-purple-50 dark:bg-purple-500/10 rounded-xl">
            <p className="text-sm text-slate-500 mb-1">수비왕</p>
            <p className="font-bold text-purple-600 dark:text-purple-400">
              {topDefender?.name || '-'}
            </p>
            <p className="text-xs text-slate-400">{topDefender ? `${topDefender.defenses}수비` : '-'}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: string
  icon: string
  color: 'emerald' | 'blue' | 'purple' | 'amber'
}) {
  const colorClasses = {
    emerald: 'from-emerald-100 to-emerald-50 dark:from-emerald-500/20 dark:to-emerald-600/10 border-emerald-200 dark:border-emerald-500/20',
    blue: 'from-blue-100 to-blue-50 dark:from-blue-500/20 dark:to-blue-600/10 border-blue-200 dark:border-blue-500/20',
    purple: 'from-purple-100 to-purple-50 dark:from-purple-500/20 dark:to-purple-600/10 border-purple-200 dark:border-purple-500/20',
    amber: 'from-amber-100 to-amber-50 dark:from-amber-500/20 dark:to-amber-600/10 border-amber-200 dark:border-amber-500/20',
  }

  const textColors = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    amber: 'text-amber-600 dark:text-amber-400',
  }

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-2xl p-4 border`}>
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
        <span>{icon}</span>
        {label}
      </div>
      <p className={`text-2xl font-bold ${textColors[color]}`}>
        {value}
      </p>
    </div>
  )
}

function QuickMenuCard({
  href,
  icon,
  title,
  description,
  color,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
  color: 'emerald' | 'amber' | 'blue' | 'purple'
}) {
  const colorClasses = {
    emerald: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-500/20',
    amber: 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-200 dark:group-hover:bg-amber-500/20',
    blue: 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-200 dark:group-hover:bg-blue-500/20',
    purple: 'bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:bg-purple-200 dark:group-hover:bg-purple-500/20',
  }

  return (
    <Link
      href={href}
      className="group bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900/80 rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 shadow-sm"
    >
      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 transition-colors ${colorClasses[color]}`}>
        {icon}
      </div>
      <h3 className="font-semibold text-slate-900 dark:text-white mb-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{title}</h3>
      <p className="text-sm text-slate-500">{description}</p>
    </Link>
  )
}
