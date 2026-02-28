'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Users,
  Plus,
  Search,
  AlertCircle,
  UserCheck,
  UserX,
  RefreshCw,
  KeyRound,
  X,
  Link2,
  Link2Off,
  Trash2,
  ShieldAlert,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { playersApi, adminApi } from '@/lib/api'
import { cn } from '@/lib/cn'

export default function AdminPlayersPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const { isAdmin, isLoggedIn, token } = useAuthStore()
  const queryClient = useQueryClient()
  const [resetModal, setResetModal] = useState<{ playerName: string; tempPassword: string } | null>(null)
  const [relinkModal, setRelinkModal] = useState<{ playerId: number; playerName: string; currentUserId: string | null } | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)

  // ✅ 모든 hooks는 조건부 return 전에 선언해야 합니다 (React Rules of Hooks)
  const { data, isLoading } = useQuery({
    queryKey: ['players', 'all'],
    queryFn: () => playersApi.list(token, { all: true }),
    enabled: !!(isLoggedIn && isAdmin),
  })

  // onSuccess에서 players를 참조하므로 useMutation 전에 선언
  const players = data?.players || []

  const approveMutation = useMutation({
    mutationFn: (playerId: number) => playersApi.approveLink(playerId, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
    },
    onError: (error: any) => {
      alert(error.message || '승인 중 오류가 발생했습니다.')
    },
  })

  const toggleGuestMutation = useMutation({
    mutationFn: ({ id, isGuest }: { id: number; isGuest: boolean }) =>
      playersApi.update(id, { isGuest: isGuest ? 1 : 0 }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
    },
    onError: (error: any) => {
      alert(error.message || '변경 중 오류가 발생했습니다.')
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: (playerId: number) => adminApi.resetPlayerPassword(playerId, token!),
    onSuccess: (data, playerId) => {
      const player = players.find((p: any) => p.id === playerId)
      setResetModal({ playerName: player?.name || '', tempPassword: data.tempPassword })
    },
    onError: (error: any) => {
      alert(error.message || '비밀번호 초기화 중 오류가 발생했습니다.')
    },
  })

  const relinkMutation = useMutation({
    mutationFn: ({ playerId, userId }: { playerId: number; userId: string | null }) =>
      adminApi.relinkPlayer(playerId, userId, token!),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
      setRelinkModal(null)
      setUserSearch('')
      setAllUsers([])
      alert(userId ? '연동이 변경되었습니다.' : '연동이 해제되었습니다.')
    },
    onError: (error: any) => {
      alert(error.message || '연동 변경 중 오류가 발생했습니다.')
    },
  })

  const recalculateMutation = useMutation({
    mutationFn: () => adminApi.recalculateAllStats(token!),
    onSuccess: (data) => {
      alert(data.message || '능력치가 재계산되었습니다.')
      queryClient.invalidateQueries({ queryKey: ['players'] })
    },
    onError: (error: any) => {
      alert(error.message || '재계산 중 오류가 발생했습니다.')
    },
  })

  const deletePlayerMutation = useMutation({
    mutationFn: (playerId: number) => playersApi.delete(playerId, token!),
    onSuccess: (_, playerId) => {
      const player = players.find((p: any) => p.id === playerId)
      queryClient.invalidateQueries({ queryKey: ['players'] })
      alert(`"${player?.name || '선수'}"이(가) 삭제되었습니다.`)
    },
    onError: (error: any) => {
      alert(error.message || '삭제 중 오류가 발생했습니다.')
    },
  })

  // 모달 열릴 때 전체 유저 목록 로드
  const loadAllUsers = useCallback(async () => {
    if (!token) return
    setIsLoadingUsers(true)
    try {
      const res = await adminApi.searchUsers('', token)
      setAllUsers(res.users || [])
    } catch {
      setAllUsers([])
    } finally {
      setIsLoadingUsers(false)
    }
  }, [token])

  useEffect(() => {
    if (relinkModal) {
      setUserSearch('')
      loadAllUsers()
    }
  }, [relinkModal, loadAllUsers])

  // 클라이언트 사이드 필터링
  const filteredUsers = userSearch.trim().length === 0
    ? allUsers
    : allUsers.filter((u: any) =>
        u.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearch.toLowerCase())
      )

  const unlinkedUserCount = allUsers.filter((u: any) => !u.is_linked).length

  const filteredPlayers = players
    .filter((p: any) => {
      if (filter === 'pending' && p.link_status !== 'PENDING') return false
      if (filter === 'linked' && p.link_status !== 'ACTIVE') return false
      // ✅ 버그 수정: null 또는 'UNLINKED' 모두 미연동으로 처리
      if (filter === 'unlinked' && p.link_status !== null && p.link_status !== 'UNLINKED') return false
      if (filter === 'guest' && !p.is_guest) return false
      if (filter === 'dummy' && !p.user_email?.includes('@noemail.conerkicks.com')) return false
      if (search && !p.name?.toLowerCase().includes(search.toLowerCase()) &&
          !p.nickname?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })

  const pendingCount = players.filter((p: any) => p.link_status === 'PENDING').length
  const linkedCount = players.filter((p: any) => p.link_status === 'ACTIVE').length
  const guestCount = players.filter((p: any) => p.is_guest).length
  const dummyCount = players.filter((p: any) => p.user_email?.includes('@noemail.conerkicks.com')).length

  // ✅ 조건부 return은 모든 hooks 선언 이후에 위치
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
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-500" />
            선수 관리
          </h1>
          <p className="text-slate-500 mt-1">선수 등록 및 연동 승인</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm"
          >
            <Users className="w-4 h-4" />
            계정 관리
          </Link>
          <button
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm"
          >
            <RefreshCw className={cn('w-4 h-4', recalculateMutation.isPending && 'animate-spin')} />
            능력치 재계산
          </button>
          <Link
            href="/admin/players/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            선수 등록
          </Link>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{players.length}</p>
          <p className="text-sm text-slate-500">전체 선수</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-4 border border-emerald-200 dark:border-emerald-500/30">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{linkedCount}</p>
          <p className="text-sm text-emerald-600 dark:text-emerald-400">연동 완료</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4 border border-amber-200 dark:border-amber-500/30">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pendingCount}</p>
          <p className="text-sm text-amber-600 dark:text-amber-400">승인 대기</p>
        </div>
        {dummyCount > 0 && (
          <div className="bg-purple-50 dark:bg-purple-500/10 rounded-xl p-4 border border-purple-200 dark:border-purple-500/30">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{dummyCount}</p>
            <p className="text-sm text-purple-600 dark:text-purple-400">더미 연동</p>
          </div>
        )}
      </div>

      {/* 필터 */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="선수 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'linked', 'unlinked', 'guest', 'dummy'] as const).map((f) => (
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
              {f === 'all' && '전체'}
              {f === 'pending' && `승인 대기${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
              {f === 'linked' && '연동 완료'}
              {f === 'unlinked' && '미연동'}
              {f === 'guest' && `용병 (${guestCount})`}
              {f === 'dummy' && `더미 연동${dummyCount > 0 ? ` (${dummyCount})` : ''}`}
            </button>
          ))}
        </div>
      </div>

      {/* 더미 연동 안내 */}
      {dummyCount > 0 && filter !== 'dummy' && (
        <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 rounded-xl flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>
            <strong>{dummyCount}명</strong>의 선수가 더미 계정(noemail)에 연동되어 있습니다.
            실제 계정으로 연동 변경이 필요할 수 있습니다.{' '}
            <button onClick={() => setFilter('dummy')} className="underline font-medium">확인하기</button>
          </span>
        </div>
      )}

      {/* 비밀번호 초기화 결과 모달 */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm border border-slate-200 dark:border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-orange-500" />
                비밀번호 초기화 완료
              </h3>
              <button
                onClick={() => setResetModal(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              <span className="font-semibold text-slate-900 dark:text-white">{resetModal.playerName}</span>의
              임시 비밀번호가 생성되었습니다. 본인에게 직접 전달해주세요.
            </p>
            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 text-center mb-4">
              <p className="text-xs text-slate-500 mb-1">임시 비밀번호</p>
              <p className="text-2xl font-mono font-bold text-orange-600 dark:text-orange-400 tracking-widest">
                {resetModal.tempPassword}
              </p>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center mb-4">
              로그인 후 비밀번호를 변경하도록 안내해주세요.
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(resetModal.tempPassword)
                alert('클립보드에 복사되었습니다.')
              }}
              className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              복사하기
            </button>
          </div>
        </div>
      )}

      {/* 연동 변경 모달 */}
      {relinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Link2 className="w-5 h-5 text-blue-500" />
                연동 변경 — {relinkModal.playerName}
              </h3>
              <button
                onClick={() => { setRelinkModal(null); setUserSearch(''); setAllUsers([]) }}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 미연동 계정 수 안내 */}
            {!isLoadingUsers && allUsers.length > 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                전체 <span className="font-semibold text-slate-700 dark:text-slate-300">{allUsers.length}</span>개 계정 중{' '}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{unlinkedUserCount}개</span>가 미연동 상태입니다.
              </p>
            )}

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="username 또는 이메일 검색..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                autoFocus
              />
            </div>

            {isLoadingUsers ? (
              <div className="space-y-2 mb-4">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
              </div>
            ) : filteredUsers.length > 0 ? (
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-4 max-h-64 overflow-y-auto">
                {filteredUsers.map((user: any) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      if (confirm(`"${relinkModal.playerName}" 선수를 @${user.username}(${user.email}) 계정으로 연동하시겠습니까?${user.player_name ? `\n\n⚠️ 이 계정은 현재 "${user.player_name}" 선수에 연동되어 있습니다.` : ''}`)) {
                        relinkMutation.mutate({ playerId: relinkModal.playerId, userId: user.id })
                      }
                    }}
                    disabled={relinkMutation.isPending}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-500/10 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">@{user.username}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                    {user.player_name ? (
                      <span className="text-xs bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full shrink-0">
                        {user.player_name} 연동중
                      </span>
                    ) : (
                      <span className="text-xs bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full shrink-0">
                        미연동
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-3 mb-4">검색 결과가 없습니다.</p>
            )}

            {relinkModal.currentUserId && (
              <button
                onClick={() => {
                  if (confirm(`"${relinkModal.playerName}" 선수의 연동을 해제하시겠습니까?`)) {
                    relinkMutation.mutate({ playerId: relinkModal.playerId, userId: null })
                  }
                }}
                disabled={relinkMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-2 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium transition-colors"
              >
                <Link2Off className="w-4 h-4" />
                연동 해제
              </button>
            )}
          </div>
        </div>
      )}

      {/* 선수 목록 */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500">선수가 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">선수</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">출석</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">골</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">도움</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">용병</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">연동 상태</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPlayers.map((player: any) => {
                const isDummy = player.user_email?.includes('@noemail.conerkicks.com')
                return (
                  <tr key={player.id} className={cn(
                    'hover:bg-slate-50 dark:hover:bg-slate-800/50',
                    isDummy && 'bg-purple-50/30 dark:bg-purple-500/5'
                  )}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            {player.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{player.name}</p>
                          {player.nickname && (
                            <p className="text-xs text-slate-500">{player.nickname}</p>
                          )}
                          {isDummy && (
                            <p className="text-xs text-purple-500 dark:text-purple-400 font-medium">더미 계정 연동</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-400">
                      {player.total_attendance || 0}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-400">
                      {player.total_goals || 0}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-400">
                      {player.total_assists || 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleGuestMutation.mutate({ id: player.id, isGuest: !player.is_guest })}
                        disabled={toggleGuestMutation.isPending}
                        className={cn(
                          'px-2 py-1 rounded-lg text-xs font-medium transition-colors',
                          player.is_guest
                            ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-200'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200'
                        )}
                      >
                        {player.is_guest ? '용병 ✓' : '—'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setRelinkModal({ playerId: player.id, playerName: player.name, currentUserId: player.user_id || null })}
                        title="연동 변경"
                        className="group inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors hover:ring-2 hover:ring-blue-400"
                      >
                        {player.link_status === 'ACTIVE' ? (
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 rounded-lg",
                            isDummy
                              ? "bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400"
                              : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          )}>
                            {isDummy ? <ShieldAlert className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                            {isDummy ? '더미연동' : '연동됨'}
                          </span>
                        ) : player.link_status === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-lg">
                            <AlertCircle className="w-3 h-3" />
                            대기중
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-1 rounded-lg">
                            <UserX className="w-3 h-3" />
                            미연동
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {player.link_status === 'PENDING' ? (
                          <button
                            onClick={() => approveMutation.mutate(player.id)}
                            disabled={approveMutation.isPending}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg transition-colors"
                          >
                            승인
                          </button>
                        ) : (
                          <Link
                            href={`/abilities/${player.id}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline text-sm px-1"
                          >
                            상세
                          </Link>
                        )}
                        {player.link_status === 'ACTIVE' && (
                          <button
                            onClick={() => {
                              if (confirm(`${player.name}의 비밀번호를 초기화하시겠습니까?`)) {
                                resetPasswordMutation.mutate(player.id)
                              }
                            }}
                            disabled={resetPasswordMutation.isPending}
                            title="비밀번호 초기화"
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-orange-100 dark:hover:bg-orange-500/20 text-slate-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {/* 선수 삭제 버튼 */}
                        <button
                          onClick={() => {
                            if (confirm(`"${player.name}" 선수를 삭제하시겠습니까?\n\n이 선수의 모든 기록(출석, 통계, 평가, 배지)이 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`)) {
                              deletePlayerMutation.mutate(player.id)
                            }
                          }}
                          disabled={deletePlayerMutation.isPending}
                          title="선수 삭제"
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-red-100 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
