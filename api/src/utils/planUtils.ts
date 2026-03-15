/**
 * 클럽의 플랜 타입을 보고 pro 여부 반환
 * plan_type: 'free' | 'pro' | 'developer'
 */
export function isClubPro(planType: string | null | undefined): boolean {
  return planType === 'pro' || planType === 'developer'
}

/**
 * 구독 만료 여부 확인 (expires_at은 Unix timestamp)
 */
export function isSubscriptionActive(expiresAt: number | null | undefined): boolean {
  if (!expiresAt) return false
  return Math.floor(Date.now() / 1000) < expiresAt
}

/**
 * 청구 주기별 금액
 */
export const PLAN_PRICES = {
  monthly: 4900,
  yearly: 39000,
} as const

/**
 * 다음 만료일 계산 (Unix timestamp)
 */
export function calcExpiresAt(billingCycle: 'monthly' | 'yearly'): number {
  const now = new Date()
  if (billingCycle === 'yearly') {
    now.setFullYear(now.getFullYear() + 1)
  } else {
    now.setMonth(now.getMonth() + 1)
  }
  return Math.floor(now.getTime() / 1000)
}
