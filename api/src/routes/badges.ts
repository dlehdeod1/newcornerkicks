import { Hono } from 'hono'
import type { Env } from '../index'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth'
import { checkAndAwardBadges } from '../utils/badges'

const badgesRoutes = new Hono<{ Bindings: Env }>()

// 전체 뱃지 정의 목록
badgesRoutes.get('/', optionalAuthMiddleware, async (c) => {
  const badges = await c.env.DB.prepare(
    'SELECT code, name, description, condition_type, threshold FROM badges ORDER BY code'
  ).all()

  return c.json({ data: badges.results })
})

// 특정 선수의 획득 뱃지 목록
badgesRoutes.get('/player/:playerId', optionalAuthMiddleware, async (c) => {
  const playerId = Number(c.req.param('playerId'))
  if (isNaN(playerId)) return c.json({ error: '유효하지 않은 선수 ID입니다.' }, 400)

  const playerBadges = await c.env.DB.prepare(`
    SELECT pb.badge_code, pb.earned_at, b.name, b.description, b.condition_type, b.threshold
    FROM player_badges pb
    JOIN badges b ON pb.badge_code = b.code
    WHERE pb.player_id = ?
    ORDER BY pb.earned_at DESC
  `).bind(playerId).all()

  return c.json({ data: playerBadges.results })
})

// 수동 뱃지 체크 (관리자 전용)
badgesRoutes.post('/check/:playerId', authMiddleware('ADMIN'), async (c) => {
  const playerId = Number(c.req.param('playerId'))
  const clubId = (c as any).clubId
  if (isNaN(playerId) || !clubId) {
    return c.json({ error: '유효하지 않은 요청입니다.' }, 400)
  }

  // 가장 최근 세션 ID를 찾아서 사용 (ALL_ROUNDER, HAT_TRICK 등 세션별 체크용)
  const latestSession = await c.env.DB.prepare(`
    SELECT s.id FROM sessions s
    JOIN attendance a ON a.session_id = s.id
    WHERE s.club_id = ? AND a.player_id = ? AND s.status IN ('completed', 'closed', 'ended')
    ORDER BY s.session_date DESC LIMIT 1
  `).bind(clubId, playerId).first<any>()

  const sessionId = latestSession?.id || 0
  const newBadges = await checkAndAwardBadges(c.env.DB, playerId, clubId, sessionId)

  return c.json({ data: { newBadges, count: newBadges.length } })
})

export { badgesRoutes }
