'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { GoogleLogin } from '@react-oauth/google'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/lib/api'

// useSearchParams는 Suspense 안에서만 사용 가능
function NoticeFromParams({ onNotice }: { onNotice: (msg: string) => void }) {
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('reason') === 'expired') {
      onNotice('세션이 만료되었습니다. 다시 로그인해주세요.')
    }
  }, [searchParams, onNotice])
  return null
}

export default function LoginPage() {
  const router = useRouter()
  const login = useAuthStore((s) => s.login)

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [notice, setNotice] = useState('')

  const navigateAfterLogin = (clubs: any[]) => {
    if (clubs.length === 0) {
      router.push('/clubs')   // 클럽 없음 → 클럽 가입/생성 화면
    } else if (clubs.length === 1) {
      router.push('/')
    } else {
      router.push('/clubs')   // 여러 클럽 → 선택 화면
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await authApi.login(identifier, password)
      const clubs = data.clubs ?? (data.club ? [data.club] : [])
      login(data.token, data.user, clubs)
      navigateAfterLogin(clubs)
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSuccess = async (credentialResponse: any) => {
    const idToken = credentialResponse.credential
    if (!idToken) {
      setError('Google 인증 정보를 받지 못했습니다.')
      return
    }
    setError('')
    try {
      const data = await authApi.googleLogin(idToken)
      const clubs = data.clubs ?? (data.club ? [data.club] : [])
      login(data.token, data.user, clubs)
      navigateAfterLogin(clubs)
    } catch (err: any) {
      setError(err.message || 'Google 로그인에 실패했습니다.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4">
      <Suspense>
        <NoticeFromParams onNotice={setNotice} />
      </Suspense>

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
          <p className="text-slate-500 mt-2">수요일의 열정을 기록하세요</p>
        </div>

        {/* 로그인 폼 */}
        <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">로그인</h2>

          {notice && (
            <div className="mb-6 p-4 bg-yellow-100 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-xl">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">{notice}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              id="identifier"
              type="text"
              label="이메일 또는 아이디"
              placeholder="이메일 또는 아이디 입력"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />

            <Input
              id="password"
              type="password"
              label="비밀번호"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <div className="p-4 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full h-12 text-base" loading={loading}>
              로그인
            </Button>
          </form>

          {/* 구분선 */}
          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            <span className="text-xs text-slate-400">또는</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          </div>

          {/* Google 로그인 */}
          <div className="mt-4 flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google 로그인에 실패했습니다.')}
              text="signin_with"
              shape="rectangular"
              size="large"
              width="368"
            />
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3 text-center">
            <p className="text-slate-500 text-sm">
              계정이 없으신가요?{' '}
              <Link href="/register" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 font-medium transition-colors">
                회원가입
              </Link>
            </p>
            <p className="text-slate-400 dark:text-slate-500 text-sm">
              <Link href="/find-account" className="text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                아이디 · 비밀번호 찾기
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
