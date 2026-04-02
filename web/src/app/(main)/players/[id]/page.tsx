'use client'

export const runtime = 'edge'

import { use, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, Star, Target, Shield, Zap, Activity, User, Lock, Heart, Handshake, Flame, Trophy, Circle, Calendar } from 'lucide-react'
import { playersApi, meApi, preferencesApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import { PlayerRadarChart } from '@/components/ui/radar-chart'
import { useAuthStore } from '@/stores/auth'
import { useQueryClient } from '@tanstack/react-query'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cornerkicks-api.conerkicks.workers.dev'

export default function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { token, club } = useAuthStore()
  const isPro = club?.isPro ?? false

  const [chemistry, setChemistry] = useState<any>(null)
  const [streaks, setStreaks] = useState<any>(null)
  const [isFav, setIsFav] = useState(false)
  const [favLoading, setFavLoading] = useState(false)
  const [prefCount, setPrefCount] = useState(0)
  const queryClient = useQueryClient()

  // 선호 선수 여부 확인
  useEffect(() => {
    if (!token) return
    meApi.getProfileSummary(token).then((res: any) => {
      const prefs = res?.preferences || []
      setPrefCount(prefs.length)
      setIsFav(prefs.some((p: any) => p.id === Number(id)))
    }).catch(() => {})
  }, [token, id])

  const toggleFav = async () => {
    if (!token || favLoading) return
    setFavLoading(true)
    try {
      if (isFav) {
        await preferencesApi.remove(Number(id), token)
        setIsFav(false)
        setPrefCount(c => c - 1)
      } else {
        if (prefCount >= 3) {
          alert('선호 선수는 최대 3명까지 등록 가능합니다.')
          return
        }
        await preferencesApi.add(Number(id), token)
        setIsFav(true)
        setPrefCount(c => c + 1)
      }
      queryClient.invalidateQueries({ queryKey: ['profile-summary'] })
    } catch (err: any) {
      alert(err.message || '오류가 발생했습니다.')
    } finally {
      setFavLoading(false)
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['player', id],
    queryFn: () => playersApi.get(Number(id)),
  })

  const player = data?.player

  useEffect(() => {
    if (!player || !token) return

    playersApi.chemistry(player.id, token)
      .then((res: any) => setChemistry(res))
      .catch(() => {})

    playersApi.streaks(player.id, token)
      .then((res: any) => setStreaks(res))
      .catch(() => {})
  }, [player?.id, token])

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
          <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-slate-400 dark:text-slate-600" />
          </div>
          <p className="text-slate-600 dark:text-slate-500 mb-4">선수를 찾을 수 없습니다.</p>
          <Link href="/players" className="text-primary hover:text-primary-hover">
            선수 목록으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  const overall = calculateOverall(player)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 뒤로가기 */}
      <Link
        href="/players"
        className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        선수 목록
      </Link>

      {/* 프로필 카드 */}
      <div className="bg-white dark:bg-slate-900/50 backdrop-blur rounded-3xl p-8 border border-slate-200 dark:border-slate-800/50 mb-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start gap-6">
          {/* 프로필 이미지 */}
          <div className="relative">
            <div className="w-28 h-28 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
              {player.photo_url ? (
                <img
                  src={`${API_BASE}${player.photo_url}`}
                  alt={player.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-5xl text-slate-600 dark:text-slate-300">{player.name.charAt(0)}</span>
              )}
            </div>
            {player.link_status === 'ACTIVE' && (
              <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-primary rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center">
                <span className="text-xs text-white">✓</span>
              </div>
            )}
          </div>

          {/* 정보 */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{player.name}</h1>
              {player.nickname && (
                <span className="text-lg text-slate-500">({player.nickname})</span>
              )}
              {token && (
                <button
                  onClick={toggleFav}
                  disabled={favLoading}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors',
                    isFav ? 'text-red-400 hover:text-red-500' : 'text-slate-300 dark:text-slate-600 hover:text-red-400'
                  )}
                  title={isFav ? '선호 선수 해제' : '선호 선수 등록'}
                >
                  <Heart className={cn('w-5 h-5', isFav && 'fill-current')} />
                </button>
              )}
              {/* Futsal DNA 뱃지 */}
              {player.futsalDna && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300">
                  {player.futsalDna.emoji} {player.futsalDna.type}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              {player.link_status === 'ACTIVE' && (
                <span className="px-3 py-1 text-sm bg-primary/10 text-primary rounded-full border border-primary/20">
                  계정 연동됨
                </span>
              )}
              {player.pay_exempt === 1 && (
                <span className="px-3 py-1 text-sm bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-full border border-purple-200 dark:border-purple-500/30">
                  회비 면제
                </span>
              )}
              {player.join_date && (
                <span className="text-sm text-slate-500">
                  가입일: {player.join_date}
                </span>
              )}
            </div>

            {/* 태그 */}
            {player.tags && player.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 mb-4">
                {player.tags.map((t: any) => (
                  <span
                    key={t.tag}
                    className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full"
                  >
                    {t.tag} ({t.votes})
                  </span>
                ))}
              </div>
            )}

            {/* 종합 능력치 */}
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-500/20 dark:to-amber-600/10 rounded-2xl px-6 py-4 border border-amber-200 dark:border-amber-500/20">
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 mb-1">
                  <Star className="w-4 h-4" />
                  종합 능력치
                </div>
                <p className="text-4xl font-bold text-slate-900 dark:text-white">{overall.toFixed(1)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 능력치 상세 */}
      <div className="bg-white dark:bg-slate-900/50 backdrop-blur rounded-3xl p-8 border border-slate-200 dark:border-slate-800/50 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          능력치 상세
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 레이더 차트 */}
          <div className="flex flex-col items-center justify-center lg:col-span-1">
            <PlayerRadarChart
              stats={player}
              size={240}
              className="mx-auto"
            />
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-4 text-center">
              종합 능력치 분포
            </p>
          </div>

          {/* 상세 스탯 */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 공격 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <Target className="w-4 h-4 text-muted-foreground" />
                공격
              </h3>
              <StatRow label="슈팅" value={player.shooting || 5} />
              <StatRow label="오프더볼" value={player.offball_run || 5} />
              <StatRow label="볼키핑" value={player.ball_keeping || 5} />
              <StatRow label="패스" value={player.passing || 5} />
              <StatRow label="연계 플레이" value={player.linkup || 5} />
            </div>

            {/* 수비 & 피지컬 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <Shield className="w-4 h-4 text-muted-foreground" />
                수비 & 피지컬
              </h3>
              <StatRow label="인터셉트" value={player.intercept || 5} />
              <StatRow label="마킹" value={player.marking || 5} />
              <StatRow label="스태미나" value={player.stamina || 5} />
              <StatRow label="스피드" value={player.speed || 5} />
              <StatRow label="피지컬" value={player.physical || 5} />
            </div>
          </div>
        </div>
      </div>

      {/* 케미스트리 (PRO) */}
      <div className="mt-6 bg-white dark:bg-slate-900/50 backdrop-blur rounded-3xl p-8 border border-slate-200 dark:border-slate-800/50 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Handshake className="w-5 h-5" /> 케미스트리
          {!isPro && (
            <span className="ml-2 px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs rounded-full font-medium">
              PRO
            </span>
          )}
        </h2>
        <div className="relative">
          <div className={cn(!isPro && 'blur-sm pointer-events-none select-none')}>
            {chemistry?.partners && chemistry.partners.length > 0 ? (
              <div className="space-y-3">
                {chemistry.partners.slice(0, 3).map((p: any, i: number) => (
                  <div key={p.partner_id ?? i} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900 dark:text-white">{p.partner_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">{typeof p.chem_score === 'number' ? p.chem_score.toFixed(1) : p.chem_score}</p>
                      <p className="text-xs text-slate-500">케미 점수</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                케미스트리 데이터가 없습니다.
              </div>
            )}
          </div>
          {!isPro && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white dark:bg-slate-900 rounded-2xl px-6 py-4 shadow-lg border border-slate-200 dark:border-slate-700 text-center">
                <Lock className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-900 dark:text-white mb-3">PRO 전용 기능</p>
                <Link
                  href="/settings/subscription"
                  className="inline-block px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition-colors"
                >
                  PRO로 업그레이드
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 스트릭 (PRO) */}
      <div className="mt-6 bg-white dark:bg-slate-900/50 backdrop-blur rounded-3xl p-8 border border-slate-200 dark:border-slate-800/50 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Flame className="w-5 h-5" /> 스트릭
          {!isPro && (
            <span className="ml-2 px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs rounded-full font-medium">
              PRO
            </span>
          )}
        </h2>
        <div className="relative">
          <div className={cn(!isPro && 'blur-sm pointer-events-none select-none')}>
            {streaks ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StreakCard
                  label="연승 스트릭"
                  value={streaks.win_streak ?? 0}
                  icon={<Trophy className="w-8 h-8" />}
                  color="amber"
                />
                <StreakCard
                  label="득점 스트릭"
                  value={streaks.scoring_streak ?? 0}
                  icon={<Circle className="w-8 h-8" />}
                  color="red"
                />
                <StreakCard
                  label="출석 스트릭"
                  value={streaks.attendance_streak ?? 0}
                  icon={<Calendar className="w-8 h-8" />}
                  color="blue"
                />
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                스트릭 데이터가 없습니다.
              </div>
            )}
          </div>
          {!isPro && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white dark:bg-slate-900 rounded-2xl px-6 py-4 shadow-lg border border-slate-200 dark:border-slate-700 text-center">
                <Lock className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-900 dark:text-white mb-3">PRO 전용 기능</p>
                <Link
                  href="/settings/subscription"
                  className="inline-block px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition-colors"
                >
                  PRO로 업그레이드
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 통산 기록 */}
      {data?.stats && (
        <div className="mt-6 bg-white dark:bg-slate-900/50 backdrop-blur rounded-3xl p-8 border border-slate-200 dark:border-slate-800/50 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <Star className="w-5 h-5 text-muted-foreground" />
            통산 기록
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <PlayerStatCard label="경기 수" value={data.stats.total_matches || 0} icon={<Circle className="w-6 h-6" />} />
            <PlayerStatCard label="득점" value={data.stats.total_goals || 0} icon={<Target className="w-6 h-6" />} color="red" />
            <PlayerStatCard label="도움" value={data.stats.total_assists || 0} icon={<Zap className="w-6 h-6" />} color="blue" />
            <PlayerStatCard label="수비" value={data.stats.total_blocks || 0} icon={<Shield className="w-6 h-6" />} color="green" />
          </div>
        </div>
      )}

      {/* 최근 경기 기록 */}
      <div className="mt-6 bg-white dark:bg-slate-900/50 backdrop-blur rounded-3xl p-8 border border-slate-200 dark:border-slate-800/50 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Zap className="w-5 h-5 text-muted-foreground" />
          최근 경기 기록
        </h2>
        {data?.recentMatches && data.recentMatches.length > 0 ? (
          <div className="space-y-3">
            {data.recentMatches.map((match: any, index: number) => (
              <div
                key={match.id || index}
                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{match.session_date}</p>
                    <p className="text-xs text-slate-400">{match.match_no}경기</p>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-slate-900 dark:text-white">{match.team1_name}</span>
                    <span className="mx-2 text-slate-400">vs</span>
                    <span className="font-medium text-slate-900 dark:text-white">{match.team2_name}</span>
                  </div>
                  <div className="text-lg font-bold">
                    <span className={match.team1_score > match.team2_score ? 'text-primary' : 'text-slate-600 dark:text-slate-400'}>
                      {match.team1_score}
                    </span>
                    <span className="mx-1 text-slate-400">:</span>
                    <span className={match.team2_score > match.team1_score ? 'text-primary' : 'text-slate-600 dark:text-slate-400'}>
                      {match.team2_score}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {(match.goals > 0) && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-500/20 text-muted-foreground rounded-lg text-sm font-medium">
                      <Circle className="w-3.5 h-3.5" /> {match.goals}
                    </span>
                  )}
                  {(match.assists > 0) && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-500/20 text-muted-foreground rounded-lg text-sm font-medium">
                      <Zap className="w-3.5 h-3.5" /> {match.assists}
                    </span>
                  )}
                  {(match.blocks > 0) && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-500/20 text-muted-foreground rounded-lg text-sm font-medium">
                      <Shield className="w-3.5 h-3.5" /> {match.blocks}
                    </span>
                  )}
                  {match.goals === 0 && match.assists === 0 && match.blocks === 0 && (
                    <span className="text-sm text-slate-400">-</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-center py-8">
            아직 경기 기록이 없습니다.
          </p>
        )}
      </div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: number }) {
  const percentage = (value / 10) * 100
  const color = value >= 8 ? 'bg-primary' : value >= 6 ? 'bg-teal-500' : value >= 4 ? 'bg-amber-500' : 'bg-red-500'
  const textColor = value >= 8 ? 'text-primary' : value >= 6 ? 'text-teal-600 dark:text-teal-400' : value >= 4 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'

  return (
    <div className="flex items-center gap-4">
      <span className="w-24 text-sm text-slate-600 dark:text-slate-400">{label}</span>
      <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={cn('w-8 text-right font-bold', textColor)}>{value}</span>
    </div>
  )
}

function calculateOverall(player: any): number {
  const stats = [
    player.shooting || 5,
    player.offball_run || 5,
    player.ball_keeping || 5,
    player.passing || 5,
    player.linkup || 5,
    player.intercept || 5,
    player.marking || 5,
    player.stamina || 5,
    player.speed || 5,
    player.physical || 5,
  ]
  return stats.reduce((a, b) => a + b, 0) / stats.length
}

function PlayerStatCard({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color?: string }) {
  const colorClasses: Record<string, string> = {
    red: 'bg-slate-100 dark:bg-slate-500/20 text-muted-foreground',
    blue: 'bg-slate-100 dark:bg-slate-500/20 text-muted-foreground',
    green: 'bg-slate-100 dark:bg-slate-500/20 text-muted-foreground',
    default: 'bg-slate-100 dark:bg-slate-800 text-muted-foreground',
  }
  const bgClass = colorClasses[color || 'default']

  return (
    <div className={cn('rounded-2xl p-4 text-center', bgClass)}>
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm opacity-80">{label}</p>
    </div>
  )
}

function StreakCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colorClasses: Record<string, string> = {
    amber: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
    red: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
    blue: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  }
  const bgClass = colorClasses[color] ?? colorClasses.amber

  return (
    <div className={cn('rounded-2xl p-5 text-center', bgClass)}>
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}<span className="text-base font-normal ml-1">연속</span></p>
      <p className="text-sm mt-1 opacity-80">{label}</p>
    </div>
  )
}
