'use client'

import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Camera,
  Trash2,
  RefreshCw,
  AlertCircle,
  Banknote,
  Check,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { clubsApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

export interface SettingsTabProps {
  club: any
  token: string
  onUpdate: () => void
  onDirtyChange?: (dirty: boolean) => void
}

export default function BasicInfoTab({ club, token, onUpdate, onDirtyChange }: SettingsTabProps) {
  const queryClient = useQueryClient()
  const { club: storeClub, setClub } = useAuthStore()

  const [regenerating, setRegenerating] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)

  // Club info
  const [clubName, setClubName] = useState('')
  const [clubDesc, setClubDesc] = useState('')
  const [seasonMonth, setSeasonMonth] = useState(1)
  const [infoSaving, setInfoSaving] = useState(false)
  const [infoSaved, setInfoSaved] = useState(false)

  // Bank account
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [holderName, setHolderName] = useState('')
  const [bankSaving, setBankSaving] = useState(false)
  const [bankSaved, setBankSaved] = useState(false)

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Track initial values for dirty detection
  const initialRef = useRef({ clubName: '', clubDesc: '', seasonMonth: 1, bankName: '', accountNumber: '', holderName: '' })

  useEffect(() => {
    if (!club) return
    const ba = club.bankAccount
    const init = {
      clubName: club.name || '',
      clubDesc: club.description || '',
      seasonMonth: club.seasonStartMonth ?? 1,
      bankName: ba?.bankName || '',
      accountNumber: ba?.accountNumber || '',
      holderName: ba?.holderName || '',
    }
    initialRef.current = init
    setClubName(init.clubName)
    setClubDesc(init.clubDesc)
    setSeasonMonth(init.seasonMonth)
    setBankName(init.bankName)
    setAccountNumber(init.accountNumber)
    setHolderName(init.holderName)
  }, [club])

  useEffect(() => {
    if (!onDirtyChange) return
    const i = initialRef.current
    const dirty =
      clubName !== i.clubName ||
      clubDesc !== i.clubDesc ||
      seasonMonth !== i.seasonMonth ||
      bankName !== i.bankName ||
      accountNumber !== i.accountNumber ||
      holderName !== i.holderName
    onDirtyChange(dirty)
  }, [clubName, clubDesc, seasonMonth, bankName, accountNumber, holderName, onDirtyChange])

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setLogoUploading(true)
    try {
      const res = await clubsApi.uploadLogo(file, token)
      queryClient.invalidateQueries({ queryKey: ['club-me'] })
      if (storeClub) setClub({ ...storeClub, logoUrl: res.logoUrl })
      onUpdate()
    } catch (err: any) {
      alert(err.message || '로고 업로드에 실패했습니다.')
    } finally {
      setLogoUploading(false)
    }
  }

  const handleLogoDelete = async () => {
    if (!confirm('로고를 삭제할까요?')) return
    try {
      await clubsApi.deleteLogo(token)
      queryClient.invalidateQueries({ queryKey: ['club-me'] })
      if (storeClub) setClub({ ...storeClub, logoUrl: null })
      onUpdate()
    } catch (err: any) {
      alert(err.message || '삭제에 실패했습니다.')
    }
  }

  const handleRegenerateCode = async () => {
    if (!confirm('초대 코드를 새로 발급하면 기존 코드는 사용할 수 없게 됩니다. 계속할까요?')) return
    setRegenerating(true)
    try {
      const res = await clubsApi.regenerateInviteCode(token)
      queryClient.invalidateQueries({ queryKey: ['club-me'] })
      if (storeClub) setClub({ ...storeClub, inviteCode: res.inviteCode })
      onUpdate()
    } catch (e: any) {
      alert(e.message || '실패했습니다.')
    } finally {
      setRegenerating(false)
    }
  }

  const handleSaveClubInfo = async () => {
    if (!token) return
    setInfoSaving(true)
    try {
      await clubsApi.updateSettings({ name: clubName, description: clubDesc, seasonStartMonth: seasonMonth }, token)
      queryClient.invalidateQueries({ queryKey: ['club-me'] })
      initialRef.current = { ...initialRef.current, clubName, clubDesc, seasonMonth }
      onDirtyChange?.(false)
      setInfoSaved(true)
      setTimeout(() => setInfoSaved(false), 2000)
      onUpdate()
    } catch (err: any) {
      alert(err.message || '저장에 실패했습니다.')
    } finally {
      setInfoSaving(false)
    }
  }

  const handleSaveBank = async () => {
    if (!token) return
    setBankSaving(true)
    try {
      await clubsApi.updateSettings({
        bankAccount: { bankName, accountNumber, holderName },
      }, token)
      queryClient.invalidateQueries({ queryKey: ['club-me'] })
      initialRef.current = { ...initialRef.current, bankName, accountNumber, holderName }
      onDirtyChange?.(false)
      setBankSaved(true)
      setTimeout(() => setBankSaved(false), 2000)
      onUpdate()
    } catch (err: any) {
      alert(err.message || '저장에 실패했습니다.')
    } finally {
      setBankSaving(false)
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

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''

  return (
    <div className="space-y-4">
      {/* 클럽 로고 */}
      <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
          클럽 로고
        </h3>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-2xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-600">
            {club.logoUrl ? (
              <Image src={apiUrl + club.logoUrl} alt="클럽 로고" width={64} height={64} className="object-cover w-full h-full" />
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
              placeholder="000-000000-00-000"
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
  )
}
