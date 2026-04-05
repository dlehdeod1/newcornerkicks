'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

const STAT_LABELS: Record<string, string> = {
  goals: '득점', assists: '도움', mvpScore: '평점', mvpCount: 'MVP',
  attackPoints: '공격P', winRate: '승률', games: '경기',
  defenses: '수비', tackles: '태클', interceptions: '인터셉트',
  clearances: '클리어런스', saves: '선방', keyPasses: '키패스',
  dribbles: '돌파', shotsOn: '유효슈팅', shotsOff: '무효슈팅',
  sessionWins: '승', sessionLosses: '패', contribution: '공헌도',
}

const STAT_PRIORITY = ['goals', 'assists', 'mvpScore', 'mvpCount', 'attackPoints', 'winRate', 'games', 'contribution']

// 정렬 기준 제외하고 우선순위대로 최대 6개 반환
function getVisibleStats(sortBy: string): string[] {
  return STAT_PRIORITY.filter(s => s !== sortBy).slice(0, 6)
}

// 반응형 breakpoint 클래스: 인덱스별로 다른 breakpoint에서 표시
const RESPONSIVE_CLASS = [
  'hidden sm:block',   // 0,1: sm부터
  'hidden sm:block',
  'hidden md:block',   // 2,3: md부터
  'hidden md:block',
  'hidden lg:block',   // 4,5: lg부터
  'hidden lg:block',
]

function getStatValue(player: any, key: string): string {
  if (key === 'attackPoints') return String((player.goals || 0) + (player.assists || 0))
  if (key === 'winRate') return player.winRate ? player.winRate + '%' : '-'
  if (key === 'mvpScore') return player.mvpScore != null ? Number(player.mvpScore).toFixed(1) : '0.0'
  if (key === 'contribution') {
    const g = player.games || 0
    return g > 0 ? ((player.goals + player.assists) / g).toFixed(2) : '0.00'
  }
  return String(player[key] || 0)
}

interface CompactPlayerListProps {
  rankings: any[]
  sortBy: string
  enabledEvents: string[]
}

export function CompactPlayerList({ rankings, sortBy, enabledEvents }: CompactPlayerListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  useEffect(() => { setExpandedId(null) }, [sortBy])
  const visibleStats = getVisibleStats(sortBy)

  return (
    <div className="flex flex-col gap-1.5">
      {rankings.map((player, index) => (
        <CompactRow
          key={player.id}
          player={player}
          rank={index + 1}
          sortBy={sortBy}
          visibleStats={visibleStats}
          enabledEvents={enabledEvents}
          isExpanded={expandedId === player.id}
          onToggle={() => setExpandedId(expandedId === player.id ? null : player.id)}
        />
      ))}
    </div>
  )
}

function CompactRow({
  player, rank, sortBy, visibleStats, enabledEvents, isExpanded, onToggle,
}: {
  player: any; rank: number; sortBy: string; visibleStats: string[]
  enabledEvents: string[]; isExpanded: boolean; onToggle: () => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const borderColor = rank === 1 ? 'border-l-amber-500' : rank === 2 ? 'border-l-slate-400' : rank === 3 ? 'border-l-amber-700' : 'border-l-transparent'
  const rankBg = rank === 1 ? 'bg-amber-500 text-white' : rank === 2 ? 'bg-slate-400 text-white' : rank === 3 ? 'bg-amber-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'

  return (
    <div className={cn(
      'bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-border border-l-[3px] overflow-hidden',
      borderColor
    )}>
      <div
        onClick={onToggle}
        className="flex items-center gap-2.5 px-3 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
      >
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0', rankBg)}>
          {rank}
        </div>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="w-7 h-7 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
            {player.photo_url
              ? <img src={player.photo_url} alt="" className="w-full h-full object-cover rounded-lg" />
              : <span className="text-xs font-bold text-slate-500">{player.name?.charAt(0)}</span>
            }
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{player.name}</span>
        </div>
        <div className="text-center bg-primary/5 px-2 py-1 rounded-lg border border-primary/30 shrink-0">
          <div className="text-[9px] text-primary font-semibold">{STAT_LABELS[sortBy] || sortBy}</div>
          <div className="text-sm font-bold text-primary">{getStatValue(player, sortBy)}</div>
        </div>
        {visibleStats.map((key, i) => (
          <div key={key} className={cn('text-center shrink-0', RESPONSIVE_CLASS[i] || 'hidden lg:block')}>
            <div className="text-[9px] text-slate-400">{STAT_LABELS[key]}</div>
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{getStatValue(player, key)}</div>
          </div>
        ))}
        <div className="shrink-0 flex items-center gap-1">
          <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', isExpanded && 'rotate-180')} />
          <Link href={`/ranking/${player.id}`} onClick={e => e.stopPropagation()}>
            <ChevronRight className="w-4 h-4 text-slate-400 hover:text-primary" />
          </Link>
        </div>
      </div>

      <div
        ref={contentRef}
        className="transition-all duration-150 ease-in-out overflow-hidden"
        style={{ maxHeight: isExpanded ? contentRef.current?.scrollHeight + 'px' : '0px' }}
      >
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <MiniStat label="경기" value={player.games || 0} />
            <MiniStat label="승/패/무" value={`${player.sessionWins || 0}/${player.sessionLosses || 0}/${player.draws || 0}`} />
            <MiniStat label="승률" value={player.winRate ? player.winRate + '%' : '-'} />
            <MiniStat label="공헌도" value={player.games > 0 ? ((player.goals + player.assists) / player.games).toFixed(2) : '0.00'} />
            <MiniStat label="MVP" value={player.mvpCount || 0} />
            {enabledEvents.includes('DEFENSE') && <MiniStat label="수비" value={player.defenses || 0} />}
            {enabledEvents.includes('TACKLE') && <MiniStat label="태클" value={player.tackles || 0} />}
            {enabledEvents.includes('INTERCEPTION') && <MiniStat label="인터셉트" value={player.interceptions || 0} />}
            {enabledEvents.includes('CLEARANCE') && <MiniStat label="클리어런스" value={player.clearances || 0} />}
            {enabledEvents.includes('SAVE') && <MiniStat label="선방" value={player.saves || 0} />}
            {enabledEvents.includes('KEY_PASS') && <MiniStat label="키패스" value={player.keyPasses || 0} />}
            {enabledEvents.includes('DRIBBLE') && <MiniStat label="돌파" value={player.dribbles || 0} />}
            {enabledEvents.includes('SHOT_ON') && <MiniStat label="유효슈팅" value={player.shotsOn || 0} />}
            {enabledEvents.includes('SHOT_OFF') && <MiniStat label="무효슈팅" value={player.shotsOff || 0} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-slate-50 dark:bg-card-elevated rounded-lg px-3 py-2 text-center">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{value}</div>
    </div>
  )
}
