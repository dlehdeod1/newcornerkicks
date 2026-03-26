'use client'

export const runtime = 'edge'

import { use, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, Star, Target, Shield, Zap, Footprints, User, Edit3, Save, X, Users } from 'lucide-react'
import { playersApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'

export default function AbilityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { isLoggedIn, token, user } = useAuthStore()
  const queryClient = useQueryClient()
  const [isRating, setIsRating] = useState(false)
  const [ratings, setRatings] = useState<Record<string, number>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['player', id],
    queryFn: () => playersApi.get(Number(id)),
  })

  const rateMutation = useMutation({
    mutationFn: (ratingData: any) => playersApi.rate(Number(id), ratingData, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player', id] })
      queryClient.invalidateQueries({ queryKey: ['players'] })
      setIsRating(false)
      setRatings({})
    },
  })

  const player = data?.player
  const existingRatings = data?.ratings || []
  const myRating = existingRatings.find((r: any) => r.rater_user_id === user?.id)

  const handleStartRating = () => {
    const initialRatings = myRating || player
    setRatings({
      shooting: initialRatings?.shooting || 50,
      offball_run: initialRatings?.offball_run || 50,
      ball_keeping: initialRatings?.ball_keeping || 50,
      passing: initialRatings?.passing || 50,
      linkup: initialRatings?.linkup || 50,
      intercept: initialRatings?.intercept || 50,
      marking: initialRatings?.marking || 50,
      stamina: initialRatings?.stamina || 50,
      speed: initialRatings?.speed || 50,
      physical: initialRatings?.physical || 50,
    })
    setIsRating(true)
  }

  const handleSaveRating = () => {
    // API가 camelCase를 기대하므로 변환
    rateMutation.mutate({
      shooting: ratings.shooting,
      offballRun: ratings.offball_run,
      ballKeeping: ratings.ball_keeping,
      passing: ratings.passing,
      linkup: ratings.linkup,
      intercept: ratings.intercept,
      marking: ratings.marking,
      stamina: ratings.stamina,
      speed: ratings.speed,
      physical: ratings.physical,
    })
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-32 mb-8" />
          <div className="bg-white dark:bg-slate-900/50 rounded-3xl p-8 border border-slate-200 dark:border-slate-800/50">
            <div className="flex items-center gap-6 mb-8">
              <div className="w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
              <div>
                <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-48 mb-2" />
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-32" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-slate-400 dark:text-slate-600" />
          </div>
          <p className="text-slate-500 mb-4">선수를 찾을 수 없습니다.</p>
          <Link href="/abilities" className="text-primary hover:text-primary-hover">
            능력치 목록으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  const overall = calculateOverall(player)
  const attackStats = calculateAttack(player)
  const creativityStats = calculateCreativity(player)
  const defenseStats = calculateDefense(player)
  const physicalStats = calculatePhysical(player)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 뒤로가기 */}
      <Link
        href="/abilities"
        className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        능력치 목록
      </Link>

      {/* 프로필 카드 */}
      <div className="bg-white dark:bg-slate-900/50 backdrop-blur rounded-3xl p-8 border border-slate-200 dark:border-slate-800/50 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row items-start gap-6">
          {/* 프로필 이미지 */}
          <div className="w-28 h-28 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 rounded-2xl flex items-center justify-center border border-slate-300 dark:border-slate-700 shadow-xl">
            {player.photo_url ? (
              <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover rounded-2xl" />
            ) : (
              <span className="text-5xl text-slate-600 dark:text-slate-300">{player.name.charAt(0)}</span>
            )}
          </div>

          {/* 정보 */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{player.name}</h1>
              {player.nickname && (
                <span className="text-lg text-slate-500">({player.nickname})</span>
              )}
            </div>

            {/* 종합 능력치 + 4분류 */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-500/20 dark:to-amber-600/10 rounded-2xl px-6 py-4 border border-amber-200 dark:border-amber-500/20">
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 mb-1">
                  <Star className="w-4 h-4" />
                  종합 능력치
                </div>
                <p className="text-4xl font-bold text-slate-900 dark:text-white">{overall.toFixed(1)}</p>
              </div>

              <div className="flex gap-2">
                <StatBadge label="공격" value={attackStats} color="red" />
                <StatBadge label="창의" value={creativityStats} color="amber" />
                <StatBadge label="수비" value={defenseStats} color="blue" />
                <StatBadge label="피지컬" value={physicalStats} color="emerald" />
              </div>
            </div>
          </div>

          {/* 평가 버튼 */}
          {isLoggedIn && !isRating && (
            <Button
              variant="outline"
              onClick={handleStartRating}
              className="self-start"
            >
              <Edit3 className="w-4 h-4" />
              {myRating ? '평가 수정' : '평가하기'}
            </Button>
          )}
        </div>
      </div>

      {/* 평가 모드 배너 */}
      {isRating && (
        <div className="bg-primary/5 rounded-2xl p-5 border border-primary/20 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-primary flex items-center gap-2 mb-1">
                <Edit3 className="w-5 h-5" />
                능력치 평가 모드
              </h3>
              <p className="text-sm text-primary">
                슬라이더를 움직여 1~10 사이로 평가해주세요
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setIsRating(false); setRatings({}) }}
              >
                <X className="w-4 h-4" />
                취소
              </Button>
              <Button
                size="sm"
                onClick={handleSaveRating}
                loading={rateMutation.isPending}
              >
                <Save className="w-4 h-4" />
                저장
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 능력치 상세 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 공격 */}
        <StatSection
          icon={<Target className="w-5 h-5" />}
          title="공격"
          color="red"
          stats={[
            { key: 'shooting', label: '슈팅', value: isRating ? ratings.shooting : player.shooting || 5 },
            { key: 'offball_run', label: '오프더볼', value: isRating ? ratings.offball_run : player.offball_run || 5 },
            { key: 'ball_keeping', label: '볼키핑', value: isRating ? ratings.ball_keeping : player.ball_keeping || 5 },
          ]}
          isEditing={isRating}
          onStatChange={(key, value) => setRatings({ ...ratings, [key]: value })}
        />

        {/* 창의성 */}
        <StatSection
          icon={<Zap className="w-5 h-5" />}
          title="창의성"
          color="amber"
          stats={[
            { key: 'passing', label: '패스', value: isRating ? ratings.passing : player.passing || 5 },
            { key: 'linkup', label: '연계 플레이', value: isRating ? ratings.linkup : player.linkup || 5 },
          ]}
          isEditing={isRating}
          onStatChange={(key, value) => setRatings({ ...ratings, [key]: value })}
        />

        {/* 수비 */}
        <StatSection
          icon={<Shield className="w-5 h-5" />}
          title="수비"
          color="blue"
          stats={[
            { key: 'intercept', label: '인터셉트', value: isRating ? ratings.intercept : player.intercept || 5 },
            { key: 'marking', label: '마킹', value: isRating ? ratings.marking : player.marking || 5 },
          ]}
          isEditing={isRating}
          onStatChange={(key, value) => setRatings({ ...ratings, [key]: value })}
        />

        {/* 피지컬 */}
        <StatSection
          icon={<Footprints className="w-5 h-5" />}
          title="피지컬"
          color="emerald"
          stats={[
            { key: 'stamina', label: '스태미나', value: isRating ? ratings.stamina : player.stamina || 5 },
            { key: 'speed', label: '스피드', value: isRating ? ratings.speed : player.speed || 5 },
            { key: 'physical', label: '피지컬', value: isRating ? ratings.physical : player.physical || 5 },
          ]}
          isEditing={isRating}
          onStatChange={(key, value) => setRatings({ ...ratings, [key]: value })}
        />
      </div>

      {/* 평가 통계 */}
      {existingRatings.length > 0 && (
        <div className="mt-6 bg-white dark:bg-slate-900/50 backdrop-blur rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50 shadow-sm">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            평가 통계
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">평가자 수</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{existingRatings.length}명</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">평균 종합</p>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                {(existingRatings.reduce((sum: number, r: any) => sum + getRatingOverall(r), 0) / existingRatings.length).toFixed(1)}점
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">최고 평가</p>
              <p className="text-xl font-bold text-primary">
                {Math.max(...existingRatings.map((r: any) => getRatingOverall(r))).toFixed(1)}점
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">최저 평가</p>
              <p className="text-xl font-bold text-slate-600 dark:text-slate-400">
                {Math.min(...existingRatings.map((r: any) => getRatingOverall(r))).toFixed(1)}점
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 레이더 차트 */}
      <div className="mt-6 bg-white dark:bg-slate-900/50 backdrop-blur rounded-3xl p-8 border border-slate-200 dark:border-slate-800/50 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500 dark:text-amber-400" />
          능력치 분포
        </h2>
        <RadarChart player={player} />
      </div>
    </div>
  )
}

