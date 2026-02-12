'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Users, ChevronRight, Star, Zap, Target, Shield, Footprints, Table, LayoutGrid, CheckCircle2, Edit3, Save, X, Eye, EyeOff } from 'lucide-react'
import { playersApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/cn'

type ViewMode = 'table' | 'card'
type SortField = 'name' | 'overall' | 'attack' | 'defense' | 'physical' | 'creativity' | 'ratingCount' |
  'shooting' | 'offball_run' | 'ball_keeping' | 'passing' | 'linkup' | 'intercept' | 'marking' | 'stamina' | 'speed' | 'physical_stat'

// 0~100점 기준 기본값
const DEFAULT_STAT = 50

// 능력치 키 목록
const STAT_KEYS = [
  { key: 'shooting', label: '슈팅', color: 'red' },
  { key: 'offball_run', label: '오프더볼', color: 'red' },
  { key: 'ball_keeping', label: '볼키핑', color: 'red' },
  { key: 'passing', label: '패스', color: 'amber' },
  { key: 'linkup', label: '연계', color: 'amber' },
  { key: 'intercept', label: '인터셉트', color: 'blue' },
  { key: 'marking', label: '마킹', color: 'blue' },
  { key: 'stamina', label: '스태미나', color: 'emerald' },
  { key: 'speed', label: '스피드', color: 'emerald' },
  { key: 'physical', label: '피지컬', color: 'emerald' },
] as const

export default function AbilitiesPage() {
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [sortField, setSortField] = useState<SortField>('overall')
  const [sortDesc, setSortDesc] = useState(true)
  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null)
  const [editRatings, setEditRatings] = useState<Record<string, number>>({})
  const [showMyRatings, setShowMyRatings] = useState(false) // 내 평가 보기 토글
  const { isLoggedIn, token } = useAuthStore()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['players', token],
    queryFn: () => playersApi.list(token),
  })

  const rateMutation = useMutation({
    mutationFn: ({ playerId, ratings }: { playerId: number; ratings: any }) =>
      playersApi.rate(playerId, ratings, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
      setEditingPlayerId(null)
      setEditRatings({})
    },
  })

  const players = data?.players || []
  const filteredPlayers = players.filter((player: any) =>
    player.name.toLowerCase().includes(search.toLowerCase()) ||
    player.nickname?.toLowerCase().includes(search.toLowerCase())
  )

  // 정렬 - 내 평가 모드일 때는 내 평가 기준으로 정렬
  const sortedPlayers = [...filteredPlayers].sort((a: any, b: any) => {
    // 내 평가 모드일 때 내 평가 데이터 사용
    const aData = showMyRatings && a.my_rating ? a.my_rating : a
    const bData = showMyRatings && b.my_rating ? b.my_rating : b

    let aVal: number, bVal: number
    switch (sortField) {
      case 'name':
        return sortDesc ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)
      case 'attack':
        aVal = calculateAttack(aData)
        bVal = calculateAttack(bData)
        break
      case 'defense':
        aVal = calculateDefense(aData)
        bVal = calculateDefense(bData)
        break
      case 'physical':
        aVal = calculatePhysical(aData)
        bVal = calculatePhysical(bData)
        break
      case 'creativity':
        aVal = calculateCreativity(aData)
        bVal = calculateCreativity(bData)
        break
      case 'ratingCount':
        aVal = a.rating_count || 0
        bVal = b.rating_count || 0
        break
      // 개별 능력치 정렬
      case 'shooting':
      case 'offball_run':
      case 'ball_keeping':
      case 'passing':
      case 'linkup':
      case 'intercept':
      case 'marking':
      case 'stamina':
      case 'speed':
        aVal = aData[sortField] || DEFAULT_STAT
        bVal = bData[sortField] || DEFAULT_STAT
        break
      case 'physical_stat':
        aVal = aData.physical || DEFAULT_STAT
        bVal = bData.physical || DEFAULT_STAT
        break
      default:
        aVal = calculateOverall(aData)
        bVal = calculateOverall(bData)
    }
    return sortDesc ? bVal - aVal : aVal - bVal
  })

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDesc(!sortDesc)
    } else {
      setSortField(field)
      setSortDesc(true)
    }
  }

  const handleStartEdit = (player: any) => {
    setEditingPlayerId(player.id)
    // 내가 이미 평가한 점수가 있으면 그 값으로, 없으면 기본값으로
    const myRating = player.my_rating
    setEditRatings({
      shooting: myRating?.shooting ?? DEFAULT_STAT,
      offball_run: myRating?.offball_run ?? DEFAULT_STAT,
      ball_keeping: myRating?.ball_keeping ?? DEFAULT_STAT,
      passing: myRating?.passing ?? DEFAULT_STAT,
      linkup: myRating?.linkup ?? DEFAULT_STAT,
      intercept: myRating?.intercept ?? DEFAULT_STAT,
      marking: myRating?.marking ?? DEFAULT_STAT,
      stamina: myRating?.stamina ?? DEFAULT_STAT,
      speed: myRating?.speed ?? DEFAULT_STAT,
      physical: myRating?.physical ?? DEFAULT_STAT,
    })
  }

  const handleSaveEdit = () => {
    if (!editingPlayerId) return
    rateMutation.mutate({
      playerId: editingPlayerId,
      ratings: {
        shooting: editRatings.shooting,
        offballRun: editRatings.offball_run,
        ballKeeping: editRatings.ball_keeping,
        passing: editRatings.passing,
        linkup: editRatings.linkup,
        intercept: editRatings.intercept,
        marking: editRatings.marking,
        stamina: editRatings.stamina,
        speed: editRatings.speed,
        physical: editRatings.physical,
      },
    })
  }

  const handleRatingChange = (key: string, value: number) => {
    setEditRatings({ ...editRatings, [key]: value })
  }

  // 평가 완료/미완료 통계
  const ratedCount = players.filter((p: any) => p.has_my_rating).length
  const totalCount = players.length

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
            능력치 평가
          </h1>
          <p className="text-slate-500 mt-2">선수들의 개인 능력치를 확인하고 평가하세요 (0~100점)</p>
        </div>

        <div className="flex items-center gap-3">
          {/* 내 평가 보기 토글 */}
          {isLoggedIn && (
            <button
              onClick={() => setShowMyRatings(!showMyRatings)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                showMyRatings
                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              {showMyRatings ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              내 평가
            </button>
          )}

          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="선수 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-56 pl-12 pr-4 py-2.5 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/50 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all shadow-sm text-sm"
            />
          </div>

          {/* 뷰 모드 토글 */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              <Table className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                viewMode === 'card'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 평가 진행률 (로그인 상태일 때만) */}
      {isLoggedIn && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-4 mb-6 border border-emerald-200 dark:border-emerald-500/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span className="font-medium text-emerald-700 dark:text-emerald-300">내 평가 진행률</span>
            </div>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {ratedCount} / {totalCount}명
            </span>
          </div>
          <div className="h-2 bg-emerald-200 dark:bg-emerald-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${totalCount > 0 ? (ratedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* 선수 목록 */}
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      ) : sortedPlayers.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-slate-400 dark:text-slate-600" />
          </div>
          <p className="text-slate-500">
            {search ? '검색 결과가 없습니다.' : '등록된 선수가 없습니다.'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* 테이블 뷰 - 전체 능력치 표시 (헤더 & 첫 열 고정) */
        <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800/50 overflow-hidden shadow-sm">
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-50 dark:bg-slate-800/95">
                  {/* 고정 열: # */}
                  <th className="sticky left-0 z-30 px-2 py-2 text-left text-slate-500 dark:text-slate-400 text-xs w-8 bg-slate-50 dark:bg-slate-800/95 border-b border-r border-slate-200 dark:border-slate-700">#</th>
                  {/* 고정 열: 선수 */}
                  <th
                    className="sticky left-8 z-30 px-2 py-2 text-left cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors text-sm w-24 bg-slate-50 dark:bg-slate-800/95 border-b border-r border-slate-200 dark:border-slate-700"
                    onClick={() => handleSort('name')}
                  >
                    <span className="flex items-center gap-1">
                      선수
                      {sortField === 'name' && <span className="text-xs">{sortDesc ? '↓' : '↑'}</span>}
                    </span>
                  </th>
                  <th
                    className="px-1 py-2 text-center cursor-pointer hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-sm font-bold w-14 border-b border-slate-200 dark:border-slate-700"
                    onClick={() => handleSort('overall')}
                  >
                    <span className="flex items-center justify-center gap-1">
                      종합
                      {sortField === 'overall' && <span className="text-xs">{sortDesc ? '↓' : '↑'}</span>}
                    </span>
                  </th>
                  {/* 개별 능력치 컬럼들 (정렬 가능) */}
                  {STAT_KEYS.map((stat) => {
                    const statSortKey = stat.key === 'physical' ? 'physical_stat' : stat.key
                    const isCurrentSort = sortField === statSortKey
                    return (
                      <th
                        key={stat.key}
                        className="px-1 py-2 text-center w-11 border-b border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                        onClick={() => handleSort(statSortKey as SortField)}
                        title={`${stat.label} 정렬`}
                      >
                        <span className={cn(
                          'text-xs font-medium flex items-center justify-center gap-0.5',
                          stat.color === 'red' && 'text-red-500',
                          stat.color === 'amber' && 'text-amber-500',
                          stat.color === 'blue' && 'text-blue-500',
                          stat.color === 'emerald' && 'text-emerald-500'
                        )}>
                          {stat.label.slice(0, 2)}
                          {isCurrentSort && <span className="text-[10px]">{sortDesc ? '↓' : '↑'}</span>}
                        </span>
                      </th>
                    )
                  })}
                  <th
                    className="px-1 py-2 text-center w-8 border-b border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                    onClick={() => handleSort('ratingCount')}
                    title="평가 수 정렬"
                  >
                    <span className="text-xs text-slate-400 flex items-center justify-center gap-0.5">
                      N
                      {sortField === 'ratingCount' && <span className="text-[10px]">{sortDesc ? '↓' : '↑'}</span>}
                    </span>
                  </th>
                  {isLoggedIn && (
                    <th className="px-1 py-2 text-center w-14 border-b border-slate-200 dark:border-slate-700"></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((player: any, idx: number) => {
                  const isEditing = editingPlayerId === player.id
                  const overall = calculateOverall(isEditing ? editRatings : (showMyRatings && player.my_rating ? player.my_rating : player))
                  const rowBg = isEditing
                    ? 'bg-emerald-50 dark:bg-emerald-900/20'
                    : !player.has_my_rating && isLoggedIn
                    ? 'bg-amber-50/50 dark:bg-amber-900/10'
                    : 'bg-white dark:bg-slate-900/50'

                  return (
                    <tr
                      key={player.id}
                      className={cn(
                        'border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
                        !player.has_my_rating && isLoggedIn && 'bg-amber-50/50 dark:bg-amber-900/10',
                        isEditing && 'bg-emerald-50 dark:bg-emerald-900/20'
                      )}
                    >
                      {/* 고정 열: # */}
                      <td className={cn('sticky left-0 z-10 px-2 py-1.5 text-slate-400 text-xs border-r border-slate-100 dark:border-slate-700/50', rowBg)}>{idx + 1}</td>
                      {/* 고정 열: 선수 */}
                      <td className={cn('sticky left-8 z-10 px-2 py-1.5 border-r border-slate-100 dark:border-slate-700/50', rowBg)}>
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 rounded flex items-center justify-center shrink-0">
                            {player.photo_url ? (
                              <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover rounded" />
                            ) : (
                              <span className="text-[10px] text-slate-600 dark:text-slate-300">{player.name.charAt(0)}</span>
                            )}
                          </div>
                          <Link
                            href={`/abilities/${player.id}`}
                            className="font-medium text-slate-900 dark:text-white truncate hover:text-emerald-600 dark:hover:text-emerald-400 text-sm"
                          >
                            {player.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <span className="font-bold text-amber-600 dark:text-amber-400 text-base">{overall.toFixed(0)}</span>
                      </td>
                      {/* 개별 능력치 셀들 */}
                      {STAT_KEYS.map((stat) => {
                        const displayData = showMyRatings && player.my_rating ? player.my_rating : player
                        const value = isEditing ? editRatings[stat.key] : (displayData[stat.key] || DEFAULT_STAT)

                        return (
                          <td key={stat.key} className="px-0.5 py-1.5 text-center">
                            {isEditing ? (
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={editRatings[stat.key]}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 1 : parseInt(e.target.value)
                                  handleRatingChange(stat.key, Math.max(1, Math.min(100, val)))
                                }}
                                className={cn(
                                  'w-10 px-0.5 py-0.5 text-center text-sm font-bold rounded border',
                                  'bg-white dark:bg-slate-800 focus:outline-none focus:ring-1',
                                  stat.color === 'red' && 'border-red-300 focus:ring-red-500 text-red-600 dark:text-red-400',
                                  stat.color === 'amber' && 'border-amber-300 focus:ring-amber-500 text-amber-600 dark:text-amber-400',
                                  stat.color === 'blue' && 'border-blue-300 focus:ring-blue-500 text-blue-600 dark:text-blue-400',
                                  stat.color === 'emerald' && 'border-emerald-300 focus:ring-emerald-500 text-emerald-600 dark:text-emerald-400'
                                )}
                              />
                            ) : (
                              <span className={cn(
                                'text-sm font-medium',
                                value >= 70 && stat.color === 'red' && 'text-red-600 dark:text-red-400',
                                value >= 70 && stat.color === 'amber' && 'text-amber-600 dark:text-amber-400',
                                value >= 70 && stat.color === 'blue' && 'text-blue-600 dark:text-blue-400',
                                value >= 70 && stat.color === 'emerald' && 'text-emerald-600 dark:text-emerald-400',
                                value < 70 && 'text-slate-500'
                              )}>
                                {value}
                              </span>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-1 py-1.5 text-center">
                        <span className="text-xs text-slate-400">{player.rating_count || 0}</span>
                      </td>
                      {isLoggedIn && (
                        <td className="px-1 py-1.5 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                onClick={() => { setEditingPlayerId(null); setEditRatings({}) }}
                                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                                disabled={rateMutation.isPending}
                              >
                                <X className="w-4 h-4 text-slate-500" />
                              </button>
                              <button
                                onClick={handleSaveEdit}
                                className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
                                disabled={rateMutation.isPending}
                              >
                                <Save className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-0.5">
                              {player.has_my_rating && (
                                <span className="px-1 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 rounded text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                  {player.my_rating?.overall || 0}
                                </span>
                              )}
                              <button
                                onClick={() => handleStartEdit(player)}
                                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                                title="평가하기"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* 카드 뷰 */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedPlayers.map((player: any, index: number) => (
            <PlayerAbilityCard key={player.id} player={player} rank={index + 1} isLoggedIn={isLoggedIn} showMyRatings={showMyRatings} />
          ))}
        </div>
      )}
    </div>
  )
}

function PlayerAbilityCard({ player, rank, isLoggedIn, showMyRatings }: { player: any; rank: number; isLoggedIn: boolean; showMyRatings: boolean }) {
  const displayData = showMyRatings && player.my_rating ? player.my_rating : player
  const overall = calculateOverall(displayData)
  const attackStats = calculateAttack(displayData)
  const creativityStats = calculateCreativity(displayData)
  const defenseStats = calculateDefense(displayData)
  const physicalStats = calculatePhysical(displayData)

  return (
    <Link
      href={`/abilities/${player.id}`}
      className={cn(
        'group block bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900/80 rounded-2xl p-5 border hover:border-emerald-300 dark:hover:border-emerald-500/30 transition-all duration-300 shadow-sm',
        !player.has_my_rating && isLoggedIn
          ? 'border-amber-300 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-900/10'
          : 'border-slate-200 dark:border-slate-800/50'
      )}
    >
      <div className="flex items-start gap-4">
        {/* 순위 & 프로필 */}
        <div className="relative">
          <div className="w-14 h-14 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 rounded-xl flex items-center justify-center border border-slate-300 dark:border-slate-700 group-hover:border-emerald-300 dark:group-hover:border-emerald-500/30 transition-colors">
            {player.photo_url ? (
              <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover rounded-xl" />
            ) : (
              <span className="text-2xl text-slate-600 dark:text-slate-300">{player.name.charAt(0)}</span>
            )}
          </div>
          <div className="absolute -top-2 -left-2 w-6 h-6 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400">
            {rank}
          </div>
          {/* 평가 여부 표시 */}
          {isLoggedIn && (
            <div className="absolute -bottom-1 -right-1">
              {player.has_my_rating ? (
                <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              ) : (
                <div className="w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                  <span className="text-[10px] font-bold text-amber-900">!</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
              {player.name}
            </h3>
            {player.nickname && (
              <span className="text-xs text-slate-500 truncate">({player.nickname})</span>
            )}
            <span className="text-xs text-slate-400">({player.rating_count || 0}명)</span>
          </div>

          {/* 종합 점수 */}
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{overall.toFixed(0)}</span>
            <span className="text-xs text-slate-500">종합</span>
            {showMyRatings && player.my_rating && (
              <span className="text-xs bg-emerald-100 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-700 dark:text-emerald-300">내 평가</span>
            )}
          </div>

          {/* 능력치 4분류 바 */}
          <div className="grid grid-cols-4 gap-2">
            <AbilityMiniBar label="공격" value={attackStats} color="red" />
            <AbilityMiniBar label="창의" value={creativityStats} color="amber" />
            <AbilityMiniBar label="수비" value={defenseStats} color="blue" />
            <AbilityMiniBar label="피지컬" value={physicalStats} color="emerald" />
          </div>
        </div>

        {/* 화살표 */}
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800/50 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20 transition-colors self-center">
          <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
        </div>
      </div>
    </Link>
  )
}

function AbilityMiniBar({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'red' | 'amber' | 'blue' | 'emerald'
}) {
  const percentage = value // 이제 0~100 기준
  const colorClasses = {
    red: 'bg-red-500',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
  }

  return (
    <div className="text-center">
      <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-1">
        <div
          className={cn('h-full rounded-full transition-all', colorClasses[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center justify-center gap-1">
        <span className="text-[10px] text-slate-500">{label}</span>
        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{value.toFixed(0)}</span>
      </div>
    </div>
  )
}

// 0~100점 기준 계산 함수
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
