'use client'

import { useAuthStore } from '@/stores/auth'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Trophy, Target, Handshake, Shield, ChevronDown, Search, ChevronRight, ChevronUp, Crown, Award } from 'lucide-react'
import { rankingsApi } from '@/lib/api'
import { cn } from '@/lib/cn'

type SortKey = 'mvpCount' | 'goals' | 'assists' | 'attackPoints' | 'defenses' | 'games' | 'rank1' | 'rank2' | 'rank3' | 'ppm' | 'winRate'
type SortOrder = 'asc' | 'desc'

function getCurrentSeasonYear(startMonth: number): number {
  const now = new Date()
  const m = now.getMonth() + 1
  const y = now.getFullYear()
  if (startMonth <= 1) return y
  return m >= startMonth ? y : y - 1
}

export default function RankingPage() {
  const { token, club } = useAuthStore()
  const currentYear = getCurrentSeasonYear(club?.seasonStartMonth ?? 1)
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [sortBy, setSortBy] = useState<SortKey>('mvpCount')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['rankings', selectedYear, token],
    queryFn: () => rankingsApi.get(selectedYear, token ?? undefined),
    enabled: !!token,
  })

  const rankings = data?.data?.rankings || []

  // 검색 필터
  const filteredRankings = rankings.filter((player: any) =>
    player.name?.toLowerCase().includes(search.toLowerCase())
  )

  // 정렬
  const sortedRankings = [...filteredRankings].sort((a: any, b: any) => {
    let aVal, bVal
    if (sortBy === 'ppm') {
      aVal = a.games > 0 ? a.goals / a.games : 0
      bVal = b.games > 0 ? b.goals / b.games : 0
    } else if (sortBy === 'attackPoints') {
      aVal = (a.goals || 0) + (a.assists || 0)
      bVal = (b.goals || 0) + (b.assists || 0)
    } else {
      aVal = a[sortBy] || 0
      bVal = b[sortBy] || 0
    }
    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal
  })

  // 상위 3명
  const topThree = sortedRankings.slice(0, 3)

  // 컬럼 클릭 핸들러
  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(key)
      setSortOrder('desc')
    }
  }

  const getSortLabel = () => {
    const labels: Record<SortKey, string> = {
      mvpCount: 'MVP',
      goals: '득점',
      assists: '도움',
      attackPoints: '공격포인트',
      defenses: '수비',
      games: '경기수',
      rank1: '1등',
      rank2: '2등',
      rank3: '3등',
      ppm: 'PPM',
      winRate: '우승률',
    }
    return labels[sortBy]
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            선수 / 랭킹
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
            {selectedYear}년 시즌 • {getSortLabel()} 순
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="선수 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-52 pl-11 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* 연도 선택 */}
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="appearance-none px-4 py-2 pr-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {[2026, 2025, 2024].map((year) => (
                <option key={year} value={year}>
                  {year}년
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : sortedRankings.length === 0 ? (
        <EmptyState year={selectedYear} search={search} />
      ) : (
        <>
          {/* 상위 3명 포디움 */}
          {!search && topThree.length >= 3 && (
            <div className="mb-10">
              <Podium topThree={topThree} sortBy={sortBy} />
            </div>
          )}

          {/* 테이블 */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            {/* 테이블 헤더 */}
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 w-12 sticky left-0 z-30 bg-slate-50 dark:bg-slate-800">
                      #
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 min-w-[120px] sticky left-12 z-30 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      선수
                    </th>
                    <SortableHeader
                      label="MVP"
                      sortKey="mvpCount"
                      currentSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      icon={<Award className="w-4 h-4" />}
                      color="emerald"
                    />
                    <SortableHeader
                      label="득점"
                      sortKey="goals"
                      currentSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      icon={<Target className="w-4 h-4" />}
                      color="amber"
                    />
                    <SortableHeader
                      label="도움"
                      sortKey="assists"
                      currentSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      icon={<Handshake className="w-4 h-4" />}
                      color="blue"
                    />
                    <SortableHeader
                      label="공격P"
                      sortKey="attackPoints"
                      currentSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      color="rose"
                    />
                    <SortableHeader
                      label="수비"
                      sortKey="defenses"
                      currentSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      icon={<Shield className="w-4 h-4" />}
                      color="purple"
                    />
                    <SortableHeader
                      label="경기"
                      sortKey="games"
                      currentSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      color="slate"
                    />
                    <SortableHeader
                      label="PPM"
                      sortKey="ppm"
                      currentSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      color="orange"
                    />
                    <SortableHeader
                      label="🥇"
                      sortKey="rank1"
                      currentSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      color="yellow"
                    />
                    <SortableHeader
                      label="🥈"
                      sortKey="rank2"
                      currentSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      color="slate"
                    />
                    <SortableHeader
                      label="🥉"
                      sortKey="rank3"
                      currentSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      color="orange"
                    />
                    <SortableHeader
                      label="승률"
                      sortKey="winRate"
                      currentSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      color="emerald"
                    />
                    <th className="px-4 py-4 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sortedRankings.map((player: any, index: number) => (
                    <PlayerRow
                      key={player.id}
                      player={player}
                      rank={index + 1}
                      sortBy={sortBy}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  sortOrder,
  onSort,
  icon,
  color,
}: {
  label: string
  sortKey: SortKey
  currentSort: SortKey
  sortOrder: SortOrder
  onSort: (key: SortKey) => void
  icon?: React.ReactNode
  color: string
}) {
  const isActive = currentSort === sortKey

  const colorClasses: Record<string, string> = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    slate: 'text-slate-600 dark:text-slate-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    orange: 'text-orange-600 dark:text-orange-400',
    rose: 'text-rose-600 dark:text-rose-400',
  }

  return (
    <th className="px-4 py-4 text-center">
      <button
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1.5 text-sm font-semibold transition-colors hover:text-emerald-600 dark:hover:text-emerald-400',
          isActive ? colorClasses[color] : 'text-slate-600 dark:text-slate-400'
        )}
      >
        {icon}
        {label}
        {isActive && (
          sortOrder === 'desc'
            ? <ChevronDown className="w-4 h-4" />
            : <ChevronUp className="w-4 h-4" />
        )}
      </button>
    </th>
  )
}

