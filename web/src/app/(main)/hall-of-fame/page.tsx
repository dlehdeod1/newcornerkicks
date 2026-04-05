'use client'

import { useAuthStore } from '@/stores/auth'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Trophy, Crown, Star, Target, Handshake, Shield, Award, TrendingUp, Calendar, Medal, Zap } from 'lucide-react'
import { rankingsApi } from '@/lib/api'

const categoryIcons: Record<string, any> = {
  '득점왕': Target,
  '도움왕': Handshake,
  '공격포인트왕': Zap,
  '수비왕': Shield,
  'MVP': Trophy,
  '승률왕': TrendingUp,
  '출석왕': Calendar,
}

// 색상은 브랜드 그린 단일로 통일 (메달만 gold/silver/bronze 예외)

export default function HallOfFamePage() {
  const { token } = useAuthStore()
  const { data, isLoading } = useQuery({
    queryKey: ['hall-of-fame'],
    queryFn: () => rankingsApi.hallOfFame(token ?? undefined),
  })

  const hallOfFame = data?.hallOfFame || []

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-3xl mb-6">
          <Trophy className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">
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
              <Crown className="w-5 h-5 text-muted-foreground" />
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
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                    <Star className="w-6 h-6 text-primary" />
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
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              </div>

              {/* 수상 카드 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {season.honors.map((honor: any) => {
                  const Icon = categoryIcons[honor.category] || Trophy

                  return (
                    <Link
                      key={`${season.year}-${honor.category}`}
                      href={`/players/${honor.player.id}`}
                      className="group bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                    >
                      <div className="p-6">
                        {/* 아이콘 + 메달 */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <Icon className="w-7 h-7 text-primary" />
                          </div>
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <Medal className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                          </div>
                        </div>

                        {/* 부문 */}
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                          {honor.category}
                        </p>

                        {/* 선수 이름 */}
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-primary transition-colors">
                          {honor.player.name}
                        </h3>

                        {/* 기록 */}
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-primary">
                            {typeof honor.value === 'number' && honor.value % 1 !== 0
                              ? honor.value.toFixed(1)
                              : honor.value}
                          </span>
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            {honor.category === '승률왕' ? '%' :
                             honor.category === '출석왕' ? '세션' :
                             honor.category === 'MVP' ? 'pts' :
                             honor.category === '공격포인트왕' ? 'pts' : ''}
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
    <div className="relative bg-white dark:bg-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 opacity-60 shadow-sm">
      <div className="absolute top-4 right-4">
        <span className="text-4xl font-bold text-slate-200 dark:text-slate-800">{year}</span>
      </div>
      <div className="relative">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
              <span className="text-2xl text-primary font-bold">{name.charAt(0)}</span>
            </div>
            <Crown className="absolute -top-2 -right-2 w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">{year}년 챔피언</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{name}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{mvpScore}</p>
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
          <div key={i} className="bg-white dark:bg-card rounded-3xl p-6 border border-slate-200 dark:border-border animate-pulse shadow-sm">
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
          <div key={i} className="bg-white dark:bg-card rounded-2xl p-6 border border-slate-200 dark:border-border h-32 animate-pulse shadow-sm" />
        ))}
      </div>
    </div>
  )
}
