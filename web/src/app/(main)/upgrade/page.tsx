'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Zap, Crown, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { subscriptionsApi } from '@/lib/api'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq'

const FREE_FEATURES = [
  '클럽 1개',
  '랜덤 팀 편성',
  '기본 통계',
  '세션/선수 관리',
]

const PRO_FEATURES = [
  '클럽 무제한',
  'AI 능력치 기반 팀 편성',
  '상세 통계 & 트렌드 분석',
  '다중 관리자 설정',
  '데이터 내보내기 (Excel/PDF)',
  '광고 없음',
]

export default function UpgradePage() {
  const router = useRouter()
  const { token, club, isLoggedIn } = useAuthStore()
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [loading, setLoading] = useState(false)
  const [subInfo, setSubInfo] = useState<any>(null)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')

  const isPro = club?.isPro

  useEffect(() => {
    if (!isLoggedIn || !token) {
      router.push('/login')
      return
    }
    subscriptionsApi.me(token).then((data: any) => {
      setSubInfo(data)
    }).catch(() => {})
  }, [isLoggedIn, token])

  const handleUpgrade = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const { customerKey } = await subscriptionsApi.checkout(token) as any

      const toss = await loadTossPayments(TOSS_CLIENT_KEY)
      const payment = toss.payment({ customerKey })
      await payment.requestBillingAuth({
        method: 'CARD',
        successUrl: `${window.location.origin}/upgrade/success?billingCycle=${billingCycle}`,
        failUrl: `${window.location.origin}/upgrade?error=failed`,
      })
    } catch (e: any) {
      setError(e.message || '결제 창을 열지 못했습니다.')
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!token || !confirm('구독을 취소하시겠습니까? 만료일까지는 PRO 기능을 계속 이용하실 수 있습니다.')) return
    setCancelling(true)
    try {
      const data = await subscriptionsApi.cancel(token) as any
      alert(data.message)
      setSubInfo((prev: any) => ({ ...prev, subscription: { ...prev.subscription, status: 'cancelled' } }))
    } catch (e: any) {
      alert(e.message || '취소 처리 중 오류가 발생했습니다.')
    } finally {
      setCancelling(false)
    }
  }

  const price = billingCycle === 'yearly' ? 39000 : 4900
  const monthlyEquiv = billingCycle === 'yearly' ? Math.round(39000 / 12) : 4900

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
          <Crown className="w-4 h-4" />
          PRO 플랜
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
          클럽을 더 스마트하게 관리하세요
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          AI 팀 편성, 상세 통계, 다중 관리자 등 프리미엄 기능을 모두 사용해보세요
        </p>
      </div>

      {/* 현재 구독 정보 (PRO인 경우) */}
      {isPro && subInfo?.subscription && (
        <div className="mb-8 p-6 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">PRO 플랜 이용 중</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {subInfo.subscription.billingCycle === 'yearly' ? '연간' : '월간'} ·{' '}
                만료일: {new Date(subInfo.subscription.expiresAt * 1000).toLocaleDateString('ko-KR')}
              </p>
            </div>
            {subInfo.subscription.status === 'active' && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="text-sm text-red-500 hover:text-red-600 disabled:opacity-50"
              >
                {cancelling ? '처리 중...' : '구독 취소'}
              </button>
            )}
            {subInfo.subscription.status === 'cancelled' && (
              <span className="text-sm text-slate-500">취소됨 (만료일까지 이용 가능)</span>
            )}
          </div>
        </div>
      )}

      {/* 요금제 선택 토글 */}
      {!isPro && (
        <>
          <div className="flex justify-center mb-8">
            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-1 flex gap-1">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                월간 결제
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                  billingCycle === 'yearly'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                연간 결제
                <span className="ml-1.5 text-xs bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">33% 할인</span>
              </button>
            </div>
          </div>

          {/* 플랜 카드 */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* FREE */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <div className="mb-4">
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">FREE</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">₩0</p>
                <p className="text-sm text-slate-400 mt-1">영구 무료</p>
              </div>
              <ul className="space-y-3">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Check className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {!isPro && (
                <div className="mt-6 w-full py-2.5 text-center text-sm text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl">
                  현재 플랜
                </div>
              )}
            </div>

            {/* PRO */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <Zap className="w-5 h-5 opacity-30" />
              </div>
              <div className="mb-4">
                <p className="text-sm font-medium opacity-80 mb-1">PRO</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold">₩{price.toLocaleString()}</p>
                  <p className="text-sm opacity-80">/ {billingCycle === 'yearly' ? '년' : '월'}</p>
                </div>
                {billingCycle === 'yearly' && (
                  <p className="text-sm opacity-70 mt-1">월 ₩{monthlyEquiv.toLocaleString()} 상당</p>
                )}
              </div>
              <ul className="space-y-3 mb-6">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full py-3 bg-white text-emerald-600 font-semibold rounded-xl hover:bg-emerald-50 transition-colors disabled:opacity-60"
              >
                {loading ? '처리 중...' : `PRO 시작하기`}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-center text-sm text-red-500 mt-2">{error}</p>
          )}
        </>
      )}

      <p className="text-center text-xs text-slate-400 mt-6">
        토스페이먼츠로 안전하게 결제됩니다 · 언제든지 취소 가능
      </p>
    </div>
  )
}