function Podium({ topThree, sortBy }: { topThree: any[]; sortBy: SortKey }) {
  const getValue = (player: any) => {
    if (sortBy === 'ppm') {
      return player.games > 0 ? (player.goals / player.games).toFixed(2) : '0.00'
    }
    if (sortBy === 'attackPoints') {
      return (player.goals || 0) + (player.assists || 0)
    }
    if (sortBy === 'winRate') {
      return player.attendance > 0 ? `${((player.rank1 || 0) / player.attendance * 100).toFixed(0)}%` : '-'
    }
    return player[sortBy] || 0
  }

  const positions = [
    { player: topThree[1], rank: 2, height: 'h-24', medal: '🥈' },
    { player: topThree[0], rank: 1, height: 'h-32', medal: '🥇' },
    { player: topThree[2], rank: 3, height: 'h-20', medal: '🥉' },
  ]

  return (
    <div className="flex items-end justify-center gap-4 py-6">
      {positions.map(({ player, rank, height, medal }) => (
        <Link
          key={rank}
          href={`/ranking/${player.id}`}
          className="flex flex-col items-center group"
        >
          {/* 프로필 */}
          <div className="relative mb-3">
            <div className={cn(
              'w-20 h-20 rounded-2xl flex items-center justify-center border-2 shadow-lg bg-slate-100 dark:bg-slate-800 transition-transform group-hover:scale-105',
              rank === 1 ? 'border-amber-400 shadow-amber-200 dark:shadow-amber-900/30' : 'border-slate-300 dark:border-slate-600'
            )}>
              {player.photo_url ? (
                <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <span className="text-3xl font-bold text-slate-600 dark:text-slate-300">{player.name?.charAt(0)}</span>
              )}
            </div>
            {rank === 1 && (
              <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 text-amber-500" />
            )}
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-2xl">{medal}</span>
          </div>

          {/* 이름 & 값 */}
          <div className="text-center mb-2">
            <p className="font-bold text-slate-900 dark:text-white text-lg">{player.name}</p>
            <p className="text-emerald-600 dark:text-emerald-400 font-bold text-xl">{getValue(player)}</p>
          </div>

          {/* 포디움 */}
          <div className={cn(
            'w-24 rounded-t-xl flex items-center justify-center transition-colors',
            height,
            rank === 1 ? 'bg-gradient-to-t from-amber-500 to-yellow-400' :
              rank === 2 ? 'bg-gradient-to-t from-slate-400 to-slate-300' :
                'bg-gradient-to-t from-amber-700 to-amber-600'
          )}>
            <span className="text-3xl font-bold text-white/90">{rank}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}

function PlayerRow({ player, rank, sortBy }: { player: any; rank: number; sortBy: SortKey }) {
  const getRankBadge = () => {
    if (rank === 1) return <span className="text-base">🥇</span>
    if (rank === 2) return <span className="text-base">🥈</span>
    if (rank === 3) return <span className="text-base">🥉</span>
    return <span className="text-sm font-bold text-slate-400 dark:text-slate-500">{rank}</span>
  }

  const getCellClass = (key: SortKey) => {
    if (sortBy !== key) return 'text-slate-700 dark:text-slate-300'
    const colors: Record<SortKey, string> = {
      mvpCount: 'text-emerald-600 dark:text-emerald-400 font-bold',
      goals: 'text-amber-600 dark:text-amber-400 font-bold',
      assists: 'text-blue-600 dark:text-blue-400 font-bold',
      attackPoints: 'text-rose-600 dark:text-rose-400 font-bold',
      defenses: 'text-purple-600 dark:text-purple-400 font-bold',
      games: 'text-slate-700 dark:text-slate-300 font-bold',
      rank1: 'text-yellow-600 dark:text-yellow-400 font-bold',
      rank2: 'text-slate-600 dark:text-slate-400 font-bold',
      rank3: 'text-orange-600 dark:text-orange-400 font-bold',
      ppm: 'text-orange-600 dark:text-orange-400 font-bold',
      winRate: 'text-emerald-600 dark:text-emerald-400 font-bold',
    }
    return colors[key]
  }

  // PPM 계산 (goals per game)
  const ppm = player.games > 0 ? (player.goals / player.games).toFixed(2) : '0.00'
  const attackPoints = (player.goals || 0) + (player.assists || 0)

  return (
    <tr className={cn(
      'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
      rank <= 3 && 'bg-amber-50/50 dark:bg-amber-900/10'
    )}>
      <td className={cn(
        'px-3 py-3 text-center sticky left-0 z-10',
        rank <= 3 ? 'bg-amber-50 dark:bg-slate-900' : 'bg-white dark:bg-slate-900'
      )}>{getRankBadge()}</td>
      <td className={cn(
        'px-3 py-3 sticky left-12 z-10 border-r border-slate-200 dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]',
        rank <= 3 ? 'bg-amber-50 dark:bg-slate-900' : 'bg-white dark:bg-slate-900'
      )}>
        <Link href={`/ranking/${player.id}`} className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
            {player.photo_url ? (
              <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover rounded-lg" />
            ) : (
              <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{player.name?.charAt(0)}</span>
            )}
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
            {player.name}
          </span>
        </Link>
      </td>
      <td className={cn('px-3 py-3 text-center text-sm', getCellClass('mvpCount'))}>
        {player.mvpCount || 0}
      </td>
      <td className={cn('px-3 py-3 text-center text-sm', getCellClass('goals'))}>
        {player.goals || 0}
      </td>
      <td className={cn('px-3 py-3 text-center text-sm', getCellClass('assists'))}>
        {player.assists || 0}
      </td>
      <td className={cn('px-3 py-3 text-center text-sm', getCellClass('attackPoints'))}>
        {attackPoints}
      </td>
      <td className={cn('px-3 py-3 text-center text-sm', getCellClass('defenses'))}>
        {player.defenses || 0}
      </td>
      <td className={cn('px-3 py-3 text-center text-sm', getCellClass('games'))}>
        {player.games || 0}
      </td>
      <td className={cn('px-3 py-3 text-center text-sm', getCellClass('ppm'))}>
        {ppm}
      </td>
      <td className={cn('px-3 py-3 text-center text-sm', getCellClass('rank1'))}>
        {player.rank1 || 0}
      </td>
      <td className={cn('px-3 py-3 text-center text-sm', getCellClass('rank2'))}>
        {player.rank2 || 0}
      </td>
      <td className={cn('px-3 py-3 text-center text-sm', getCellClass('rank3'))}>
        {player.rank3 || 0}
      </td>
      <td className={cn('px-3 py-3 text-center text-sm', getCellClass('winRate'))}>
        {player.attendance > 0 ? `${((player.rank1 || 0) / player.attendance * 100).toFixed(0)}%` : '-'}
      </td>
      <td className="px-4 py-4">
        <Link href={`/ranking/${player.id}`}>
          <ChevronRight className="w-5 h-5 text-slate-400 hover:text-emerald-500 transition-colors" />
        </Link>
      </td>
    </tr>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-center gap-4 py-8">
        {[24, 32, 20].map((h, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="w-20 h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl mb-3 animate-pulse" />
            <div className="w-16 h-5 bg-slate-200 dark:bg-slate-800 rounded mb-2 animate-pulse" />
            <div className="w-24 bg-slate-200 dark:bg-slate-800 rounded-t-xl animate-pulse" style={{ height: h * 3 }} />
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl mb-3 animate-pulse" />
        ))}
      </div>
    </div>
  )
}

function EmptyState({ year, search }: { year: number; search: string }) {
  return (
    <div className="text-center py-20">
      <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Trophy className="w-10 h-10 text-slate-400" />
      </div>
      {search ? (
        <p className="text-slate-600 dark:text-slate-400 text-lg">"{search}" 검색 결과가 없습니다.</p>
      ) : (
        <>
          <p className="text-slate-600 dark:text-slate-400 text-lg mb-2">{year}년 시즌 데이터가 없습니다.</p>
          <p className="text-slate-500 dark:text-slate-500">경기가 진행되면 순위가 자동으로 업데이트됩니다.</p>
        </>
      )}
    </div>
  )
}
