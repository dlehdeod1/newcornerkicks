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

export type Env = {
  DB: D1Database
  JWT_SECRET: string
  GEMINI_API_KEY?: string
}

const app = new Hono<{ Bindings: Env }>()

// 미들웨어
app.use('*', logger())
app.use('*', cors({
  origin: [
    'http://localhost:3000',
    'https://cornerkicks.vercel.app',
    'https://cornerkicks.pages.dev'
  ],
  credentials: true,
}))

// 헬스 체크
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    name: 'CornerKicks API',
    version: '0.1.0'
  })
})

// 라우트
app.route('/auth', authRoutes)
app.route('/sessions', sessionsRoutes)
app.route('/players', playersRoutes)
app.route('/matches', matchesRoutes)
app.route('/rankings', rankingsRoutes)
app.route('/notifications', notificationsRoutes)
app.route('/stats', statsRoutes)
app.route('/teams', teamsRoutes)
app.route('/settlements', settlementsRoutes)
app.route('/me', meRoutes)

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

export default app
