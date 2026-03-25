'use client'

import { useAuthStore } from '@/stores/auth'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Trophy, Target, Handshake, Shield, ChevronDown, Search, ChevronRight, ChevronUp, Crown, Award, List, TableProperties } from 'lucide-react'
import { rankingsApi, exportApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import { SortChips, type SortChip } from '@/components/ui/sort-chips'
import { CompactPlayerList } from '@/components/ranking/compact-player-list'

type SortKey = 'mvpCount' | 'goals' | 'assists' | 'attackPoints' | 'defenses' | 'games' | 'sessionWins' | 'sessionLosses' | 'contribution' | 'winRate' | 'tackles' | 'interceptions' | 'clearances' | 'saves' | 'keyPasses' | 'dribbles' | 'shotsOn' | 'shotsOff' | 'mvpScore'
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
  const [viewMode, setViewMode] = useState<'compact' | 'table'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('ranking-view-mode') as 'compact' | 'table') || 'compact'
    return 'compact'
  })

  const enabledEvents: string[] = club?.enabledEvents ?? ['GOAL', 'DEFENSE']

  useEffect(() => {
    localStorage.setItem('ranking-view-mode', viewMode)
  }, [viewMode])

  const { data, isLoading } = useQuery({
    queryKey: ['rankings', selectedYear, token],
    queryFn: () => rankingsApi.get(selectedYear, token ?? undefined),
    enabled: !!token,
  })

  const rankings = data?.data?.rankings || []

  const filteredRankings = rankings.filter((player: any) =>
    player.name?.toLowerCase().includes(search.toLowerCase())
  )

  const sortedRankings = [...filteredRankings].sort((a: any, b: any) => {
    let aVal, bVal
    if (sortBy === 'contribution') {
      aVal = a.games > 0 ? (a.goals + a.assists) / a.games : 0
      bVal = b.games > 0 ? (b.goals + b.assists) / b.games : 0
    } else if (sortBy === 'attackPoints') {
      aVal = (a.goals || 0) + (a.assists || 0)
      bVal = (b.goals || 0) + (b.assists || 0)
    } else {
      aVal = a[sortBy] || 0
      bVal = b[sortBy] || 0
    }
    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal
  })

  const topThree = sortedRankings.slice(0, 3)

  const handleSort = (key: string) => {
    const k = key as SortKey
    if (sortBy === k) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(k)
      setSortOrder('desc')
    }
  }

  const chipList: SortChip[] = [
    { key: 'mvpCount', label: 'MVP' },
    { key: 'goals', label: '득점' },
    { key: 'assists', label: '도움' },
    { key: 'attackPoints', label: '공격P' },
    ...enabledEvents.filter(e => e !== 'GOAL').map(e => {
      const map: Record<string, SortChip> = {
        DEFENSE: { key: 'defenses', label: '수비' },
        TACKLE: { key: 'tackles', label: '태클' },
        INTERCEPTION: { key: 'interceptions', label: '인터셉트' },
        CLEARANCE: { key: 'clearances', label: '클리어런스' },
        SAVE: { key: 'saves', label: '선방' },
        KEY_PASS: { key: 'keyPasses', label: '키패스' },
        DRIBBLE: { key: 'dribbles', label: '돌파' },
        SHOT_ON: { key: 'shotsOn', label: '유효슈팅' },
        SHOT_OFF: { key: 'shotsOff', label: '무효슈팅' },
      }
      return map[e]
    }).filter(Boolean) as SortChip[],
    { key: 'games', label: '경기' },
    { key: 'winRate', label: '승률' },
    { key: 'contribution', label: '공헌도' },
    { key: 'mvpScore', label: '평점' },
  ]

  const getSortLabel = () => {
    const chip = chipList.find(c => c.key === sortBy)
    return chip?.label ?? sortBy
  }

  // Table column grouping: determine if we need column toggle
  const eventColumns = enabledEvents.filter(e => e !== 'GOAL')
  const totalColumns = 11 + eventColumns.length
  const showColumnToggle = totalColumns >= 12
  const [showAllColumns, setShowAllColumns] = useState(false)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              선수 / 랭킹
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
              {selectedYear}년 시즌 &bull; {getSortLabel()} 순
            </p>
          </div>
          <div className="flex items-center gap-2">
            {club?.isPro && (
              <button
                onClick={() => exportApi.download(token!, 'rankings', selectedYear)}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
              >
                CSV
              </button>
            )}
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="appearance-none pl-3 pr-8 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {[2026, 2025, 2024].map((year) => (
                  <option key={year} value={year}>
                    {year}년
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* 검색 */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="선수 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Sort Chips */}
        <SortChips chips={chipList} activeKey={sortBy} onSelect={handleSort} />
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : sortedRankings.length === 0 ? (
        <EmptyState year={selectedYear} search={search} />
      ) : (
        <>
          {/* 상위 3명 포디움 */}
          {!search && topThree.length >= 3 && (
            <div className="mb-8">
              <Podium topThree={topThree} sortBy={sortBy} />
            </div>
          )}

          {/* 뷰 모드에 따른 렌더링 */}
          {viewMode === 'compact' ? (
            <CompactPlayerList
              rankings={sortedRankings}
              sortBy={sortBy}
              enabledEvents={enabledEvents}
            />
          ) : (
            /* 테이블 뷰 */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              {showColumnToggle && (
                <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {showAllColumns ? '전체 컬럼 표시 중' : '주요 컬럼만 표시 중'}
                  </span>
                  <button
                    onClick={() => setShowAllColumns(!showAllColumns)}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold"
                  >
                    {showAllColumns ? '주요 컬럼만' : '전체 컬럼 보기'}
                  </button>
                </div>
              )}
              <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
                <table className="w-max min-w-full">
                  <thead>
                    {/* Group headers when showing all columns */}
                    {showAllColumns && showColumnToggle && (
                      <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                        <th className="sticky left-0 z-30 bg-slate-100 dark:bg-slate-800" colSpan={2}></th>
                        <th className="text-[10px] font-bold text-amber-600 dark:text-amber-400 text-center border-b-2 border-amber-400/30" colSpan={getAttackColspan(enabledEvents)}>공격</th>
                        <th className="text-[10px] font-bold text-purple-600 dark:text-purple-400 text-center border-b-2 border-purple-400/30" colSpan={getDefenseColspan(enabledEvents)}>수비</th>
                        <th className="text-[10px] font-bold text-slate-600 dark:text-slate-400 text-center border-b-2 border-slate-400/30" colSpan={6}>기록</th>
                        <th className="w-8"></th>
                      </tr>
                    )}
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
                      <th className="px-2 py-2.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 w-10 sticky left-0 z-30 bg-slate-50 dark:bg-slate-800">
                        #
                      </th>
                      <th className="px-2 py-2.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 min-w-[100px] sticky left-10 z-30 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        선수
                      </th>
                      {/* 공격 그룹 */}
                      <SortableHeader label="득점" sortKey="goals" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} icon={<Target className="w-3.5 h-3.5" />} color="amber" />
                      <SortableHeader label="도움" sortKey="assists" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} icon={<Handshake className="w-3.5 h-3.5" />} color="blue" />
                      <SortableHeader label="공격P" sortKey="attackPoints" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} color="rose" />
                      {(!showColumnToggle || showAllColumns) && (
                        <>
                          {enabledEvents.includes('KEY_PASS') && (
                            <SortableHeader label="키패스" sortKey="keyPasses" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} color="blue" />
                          )}
                          {enabledEvents.includes('DRIBBLE') && (
                            <SortableHeader label="돌파" sortKey="dribbles" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} color="orange" />
                          )}
                          {enabledEvents.includes('SHOT_ON') && (
                            <SortableHeader label="유효슈팅" sortKey="shotsOn" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} color="amber" />
                          )}
                          {enabledEvents.includes('SHOT_OFF') && (
                            <SortableHeader label="무효슈팅" sortKey="shotsOff" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} color="slate" />
                          )}
                        </>
                      )}
                      {/* 수비 그룹 */}
                      {(!showColumnToggle || showAllColumns) && (
                        <>
                          {enabledEvents.includes('DEFENSE') && (
                            <SortableHeader label="수비" sortKey="defenses" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} icon={<Shield className="w-3.5 h-3.5" />} color="purple" />
                          )}
                          {enabledEvents.includes('TACKLE') && (
                            <SortableHeader label="태클" sortKey="tackles" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} color="purple" />
                          )}
                          {enabledEvents.includes('INTERCEPTION') && (
                            <SortableHeader label="인터셉트" sortKey="interceptions" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} color="purple" />
                          )}
                          {enabledEvents.includes('CLEARANCE') && (
                            <SortableHeader label="클리어런스" sortKey="clearances" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} color="purple" />
                          )}
                          {enabledEvents.includes('SAVE') && (
                            <SortableHeader label="선방" sortKey="saves" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} color="teal" />
                          )}
                        </>
                      )}
                      {/* 기록 그룹 */}
                      <SortableHeader label="경기" sortKey="games" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} color="slate" />
                      <SortableHeader label="승" sortKey="sessionWins" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} color="emerald" />
                      <SortableHeader label="패" sortKey="sessionLosses" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} color="red" />
                      <SortableHeader label="승률" sortKey="winRate" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} color="emerald" />
                      <SortableHeader label="MVP" sortKey="mvpCount" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} icon={<Award className="w-3.5 h-3.5" />} color="emerald" />
                      <SortableHeader label="평점" sortKey="mvpScore" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} color="amber" />
                      <th className="px-2 py-2.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sortedRankings.map((player: any, index: number) => (
                      <PlayerRow
                        key={player.id}
                        player={player}
                        rank={index + 1}
                        sortBy={sortBy}
                        enabledEvents={enabledEvents}
                        showAllColumns={!showColumnToggle || showAllColumns}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* View Toggle */}
          <ViewToggle viewMode={viewMode} onToggle={() => setViewMode(viewMode === 'compact' ? 'table' : 'compact')} />
        </>
      )}
    </div>
  )
}

