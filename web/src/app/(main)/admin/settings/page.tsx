'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Settings,
  Camera,
  Trash2,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  Banknote,
  HelpCircle,
  Check,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { clubsApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

export default function AdminSettingsPage() {
  const { isLoggedIn, isAdmin, token, club: storeClub, setClub } = useAuthStore()
  const queryClient = useQueryClient()

  const [regenerating, setRegenerating] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [mvpToggling, setMvpToggling] = useState(false)
  const [notifToggling, setNotifToggling] = useState<string | null>(null)

  // 클럽 정보 수정
  const [clubName, setClubName] = useState('')
  const [clubDesc, setClubDesc] = useState('')
  const [seasonMonth, setSeasonMonth] = useState(1)
  const [infoSaving, setInfoSaving] = useState(false)
  const [infoSaved, setInfoSaved] = useState(false)

  // 클럽 삭제
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  // 계좌 정보
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [holderName, setHolderName] = useState('')
  const [bankSaving, setBankSaving] = useState(false)
  const [bankSaved, setBankSaved] = useState(false)

  // 참가비 설정
  const [baseAmount, setBaseAmount] = useState(0)
  const [splitEnabled, setSplitEnabled] = useState(false)
  const [splitTotal, setSplitTotal] = useState(0)
  const [splitRoundUp, setSplitRoundUp] = useState(100)
  const [rankDiffEnabled, setRankDiffEnabled] = useState(false)
  const [rankDiffAmount, setRankDiffAmount] = useState(500)
  const [feeSaving, setFeeSaving] = useState(false)
  const [feeSaved, setFeeSaved] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['club-me'],
    queryFn: () => clubsApi.me(token!),
    enabled: !!token && isLoggedIn,
  })

  const club = data?.club ?? null

  // 데이터 로드 시 state 초기화
  useEffect(() => {
    if (!club) return
    const ba = club.bankAccount
    if (ba) {
      setBankName(ba.bankName || '')
      setAccountNumber(ba.accountNumber || '')
      setHolderName(ba.holderName || '')
    }
    setClubName(club.name || '')
    setClubDesc(club.description || '')
    setSeasonMonth(club.seasonStartMonth ?? 1)
    const fc = club.feeConfig || {}
    setBaseAmount(fc.baseAmount ?? 0)
    setSplitEnabled(fc.splitEnabled ?? false)
    setSplitTotal(fc.splitTotal ?? 0)
    setSplitRoundUp(fc.splitRoundUp ?? 100)
    setRankDiffEnabled(fc.rankDiffEnabled ?? false)
    setRankDiffAmount(fc.rankDiffAmount ?? 500)
  }, [club])

  const handleSaveBank = async () => {
    if (!token) return
    setBankSaving(true)
    try {
      await clubsApi.updateSettings({
        bankAccount: { bankName, accountNumber, holderName },
      }, token)
      queryClient.invalidateQueries({ queryKey: ['club-me'] })
      setBankSaved(true)
      setTimeout(() => setBankSaved(false), 2000)
    } catch (err: any) {
      alert(err.message || '저장에 실패했습니다.')
    } finally {
      setBankSaving(false)
    }
  }

  const handleSaveFeeConfig = async () => {
    if (!token) return
    setFeeSaving(true)
    try {
      await clubsApi.updateSettings({
        feeConfig: { baseAmount, splitEnabled, splitTotal, splitRoundUp, rankDiffEnabled, rankDiffAmount },
      }, token)
      queryClient.invalidateQueries({ queryKey: ['club-me'] })
      setFeeSaved(true)
      setTimeout(() => setFeeSaved(false), 2000)
    } catch (err: any) {
      alert(err.message || '저장에 실패했습니다.')
    } finally {
      setFeeSaving(false)
    }
  }

  if (!isLoggedIn || !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">접근 권한이 없습니다</h2>
        <p className="text-slate-500 mb-6">관리자만 접근할 수 있습니다.</p>
        <Link href="/" className="text-emerald-600 hover:underline">홈으로 돌아가기</Link>
      </div>
    )
  }

  if (isLoading || !club) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setLogoUploading(true)
    try {
      const res = await clubsApi.uploadLogo(file, token)
      queryClient.invalidateQueries({ queryKey: ['club-me'] })
      if (storeClub) setClub({ ...storeClub, logoUrl: res.logoUrl })
    } catch (err: any) {
      alert(err.message || '로고 업로드에 실패했습니다.')
    } finally {
      setLogoUploading(false)
    }
  }

  const handleLogoDelete = async () => {
    if (!confirm('로고를 삭제할까요?')) return
    try {
      await clubsApi.deleteLogo(token!)
      queryClient.invalidateQueries({ queryKey: ['club-me'] })
      if (storeClub) setClub({ ...storeClub, logoUrl: null })
    } catch (err: any) {
      alert(err.message || '삭제에 실패했습니다.')
    }
  }

  const handleRegenerateCode = async () => {
    if (!confirm('초대 코드를 새로 발급하면 기존 코드는 사용할 수 없게 됩니다. 계속할까요?')) return
    setRegenerating(true)
    try {
      const res = await clubsApi.regenerateInviteCode(token!)
      queryClient.invalidateQueries({ queryKey: ['club-me'] })
      if (storeClub) setClub({ ...storeClub, inviteCode: res.inviteCode })
    } catch (e: any) {
      alert(e.message || '실패했습니다.')
    } finally {
      setRegenerating(false)
    }
  }

  const handleNotifToggle = async (key: string) => {
    if (!token || !club) return
    setNotifToggling(key)
    try {
      const nc = club.notificationConfig || { sessionCreated: true, sessionDayRemind: true, settlementRemind: true }
      const updated = { ...nc, [key]: !nc[key] }
      await clubsApi.updateSettings({ notificationConfig: updated }, token)
      queryClient.invalidateQueries({ queryKey: ['club-me'] })
    } catch (err: any) {
      alert(err.message || '설정 변경에 실패했습니다.')
    } finally {
      setNotifToggling(null)
    }
  }

  const handleSaveClubInfo = async () => {
    if (!token) return
    setInfoSaving(true)
    try {
      await clubsApi.updateSettings({ name: clubName, description: clubDesc, seasonStartMonth: seasonMonth }, token)
      queryClient.invalidateQueries({ queryKey: ['club-me'] })
      setInfoSaved(true)
      setTimeout(() => setInfoSaved(false), 2000)
    } catch (err: any) {
      alert(err.message || '저장에 실패했습니다.')
    } finally {
      setInfoSaving(false)
    }
  }

  const handleDeleteClub = async () => {
    if (!token || deleteConfirm !== club?.name) return
    setDeleting(true)
    try {
      await clubsApi.deleteClub(token)
      window.location.href = '/'
    } catch (err: any) {
      alert(err.message || '클럽 삭제에 실패했습니다.')
      setDeleting(false)
    }
  }

  const handleMvpToggle = async () => {
    if (!token || !club) return
    setMvpToggling(true)
    try {
      await clubsApi.updateSettings({ mvpVoteEnabled: !club.mvpVoteEnabled }, token)
      queryClient.invalidateQueries({ queryKey: ['club-me'] })
    } catch (err: any) {
      alert(err.message || '설정 변경에 실패했습니다.')
    } finally {
      setMvpToggling(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-3">
          <ChevronLeft className="w-4 h-4" />
          관리자 대시보드
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Settings className="w-8 h-8 text-slate-500" />
          클럽 설정
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">클럽 로고, 초대 코드, 기능 설정을 관리하세요</p>
      </div>

      <div className="space-y-4">
        {/* 클럽 로고 */}
        <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
            클럽 로고
          </h3>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-2xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-600">
              {club.logoUrl ? (
                <Image src={`${process.env.NEXT_PUBLIC_API_URL}${club.logoUrl}`} alt="클럽 로고" width={64} height={64} className="object-cover w-full h-full" />
              ) : (
                <Camera className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg cursor-pointer bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <Camera className="w-3.5 h-3.5" />
                {club.logoUrl ? '변경' : '업로드'}
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
              </label>
              {club.logoUrl && (
                <button
                  onClick={handleLogoDelete}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  삭제
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">권장: 정사각형 이미지, 5MB 이하</p>
        </div>

        {/* 초대 코드 재발급 */}
        <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
            초대 코드
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold tracking-[0.25em] text-slate-900 dark:text-white font-mono">
                {club.inviteCode}
              </p>
              <p className="text-xs text-slate-500 mt-1">새로 발급하면 기존 코드는 사용할 수 없습니다</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerateCode}
              disabled={regenerating}
            >
              <RefreshCw className={cn('w-4 h-4', regenerating && 'animate-spin')} />
              재발급
            </Button>
          </div>
        </div>

        {/* 계좌 정보 */}
        <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Banknote className="w-4 h-4" />
            정산 계좌
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">정산 알림에 포함되는 입금 계좌 정보입니다</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">은행명</label>
              <input
                type="text"
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                placeholder="국민은행"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">계좌번호</label>
              <input
                type="text"
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value)}
                placeholder="801301-01-610282"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">예금주</label>
              <input
                type="text"
                value={holderName}
                onChange={e => setHolderName(e.target.value)}
                placeholder="홍길동"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button size="sm" onClick={handleSaveBank} disabled={bankSaving}>
              {bankSaved ? <><Check className="w-4 h-4" /> 저장됨</> : bankSaving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </div>

        {/* 참가비 설정 */}
        <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Banknote className="w-4 h-4" />
            참가비 설정
          </h3>

          {/* 기본 참가비 */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">기본 참가비</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={baseAmount}
                onChange={e => setBaseAmount(Number(e.target.value))}
                className="w-32 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <span className="text-sm text-slate-500">원</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">토글을 둘 다 끄면 이 금액이 모든 참가자에게 동일 적용됩니다</p>
          </div>

          {/* 총액 분할 토글 */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-900 dark:text-white text-sm">총액 분할</p>
              </div>
              <button
                onClick={() => setSplitEnabled(!splitEnabled)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  splitEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm',
                  splitEnabled ? 'translate-x-6' : 'translate-x-1'
                )} />
              </button>
            </div>
            {splitEnabled && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg p-3">
                  <HelpCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    구장비 등 총 금액을 참가 인원으로 나눕니다. 예: 총 18만원 / 15명 = 12,000원
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">총액</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={splitTotal}
                        onChange={e => setSplitTotal(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                      <span className="text-xs text-slate-500 whitespace-nowrap">원</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">올림 단위</label>
                    <select
                      value={splitRoundUp}
                      onChange={e => setSplitRoundUp(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value={10}>10원</option>
                      <option value={100}>100원</option>
                      <option value={1000}>1,000원</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 순위별 차등 토글 */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-900 dark:text-white text-sm">순위별 차등</p>
              </div>
              <button
                onClick={() => setRankDiffEnabled(!rankDiffEnabled)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  rankDiffEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm',
                  rankDiffEnabled ? 'translate-x-6' : 'translate-x-1'
                )} />
              </button>
            </div>
            {rankDiffEnabled && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg p-3">
                  <HelpCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    중간 순위를 기준으로, 높은 순위는 덜 내고 낮은 순위는 더 냅니다.
                    {splitEnabled
                      ? ` 예: 기본 12,000원 / 차등 500원 → 1위 11,500원, 2위 12,000원, 3위 12,500원`
                      : ` 예: 기본 ${baseAmount.toLocaleString()}원 / 차등 500원 → 1위 ${(baseAmount - 500).toLocaleString()}원, 2위 ${baseAmount.toLocaleString()}원, 3위 ${(baseAmount + 500).toLocaleString()}원`
                    }
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">순위당 차등 금액</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={rankDiffAmount}
                      onChange={e => setRankDiffAmount(Number(e.target.value))}
                      className="w-32 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                    <span className="text-sm text-slate-500">원</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 조합 설명 */}
          {splitEnabled && rankDiffEnabled && (
            <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg p-3 mb-4">
              <HelpCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                <strong>총액 분할 + 순위별 차등</strong>: 총액을 인원수로 나눈 금액을 기준으로 순위별 차등이 적용됩니다.
                인원수가 달라져도 총액 기준으로 자동 계산되며, 순위에 따라 금액이 조정됩니다.
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button size="sm" onClick={handleSaveFeeConfig} disabled={feeSaving}>
              {feeSaved ? <><Check className="w-4 h-4" /> 저장됨</> : feeSaving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </div>

        {/* 기능 토글 */}
        <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
            기능 설정
          </h3>
          <div className="space-y-4">
            {[
              { key: 'mvp', label: 'MVP 투표', desc: '세션 종료 후 24시간 내 MVP 투표 진행', value: club.mvpVoteEnabled, handler: handleMvpToggle, loading: mvpToggling },
              { key: 'sessionCreated', label: '세션 생성 알림', desc: '새 세션이 생성되면 멤버에게 알림', value: club.notificationConfig?.sessionCreated ?? true, handler: () => handleNotifToggle('sessionCreated'), loading: notifToggling === 'sessionCreated' },
              { key: 'settlementRemind', label: '자동 정산 알림', desc: '세션 종료 후 정산 알림 발송', value: club.notificationConfig?.settlementRemind ?? true, handler: () => handleNotifToggle('settlementRemind'), loading: notifToggling === 'settlementRemind' },
              { key: 'sessionDayRemind', label: '경기일 리마인드', desc: '경기 당일 참석 리마인드 알림', value: club.notificationConfig?.sessionDayRemind ?? true, handler: () => handleNotifToggle('sessionDayRemind'), loading: notifToggling === 'sessionDayRemind' },
            ].map(({ key, label, desc, value, handler, loading }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
                </div>
                <button
                  onClick={handler}
                  disabled={!!loading}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    value ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                  )}
                >
                  <span className={cn(
                    'inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm',
                    value ? 'translate-x-6' : 'translate-x-1'
                  )} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 클럽 정보 수정 */}
        <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
            클럽 정보
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">클럽 이름</label>
              <input
                type="text"
                value={clubName}
                onChange={e => setClubName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">설명</label>
              <textarea
                value={clubDesc}
                onChange={e => setClubDesc(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">시즌 시작월</label>
              <select
                value={seasonMonth}
                onChange={e => setSeasonMonth(Number(e.target.value))}
                className="w-32 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}월</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSaveClubInfo} disabled={infoSaving}>
                {infoSaved ? <><Check className="w-4 h-4" /> 저장됨</> : infoSaving ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        </div>

        {/* 위험 구역 */}
        <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-red-200 dark:border-red-500/20 shadow-sm">
          <h3 className="text-sm font-semibold text-red-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            위험 구역
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            클럽을 삭제하면 모든 데이터(세션, 경기, 랭킹, 멤버 등)가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                확인을 위해 클럽 이름 <span className="font-bold text-slate-900 dark:text-white">{club.name}</span>을 입력하세요
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={club.name}
                className="w-full px-3 py-2 text-sm rounded-lg border border-red-200 dark:border-red-500/30 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteClub}
              disabled={deleteConfirm !== club.name || deleting}
              className="text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? '삭제 중...' : '클럽 영구 삭제'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
