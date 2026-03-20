import { Hono } from 'hono'
import type { Env } from '../index'
import { authMiddleware } from '../middleware/auth'

const announcementsRoutes = new Hono<{ Bindings: Env }>()

// GET /announcements — 목록 (클럽 공지 + 시스템 공지)
announcementsRoutes.get('/', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId
  const limit = Number(c.req.query('limit')) || 20
  const offset = Number(c.req.query('offset')) || 0

  const { results } = await c.env.DB.prepare(`
    SELECT a.*,
      u.username as author_name,
      CASE WHEN ar.user_id IS NOT NULL THEN 1 ELSE 0 END as is_read
    FROM announcements a
    LEFT JOIN users u ON u.id = a.created_by
    LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id AND ar.user_id = ?
    WHERE a.club_id = ? OR a.club_id IS NULL
    ORDER BY a.is_pinned DESC, a.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(userId, clubId, limit, offset).all()

  return c.json({ data: results })
})

// GET /announcements/unread-count — MUST be before /:id to avoid route conflict
announcementsRoutes.get('/unread-count', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId

  const row = await c.env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM announcements a
    LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id AND ar.user_id = ?
    WHERE (a.club_id = ? OR a.club_id IS NULL)
      AND ar.user_id IS NULL
  `).bind(userId, clubId).first()

  return c.json({ data: { count: row?.count ?? 0 } })
})

// GET /announcements/:id — 상세 + 자동 읽음 처리
announcementsRoutes.get('/:id', authMiddleware(), async (c) => {
  const id = Number(c.req.param('id'))
  const userId = (c as any).userId
  const clubId = (c as any).clubId

  const row = await c.env.DB.prepare(`
    SELECT a.*, u.username as author_name
    FROM announcements a
    LEFT JOIN users u ON u.id = a.created_by
    WHERE a.id = ? AND (a.club_id = ? OR a.club_id IS NULL)
  `).bind(id, clubId).first()

  if (!row) return c.json({ error: '공지를 찾을 수 없습니다.' }, 404)

  const now = Math.floor(Date.now() / 1000)
  await c.env.DB.prepare(`
    INSERT OR IGNORE INTO announcement_reads (announcement_id, user_id, read_at)
    VALUES (?, ?, ?)
  `).bind(id, userId, now).run()

  return c.json({ data: row })
})

// POST /announcements — 작성
announcementsRoutes.post('/', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId
  const clubRole = (c as any).clubRole

  const { title, content, imageUrl, isPinned, isSystem } = await c.req.json()

  if (!title || !content) {
    return c.json({ error: '제목과 내용은 필수입니다.' }, 400)
  }

  // 시스템 공지: SYSTEM_ADMIN_IDS 환경변수로 관리자 판별
  const isSystemAdmin = (c.env.SYSTEM_ADMIN_IDS || '').split(',').includes(userId)
  let targetClubId = clubId
  if (isSystem) {
    if (!isSystemAdmin) {
      return c.json({ error: '시스템 공지는 시스템 관리자만 작성할 수 있습니다.' }, 403)
    }
    targetClubId = null
  } else {
    if (clubRole !== 'admin' && clubRole !== 'owner') {
      return c.json({ error: '클럽 관리자만 공지를 작성할 수 있습니다.' }, 403)
    }
  }

  const now = Math.floor(Date.now() / 1000)
  const result = await c.env.DB.prepare(`
    INSERT INTO announcements (club_id, title, content, image_url, is_pinned, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(targetClubId, title, content, imageUrl || null, isPinned ? 1 : 0, userId, now, now).run()

  const id = result.meta.last_row_id

  // 알림 발송
  let members: any
  if (targetClubId) {
    members = await c.env.DB.prepare(`
      SELECT user_id FROM club_members WHERE club_id = ? AND user_id != ?
    `).bind(targetClubId, userId).all()
  } else {
    members = await c.env.DB.prepare(`
      SELECT id as user_id FROM users WHERE id != ?
    `).bind(userId).all()
  }

  if (members.results.length > 0) {
    const values = members.results.map(() => '(?, ?, ?, ?, ?, ?)').join(',')
    const binds = members.results.flatMap((m: any) => [
      m.user_id, 'ANNOUNCEMENT', '새 공지사항', title, `/announcements/${id}`, now
    ])
    await c.env.DB.prepare(`
      INSERT INTO notifications (user_id, type, title, message, link_url, created_at)
      VALUES ${values}
    `).bind(...binds).run()
  }

  return c.json({ data: { id } }, 201)
})

// PUT /announcements/:id — 수정
announcementsRoutes.put('/:id', authMiddleware(), async (c) => {
  const id = Number(c.req.param('id'))
  const userId = (c as any).userId
  const clubRole = (c as any).clubRole

  const existing = await c.env.DB.prepare(
    'SELECT * FROM announcements WHERE id = ?'
  ).bind(id).first()
  if (!existing) return c.json({ error: '공지를 찾을 수 없습니다.' }, 404)

  if (existing.created_by !== userId && clubRole !== 'admin' && clubRole !== 'owner') {
    return c.json({ error: '수정 권한이 없습니다.' }, 403)
  }

  const body = await c.req.json()
  const now = Math.floor(Date.now() / 1000)

  const updates: string[] = ['updated_at = ?']
  const binds: any[] = [now]

  if (body.title !== undefined) { updates.push('title = ?'); binds.push(body.title) }
  if (body.content !== undefined) { updates.push('content = ?'); binds.push(body.content) }
  if ('imageUrl' in body) { updates.push('image_url = ?'); binds.push(body.imageUrl) }
  if (body.isPinned !== undefined) { updates.push('is_pinned = ?'); binds.push(body.isPinned ? 1 : 0) }

  binds.push(id)
  await c.env.DB.prepare(
    `UPDATE announcements SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...binds).run()

  return c.json({ data: { id } })
})

// DELETE /announcements/:id
announcementsRoutes.delete('/:id', authMiddleware(), async (c) => {
  const id = Number(c.req.param('id'))
  const userId = (c as any).userId
  const clubRole = (c as any).clubRole

  const existing = await c.env.DB.prepare(
    'SELECT * FROM announcements WHERE id = ?'
  ).bind(id).first()
  if (!existing) return c.json({ error: '공지를 찾을 수 없습니다.' }, 404)

  if (existing.created_by !== userId && clubRole !== 'admin' && clubRole !== 'owner') {
    return c.json({ error: '삭제 권한이 없습니다.' }, 403)
  }

  if (existing.image_url) {
    const key = (existing.image_url as string).replace('/photos/', '')
    await c.env.PHOTOS.delete(key)
  }

  await c.env.DB.prepare('DELETE FROM announcements WHERE id = ?').bind(id).run()

  return c.json({ data: { success: true } })
})

export { announcementsRoutes }
