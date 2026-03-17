import { Hono } from 'hono'
import type { Env } from '../index'
import { authMiddleware } from '../middleware/auth'
import { isClubPro, isSubscriptionActive, PLAN_PRICES, calcExpiresAt } from '../utils/planUtils'

const subscriptionsRoutes = new Hono<{ Bindings: Env }>()

const TOSS_API_BASE = 'https://api.tosspayments.com/v1'

function tossAuthHeader(secretKey: string) {
  return 'Basic ' + btoa(secretKey + ':')
}

// ── 내 구독 정보 조회 ─────────────────────────────────
subscriptionsRoutes.get('/me', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId

  if (!clubId) return c.json({ subscription: null, isPro: false })

  const sub = await c.env.DB.prepare(`
    SELECT s.*, c.plan_type FROM subscriptions s
    JOIN clubs c ON s.club_id = c.id
    WHERE s.user_id = ? AND s.club_id = ? AND s.status = 'active'
    ORDER BY s.created_at DESC LIMIT 1
  `).bind(userId, clubId).first<any>()

  if (!sub) {
    return c.json({ subscription: null, isPro: isClubPro(null) })
  }

  // 만료 체크: cron보다 먼저 접근한 경우 즉시 다운그레이드
  if (!isSubscriptionActive(sub.expires_at)) {
    const now = Math.floor(Date.now() / 1000)
    await c.env.DB.prepare(
      `UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE id = ?`
    ).bind(now, sub.id).run()
    await c.env.DB.prepare(
      `UPDATE clubs SET plan_type = 'free', updated_at = ? WHERE id = ?`
    ).bind(now, sub.club_id).run()
    return c.json({ subscription: null, isPro: false })
  }

  return c.json({
    subscription: {
      id: sub.id,
      billingCycle: sub.billing_cycle,
      status: sub.status,
      startedAt: sub.started_at,
      expiresAt: sub.expires_at,
      amount: sub.amount,
    },
    isPro: isClubPro(sub.plan_type),
  })
})

// ── 빌링키 발급 요청 (토스 카드 등록 시작) ──────────────
// 프론트엔드에서 토스 위젯에 넘길 customerKey를 반환
subscriptionsRoutes.post('/checkout', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId

  if (!clubId) {
    return c.json({ error: '소속 클럽이 없습니다.' }, 400)
  }

  // 이미 이 클럽에 활성 구독 있는지 확인
  const existing = await c.env.DB.prepare(
    `SELECT id FROM subscriptions WHERE user_id = ? AND club_id = ? AND status = 'active'`
  ).bind(userId, clubId).first()
  if (existing) {
    return c.json({ error: '이미 구독 중입니다.' }, 400)
  }

  // customerKey: 유저별 고유값 (토스 요구사항)
  const customerKey = `ck_${userId.replace(/-/g, '').substring(0, 20)}`

  return c.json({ customerKey })
})

