'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authApi } from '@/lib/api'

type Tab = 'find-id' | 'find-pw'

export default function FindAccountPage() {
  const [tab, setTab] = useState<Tab>('find-id')

  // 아이디 찾기
  const [findIdUsername, setFindIdUsername] = useState('')
  const [findIdResult, setFindIdResult] = useState('')
  const [findIdError, setFindIdError] = useState('')
  const [findIdLoading, setFindIdLoading] = useState(false)

  // 비밀번호 찾기
  const [resetEmail, setResetEmail] = useState('')
  const [resetUsername, setResetUsername] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('')
  const [resetResult, setResetResult] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const handleFindId = async (e: React.FormEvent) => {
    e.preventDefault()
    setFindIdError('')
    setFindIdResult('')
    setFindIdLoading(true)
    try {
      const data = await authApi.findEmail(findIdUsername)
      setFindIdResult(data.maskedEmail)
    } catch (err: any) {
      setFindIdError(err.message || '아이디 찾기에 실패했습니다.')
    } finally {
      setFindIdLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError('')
    setResetResult('')

    if (resetPassword !== resetPasswordConfirm) {
      setResetError('새 비밀번호가 일치하지 않습니다.')
      return
    }

    setResetLoading(true)
    try {
      const data = await authApi.resetPassword(resetEmail, resetUsername, resetPassword)
      setResetResult(data.message)
    } catch (err: any) {
      setResetError(err.message || '비밀번호 재설정에 실패했습니다.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* 로고 */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl mb-4 shadow-lg shadow-emerald-500/20">
            <span className="text-3xl">⚽</span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            코너킥스 FC
          </h1>
          <p className="text-slate-500 mt-2">계정 정보 찾기</p>
        </div>

        <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl">
          {/* 탭 */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-6">
            <button
              onClick={() => setTab('find-id')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                tab === 'find-id'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              아이디 찾기
            </button>
            <button
              onClick={() => setTab('find-pw')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                tab === 'find-pw'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              비밀번호 찾기
            </button>
          </div>

          {/* 아이디 찾기 */}
          {tab === 'find-id' && (
            <form onSubmit={handleFindId} className="space-y-5">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                가입 시 등록한 이름을 입력하면 이메일을 확인할 수 있습니다.
              </p>

              <Input
                id="find-id-username"
                type="text"
                label="이름"
                placeholder="가입 시 등록한 이름"
                value={findIdUsername}
                onChange={(e) => setFindIdUsername(e.target.value)}
                required
              />

              {findIdError && (
                <div className="p-4 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
                  <p className="text-sm text-red-600 dark:text-red-400">{findIdError}</p>
                </div>
              )}

              {findIdResult && (
                <div className="p-4 bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                    등록된 이메일
                  </p>
                  <p className="text-base font-bold text-emerald-800 dark:text-emerald-300 mt-1">
                    {findIdResult}
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full h-12 text-base" loading={findIdLoading}>
                아이디 찾기
              </Button>
            </form>
          )}

          {/* 비밀번호 찾기 */}
          {tab === 'find-pw' && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                가입한 이메일과 이름을 입력하면 비밀번호를 재설정할 수 있습니다.
              </p>

              <Input
                id="reset-email"
                type="email"
                label="이메일"
                placeholder="가입 시 등록한 이메일"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />

              <Input
                id="reset-username"
                type="text"
                label="이름"
                placeholder="가입 시 등록한 이름"
                value={resetUsername}
                onChange={(e) => setResetUsername(e.target.value)}
                required
              />

              <Input
                id="reset-password"
                type="password"
                label="새 비밀번호"
                placeholder="새 비밀번호 (4자 이상)"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                required
              />

              <Input
                id="reset-password-confirm"
                type="password"
                label="새 비밀번호 확인"
                placeholder="새 비밀번호 재입력"
                value={resetPasswordConfirm}
                onChange={(e) => setResetPasswordConfirm(e.target.value)}
                required
              />

              {resetError && (
                <div className="p-4 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
                  <p className="text-sm text-red-600 dark:text-red-400">{resetError}</p>
                </div>
              )}

              {resetResult && (
                <div className="p-4 bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                    {resetResult}
                  </p>
                  <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-1">
                    새 비밀번호로 로그인해주세요.
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full h-12 text-base" loading={resetLoading}>
                비밀번호 재설정
              </Button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-center">
            <p className="text-slate-500 text-sm">
              계정이 기억나셨나요?{' '}
              <Link href="/login" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 font-medium transition-colors">
                로그인
              </Link>
            </p>
          </div>
        </div>

        {/* 하단 링크 */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:text-slate-600 dark:hover:text-slate-400 text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}