function getAttackColspan(enabledEvents: string[]): number {
  let count = 3 // 득점, 도움, 공격P
  if (enabledEvents.includes('KEY_PASS')) count++
  if (enabledEvents.includes('DRIBBLE')) count++
  if (enabledEvents.includes('SHOT_ON')) count++
  if (enabledEvents.includes('SHOT_OFF')) count++
  return count
}

function getDefenseColspan(enabledEvents: string[]): number {
  let count = 0
  if (enabledEvents.includes('DEFENSE')) count++
  if (enabledEvents.includes('TACKLE')) count++
  if (enabledEvents.includes('INTERCEPTION')) count++
  if (enabledEvents.includes('CLEARANCE')) count++
  if (enabledEvents.includes('SAVE')) count++
  return count
}

function ViewToggle({ viewMode, onToggle }: { viewMode: 'compact' | 'table'; onToggle: () => void }) {
  return (
    <div className="flex justify-center mt-6">
      <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5">
        <button
          onClick={viewMode !== 'compact' ? onToggle : undefined}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
            viewMode === 'compact'
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          )}
        >
          <List className="w-3.5 h-3.5" />
          리스트
        </button>
        <button
          onClick={viewMode !== 'table' ? onToggle : undefined}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
            viewMode === 'table'
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          )}
        >
          <TableProperties className="w-3.5 h-3.5" />
          테이블
        </button>
      </div>
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
  sortKey: string
  currentSort: string
  sortOrder: SortOrder
  onSort: (key: string) => void
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
    red: 'text-red-600 dark:text-red-400',
    teal: 'text-teal-600 dark:text-teal-400',
  }

  return (
    <th className="px-2 py-2.5 text-center whitespace-nowrap min-w-[52px]">
      <button
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 text-xs font-semibold transition-colors hover:text-emerald-600 dark:hover:text-emerald-400',
          isActive ? colorClasses[color] : 'text-slate-600 dark:text-slate-400'
        )}
      >
        {icon}
        {label}
        {isActive && (
          sortOrder === 'desc'
            ? <ChevronDown className="w-3 h-3" />
            : <ChevronUp className="w-3 h-3" />
        )}
      </button>
    </th>
  )
}

