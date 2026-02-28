'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Users,
  Search,
  AlertCircle,
  UserCheck,
  UserX,
  Trash2,
  ShieldAlert,
  Shield,
  ChevronLeft,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { adminApi } from '@/lib/api'
import { cn } from '@/lib/cn'

export default function AdminUsersPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'unlinked' | 'dummy' | 'admin'>('all')
  const { isAdmin, isLoggedIn, token } = useAuthStore()
  const queryClient = useQueryClient()

  // ✅ 모든 hooks는 조건부 return 전에
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminApi.searchUsers('', token!),
    enabled: !!(isLoggedIn && isAdmin),
  })

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId, token!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      queryClient.invalidateQueries({ queryKey: ['players'] })
      alert(data.message || '계정이 삭제되었습니다.')
    },
    onError: (error: any) => {
      alert(error.message || '삭제 중 오류가 발생했습니다.')
    },
  })

  const users: any[] = data?.users || []

  const filteredUsers = users.filter((u: any) => {
    const isDummy = u.email?.includes('@noemail.conerkicks.com')
    if (filter === 'unlinked' && u.is_linked) return false
    if (filter === 'dummy' && !isDummy) return false
    if (filter === 'admin' && u.role !== 'ADMIN') return false
    if (search) {
      const q = search.toLowerCase()
      if (!u.username?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const unlinkedCount = users.filter((u: any) => !u.is_linked).length
  const dummyCount = users.filter((u: any) => u.email?.includes('@noemail.conerkicks.com')).length
  const adminCount = users.filter((u: any) => u.role === 'ADMIN').length

  if (!isLoggedIn || !isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">접근 권한이 없습니다</h2>
        <Link href="/" className="text-emerald-600 hover:underline">홈으로 돌아가기</Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/players"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-slate-500" />
              계정 관리
            </h1>
          </div>
          <p className="text-slate-500 text-sm ml-7">가입된 유저 계정을 관리합니다</p>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{users.length}</p>
          <p className="text-sm text-slate-500">전체 계정</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-4 border border-emerald-200 dark:border-emerald-500/30">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{users.length - unlinkedCount}</p>
          <p className="text-sm text-emerald-600 dark:text-emerald-400">선수 연동됨</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">{unlinkedCount}</p>
          <p className="text-sm text-slate-500">미연동 계정</p>
        </div>
        {dummyCount > 0 && (
          <div className="bg-purple-50 dark:bg-purple-500/10 rounded-xl p-4 border border-purple-200 dark:border-purple-500/30">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{dummyCount}</p>
            <p className="text-sm text-purple-600 dark:text-purple-400">더미 계정</p>
          </div>
        )}
      </div>

      {/* 더미 계정 안내 */}
      {dummyCount > 0 && (
        <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 rounded-xl flex items-start gap-2 text-sm text-purple-700 dark:text-purple-300">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            <strong>{dummyCount}개</strong>의 더미 계정(<code className="text-xs bg-purple-100 dark:bg-purple-900/50 px-1 rounded">@noemail.conerkicks.com</code>)이 있습니다.
            이전 시스템 마이그레이션 시 생성된 계정으로, 실제 선수와 연동된 경우 새 계정으로 연동을 변경한 뒤 삭제할 수 있습니다.
          </span>
        </div>
      )}

      {/* 필터 */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="username 또는 이메일 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'unlinked', 'dummy', 'admin'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                filter === f
                  ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              )}
            >
              {f === 'all' && `전체 (${users.length})`}
              {f === 'unlinked' && `미연동 (${unlinkedCount})`}
              {f === 'dummy' && `더미 (${dummyCount})`}
              {f === 'admin' && `관리자 (${adminCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* 유저 목록 */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500">계정이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">계정</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-500 hidden sm:table-cell">이메일</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">연동 선수</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">역할</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredUsers.map((user: any) => {
                const isDummy = user.email?.includes('@noemail.conerkicks.com')
                const isAdminUser = user.role === 'ADMIN'
                return (
                  <tr
                    key={user.id}
                    className={cn(
                      'hover:bg-slate-50 dark:hover:bg-slate-800/50',
                      isDummy && 'bg-purple-50/30 dark:bg-purple-500/5'
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                          isAdminUser
                            ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                            : isDummy
                            ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        )}>
                          {isAdminUser ? <Shield className="w-4 h-4" /> : (user.username?.[0]?.toUpperCase() || '?')}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white text-sm">@{user.username}</p>
                          {isDummy && (
                            <p className="text-xs text-purple-500 dark:text-purple-400">더미 계정</p>
                          )}
                          <p className="text-xs text-slate-500 sm:hidden">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <p className="text-sm text-slate-600 dark:text-slate-400 font-mono text-xs">{user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.player_name ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-full">
                          <UserCheck className="w-3 h-3" />
                          {user.player_name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-1 rounded-full">
                          <UserX className="w-3 h-3" />
                          미연동
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isAdminUser ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full font-medium">
                          <Shield className="w-3 h-3" />
                          관리자
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">일반</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isAdminUser ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <button
                          onClick={() => {
                            const msg = user.player_name
                              ? `"@${user.username}" 계정을 삭제하시겠습니까?\n\n⚠️ "${user.player_name}" 선수와의 연동이 해제되고, 이 계정이 작성한 능력치 평가가 삭제됩니다.\n\n이 작업은 되돌릴 수 없습니다.`
                              : `"@${user.username}" 계정을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
                            if (confirm(msg)) {
                              deleteUserMutation.mutate(user.id)
                            }
                          }}
                          disabled={deleteUserMutation.isPending}
                          title="계정 삭제"
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-red-100 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-400">총 {filteredUsers.length}개 계정 표시 중</p>
          </div>
        </div>
      )}
    </div>
  )
}