// ── 빌링키 인증 완료 → 최초 결제 ────────────────────────
// 토스가 successUrl로 리다이렉트한 뒤 프론트에서 호출
subscriptionsRoutes.post('/billing-auth', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId

  if (!clubId) {
    return c.json({ error: '소속 클럽이 없습니다.' }, 400)
  }

  const secretKey = c.env.TOSS_SECRET_KEY
  if (!secretKey) {
    return c.json({ error: '결제 설정이 완료되지 않았습니다.' }, 500)
  }

  const { authKey, customerKey, billingCycle = 'monthly' } = await c.req.json()
  if (!authKey || !customerKey) {
    return c.json({ error: 'authKey와 customerKey가 필요합니다.' }, 400)
  }

  const amount = PLAN_PRICES[billingCycle as 'monthly' | 'yearly'] ?? PLAN_PRICES.monthly

  try {
    // 1. 빌링키 발급
    const authRes = await fetch(`${TOSS_API_BASE}/billing/authorizations/card`, {
      method: 'POST',
      headers: {
        Authorization: tossAuthHeader(secretKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ authKey, customerKey }),
    })
    if (!authRes.ok) {
      const err = await authRes.json() as any
      return c.json({ error: err.message || '빌링키 발급에 실패했습니다.' }, 400)
    }
    const { billingKey } = await authRes.json() as any

    // 2. 최초 결제
    const orderId = `order_${userId.substring(0, 8)}_${Date.now()}`
    const chargeRes = await fetch(`${TOSS_API_BASE}/billing/${billingKey}`, {
      method: 'POST',
      headers: {
        Authorization: tossAuthHeader(secretKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerKey,
        amount,
        orderId,
        orderName: `코너킥스 PRO ${billingCycle === 'yearly' ? '연간' : '월간'} 구독`,
      }),
    })
    if (!chargeRes.ok) {
      const err = await chargeRes.json() as any
      return c.json({ error: err.message || '결제에 실패했습니다.' }, 400)
    }

    // 3. DB에 구독 저장 + 클럽 plan_type = 'pro'
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = calcExpiresAt(billingCycle as 'monthly' | 'yearly')

    await c.env.DB.prepare(`
      INSERT INTO subscriptions
        (user_id, club_id, billing_cycle, status, started_at, expires_at,
         toss_customer_key, toss_billing_key, last_order_id, amount, created_at, updated_at)
      VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(userId, clubId, billingCycle, now, expiresAt,
            customerKey, billingKey, orderId, amount, now, now).run()

    await c.env.DB.prepare(
      `UPDATE clubs SET plan_type = 'pro', updated_at = ? WHERE id = ?`
    ).bind(now, clubId).run()

    return c.json({ success: true, expiresAt })
  } catch (e: any) {
    console.error('billing-auth error:', e)
    return c.json({ error: '결제 처리 중 오류가 발생했습니다.' }, 500)
  }
})

// ── 구독 취소 ─────────────────────────────────────────
subscriptionsRoutes.post('/cancel', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId

  if (!clubId) return c.json({ error: '소속 클럽이 없습니다.' }, 400)

  const sub = await c.env.DB.prepare(
    `SELECT * FROM subscriptions WHERE user_id = ? AND club_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`
  ).bind(userId, clubId).first<any>()

  if (!sub) {
    return c.json({ error: '활성 구독이 없습니다.' }, 404)
  }

  const now = Math.floor(Date.now() / 1000)

  // 구독 취소 (만료일까지는 서비스 유지)
  await c.env.DB.prepare(
    `UPDATE subscriptions SET status = 'cancelled', updated_at = ? WHERE id = ?`
  ).bind(now, sub.id).run()

  return c.json({
    message: '구독이 취소되었습니다. 만료일까지 PRO 기능을 계속 이용할 수 있습니다.',
    expiresAt: sub.expires_at,
  })
})

async function verifyTossSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['verify']
  )
  const sigBytes = Uint8Array.from(atob(signature), ch => ch.charCodeAt(0))
  return crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(body))
}

// ── 토스 웹훅 (결제/취소 이벤트) ─────────────────────
subscriptionsRoutes.post('/webhook', async (c) => {
  const webhookSecret = c.env.TOSS_WEBHOOK_SECRET

  // 서명 검증 (TOSS_WEBHOOK_SECRET 설정된 경우)
  if (webhookSecret) {
    const signature = c.req.header('TossPayments-Signature') ?? ''
    const rawBody = await c.req.text()
    const valid = signature ? await verifyTossSignature(rawBody, signature, webhookSecret) : false
    if (!valid) {
      return c.json({ error: 'Invalid signature' }, 401)
    }
    // rawBody를 이미 읽었으므로 파싱해서 처리
    try {
      const event = JSON.parse(rawBody) as any
      const { eventType, data } = event
      if (eventType === 'PAYMENT_CANCELED' || eventType === 'BILLING_FAILED') {
        const orderId = data?.orderId
        if (orderId) {
          const sub = await c.env.DB.prepare(
            `SELECT * FROM subscriptions WHERE last_order_id = ?`
          ).bind(orderId).first<any>()
          if (sub) {
            const now = Math.floor(Date.now() / 1000)
            await c.env.DB.prepare(
              `UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE id = ?`
            ).bind(now, sub.id).run()
            await c.env.DB.prepare(
              `UPDATE clubs SET plan_type = 'free', updated_at = ? WHERE id = ?`
            ).bind(now, sub.club_id).run()
          }
        }
      }
    } catch (e) {
      console.error('webhook error:', e)
    }
    return c.json({ ok: true })
  }

  try {
    const event = await c.req.json() as any
    const { eventType, data } = event

    if (eventType === 'PAYMENT_CANCELED' || eventType === 'BILLING_FAILED') {
      const orderId = data?.orderId
      if (orderId) {
        const sub = await c.env.DB.prepare(
          `SELECT * FROM subscriptions WHERE last_order_id = ?`
        ).bind(orderId).first<any>()
        if (sub) {
          const now = Math.floor(Date.now() / 1000)
          await c.env.DB.prepare(
            `UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE id = ?`
          ).bind(now, sub.id).run()
          await c.env.DB.prepare(
            `UPDATE clubs SET plan_type = 'free', updated_at = ? WHERE id = ?`
          ).bind(now, sub.club_id).run()
        }
      }
    }
  } catch (e) {
    console.error('webhook error:', e)
  }

  return c.json({ ok: true })
})

export { subscriptionsRoutes }
