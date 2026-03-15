'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Crown } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { subscriptionsApi } from '@/lib/api'

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { token, setClub, club } = useAuthStore()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const authKey = searchParams.get('authKey')
    const customerKey = searchParams.get('customerKey')
    const billingCycle = (searchParams.get('billingCycle') || 'monthly') as 'monthly' | 'yearly'

    if (!authKey || !customerKey || !token) {
      setStatus('error')
      setMessage('결제 정보가 올바르지 않습니다.')
      return
    }

    subscriptionsApi.billingAuth(authKey, customerKey, billingCycle, token)
      .then(() => {
        // 클럽 isPro 상태 업데이트
        if (club) {
          setClub({ ...club, isPro: true, planType: 'pro' })
        }
        setStatus('success')
      })
      .catch((e: any) => {
        setStatus('error')
        setMessage(e.message || '결제 처리 중 오류가 발생했습니다.')
      })
  }, [])

  if (status === 'loading') {
    return (
      <div className="text-center py-20">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500">결제를 처리하고 있습니다...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 mb-4">{message}</p>
        <button onClick={() => router.push('/upgrade')} className="text-emerald-600 hover:underline">
          다시 시도하기
        </button>
      </div>
    )
  }

  return (
    <div className="text-center py-20">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full mb-6 shadow-lg shadow-emerald-500/30">
        <Crown className="w-10 h-10 text-white" />
      </div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">PRO 구독 완료!</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-8">
        이제 모든 PRO 기능을 사용할 수 있습니다.
      </p>
      <button
        onClick={() => router.push('/')}
        className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
      >
        홈으로 가기
      </button>
    </div>
  )
}

export default function UpgradeSuccessPage() {
  return (
    <div className="max-w-lg mx-auto px-4">
      <Suspense fallback={<div className="text-center py-20 text-slate-500">로딩 중...</div>}>
        <SuccessContent />
      </Suspense>
    </div>
  )
}