function StatBadge({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'red' | 'amber' | 'blue' | 'emerald'
}) {
  const colorClasses = {
    red: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30',
    amber: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
    blue: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
    emerald: 'bg-primary/10 text-primary border-primary/20',
  }

  return (
    <div className={cn('px-3 py-2 rounded-xl border text-center', colorClasses[color])}>
      <p className="text-lg font-bold">{value.toFixed(1)}</p>
      <p className="text-[10px] opacity-70">{label}</p>
    </div>
  )
}

function StatSection({
  icon,
  title,
  color,
  stats,
  isEditing = false,
  onStatChange,
}: {
  icon: React.ReactNode
  title: string
  color: 'red' | 'amber' | 'blue' | 'emerald'
  stats: { key: string; label: string; value: number }[]
  isEditing?: boolean
  onStatChange?: (key: string, value: number) => void
}) {
  const titleColors = {
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600 dark:text-amber-400',
    blue: 'text-blue-600 dark:text-blue-400',
    emerald: 'text-primary',
  }

  const barColors = {
    red: 'bg-red-500',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    emerald: 'bg-primary',
  }

  const sliderThumbColors = {
    red: '[&::-webkit-slider-thumb]:bg-red-500',
    amber: '[&::-webkit-slider-thumb]:bg-amber-500',
    blue: '[&::-webkit-slider-thumb]:bg-blue-500',
    emerald: '[&::-webkit-slider-thumb]:bg-primary',
  }

  return (
    <div className="bg-white dark:bg-slate-900/50 backdrop-blur rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50 shadow-sm">
      <h3 className={cn('text-sm font-medium flex items-center gap-2 mb-4', titleColors[color])}>
        {icon}
        {title}
      </h3>
      <div className="space-y-4">
        {stats.map((stat) => (
          <div key={stat.key}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</span>
              <span className={cn('font-bold text-lg', titleColors[color])}>{stat.value?.toFixed(0) || '50'}</span>
            </div>
            {isEditing ? (
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={stat.value || 50}
                onChange={(e) => onStatChange?.(stat.key, parseInt(e.target.value))}
                className={cn(
                  'w-full h-2 rounded-full appearance-none cursor-pointer',
                  'bg-slate-200 dark:bg-slate-700',
                  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer',
                  sliderThumbColors[color]
                )}
              />
            ) : (
              <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', barColors[color])}
                  style={{ width: `${stat.value || 50}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// 0~100점 기준
const DEFAULT_STAT = 50

function calculateOverall(player: any): number {
  const stats = [
    player.shooting || DEFAULT_STAT,
    player.offball_run || DEFAULT_STAT,
    player.ball_keeping || DEFAULT_STAT,
    player.passing || DEFAULT_STAT,
    player.linkup || DEFAULT_STAT,
    player.intercept || DEFAULT_STAT,
    player.marking || DEFAULT_STAT,
    player.stamina || DEFAULT_STAT,
    player.speed || DEFAULT_STAT,
    player.physical || DEFAULT_STAT,
  ]
  return stats.reduce((a, b) => a + b, 0) / stats.length
}

function calculateAttack(player: any): number {
  return ((player.shooting || DEFAULT_STAT) + (player.offball_run || DEFAULT_STAT) + (player.ball_keeping || DEFAULT_STAT)) / 3
}

function calculateCreativity(player: any): number {
  return ((player.passing || DEFAULT_STAT) + (player.linkup || DEFAULT_STAT)) / 2
}

function calculateDefense(player: any): number {
  return ((player.intercept || DEFAULT_STAT) + (player.marking || DEFAULT_STAT)) / 2
}

function calculatePhysical(player: any): number {
  return ((player.stamina || DEFAULT_STAT) + (player.speed || DEFAULT_STAT) + (player.physical || DEFAULT_STAT)) / 3
}

const RADAR_STATS = [
  { key: 'shooting', label: '슈팅', color: '#ef4444' },
  { key: 'offball_run', label: '오프더볼', color: '#f97316' },
  { key: 'ball_keeping', label: '볼키핑', color: '#f59e0b' },
  { key: 'passing', label: '패스', color: '#eab308' },
  { key: 'linkup', label: '연계', color: '#84cc16' },
  { key: 'intercept', label: '인터셉트', color: '#22c55e' },
  { key: 'marking', label: '마킹', color: '#06b6d4' },
  { key: 'stamina', label: '체력', color: '#3b82f6' },
  { key: 'speed', label: '스피드', color: '#8b5cf6' },
  { key: 'physical', label: '피지컬', color: '#a855f7' },
]

function RadarChart({ player }: { player: any }) {
  const cx = 160
  const cy = 160
  const maxR = 120
  const levels = 4
  const count = RADAR_STATS.length

  const angleStep = (2 * Math.PI) / count
  const startAngle = -Math.PI / 2

  const getPoint = (index: number, value: number) => {
    const angle = startAngle + index * angleStep
    const r = (value / 100) * maxR
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  }

  const getLabelPoint = (index: number) => {
    const angle = startAngle + index * angleStep
    const r = maxR + 28
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  }

  // 격자 다각형
  const gridPolygons = Array.from({ length: levels }, (_, lvl) => {
    const r = ((lvl + 1) / levels) * maxR
    return RADAR_STATS.map((_, i) => {
      const angle = startAngle + i * angleStep
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
    }).join(' ')
  })

  // 축선
  const axisLines = RADAR_STATS.map((_, i) => {
    const angle = startAngle + i * angleStep
    return { x2: cx + maxR * Math.cos(angle), y2: cy + maxR * Math.sin(angle) }
  })

  // 데이터 다각형
  const dataPoints = RADAR_STATS.map((stat, i) => {
    const value = player[stat.key] || DEFAULT_STAT
    const pt = getPoint(i, value)
    return `${pt.x},${pt.y}`
  }).join(' ')

  return (
    <div className="flex justify-center">
      <svg viewBox="0 0 320 320" className="w-full max-w-[400px]">
        {/* 격자 */}
        {gridPolygons.map((points, i) => (
          <polygon
            key={i}
            points={points}
            fill="none"
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-700"
            strokeWidth={i === levels - 1 ? 1.5 : 0.8}
          />
        ))}

        {/* 축선 */}
        {axisLines.map((line, i) => (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={line.x2} y2={line.y2}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-700"
            strokeWidth={0.8}
          />
        ))}

        {/* 데이터 영역 */}
        <polygon
          points={dataPoints}
          fill="rgba(16, 185, 129, 0.2)"
          stroke="#10b981"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* 데이터 점 */}
        {RADAR_STATS.map((stat, i) => {
          const value = player[stat.key] || DEFAULT_STAT
          const pt = getPoint(i, value)
          return (
            <circle key={i} cx={pt.x} cy={pt.y} r={3.5} fill="#10b981" stroke="white" strokeWidth={1.5} />
          )
        })}

        {/* 라벨 */}
        {RADAR_STATS.map((stat, i) => {
          const lp = getLabelPoint(i)
          const value = player[stat.key] || DEFAULT_STAT
          return (
            <text
              key={i}
              x={lp.x}
              y={lp.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-slate-600 dark:fill-slate-400"
              fontSize={10}
              fontWeight={500}
            >
              <tspan x={lp.x} dy="-0.4em">{stat.label}</tspan>
              <tspan x={lp.x} dy="1.2em" fontWeight={700} fontSize={11} className="fill-slate-800 dark:fill-slate-200">{value}</tspan>
            </text>
          )
        })}
      </svg>
    </div>
  )
}

// overall이 null인 경우 각 항목 평균으로 계산
function getRatingOverall(rating: any): number {
  if (rating.overall != null) return rating.overall

  const stats = [
    rating.shooting,
    rating.offball_run,
    rating.ball_keeping,
    rating.passing,
    rating.linkup,
    rating.intercept,
    rating.marking,
    rating.stamina,
    rating.speed,
    rating.physical,
  ].filter((v) => v != null && v > 0)

  if (stats.length === 0) return 0
  return stats.reduce((a, b) => a + b, 0) / stats.length
}
