'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  User,
  Mail,
  Shield,
  Trophy,
  Target,
  Handshake,
  Edit3,
  Save,
  X,
  Key,
  Star,
  Gamepad2,
  TrendingUp,
  Crown,
  Zap,
  Users,
  ChevronRight,
  Link2,
  Unlink,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { authApi, rankingsApi, subscriptionsApi } from '@/lib/api'
import { GoogleLogin } from '@react-oauth/google'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'

export default function ProfilePage() {
  const router = useRouter()
  const { isLoggedIn, user, player, club, token, logout, setPlayer } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // 프로필 수정 폼
  const [nickname, setNickname] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editHeightCm, setEditHeightCm] = useState('')
  const [editWeightKg, setEditWeightKg] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editBirthYear, setEditBirthYear] = useState('')

  // 비밀번호 변경 폼
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const currentYear = new Date().getFullYear()
  const isPro = club?.isPro
  const [subInfo, setSubInfo] = useState<any>(null)
  const [googleLinked, setGoogleLinked] = useState<boolean | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => {
    if (token) {
      authApi.me(token).then((d: any) => setGoogleLinked(!!d.user?.googleLinked)).catch(() => {})
      subscriptionsApi.me(token).then((d: any) => setSubInfo(d)).catch(() => {})
    }
  }, [token])

  // 랭킹 데이터
  const { data: rankingsData } = useQuery({
    queryKey: ['rankings', currentYear],
    queryFn: () => rankingsApi.get(currentYear, token ?? undefined),
    enabled: !!player?.id,
  })

  const rankings = rankingsData?.data?.rankings || []
  const sortedRankings = [...rankings].sort((a: any, b: any) => (b.mvpCount || 0) - (a.mvpCount || 0))
  const playerRank = player ? sortedRankings.findIndex((p: any) => p.id === player.id) + 1 : null
  const playerStats = player ? rankings.find((p: any) => p.id === player.id) : null

  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/login')
    }
  }, [isLoggedIn, router])

  useEffect(() => {
    if (player?.nickname) {
      setNickname(player.nickname)
    }
  }, [player])

  const openEditModal = async () => {
    setEditEmail(user?.email || '')
    setNickname(player?.nickname || '')
    // 선수 상세 정보 불러오기
    try {
      const me = await authApi.me(token!)
      if (me.player) {
        setEditHeightCm(me.player.height_cm ? String(me.player.height_cm) : '')
        setEditWeightKg(me.player.weight_kg ? String(me.player.weight_kg) : '')
        setEditBirthYear(me.player.birth_year ? String(me.player.birth_year) : '')
      }
      if (me.profile) {
        setEditPhone(me.profile.phone || '')
      }
    } catch {}
    setIsEditing(true)
  }

  const handleSaveProfile = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const updateData: any = { nickname }
      if (editEmail && editEmail !== user?.email) updateData.email = editEmail
      if (editHeightCm) updateData.heightCm = Number(editHeightCm)
      if (editWeightKg) updateData.weightKg = Number(editWeightKg)
      if (editPhone !== undefined) updateData.phone = editPhone
      if (editBirthYear) updateData.birthYear = Number(editBirthYear)

      await authApi.updateProfile(updateData, token!)
      if (player) {
        setPlayer({ ...player, nickname })
      }
      setSuccess('프로필이 저장되었습니다.')
      setIsEditing(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.')
      return
    }

    if (newPassword.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await authApi.changePassword(oldPassword, newPassword, token!)
      setSuccess('비밀번호가 변경되었습니다.')
      setIsChangingPassword(false)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  if (!isLoggedIn || !user) {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">내 프로필</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">계정 정보와 경기 기록을 확인하세요</p>
      </div>

      {/* 알림 */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 프로필 카드 */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            {/* 프로필 이미지 */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg mb-4">
                <span className="text-4xl font-bold text-white">
                  {player?.name?.charAt(0) || user.username.charAt(0)}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {player?.name || user.username}
              </h2>
              {player?.nickname && (
                <p className="text-slate-500">({player.nickname})</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className={cn(
                  'px-3 py-1 text-xs font-medium rounded-full',
                  user.role === 'ADMIN'
                    ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
                    : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                )}>
                  {user.role === 'ADMIN' ? '관리자' : '멤버'}
                </span>
                {player && (
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    선수 연동됨
                  </span>
                )}
              </div>
            </div>

            {/* 계정 정보 */}
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-400">{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <User className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-400">@{user.username}</span>
              </div>
            </div>

            {/* 구글 계정 연동 */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">소셜 계정</p>
              {googleLinked ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Google 연동됨</span>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm('구글 계정 연동을 해제할까요?')) return
                      setGoogleLoading(true)
                      try {
                        await authApi.unlinkGoogle(token!)
                        setGoogleLinked(false)
                        setSuccess('구글 연동이 해제되었습니다.')
                      } catch (e: any) {
                        setError(e.message)
                      } finally {
                        setGoogleLoading(false)
                      }
                    }}
                    disabled={googleLoading}
                    className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    해제
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">구글 계정으로도 로그인할 수 있어요</p>
                  <GoogleLogin
                    onSuccess={async (res) => {
                      if (!res.credential) return
                      setGoogleLoading(true)
                      try {
                        await authApi.linkGoogle(res.credential, token!)
                        setGoogleLinked(true)
                        setSuccess('구글 계정이 연동되었습니다.')
                      } catch (e: any) {
                        setError(e.message)
                      } finally {
                        setGoogleLoading(false)
                      }
                    }}
                    onError={() => setError('구글 인증에 실패했습니다.')}
                    text="signin_with"
                    size="medium"
                    shape="rectangular"
                    theme="outline"
                  />
                </div>
              )}
            </div>

            {/* 버튼들 */}
            <div className="mt-6 space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={openEditModal}
              >
                <Edit3 className="w-4 h-4" />
                프로필 수정
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setIsChangingPassword(true)}
              >
                <Key className="w-4 h-4" />
                비밀번호 변경
              </Button>
              <Button
                variant="ghost"
                className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                onClick={handleLogout}
              >
                로그아웃
              </Button>
            </div>
          </div>
        </div>

        {/* 오른쪽: 통계 & 기록 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 시즌 스탯 */}
          {player && (
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  {currentYear}년 시즌 스탯
                </h3>
                {playerRank && (
                  <span className="px-3 py-1 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full text-sm font-medium">
                    MVP 순위 {playerRank}위
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  icon={<Star className="w-5 h-5" />}
                  label="MVP"
                  value={`${playerStats?.mvpCount || 0}회`}
                  color="emerald"
                />
                <StatCard
                  icon={<Target className="w-5 h-5" />}
                  label="득점"
                  value={playerStats?.goals || 0}
                  color="amber"
                />
                <StatCard
                  icon={<Handshake className="w-5 h-5" />}
                  label="도움"
                  value={playerStats?.assists || 0}
                  color="blue"
                />
                <StatCard
                  icon={<Shield className="w-5 h-5" />}
                  label="수비"
                  value={playerStats?.defenses || 0}
                  color="purple"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Gamepad2 className="w-4 h-4" />
                    <span className="text-sm">경기 참여</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {playerStats?.games || 0}경기
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Trophy className="w-4 h-4" />
                    <span className="text-sm">1등</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {playerStats?.rank1 || 0}회
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Link
                  href={`/ranking/${player.id}`}
                  className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 font-medium"
                >
                  상세 기록 보기 →
                </Link>
              </div>
            </div>
          )}

          {/* 선수 미연동 시 */}
          {!player && (
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                선수 프로필이 연동되지 않았습니다
              </h3>
              <p className="text-slate-500 mb-4">
                관리자에게 문의하여 선수 코드를 받아 연동하세요.
              </p>
            </div>
          )}

          {/* 내 클럽 바로가기 */}
          {club && (
            <Link
              href="/club"
              className="flex items-center gap-4 bg-white dark:bg-slate-900/50 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-300 dark:hover:border-emerald-500/40 transition-colors group"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-md shadow-emerald-500/20">
                ⚽
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white truncate">{club.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                  <Users className="w-3.5 h-3.5" />
                  초대 코드 · 클럽 정보 보기
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
            </Link>
          )}

          {/* 구독 현황 */}
          {club && (
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Crown className="w-5 h-5 text-emerald-500" />
                플랜
              </h3>
              {isPro ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 rounded-full text-sm font-medium border border-emerald-300 dark:border-emerald-500/30">
                        <Zap className="w-3.5 h-3.5" />
                        {club.planType === 'developer' ? 'Developer' : 'PRO'}
                      </span>
                    </div>
                    {subInfo?.subscription && club.planType !== 'developer' && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {subInfo.subscription.billingCycle === 'yearly' ? '연간' : '월간'} ·{' '}
                        {subInfo.subscription.status === 'cancelled' ? '취소됨 · ' : ''}
                        만료: {new Date(subInfo.subscription.expiresAt * 1000).toLocaleDateString('ko-KR')}
                      </p>
                    )}
                  </div>
                  {club.planType !== 'developer' && (
                    <Link href="/upgrade" className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                      관리 →
                    </Link>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="inline-flex px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full text-sm font-medium">
                      FREE
                    </span>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                      AI 팀 편성, 다중 관리자 등 프리미엄 기능을 사용해보세요
                    </p>
                  </div>
                  <Link
                    href="/upgrade"
                    className="ml-4 flex-shrink-0 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity"
                  >
                    업그레이드
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 프로필 수정 모달 */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                프로필 수정
              </h2>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                변경할 항목만 입력하세요. 빈 칸은 기존 값이 유지됩니다.
              </p>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">계정 정보</p>
                <Input
                  id="editEmail"
                  type="email"
                  label="이메일"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="이메일 주소"
                />
                <Input
                  id="nickname"
                  label="닉네임"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="닉네임을 입력하세요"
                />
              </div>

              {player && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">신체 정보</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      id="editHeightCm"
                      type="number"
                      label="키 (cm)"
                      value={editHeightCm}
                      onChange={(e) => setEditHeightCm(e.target.value)}
                      placeholder="예: 175"
                    />
                    <Input
                      id="editWeightKg"
                      type="number"
                      label="몸무게 (kg)"
                      value={editWeightKg}
                      onChange={(e) => setEditWeightKg(e.target.value)}
                      placeholder="예: 70"
                    />
                  </div>
                  <Input
                    id="editBirthYear"
                    type="number"
                    label="출생연도"
                    value={editBirthYear}
                    onChange={(e) => setEditBirthYear(e.target.value)}
                    placeholder="예: 1990"
                  />
                </div>
              )}

              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">연락처</p>
                <Input
                  id="editPhone"
                  type="tel"
                  label="전화번호"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="예: 010-1234-5678"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
              <Button variant="secondary" onClick={() => setIsEditing(false)}>
                취소
              </Button>
              <Button onClick={handleSaveProfile} loading={loading}>
                <Save className="w-4 h-4" />
                저장
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 변경 모달 */}
      {isChangingPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                비밀번호 변경
              </h2>
              <button
                onClick={() => setIsChangingPassword(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <Input
                id="oldPassword"
                type="password"
                label="현재 비밀번호"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
              <Input
                id="newPassword"
                type="password"
                label="새 비밀번호"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Input
                id="confirmPassword"
                type="password"
                label="새 비밀번호 확인"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
              <Button variant="secondary" onClick={() => setIsChangingPassword(false)}>
                취소
              </Button>
              <Button onClick={handleChangePassword} loading={loading}>
                변경
              </Button>
            </div>
          </div>
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
  value: string | number
  color: 'emerald' | 'amber' | 'blue' | 'purple'
}) {
  const colorClasses = {
    emerald: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
    amber: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
    blue: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
    purple: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30',
  }

  return (
    <div className={cn('rounded-xl p-4 border', colorClasses[color])}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
