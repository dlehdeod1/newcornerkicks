'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Search, Users, ChevronRight, Star, Target, Shield } from 'lucide-react'
import { playersApi } from '@/lib/api'
import { cn } from '@/lib/cn'

export default function PlayersPage() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['players'],
    queryFn: () => playersApi.list(),
  })

  const players = data?.players || []
  const filteredPlayers = players.filter((player: any) =>
    player.name.toLowerCase().includes(search.toLowerCase()) ||
    player.nickname?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            선수 목록
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">코너킥스 멤버들의 능력치를 확인하세요</p>
        </div>

        {/* 검색 */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="선수 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-72 pl-12 pr-4 py-3 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/50 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
          />
        </div>
      </div>

      {/* 통계 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="전체 선수"
          value={players.length}
          color="emerald"
        />
        <StatCard
          icon={<Target className="w-5 h-5" />}
          label="활성 선수"
          value={players.filter((p: any) => p.link_status === 'ACTIVE').length}
          color="blue"
        />
        <StatCard
          icon={<Star className="w-5 h-5" />}
          label="평균 능력치"
          value={calculateAvgOverall(players)}
          color="amber"
        />
        <StatCard
          icon={<Shield className="w-5 h-5" />}
          label="회비 면제"
          value={players.filter((p: any) => p.pay_exempt).length}
          color="purple"
        />
      </div>

      {/* 선수 목록 */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                <div className="flex-1">
                  <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-24 mb-2" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-slate-400 dark:text-slate-600" />
          </div>
          <p className="text-slate-600 dark:text-slate-500">
            {search ? '검색 결과가 없습니다.' : '등록된 선수가 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlayers.map((player: any) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  color: 'emerald' | 'blue' | 'amber' | 'purple'
}) {
  const colorClasses = {
    emerald: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
    blue: 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
    amber: 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
    purple: 'bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
  }

  return (
    <div className={cn('rounded-2xl p-5 border', colorClasses[color])}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  )
}

function PlayerCard({ player }: { player: any }) {
  const overall = calculatePlayerOverall(player)
  const overallColor = overall >= 7 ? 'text-emerald-600 dark:text-emerald-400' : overall >= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'

  return (
    <Link
      href={`/players/${player.id}`}
      className="group block bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900/80 rounded-2xl p-5 border border-slate-200 dark:border-slate-800/50 hover:border-emerald-500/30 transition-all duration-300 shadow-sm"
    >
      <div className="flex items-center gap-4">
        {/* 프로필 */}
        <div className="relative">
          <div className="w-14 h-14 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700 group-hover:border-emerald-500/30 transition-colors">
            {player.photo_url ? (
              <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover rounded-xl" />
            ) : (
              <span className="text-2xl text-slate-600 dark:text-slate-300">{player.name.charAt(0)}</span>
            )}
          </div>
          {player.link_status === 'ACTIVE' && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
          )}
        </div>

        {/* 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
              {player.name}
            </h3>
            {player.nickname && (
              <span className="text-xs text-slate-500 truncate">({player.nickname})</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-1 text-sm">
              <span className="text-slate-500">종합</span>
              <span className={cn('font-bold', overallColor)}>{overall.toFixed(1)}</span>
            </div>
            {player.pay_exempt === 1 && (
              <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-full">면제</span>
            )}
          </div>
        </div>

        {/* 화살표 */}
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800/50 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20 transition-colors">
          <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
        </div>
      </div>

      {/* 능력치 바 */}
      <div className="mt-4 grid grid-cols-5 gap-1.5">
        <StatBar label="슈팅" value={player.shooting || 5} />
        <StatBar label="패스" value={player.passing || 5} />
        <StatBar label="수비" value={player.marking || 5} />
        <StatBar label="스피드" value={player.speed || 5} />
        <StatBar label="체력" value={player.stamina || 5} />
      </div>
    </Link>
  )
}

function StatBar({ label, value }: { label: string; value: number }) {
  const percentage = (value / 10) * 100
  const color = value >= 7 ? 'bg-emerald-500' : value >= 5 ? 'bg-amber-500' : 'bg-slate-400 dark:bg-slate-600'

  return (
    <div className="text-center">
      <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-1">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${percentage}%` }} />
      </div>
      <span className="text-[10px] text-slate-500 dark:text-slate-600">{label}</span>
    </div>
  )
}

function calculatePlayerOverall(player: any): number {
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

function calculateAvgOverall(players: any[]): string {
  if (players.length === 0) return '-'
  const total = players.reduce((sum, p) => sum + calculatePlayerOverall(p), 0)
  return (total / players.length).toFixed(1)
}
