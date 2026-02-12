'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Trophy, Crown, Star, Target, Handshake, Shield, Award, TrendingUp, Calendar, Medal } from 'lucide-react'
import { rankingsApi } from '@/lib/api'
import { cn } from '@/lib/cn'

const categoryIcons: Record<string, any> = {
  '득점왕': Target,
  '도움왕': Handshake,
  '수비왕': Shield,
  'MVP': Trophy,
  '승률왕': TrendingUp,
  '출석왕': Calendar,
}

const categoryColors: Record<string, string> = {
  '득점왕': 'from-red-500 to-orange-500',
  '도움왕': 'from-blue-500 to-cyan-500',
  '수비왕': 'from-green-500 to-emerald-500',
  'MVP': 'from-amber-500 to-yellow-500',
  '승률왕': 'from-purple-500 to-pink-500',
  '출석왕': 'from-teal-500 to-green-500',
}

export default function HallOfFamePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['hall-of-fame'],
    queryFn: () => rankingsApi.hallOfFame(),
  })

  const hallOfFame = data?.hallOfFame || []

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-3xl mb-6 shadow-lg shadow-amber-500/30">
          <Trophy className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 dark:from-amber-300 dark:via-yellow-300 dark:to-amber-300 bg-clip-text text-transparent mb-3">
          명예의 전당
        </h1>
        <p className="text-slate-500">코너킥스의 역대 챔피언과 기록을 확인하세요</p>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : hallOfFame.length === 0 ? (
        <>
          <div className="text-center py-16">
            <Trophy className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400 mb-2">
              아직 등록된 기록이 없습니다.
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              시즌이 완료되고 25세션 이상 참석한 선수가 있으면 표시됩니다.
            </p>
          </div>

          {/* 데모 데이터 */}
          <section className="mt-12">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500 dark:text-amber-400" />
              예시 챔피언 (데모)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <DemoChampionCard year={2025} name="이동헌" mvpScore={42.5} />
              <DemoChampionCard year={2024} name="김선수" mvpScore={38.0} />
              <DemoChampionCard year={2023} name="박에이스" mvpScore={45.5} />
            </div>
          </section>
        </>
      ) : (
        <div className="space-y-16">
          {hallOfFame.map((season: any) => (
            <div key={season.year}>
              {/* 시즌 헤더 */}
              <div className="flex items-center gap-4 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-700 dark:to-slate-800 rounded-xl flex items-center justify-center shadow-lg">
                    <Star className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                      {season.year} 시즌
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {season.honors.length}개 부문 수상
                    </p>
                  </div>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-slate-200 dark:from-slate-700 to-transparent" />
              </div>

              {/* 수상 카드 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {season.honors.map((honor: any) => {
                  const Icon = categoryIcons[honor.category] || Trophy
                  const gradient = categoryColors[honor.category] || 'from-slate-500 to-slate-600'

                  return (
                    <Link
                      key={`${season.year}-${honor.category}`}
                      href={`/players/${honor.player.id}`}
                      className="group relative overflow-hidden bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                    >
                      {/* 배경 그라데이션 */}
                      <div className={cn(
                        'absolute inset-0 opacity-5 dark:opacity-10 bg-gradient-to-br',
                        gradient
                      )} />

                      {/* 메달 표시 */}
                      <div className="absolute top-4 right-4">
                        <div className={cn(
                          'w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center shadow-lg',
                          gradient
                        )}>
                          <Medal className="w-5 h-5 text-white" />
                        </div>
                      </div>

                      <div className="relative p-6">
                        {/* 아이콘 */}
                        <div className={cn(
                          'w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center mb-4 shadow-lg',
                          gradient
                        )}>
                          <Icon className="w-7 h-7 text-white" />
                        </div>

                        {/* 부문 */}
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                          {honor.icon} {honor.category}
                        </p>

                        {/* 선수 이름 */}
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {honor.player.name}
                        </h3>

                        {/* 기록 */}
                        <div className="flex items-baseline gap-1">
                          <span className={cn(
                            'text-3xl font-black bg-gradient-to-r bg-clip-text text-transparent',
                            gradient
                          )}>
                            {typeof honor.value === 'number' && honor.value % 1 !== 0
                              ? honor.value.toFixed(1)
                              : honor.value}
                          </span>
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            {honor.category === '승률왕' ? '%' :
                             honor.category === '출석왕' ? '세션' :
                             honor.category === 'MVP' ? 'pts' : ''}
                          </span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DemoChampionCard({ year, name, mvpScore }: { year: number; name: string; mvpScore: number }) {
  return (
    <div className="relative group bg-gradient-to-br from-amber-100 via-white to-white dark:from-amber-500/10 dark:via-slate-900/80 dark:to-slate-900/80 rounded-3xl p-6 border border-amber-200 dark:border-amber-500/30 overflow-hidden opacity-60 shadow-sm">
      <div className="absolute top-4 right-4">
        <span className="text-4xl font-bold text-amber-500/20">{year}</span>
      </div>
      <div className="relative">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30">
              <span className="text-2xl text-white font-bold">{name.charAt(0)}</span>
            </div>
            <Crown className="absolute -top-2 -right-2 w-6 h-6 text-amber-500 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">{year}년 챔피언</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{name}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-amber-200 dark:border-amber-500/20">
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{mvpScore}</p>
            <p className="text-xs text-slate-500">MVP 점수</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">15</p>
            <p className="text-xs text-slate-500">득점</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">8</p>
            <p className="text-xs text-slate-500">도움</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-slate-900/50 rounded-3xl p-6 border border-slate-200 dark:border-slate-800/50 animate-pulse shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
              <div>
                <div className="w-24 h-4 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
                <div className="w-32 h-6 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50 h-32 animate-pulse shadow-sm" />
        ))}
      </div>
    </div>
  )
}
