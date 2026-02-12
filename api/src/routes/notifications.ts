import { Hono } from 'hono'
import type { Env } from '../index'
import { authMiddleware } from '../middleware/auth'

const notificationsRoutes = new Hono<{ Bindings: Env }>()

// 내 알림 목록 조회
notificationsRoutes.get('/', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const limit = Number(c.req.query('limit')) || 20
  const unreadOnly = c.req.query('unread') === 'true'

  let query = `
    SELECT * FROM notifications
    WHERE user_id = ?
  `
  const params: any[] = [userId]

  if (unreadOnly) {
    query += ' AND is_read = 0'
  }

  query += ' ORDER BY created_at DESC LIMIT ?'
  params.push(limit)

  const notifications = await c.env.DB.prepare(query).bind(...params).all()

  // 읽지 않은 알림 개수
  const unreadCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
  ).bind(userId).first()

  return c.json({
    notifications: notifications.results,
    unreadCount: unreadCount?.count || 0,
  })
})

// 알림 읽음 처리
notificationsRoutes.put('/:id/read', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const id = c.req.param('id')

  await c.env.DB.prepare(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
  ).bind(id, userId).run()

  return c.json({ message: '알림을 읽음 처리했습니다.' })
})

// 모든 알림 읽음 처리
notificationsRoutes.put('/read-all', authMiddleware(), async (c) => {
  const userId = (c as any).userId

  await c.env.DB.prepare(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0'
  ).bind(userId).run()

  return c.json({ message: '모든 알림을 읽음 처리했습니다.' })
})

// 알림 삭제
notificationsRoutes.delete('/:id', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const id = c.req.param('id')

  await c.env.DB.prepare(
    'DELETE FROM notifications WHERE id = ? AND user_id = ?'
  ).bind(id, userId).run()

  return c.json({ message: '알림이 삭제되었습니다.' })
})

// 알림 생성 (내부용 또는 관리자)
notificationsRoutes.post('/', authMiddleware('ADMIN'), async (c) => {
  const body = await c.req.json()
  const { userId, type, title, message, linkUrl } = body

  const now = Math.floor(Date.now() / 1000)

  const result = await c.env.DB.prepare(`
    INSERT INTO notifications (user_id, type, title, message, link_url, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).bind(userId, type, title, message, linkUrl || null, now).run()

  return c.json({
    id: result.meta.last_row_id,
    message: '알림이 생성되었습니다.',
  }, 201)
})

// 일괄 알림 생성 (모든 사용자 또는 특정 그룹)
notificationsRoutes.post('/broadcast', authMiddleware('ADMIN'), async (c) => {
  try {
    const body = await c.req.json()
    const { type, title, message, linkUrl, userIds } = body

    if (!type || !title || !message) {
      return c.json({ error: '필수 필드가 누락되었습니다.' }, 400)
    }

    const now = Math.floor(Date.now() / 1000)

    // 특정 사용자들에게 알림
    if (userIds && userIds.length > 0) {
      for (const userId of userIds) {
        await c.env.DB.prepare(`
          INSERT INTO notifications (user_id, type, title, message, link_url, is_read, created_at)
          VALUES (?, ?, ?, ?, ?, 0, ?)
        `).bind(userId, type, title, message, linkUrl || null, now).run()
      }
      return c.json({ message: `${userIds.length}명에게 알림을 전송했습니다.` })
    }

    // 모든 사용자에게 알림
    const users = await c.env.DB.prepare('SELECT id FROM users').all()

    if (users.results.length === 0) {
      return c.json({ message: '알림을 전송할 사용자가 없습니다. (0명 전송)' })
    }

    for (const user of users.results) {
      await c.env.DB.prepare(`
        INSERT INTO notifications (user_id, type, title, message, link_url, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?)
      `).bind((user as any).id, type, title, message, linkUrl || null, now).run()
    }

    return c.json({ message: `${users.results.length}명에게 알림을 전송했습니다.` })
  } catch (err: any) {
    console.error('Broadcast error:', err)
    return c.json({ error: err.message || '알림 발송 중 오류가 발생했습니다.' }, 500)
  }
})

export { notificationsRoutes }
