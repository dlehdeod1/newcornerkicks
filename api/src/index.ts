import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes } from './routes/auth'
import { sessionsRoutes } from './routes/sessions'
import { playersRoutes } from './routes/players'
import { matchesRoutes } from './routes/matches'
import { rankingsRoutes } from './routes/rankings'
import { notificationsRoutes } from './routes/notifications'
import { statsRoutes } from './routes/stats'
import { teamsRoutes } from './routes/teams'
import { settlementsRoutes } from './routes/settlements'
import { meRoutes } from './routes/me'
import { clubsRoutes } from './routes/clubs'
import { paymentsRoutes } from './routes/payments'
import { subscriptionsRoutes } from './routes/subscriptions'
import { photosRoutes } from './routes/photos'

export type Env = {
  DB: D1Database
  JWT_SECRET: string
  GEMINI_API_KEY?: string
  TOSS_SECRET_KEY?: string
  TOSS_CLIENT_KEY?: string
  TOSS_WEBHOOK_SECRET?: string
  PHOTOS: R2Bucket
}

const app = new Hono<{ Bindings: Env }>()

// 미들웨어
app.use('*', logger())
app.use('*', cors({
  origin: (origin) => {
    const allowedOrigins = [
      'http://localhost:3000',
      /^http:\/\/localhost:\d+$/,
      'https://cornerkicks.vercel.app',
      'https://cornerkicks.pages.dev',
      /\.pages\.dev$/,
      /\.workers\.dev$/,
    ]

    if (!origin) return '*'

    for (const allowed of allowedOrigins) {
      if (typeof allowed === 'string' && origin === allowed) return origin
      if (allowed instanceof RegExp && allowed.test(origin)) return origin
    }

    return null
  },
  credentials: true,
}))

// 헬스 체크
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    name: 'CornerKicks API',
    version: '0.2.0'
  })
})

// 라우트
app.route('/auth', authRoutes)
app.route('/clubs', clubsRoutes)
app.route('/sessions', sessionsRoutes)
app.route('/players', playersRoutes)
app.route('/matches', matchesRoutes)
app.route('/rankings', rankingsRoutes)
app.route('/notifications', notificationsRoutes)
app.route('/stats', statsRoutes)
app.route('/teams', teamsRoutes)
app.route('/settlements', settlementsRoutes)
app.route('/me', meRoutes)
app.route('/payments', paymentsRoutes)
app.route('/subscriptions', subscriptionsRoutes)
app.route('/photos', photosRoutes)

// 404
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

// 에러 핸들러
app.onError((err, c) => {
  console.error('Error:', err.message)
  console.error('Stack:', err.stack)
  return c.json({
    error: 'Internal Server Error',
    message: err.message,
  }, 500)
})

// 매시간 실행: 경기 종료 시간 지난 세션 → 'ended' 로 전환
async function autoTransitionSessions(env: Env) {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const todayKST = kstNow.toISOString().split('T')[0]
  const timeKST = kstNow.toISOString().split('T')[1].substring(0, 5)
  const now = Math.floor(Date.now() / 1000)

  await env.DB.prepare(`
    UPDATE sessions SET status = 'ended', updated_at = ?
    WHERE status IN ('recruiting', 'open', 'closed')
      AND end_time IS NOT NULL
      AND (
        session_date < ?
        OR (session_date = ? AND end_time <= ?)
      )
  `).bind(now, todayKST, todayKST, timeKST).run()
}

// 매시간 실행: 만료된 구독 → 'expired' 처리 + 클럽 plan_type → 'free' 다운그레이드
async function expireSubscriptions(env: Env) {
  const now = Math.floor(Date.now() / 1000)

  const expired = await env.DB.prepare(`
    SELECT id, club_id FROM subscriptions
    WHERE expires_at < ? AND status IN ('active', 'cancelled')
  `).bind(now).all()

  for (const sub of expired.results as any[]) {
    await env.DB.prepare(
      `UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE id = ?`
    ).bind(now, sub.id).run()

    // 해당 클럽에 아직 유효한 다른 구독이 없으면 free로 다운그레이드
    const otherActive = await env.DB.prepare(`
      SELECT id FROM subscriptions
      WHERE club_id = ? AND status IN ('active', 'cancelled') AND expires_at >= ?
    `).bind(sub.club_id, now).first()

    if (!otherActive) {
      await env.DB.prepare(
        `UPDATE clubs SET plan_type = 'free', updated_at = ? WHERE id = ?`
      ).bind(now, sub.club_id).run()
    }
  }
}

export default {
  fetch: app.fetch.bind(app),
  async scheduled(_event: any, env: Env, _ctx: any) {
    await autoTransitionSessions(env)
    await expireSubscriptions(env)
  },
}
