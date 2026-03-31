'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X, User, LogOut, Crown, Sun, Moon, LayoutDashboard, ChevronDown, Check, Plus, Users, Circle } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/cn'
import { NotificationDropdown } from './notification-dropdown'

const CLUB_GRADIENTS = [
  'from-emerald-500 to-teal-600',
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-red-600',
  'from-cyan-500 to-blue-600',
]

const navItems = [
  { href: '/', label: '홈' },
  { href: '/sessions', label: '일정' },
  { href: '/ranking', label: '선수/랭킹' },
  { href: '/abilities', label: '능력치' },
  { href: '/stats', label: '통계' },
  { href: '/hall-of-fame', label: '명예의 전당' },
  { href: '/board', label: '게시판' },
]

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [clubDropdownOpen, setClubDropdownOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const { isLoggedIn, user, club, clubs, isAdmin, logout, setActiveClub } = useAuthStore()
  const isPro = club?.isPro
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // 드롭다운 바깥 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setClubDropdownOpen(false)
      }
    }
    if (clubDropdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [clubDropdownOpen])

  const handleSwitchClub = (c: any) => {
    setActiveClub(c)
    setClubDropdownOpen(false)
    router.push('/')
  }

  const clubGradient = (index: number) => CLUB_GRADIENTS[index % CLUB_GRADIENTS.length]

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 좌상단: 클럽 전환 or 앱 로고 */}
          {mounted && isLoggedIn && club ? (
            <div className="relative flex items-center" ref={dropdownRef}>
              <Link
                href="/"
                className="flex items-center gap-2.5 px-2 py-1.5 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
              >
                {/* 클럽 아바타 */}
                {club.logoUrl ? (
                  <img
                    src={`${process.env.NEXT_PUBLIC_API_URL || 'https://cornerkicks-api.conerkicks.workers.dev'}${club.logoUrl}`}
                    className="w-9 h-9 rounded-xl object-cover"
                    alt={club.name}
                  />
                ) : (
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${clubGradient(clubs.indexOf(club))} flex items-center justify-center shadow-sm`}>
                    <span className="text-sm font-bold text-white">{club.name.charAt(0)}</span>
                  </div>
                )}
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white leading-none max-w-[140px] truncate">
                    {club.name}
                  </span>
                  <span className="text-[10px] text-slate-400 leading-none mt-0.5">코너킥스</span>
                </div>
              </Link>
              <button
                onClick={() => setClubDropdownOpen(!clubDropdownOpen)}
                className="p-1.5 -ml-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
              >
                <ChevronDown className={cn(
                  'w-4 h-4 text-slate-400 transition-transform',
                  clubDropdownOpen && 'rotate-180'
                )} />
              </button>

              {/* 클럽 전환 드롭다운 */}
              {clubDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl shadow-black/10 dark:shadow-black/30 overflow-hidden z-50">
                  <div className="px-2 pt-2 pb-2 max-h-[280px] overflow-y-auto">
                    {clubs.map((c, i) => {
                      const isActive = club.id === c.id
                      return (
                        <button
                          key={c.id}
                          onClick={() => handleSwitchClub(c)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
                            isActive
                              ? 'bg-primary/5'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          )}
                        >
                          {c.logoUrl ? (
                            <img
                              src={`${process.env.NEXT_PUBLIC_API_URL || 'https://cornerkicks-api.conerkicks.workers.dev'}${c.logoUrl}`}
                              className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                              alt={c.name}
                            />
                          ) : (
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${clubGradient(i)} flex items-center justify-center flex-shrink-0`}>
                              <span className="text-sm font-bold text-white">{c.name.charAt(0)}</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{c.name}</span>
                              {c.isPro && (
                                <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />
                              )}
                            </div>
                            <span className="text-xs text-slate-400">{c.myRole === 'owner' ? '오너' : c.myRole === 'admin' ? '관리자' : '멤버'}</span>
                          </div>
                          {isActive && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                  <div className="border-t border-slate-100 dark:border-slate-800 px-2 py-2">
                    <Link
                      href="/clubs"
                      onClick={() => setClubDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      클럽 참여 / 만들기
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 bg-brand-green rounded-xl flex items-center justify-center shadow-lg shadow-brand-green/20 group-hover:shadow-brand-green/40 transition-shadow">
                <Circle className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                코너킥스
              </span>
            </Link>
          )}

          {/* 데스크탑 네비게이션 */}
          <nav aria-label="주 메뉴" className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200 dark:border-slate-800/50">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href))
                    ? 'bg-brand-green/20 text-brand-green'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/50'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* 유저 메뉴 */}
          <div className="hidden md:flex items-center gap-3 min-w-[120px] justify-end">
            {/* 테마 토글 */}
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl transition-colors"
                title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            )}

            {/* 인증 영역 */}
            {mounted ? (
              isLoggedIn ? (
                <div className="flex items-center gap-2">
                  {!isPro && club && (
                    <Link
                      href="/upgrade"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-green/20 text-brand-green rounded-lg border border-brand-green/30 hover:bg-brand-green/30 transition-all"
                    >
                      <Crown className="w-3 h-3" />
                      PRO
                    </Link>
                  )}
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 rounded-lg border border-amber-300 dark:border-amber-500/30 hover:from-amber-500/30 hover:to-orange-500/30 transition-all"
                    >
                      <LayoutDashboard className="w-3 h-3" />
                      관리자
                    </Link>
                  )}
                  <NotificationDropdown />
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl transition-colors"
                  >
                    <div className="w-7 h-7 bg-gradient-to-br from-slate-400 to-slate-500 dark:from-slate-600 dark:to-slate-700 rounded-lg flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-medium">{user?.username}</span>
                  </Link>
                  <button
                    onClick={logout}
                    className="p-2.5 text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="px-5 py-2 bg-primary hover:bg-primary-hover rounded-xl text-sm font-medium text-primary-foreground shadow-md transition-all"
                >
                  로그인
                </Link>
              )
            ) : (
              <div className="w-20 h-9 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
            )}
          </div>

          {/* 모바일 메뉴 버튼 */}
          <div className="flex md:hidden items-center gap-2">
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 모바일 메뉴 */}
      {mobileMenuOpen && (
        <nav aria-label="모바일 메뉴" className="md:hidden border-t border-slate-200 dark:border-slate-800/50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl">
          <div className="px-4 py-4 space-y-1">
            {/* 모바일: 클럽 전환 */}
            {mounted && isLoggedIn && clubs.length > 1 && (
              <div className="pb-3 mb-3 border-b border-slate-200 dark:border-slate-800/50">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider px-4 mb-2">클럽 전환</p>
                {clubs.map((c, i) => {
                  const isActive = club?.id === c.id
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        handleSwitchClub(c)
                        setMobileMenuOpen(false)
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-colors',
                        isActive ? 'bg-primary/5' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      )}
                    >
                      {c.logoUrl ? (
                        <img
                          src={`${process.env.NEXT_PUBLIC_API_URL || 'https://cornerkicks-api.conerkicks.workers.dev'}${c.logoUrl}`}
                          className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                          alt={c.name}
                        />
                      ) : (
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${clubGradient(i)} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-xs font-bold text-white">{c.name.charAt(0)}</span>
                        </div>
                      )}
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{c.name}</span>
                      {isActive && <Check className="w-4 h-4 text-primary flex-shrink-0 ml-auto" />}
                    </button>
                  )
                })}
              </div>
            )}

            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'block px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                  (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href))
                    ? 'bg-brand-green/20 text-brand-green'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
                )}
              >
                {item.label}
              </Link>
            ))}

            <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800/50">
              {mounted && isLoggedIn ? (
                <div className="space-y-1">
                  {!isPro && club && (
                    <Link
                      href="/upgrade"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-brand-green hover:bg-brand-green/10 rounded-xl"
                    >
                      <div className="w-8 h-8 bg-brand-green rounded-lg flex items-center justify-center">
                        <Crown className="w-4 h-4 text-white" />
                      </div>
                      <div className="font-medium">PRO로 업그레이드</div>
                    </Link>
                  )}
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-xl"
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                        <LayoutDashboard className="w-4 h-4 text-white" />
                      </div>
                      <div className="font-medium">관리자 대시보드</div>
                    </Link>
                  )}
                  <Link
                    href="/clubs"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-slate-400 to-slate-500 dark:from-slate-600 dark:to-slate-700 rounded-lg flex items-center justify-center">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <div className="font-medium">클럽 관리</div>
                  </Link>
                  <Link
                    href="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-slate-400 to-slate-500 dark:from-slate-600 dark:to-slate-700 rounded-lg flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="font-medium">{user?.username}</div>
                      {isAdmin && (
                        <span className="text-xs text-amber-500 dark:text-amber-400">관리자</span>
                      )}
                    </div>
                  </Link>
                  <button
                    onClick={() => {
                      logout()
                      setMobileMenuOpen(false)
                    }}
                    className="flex items-center gap-3 w-full px-4 py-3 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    로그아웃
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 bg-primary hover:bg-primary-hover rounded-xl text-center text-sm font-medium text-primary-foreground"
                >
                  로그인
                </Link>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  )
}
