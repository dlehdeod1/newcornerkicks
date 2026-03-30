'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Calendar, Users, CircleUser, Trophy,
  Bell, BellRing, ShieldOff, Settings, Home, Menu, X,
  Banknote, BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/cn'

type MenuItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean }
type MenuGroup = { label?: string; items: MenuItem[] }

const menuGroups: MenuGroup[] = [
  {
    items: [
      { href: '/admin', label: '대시보드', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: '운영',
    items: [
      { href: '/admin/sessions', label: '세션 관리', icon: Calendar },
      { href: '/admin/players', label: '선수 관리', icon: Users },
      { href: '/admin/users', label: '유저 관리', icon: CircleUser },
    ],
  },
  {
    label: '소통',
    items: [
      { href: '/admin/announcements', label: '공지 관리', icon: Bell },
      { href: '/admin/notifications', label: '알림 관리', icon: BellRing },
    ],
  },
  {
    label: '재정',
    items: [
      { href: '/admin/fees', label: '참가비 설정', icon: Banknote },
      { href: '/admin/exemptions', label: '회비 면제', icon: ShieldOff },
    ],
  },
  {
    label: '기록/통계',
    items: [
      { href: '/admin/rankings', label: '랭킹 관리', icon: Trophy },
      { href: '/admin/records', label: '기록 설정', icon: BarChart3 },
    ],
  },
  {
    label: '설정',
    items: [
      { href: '/admin/settings', label: '클럽 정보', icon: Settings },
    ],
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (item: MenuItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href + '/') || pathname === item.href

  const sidebar = (
    <nav className="flex flex-col h-full py-4">
      <div className="flex-1 space-y-4 px-3">
        {menuGroups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <Link key={item.href} href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                    isActive(item)
                      ? 'bg-primary/5 text-primary font-semibold border-l-2 border-primary -ml-[2px]'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  )}>
                  <item.icon className="w-5 h-5 shrink-0" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="px-3 pt-4 border-t border-slate-200 dark:border-slate-800">
        <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-500 hover:text-primary transition-colors">
          <Home className="w-5 h-5" /> 홈으로
        </Link>
      </div>
    </nav>
  )

  return (
    <div className="flex">
      <aside className="hidden md:block w-60 shrink-0 h-[calc(100vh-64px)] sticky top-16 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 overflow-y-auto">
        {sidebar}
      </aside>
      <button onClick={() => setMobileOpen(true)} className="md:hidden fixed bottom-4 right-4 z-40 w-12 h-12 bg-brand-green text-white rounded-full shadow-lg flex items-center justify-center">
        <Menu className="w-6 h-6" />
      </button>
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-64 z-50 bg-white dark:bg-slate-950 shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <span className="font-semibold text-slate-900 dark:text-white">관리자 메뉴</span>
              <button onClick={() => setMobileOpen(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            {sidebar}
          </aside>
        </>
      )}
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
