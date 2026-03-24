'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  User,
  Mail,
  Edit3,
  Save,
  X,
  Key,
  Unlink,
  Trophy,
  Target,
  Shield,
  Zap,
  Heart,
  ChevronRight,
  Swords,
  Ruler,
  Weight,
  Cake,
  LogOut,
  LinkIcon,
  AlertCircle,
} from 'lucide-react'
import { useAuthStore, useAuthHydrated } from '@/stores/auth'
import { authApi, meApi, preferencesApi, playersApi } from '@/lib/api'
import { GoogleLogin } from '@react-oauth/google'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export default function ProfilePage() {
  const router = useRouter()
  const hydrated = useAuthHydrated()
  const { isLoggedIn, user, player, token, logout, setPlayer } = useAuthStore()
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

  const [googleLinked, setGoogleLinked] = useState<boolean | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  // 선호 선수 모달
  const [showPrefModal, setShowPrefModal] = useState(false)
  const [prefSearch, setPrefSearch] = useState('')
  const queryClient = useQueryClient()

  // 프로필 요약 (능력치 + 시즌스탯 + 선호선수)
  // player가 store에 없어도 API에서 user_id+club_id로 조회하므로 token만 있으면 시도
  const { data: summary } = useQuery({
    queryKey: ['profile-summary', token],
    queryFn: () => meApi.getProfileSummary(token!),
    enabled: !!token,
  })

  // 선수 목록 (선호 선수 추가용)
  const { data: allPlayers } = useQuery({
    queryKey: ['players-list', token],
    queryFn: () => playersApi.list(token),
    enabled: !!token && showPrefModal,
  })

  useEffect(() => {
    if (token) {
      authApi.me(token).then((d: any) => setGoogleLinked(!!d.user?.googleLinked)).catch(() => {})
    }
  }, [token])

  useEffect(() => {
    if (hydrated && !isLoggedIn) {
      router.push('/login')
    }
  }, [hydrated, isLoggedIn, router])

  useEffect(() => {
    if (player?.nickname) {
      setNickname(player.nickname)
    }
  }, [player])

  const openEditModal = async () => {
    setEditEmail(user?.email || '')
    setNickname(player?.nickname || '')
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
      queryClient.invalidateQueries({ queryKey: ['profile-summary'] })
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

  if (!hydrated) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isLoggedIn || !user) {
    return null
  }

  const prefIds = new Set((summary?.preferences || []).map((p: any) => p.id))

  const handleAddPref = async (targetId: number) => {
    try {
      await preferencesApi.add(targetId, token!)
      queryClient.invalidateQueries({ queryKey: ['profile-summary'] })
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleRemovePref = async (targetId: number) => {
    try {
      await preferencesApi.remove(targetId, token!)
      queryClient.invalidateQueries({ queryKey: ['profile-summary'] })
    } catch (err: any) {
      setError(err.message)
    }
  }

  const abilities = summary?.abilities
  const seasonStats = summary?.seasonStats
  const preferences = summary?.preferences || []
  const summaryPlayer = summary?.player

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      {/* 알림 */}
      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
        </div>
      )}

      {/* 프로필 카드 */}
      <div className="bg-white dark:bg-white/[0.03] rounded-2xl p-6 border border-slate-200 dark:border-white/[0.08]">
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg mb-3">
            <span className="text-3xl font-bold text-white">
              {player?.name?.charAt(0) || user.username.charAt(0)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {player?.name || user.username}
            </h2>
            {player && (
              <button
                onClick={openEditModal}
                className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/[0.08] flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/[0.15] transition-colors"
              >
                <Edit3 className="w-3 h-3 text-slate-500 dark:text-white/70" />
              </button>
            )}
          </div>
          {player?.nickname && (
            <p className="text-sm text-slate-500 dark:text-white/50 mt-0.5">({player.nickname})</p>
          )}
          <div className="flex items-center gap-2 mt-2.5">
            <span className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-full border',
              user.role === 'ADMIN'
                ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/25'
                : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/25'
            )}>
              {user.role === 'ADMIN' ? '관리자' : '멤버'}
            </span>
            {player && (
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25">
                선수 연동됨
              </span>
            )}
          </div>
          <div className="w-full mt-4 pt-4 border-t border-slate-100 dark:border-white/[0.08] space-y-1.5">
            <div className="flex items-center gap-2.5 text-sm">
              <Mail className="w-4 h-4 text-slate-400 dark:text-white/40" />
              <span className="text-slate-600 dark:text-white/60">{user.email}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <User className="w-4 h-4 text-slate-400 dark:text-white/40" />
              <span className="text-slate-600 dark:text-white/60">@{user.username}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 선수 미연동 안내 */}
      {!player && !summaryPlayer && (
        <div className="bg-amber-50 dark:bg-amber-500/10 rounded-2xl p-5 border border-amber-200 dark:border-amber-500/25">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <LinkIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-1">선수 연동이 필요합니다</h3>
              <p className="text-sm text-amber-700 dark:text-amber-400/80 leading-relaxed">
                관리자가 선수를 등록한 후 내 계정과 연동하면 기록, 능력치, 선호선수 등의 기능을 사용할 수 있어요.
                관리자에게 선수 연동을 요청해 주세요.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 신체 정보 */}
      {summaryPlayer && (summaryPlayer.heightCm || summaryPlayer.weightKg || summaryPlayer.birthYear) && (
        <div className="bg-white dark:bg-white/[0.03] rounded-2xl p-5 border border-slate-200 dark:border-white/[0.08]">
          <p className="text-xs font-semibold text-slate-400 dark:text-white/40 uppercase tracking-wider mb-3">신체 정보</p>
          <div className="flex">
            {summaryPlayer.heightCm && (
              <div className="flex-1 text-center">
                <Ruler className="w-4 h-4 mx-auto mb-1.5 text-slate-400 dark:text-white/50" />
                <div className="text-lg font-bold text-slate-900 dark:text-white">{summaryPlayer.heightCm}cm</div>
                <div className="text-xs text-slate-500 dark:text-white/40">키</div>
              </div>
            )}
            {summaryPlayer.weightKg && (
              <div className="flex-1 text-center">
                <Weight className="w-4 h-4 mx-auto mb-1.5 text-slate-400 dark:text-white/50" />
                <div className="text-lg font-bold text-slate-900 dark:text-white">{summaryPlayer.weightKg}kg</div>
                <div className="text-xs text-slate-500 dark:text-white/40">몸무게</div>
              </div>
            )}
            {summaryPlayer.birthYear && (
              <div className="flex-1 text-center">
                <Cake className="w-4 h-4 mx-auto mb-1.5 text-slate-400 dark:text-white/50" />
                <div className="text-lg font-bold text-slate-900 dark:text-white">{summaryPlayer.birthYear}</div>
                <div className="text-xs text-slate-500 dark:text-white/40">출생</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 시즌 스탯 */}
      {summaryPlayer && seasonStats && (
        <div className="bg-white dark:bg-white/[0.03] rounded-2xl p-5 border border-slate-200 dark:border-white/[0.08]">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-slate-400 dark:text-white/40 uppercase tracking-wider">
              {seasonStats.year} 시즌 기록
            </p>
            {summaryPlayer && (
              <Link href={`/players/${summaryPlayer.id}`} className="text-xs text-emerald-500 hover:text-emerald-600 flex items-center gap-0.5">
                자세히 보기 <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>
          <div className="flex">
            {[
              { label: '출석', value: seasonStats.attendance, icon: Target, color: 'text-blue-500' },
              { label: '경기', value: seasonStats.games, icon: Swords, color: 'text-slate-500 dark:text-white/50' },
              { label: '득점', value: seasonStats.goals, icon: Zap, color: 'text-emerald-500' },
              { label: '도움', value: seasonStats.assists, icon: Trophy, color: 'text-amber-500' },
              { label: '수비', value: seasonStats.defenses, icon: Shield, color: 'text-purple-500' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex-1 text-center">
                <Icon className={cn('w-4 h-4 mx-auto mb-1.5', color)} />
                <div className="text-xl font-bold text-slate-900 dark:text-white">{value ?? 0}</div>
                <div className="text-xs text-slate-500 dark:text-white/50">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 능력치 + 선호 선수 (2열) */}
      {summaryPlayer && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 능력치 */}
          <div className="bg-white dark:bg-white/[0.03] rounded-2xl p-5 border border-slate-200 dark:border-white/[0.08]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 dark:text-white/40 uppercase tracking-wider">능력치</p>
              <Link href={`/abilities/${summary.player.id}`} className="text-xs text-emerald-500 hover:text-emerald-600 flex items-center gap-0.5">
                상세 <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            {abilities ? (
              <>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                    <span className="text-lg font-bold text-white">{abilities.overall}</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">종합</div>
                    <div className="text-xs text-slate-500 dark:text-white/40">{abilities.raterCount}명 평가</div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: '슈팅', value: abilities.shooting, color: 'bg-red-500' },
                    { label: '패스', value: abilities.passing, color: 'bg-amber-500' },
                    { label: '수비', value: abilities.marking, color: 'bg-blue-500' },
                    { label: '체력', value: abilities.stamina, color: 'bg-emerald-500' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-white/60 w-7">{label}</span>
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', color)} style={{ width: `${value}%` }} />
                      </div>
                      <span className="text-xs font-medium text-slate-700 dark:text-white/80 w-7 text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400 dark:text-white/40 py-4">평가 데이터 없음</p>
            )}
          </div>

          {/* 선호 선수 */}
          <div className="bg-white dark:bg-white/[0.03] rounded-2xl p-5 border border-slate-200 dark:border-white/[0.08]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-red-400" />
                <p className="text-xs font-semibold text-slate-400 dark:text-white/40 uppercase tracking-wider">
                  선호 선수 ({preferences.length}/3)
                </p>
              </div>
              {preferences.length < 3 && (
                <button onClick={() => setShowPrefModal(true)} className="text-xs text-emerald-500 hover:text-emerald-600">+ 추가</button>
              )}
            </div>
            {preferences.length > 0 ? (
              <div className="space-y-2">
                {preferences.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04]">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-400 to-red-400 flex items-center justify-center text-white font-bold text-xs">
                      {(p.name || '?')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-slate-900 dark:text-white truncate">{p.name}</div>
                      {p.nickname && <div className="text-xs text-slate-500 dark:text-white/40 truncate">{p.nickname}</div>}
                    </div>
                    <button
                      onClick={() => handleRemovePref(p.id)}
                      className="text-red-400 hover:text-red-500 transition-colors"
                    >
                      <Heart className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <Heart className="w-7 h-7 mx-auto mb-2 text-slate-300 dark:text-white/20" />
                <p className="text-sm text-slate-400 dark:text-white/40 mb-1">같이 뛰고 싶은<br/>선수를 선택하세요</p>
                <button onClick={() => setShowPrefModal(true)} className="text-sm text-emerald-500 hover:text-emerald-600">선수 선택하기</button>
              </div>
            )}
            {preferences.length < 3 && preferences.length > 0 && (
              <button
                onClick={() => setShowPrefModal(true)}
                className="mt-2 w-full py-2 rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
              >
                + 추가
              </button>
            )}
          </div>
        </div>
      )}

      {/* 메뉴 섹션 */}
      <div className="space-y-2">
        {!player && (
          <button
            onClick={openEditModal}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.05] hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            <Edit3 className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-white/80">프로필 수정</span>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-white/25 ml-auto" />
          </button>
        )}
        <button
          onClick={() => setIsChangingPassword(true)}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.05] hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
        >
          <Key className="w-5 h-5 text-blue-500" />
          <span className="text-sm font-medium text-slate-700 dark:text-white/80">비밀번호 변경</span>
          <ChevronRight className="w-4 h-4 text-slate-400 dark:text-white/25 ml-auto" />
        </button>

        {/* 구글 연동 */}
        {googleLinked ? (
          <div className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.05]">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-sm font-medium text-slate-600 dark:text-white/60">Google 연동됨</span>
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
              className="ml-auto text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
            >
              <Unlink className="w-3.5 h-3.5" />
              해제
            </button>
          </div>
        ) : (
          <div className="w-full px-4 py-3.5 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.05]">
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-sm text-slate-500 dark:text-white/50">구글 계정으로도 로그인할 수 있어요</span>
            </div>
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

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.05] hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-5 h-5 text-red-500" />
          <span className="text-sm font-medium text-red-500">로그아웃</span>
          <ChevronRight className="w-4 h-4 text-slate-400 dark:text-white/25 ml-auto" />
        </button>
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

      {/* 선호 선수 선택 모달 */}
      {showPrefModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                선호 선수 선택
              </h2>
              <button
                onClick={() => { setShowPrefModal(false); setPrefSearch('') }}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <Input
                id="prefSearch"
                placeholder="선수 이름으로 검색..."
                value={prefSearch}
                onChange={(e) => setPrefSearch(e.target.value)}
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {(allPlayers || [])
                .filter((p: any) => p.id !== summary?.player?.id)
                .filter((p: any) =>
                  !prefSearch || (p.name || '').includes(prefSearch) || (p.nickname || '').includes(prefSearch)
                )
                .map((p: any) => {
                  const isFav = prefIds.has(p.id)
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center text-white font-bold text-sm">
                        {(p.name || '?')[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-slate-900 dark:text-white truncate">{p.name}</div>
                        {p.nickname && <div className="text-xs text-slate-500 truncate">{p.nickname}</div>}
                      </div>
                      <button
                        onClick={async () => {
                          if (isFav) {
                            await handleRemovePref(p.id)
                          } else {
                            if (prefIds.size >= 3) {
                              setError('선호 선수는 최대 3명까지 등록 가능합니다.')
                              return
                            }
                            await handleAddPref(p.id)
                          }
                        }}
                        className={cn(
                          'transition-colors p-1',
                          isFav ? 'text-red-400 hover:text-red-500' : 'text-slate-300 hover:text-red-400'
                        )}
                      >
                        <Heart className={cn('w-5 h-5', isFav && 'fill-current')} />
                      </button>
                    </div>
                  )
                })}
              {allPlayers && allPlayers.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-8">선수 목록이 없습니다</p>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
              <Button variant="secondary" className="w-full" onClick={() => { setShowPrefModal(false); setPrefSearch('') }}>
                닫기
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
