'use client'

import { Medal } from 'lucide-react'
import { cn } from '@/lib/cn'

type Entry = { id: number; name: string; value: number | string }

const MEDALS = ['\u{1F947}', '\u{1F948}', '\u{1F949}']

export function PeriodAwards({ data, enabledEvents, periodLabel }: {
  data: any
  enabledEvents: string[]
  periodLabel: string
}) {
  if (!data) return null
  const rankings: any[] = data.rankings || []

  const top3 = (list: any[], key: string, format?: (v: number) => string): Entry[] =>
    (list || []).slice(0, 3).map((p) => ({ id: p.id, name: p.name, value: format ? format(p[key]) : p[key] }))

  const attackPointRanking = [...rankings]
    .map((p) => ({ ...p, attackPoints: (p.goals || 0) + (p.assists || 0) }))
    .filter((p) => p.attackPoints > 0)
    .sort((a, b) => b.attackPoints - a.attackPoints)

  const categories: { name: string; icon: string; entries: Entry[]; show: boolean }[] = [
    { name: '득점왕', icon: '⚽', entries: top3(data.goalRanking, 'goals'), show: true },
    { name: '도움왕', icon: '\u{1F170}️', entries: top3(data.assistRanking, 'assists'), show: true },
    { name: '공격포인트왕', icon: '⚡', entries: top3(attackPointRanking, 'attackPoints'), show: true },
    { name: '수비왕', icon: '\u{1F6E1}️', entries: top3(data.defenseRanking, 'defenses'), show: enabledEvents.includes('DEFENSE') },
    { name: 'MVP', icon: '\u{1F3C6}', entries: top3(data.mvpRanking, 'mvpCount'), show: true },
    { name: '승률왕', icon: '\u{1F4C8}', entries: top3(data.winRateRanking, 'winRate', (v) => `${v}%`), show: true },
    { name: '출석왕', icon: '\u{1F4C5}', entries: top3(data.attendanceRanking, 'attendance'), show: true },
  ].filter((c) => c.show && c.entries.length > 0)

  if (categories.length === 0) return null

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Medal className="w-5 h-5 text-primary" />
        {periodLabel} 결산 TOP3
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map((cat) => (
          <div key={cat.name} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-sm font-bold text-slate-900 dark:text-white mb-3">
              <span className="mr-1.5">{cat.icon}</span>{cat.name}
            </p>
            <ul className="space-y-1.5">
              {cat.entries.map((e, i) => (
                <li key={e.id} className="flex items-center justify-between text-sm">
                  <span className={cn('flex items-center gap-1.5 truncate', i === 0 ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400')}>
                    <span>{MEDALS[i]}</span>{e.name}
                  </span>
                  <span className={cn('font-semibold shrink-0', i === 0 ? 'text-primary' : 'text-slate-500 dark:text-slate-400')}>{e.value}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