function Podium({ topThree, sortBy }: { topThree: any[]; sortBy: SortKey }) {
  const getValue = (player: any) => {
    if (sortBy === 'contribution') {
      return player.games > 0 ? ((player.goals + player.assists) / player.games).toFixed(2) : '0.00'
    }
    if (sortBy === 'attackPoints') {
      return (player.goals || 0) + (player.assists || 0)
    }
    if (sortBy === 'winRate') {
      return player.winRate ? player.winRate + '%' : '-'
    }
    if (sortBy === 'mvpScore') {
      return player.mvpScore != null ? Number(player.mvpScore).toFixed(1) : '0.0'
    }
    return player[sortBy] || 0
  }

  const positions = [
    { player: topThree[1], rank: 2, medal: '\u{1F948}', size: 'w-14 h-14 sm:w-16 sm:h-16' },
    { player: topThree[0], rank: 1, medal: '\u{1F947}', size: 'w-16 h-16 sm:w-20 sm:h-20' },
    { player: topThree[2], rank: 3, medal: '\u{1F949}', size: 'w-14 h-14 sm:w-16 sm:h-16' },
  ]

  return (
    <div className="bg-gradient-to-b from-slate-50 to-white dark:from-slate-800/30 dark:to-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
      <div className="flex items-end justify-center gap-4 sm:gap-8">
        {positions.map(({ player, rank, medal, size }) => (
          <Link
            key={rank}
            href={'/ranking/' + player.id}
            className={cn(
              'flex flex-col items-center group transition-transform hover:scale-105',
              rank === 1 ? 'mb-4' : 'mb-0'
            )}
          >
            <div className="relative mb-2">
              {rank === 1 && (
                <Crown className="absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-6 text-amber-500 drop-shadow-sm" />
              )}
              <div className={cn(
                size,
                'rounded-xl flex items-center justify-center border-2 shadow-md bg-slate-100 dark:bg-slate-800',
                rank === 1 ? 'border-amber-400 ring-2 ring-amber-200 dark:ring-amber-800' :
                  rank === 2 ? 'border-slate-300 dark:border-slate-600' :
                    'border-amber-600/50 dark:border-amber-700/50'
              )}>
                {player.photo_url ? (
                  <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <span className={cn(
                    'font-bold text-slate-600 dark:text-slate-300',
                    rank === 1 ? 'text-2xl' : 'text-xl'
                  )}>{player.name?.charAt(0)}</span>
                )}
              </div>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-lg leading-none">{medal}</span>
            </div>

            <p className={cn(
              'font-bold text-slate-900 dark:text-white mt-1',
              rank === 1 ? 'text-base' : 'text-sm'
            )}>{player.name}</p>
            <p className={cn(
              'font-bold text-emerald-600 dark:text-emerald-400',
              rank === 1 ? 'text-xl' : 'text-lg'
            )}>{getValue(player)}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

function PlayerRow({ player, rank, sortBy, enabledEvents, showAllColumns }: { player: any; rank: number; sortBy: SortKey; enabledEvents: string[]; showAllColumns: boolean }) {
  const getRankBadge = () => {
    if (rank === 1) return <span className="text-sm">{'\u{1F947}'}</span>
    if (rank === 2) return <span className="text-sm">{'\u{1F948}'}</span>
    if (rank === 3) return <span className="text-sm">{'\u{1F949}'}</span>
    return <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{rank}</span>
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
      sessionWins: 'text-emerald-600 dark:text-emerald-400 font-bold',
      sessionLosses: 'text-red-600 dark:text-red-400 font-bold',
      contribution: 'text-orange-600 dark:text-orange-400 font-bold',
      winRate: 'text-emerald-600 dark:text-emerald-400 font-bold',
      tackles: 'text-purple-600 dark:text-purple-400 font-bold',
      interceptions: 'text-purple-600 dark:text-purple-400 font-bold',
      clearances: 'text-purple-600 dark:text-purple-400 font-bold',
      saves: 'text-teal-600 dark:text-teal-400 font-bold',
      keyPasses: 'text-blue-600 dark:text-blue-400 font-bold',
      dribbles: 'text-orange-600 dark:text-orange-400 font-bold',
      shotsOn: 'text-amber-600 dark:text-amber-400 font-bold',
      shotsOff: 'text-slate-600 dark:text-slate-400 font-bold',
      mvpScore: 'text-amber-600 dark:text-amber-400 font-bold',
    }
    return colors[key]
  }

  const attackPoints = (player.goals || 0) + (player.assists || 0)

  return (
    <tr className={cn(
      'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
      rank <= 3 && 'bg-amber-50/50 dark:bg-amber-900/10'
    )}>
      <td className={cn(
        'px-2 py-2.5 text-center sticky left-0 z-10',
        rank <= 3 ? 'bg-amber-50 dark:bg-slate-900' : 'bg-white dark:bg-slate-900'
      )}>{getRankBadge()}</td>
      <td className={cn(
        'px-2 py-2.5 sticky left-10 z-10 border-r border-slate-200 dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]',
        rank <= 3 ? 'bg-amber-50 dark:bg-slate-900' : 'bg-white dark:bg-slate-900'
      )}>
        <Link href={'/ranking/' + player.id} className="flex items-center gap-1.5 group">
          <div className="w-7 h-7 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
            {player.photo_url ? (
              <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover rounded-lg" />
            ) : (
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{player.name?.charAt(0)}</span>
            )}
          </div>
          <span className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate max-w-[80px] sm:max-w-none">
            {player.name}
          </span>
        </Link>
      </td>
      {/* 공격 */}
      <td className={cn('px-2 py-2.5 text-center text-xs min-w-[52px]', getCellClass('goals'))}>
        {player.goals || 0}
      </td>
      <td className={cn('px-2 py-2.5 text-center text-xs min-w-[52px]', getCellClass('assists'))}>
        {player.assists || 0}
      </td>
      <td className={cn('px-2 py-2.5 text-center text-xs min-w-[52px]', getCellClass('attackPoints'))}>
        {attackPoints}
      </td>
      {showAllColumns && (
        <>
          {enabledEvents.includes('KEY_PASS') && (
            <td className={cn('px-2 py-2.5 text-center text-xs min-w-[52px]', getCellClass('keyPasses'))}>
              {player.keyPasses || 0}
            </td>
          )}
          {enabledEvents.includes('DRIBBLE') && (
            <td className={cn('px-2 py-2.5 text-center text-xs min-w-[52px]', getCellClass('dribbles'))}>
              {player.dribbles || 0}
            </td>
          )}
          {enabledEvents.includes('SHOT_ON') && (
            <td className={cn('px-2 py-2.5 text-center text-xs min-w-[52px]', getCellClass('shotsOn'))}>
              {player.shotsOn || 0}
            </td>
          )}
          {enabledEvents.includes('SHOT_OFF') && (
            <td className={cn('px-2 py-2.5 text-center text-xs min-w-[52px]', getCellClass('shotsOff'))}>
              {player.shotsOff || 0}
            </td>
          )}
        </>
      )}
      {/* 수비 */}
      {showAllColumns && (
        <>
          {enabledEvents.includes('DEFENSE') && (
            <td className={cn('px-2 py-2.5 text-center text-xs min-w-[52px]', getCellClass('defenses'))}>
              {player.defenses || 0}
            </td>
          )}
          {enabledEvents.includes('TACKLE') && (
            <td className={cn('px-2 py-2.5 text-center text-xs min-w-[52px]', getCellClass('tackles'))}>
              {player.tackles || 0}
            </td>
          )}
          {enabledEvents.includes('INTERCEPTION') && (
            <td className={cn('px-2 py-2.5 text-center text-xs min-w-[52px]', getCellClass('interceptions'))}>
              {player.interceptions || 0}
            </td>
          )}
          {enabledEvents.includes('CLEARANCE') && (
            <td className={cn('px-2 py-2.5 text-center text-xs min-w-[52px]', getCellClass('clearances'))}>
              {player.clearances || 0}
            </td>
          )}
          {enabledEvents.includes('SAVE') && (
            <td className={cn('px-2 py-2.5 text-center text-xs min-w-[52px]', getCellClass('saves'))}>
              {player.saves || 0}
            </td>
          )}
        </>
      )}
      {/* 기록 */}
      <td className={cn('px-2 py-2.5 text-center text-xs min-w-[52px]', getCellClass('games'))}>
        {player.games || 0}
      </td>
      <td className={cn('px-2 py-2.5 text-center text-xs min-w-[52px]', getCellClass('sessionWins'))}>
        {player.sessionWins || 0}
      </td>
      <td className={cn('px-2 py-2.5 text-center text-xs min-w-[52px]', getCellClass('sessionLosses'))}>
        {player.sessionLosses || 0}
      </td>
      <td className={cn('px-2 py-2.5 text-center text-xs min-w-[52px]', getCellClass('winRate'))}>
        {player.winRate ? player.winRate + '%' : '-'}
      </td>
      <td className={cn('px-2 py-2.5 text-center text-xs min-w-[52px]', getCellClass('mvpCount'))}>
        {player.mvpCount || 0}
      </td>
      <td className={cn('px-2 py-2.5 text-center text-xs min-w-[52px]', getCellClass('mvpScore'))}>
        {player.mvpScore != null ? Number(player.mvpScore).toFixed(1) : '0.0'}
      </td>
      <td className="px-2 py-2.5">
        <Link href={'/ranking/' + player.id}>
          <ChevronRight className="w-4 h-4 text-slate-400 hover:text-emerald-500 transition-colors" />
        </Link>
      </td>
    </tr>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-end justify-center gap-6">
          {[16, 20, 16].map((s, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="bg-slate-200 dark:bg-slate-700 rounded-xl mb-2 animate-pulse" style={{ width: s * 4, height: s * 4 }} />
              <div className="w-12 h-4 bg-slate-200 dark:bg-slate-700 rounded mb-1 animate-pulse" />
              <div className="w-8 h-5 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl mb-2 animate-pulse" />
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
        <p className="text-slate-600 dark:text-slate-400 text-lg">&quot;{search}&quot; 검색 결과가 없습니다.</p>
      ) : (
        <>
          <p className="text-slate-600 dark:text-slate-400 text-lg mb-2">{year}년 시즌 데이터가 없습니다.</p>
          <p className="text-slate-500 dark:text-slate-500">경기가 진행되면 순위가 자동으로 업데이트됩니다.</p>
        </>
      )}
    </div>
  )
}
