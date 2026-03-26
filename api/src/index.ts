import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes } from './routes/auth'
import { sessionsRoutes, autoSettleSession } from './routes/sessions'
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
import { exportRoutes } from './routes/export'
import { uploadsRoutes } from './routes/uploads'
import { announcementsRoutes } from './routes/announcements'
import { postsRoutes } from './routes/posts'
import { communityRoutes } from './routes/community'

export type Env = {
  DB: D1Database
  JWT_SECRET: string
  GEMINI_API_KEY?: string
  TOSS_SECRET_KEY?: string
  TOSS_CLIENT_KEY?: string
  TOSS_WEBHOOK_SECRET?: string
  PHOTOS: R2Bucket
  SYSTEM_ADMIN_IDS?: string
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
app.route('/export', exportRoutes)
app.route('/uploads', uploadsRoutes)
app.route('/announcements', announcementsRoutes)
app.route('/posts', postsRoutes)
app.route('/community', communityRoutes)

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

  // 1. end_time 지난 세션 → ended로 전환 (end_time null이면 session_date 다음날 자정 기준)
  const transitioning = await env.DB.prepare(`
    SELECT id FROM sessions
    WHERE status IN ('recruiting', 'open', 'closed')
      AND (
        (end_time IS NOT NULL AND (session_date < ? OR (session_date = ? AND end_time <= ?)))
        OR (end_time IS NULL AND session_date < ?)
      )
  `).bind(todayKST, todayKST, timeKST, todayKST).all()

  for (const session of transitioning.results as any[]) {
    await env.DB.prepare(
      'UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?'
    ).bind('ended', now, session.id).run()

    // 자동 정산 생성
    try {
      await autoSettleSession(env.DB, session.id)
    } catch (e) {
      console.error(`autoSettleSession failed for session ${session.id}:`, e)
    }
  }

  // 2. ended/completed인데 settlement 없는 세션 보강
  const missingSettlement = await env.DB.prepare(`
    SELECT s.id FROM sessions s
    LEFT JOIN settlements st ON st.session_id = s.id
    WHERE s.status IN ('ended', 'completed')
      AND st.id IS NULL
  `).all()

  for (const session of missingSettlement.results as any[]) {
    try {
      await autoSettleSession(env.DB, session.id)
    } catch (e) {
      console.error(`autoSettleSession backfill failed for session ${session.id}:`, e)
    }
  }
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

// 매시간 실행: MVP 투표 마감 (ended/completed, 24시간 경과, mvp_vote_enabled 클럽)
async function finalizeMvpVotes(env: Env) {
  const now = Math.floor(Date.now() / 1000)
  const cutoff = now - 86400 // 24시간 전

  // MVP 투표 마감 대상 세션 (ended/completed, 24시간 경과, mvp_vote_enabled 클럽)
  const sessions = await env.DB.prepare(`
    SELECT s.id, s.club_id
    FROM sessions s
    JOIN clubs c ON s.club_id = c.id
    WHERE s.status IN ('ended', 'completed')
      AND s.updated_at < ?
      AND c.mvp_vote_enabled = 1
      AND s.id NOT IN (SELECT session_id FROM session_mvp_results)
  `).bind(cutoff).all()

  for (const session of sessions.results as any[]) {
    // 투표 집계
    const votes = await env.DB.prepare(`
      SELECT voted_player_id, COUNT(*) as vote_count
      FROM session_mvp_votes
      WHERE session_id = ?
      GROUP BY voted_player_id
      ORDER BY vote_count DESC
    `).bind(session.id).all()

    if ((votes.results as any[]).length === 0) continue

    // 참가자 수 (attendance 테이블)
    const attendeeCount = await env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM attendance WHERE session_id = ?'
    ).bind(session.id).first<any>()
    const total = attendeeCount?.cnt || 1

    // 최고 득표자만 MVP로 저장
    const winner = (votes.results as any[])[0]
    const voteBonus = (winner.vote_count / total) * 3.0
    await env.DB.prepare(`
      INSERT OR REPLACE INTO session_mvp_results
        (session_id, player_id, vote_count, vote_bonus, decided_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(session.id, winner.voted_player_id, winner.vote_count, voteBonus, now).run()
  }
}

// 매시간 실행: 세션 당일 리마인더 (오전 9시 KST ≈ UTC 0시)
async function sendSessionDayReminders(env: Env) {
  const now = Math.floor(Date.now() / 1000)
  // KST 기준 현재 시각
  const kstHour = new Date(now * 1000).getUTCHours() + 9
  // UTC 0시 = KST 9시에만 실행
  if (kstHour % 24 !== 9) return

  const today = new Date(now * 1000 + 9 * 3600 * 1000).toISOString().slice(0, 10)

  // 오늘 세션 조회 (recruiting/진행 전 상태)
  const sessions = await env.DB.prepare(`
    SELECT s.id, s.club_id, s.title, s.session_date, c.notification_config
    FROM sessions s
    JOIN clubs c ON s.club_id = c.id
    WHERE s.session_date = ? AND s.status = 'recruiting'
  `).bind(today).all()

  for (const session of sessions.results as any[]) {
    const config = JSON.parse(session.notification_config ?? '{}')
    if (config.sessionDayRemind === false) continue

    // 클럽 전체 멤버에게 알림
    const members = await env.DB.prepare(
      'SELECT user_id FROM club_members WHERE club_id = ?'
    ).bind(session.club_id).all()

    for (const m of members.results as any[]) {
      await env.DB.prepare(
        `INSERT INTO notifications (user_id, type, title, message, link_url, is_read, created_at)
         VALUES (?, 'session_day_remind', ?, ?, ?, 0, ?)`
      ).bind(
        m.user_id,
        '오늘 세션이 있어요!',
        `${session.title || '정기 풋살'} - 오늘 예정된 세션을 확인하세요.`,
        `/sessions/${session.id}`,
        now
      ).run()
    }
  }
}

export default {
  fetch: app.fetch.bind(app),
  async scheduled(_event: any, env: Env, _ctx: any) {
    await autoTransitionSessions(env)
    await expireSubscriptions(env)
    await finalizeMvpVotes(env)
    await sendSessionDayReminders(env)
  },
}
