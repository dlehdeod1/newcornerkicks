import { Hono } from 'hono'
import type { Env } from '../index'
import { authMiddleware } from '../middleware/auth'

const communityRoutes = new Hono<{ Bindings: Env }>()

// GET /community — 목록 (카테고리 + 필터)
communityRoutes.get('/', authMiddleware(), async (c) => {
  const category = c.req.query('category') || null
  const region = c.req.query('region') || null
  const dayOfWeek = c.req.query('dayOfWeek') || null
  const timeSlot = c.req.query('timeSlot') || null
  const skillLevel = c.req.query('skillLevel') || null
  const status = c.req.query('status') || null
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100)
  const offset = Math.max(Number(c.req.query('offset')) || 0, 0)

  let sql = `
    SELECT cp.*, u.username as author_name, cl.name as club_name
    FROM community_posts cp
    LEFT JOIN users u ON u.id = cp.author_id
    LEFT JOIN clubs cl ON cl.id = cp.club_id
    WHERE 1=1
  `
  const binds: any[] = []

  if (category) { sql += ' AND cp.category = ?'; binds.push(category) }
  if (region) { sql += ' AND cp.region = ?'; binds.push(region) }
  if (dayOfWeek) { sql += ' AND cp.day_of_week LIKE ?'; binds.push(`%${dayOfWeek}%`) }
  if (timeSlot) { sql += ' AND cp.time_slot = ?'; binds.push(timeSlot) }
  if (skillLevel) { sql += ' AND cp.skill_level = ?'; binds.push(skillLevel) }
  if (status) { sql += ' AND cp.status = ?'; binds.push(status) }

  sql += ' ORDER BY cp.created_at DESC LIMIT ? OFFSET ?'
  binds.push(limit, offset)

  const { results } = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json({ data: results })
})

// GET /community/:id — 상세 + 댓글
communityRoutes.get('/:id', authMiddleware(), async (c) => {
  const id = Number(c.req.param('id'))

  const post = await c.env.DB.prepare(`
    SELECT cp.*, u.username as author_name, cl.name as club_name
    FROM community_posts cp
    LEFT JOIN users u ON u.id = cp.author_id
    LEFT JOIN clubs cl ON cl.id = cp.club_id
    WHERE cp.id = ?
  `).bind(id).first()

  if (!post) return c.json({ error: '게시글을 찾을 수 없습니다.' }, 404)

  const { results: comments } = await c.env.DB.prepare(`
    SELECT c.*, u.username as author_name
    FROM community_comments c
    LEFT JOIN users u ON u.id = c.author_id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `).bind(id).all()

  return c.json({ data: { ...post, comments } })
})

// POST /community — 작성
communityRoutes.post('/', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId

  const { title, content, category, imageUrl, region, dayOfWeek, timeSlot, skillLevel, headcount } = await c.req.json()

  if (!title || !content) {
    return c.json({ error: '제목과 내용은 필수입니다.' }, 400)
  }

  const validCategories = ['free', 'recruit', 'match', 'review', 'mercenary', 'patchnote']
  if (category && !validCategories.includes(category)) {
    return c.json({ error: '유효하지 않은 카테고리입니다.' }, 400)
  }

  const now = Math.floor(Date.now() / 1000)
  const result = await c.env.DB.prepare(`
    INSERT INTO community_posts (author_id, club_id, category, title, content, image_url, region, day_of_week, time_slot, skill_level, headcount, status, comment_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 0, ?, ?)
  `).bind(
    userId, clubId || null, category || 'free', title, content, imageUrl || null,
    region || null, dayOfWeek || null, timeSlot || null, skillLevel || null, headcount || null,
    now, now
  ).run()

  return c.json({ data: { id: result.meta.last_row_id } }, 201)
})

// PUT /community/:id — 수정
communityRoutes.put('/:id', authMiddleware(), async (c) => {
  const id = Number(c.req.param('id'))
  const userId = (c as any).userId

  const existing = await c.env.DB.prepare(
    'SELECT * FROM community_posts WHERE id = ?'
  ).bind(id).first()
  if (!existing) return c.json({ error: '게시글을 찾을 수 없습니다.' }, 404)

  if (existing.author_id !== userId) {
    return c.json({ error: '수정 권한이 없습니다.' }, 403)
  }

  const body = await c.req.json()
  const now = Math.floor(Date.now() / 1000)

  const updates: string[] = ['updated_at = ?']
  const binds: any[] = [now]

  if (body.title !== undefined) { updates.push('title = ?'); binds.push(body.title) }
  if (body.content !== undefined) { updates.push('content = ?'); binds.push(body.content) }
  if ('imageUrl' in body) { updates.push('image_url = ?'); binds.push(body.imageUrl) }
  if (body.category !== undefined) {
    const validCats = ['free', 'recruit', 'match', 'review', 'mercenary', 'patchnote']
    if (!validCats.includes(body.category)) {
      return c.json({ error: '유효하지 않은 카테고리입니다.' }, 400)
    }
    updates.push('category = ?'); binds.push(body.category)
  }
  if (body.region !== undefined) { updates.push('region = ?'); binds.push(body.region) }
  if (body.dayOfWeek !== undefined) { updates.push('day_of_week = ?'); binds.push(body.dayOfWeek) }
  if (body.timeSlot !== undefined) { updates.push('time_slot = ?'); binds.push(body.timeSlot) }
  if (body.skillLevel !== undefined) { updates.push('skill_level = ?'); binds.push(body.skillLevel) }
  if (body.headcount !== undefined) { updates.push('headcount = ?'); binds.push(body.headcount) }
  if (body.status !== undefined) {
    const validStatuses = ['open', 'closed']
    if (!validStatuses.includes(body.status)) {
      return c.json({ error: '유효하지 않은 상태값입니다.' }, 400)
    }
    updates.push('status = ?'); binds.push(body.status)
  }

  binds.push(id)
  await c.env.DB.prepare(
    `UPDATE community_posts SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...binds).run()

  return c.json({ data: { id } })
})

// DELETE /community/:id
communityRoutes.delete('/:id', authMiddleware(), async (c) => {
  const id = Number(c.req.param('id'))
  const userId = (c as any).userId

  const existing = await c.env.DB.prepare(
    'SELECT * FROM community_posts WHERE id = ?'
  ).bind(id).first()
  if (!existing) return c.json({ error: '게시글을 찾을 수 없습니다.' }, 404)

  if (existing.author_id !== userId) {
    return c.json({ error: '삭제 권한이 없습니다.' }, 403)
  }

  if (existing.image_url) {
    const key = (existing.image_url as string).replace('/photos/', '')
    await c.env.PHOTOS.delete(key).catch(() => {})
  }

  await c.env.DB.prepare('DELETE FROM community_posts WHERE id = ?').bind(id).run()
  return c.json({ data: { success: true } })
})

// POST /community/:id/comments
communityRoutes.post('/:id/comments', authMiddleware(), async (c) => {
  const postId = Number(c.req.param('id'))
  const userId = (c as any).userId

  const post = await c.env.DB.prepare(
    'SELECT id FROM community_posts WHERE id = ?'
  ).bind(postId).first()
  if (!post) return c.json({ error: '게시글을 찾을 수 없습니다.' }, 404)

  const { content } = await c.req.json()
  if (!content) return c.json({ error: '내용은 필수입니다.' }, 400)

  const now = Math.floor(Date.now() / 1000)
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO community_comments (post_id, author_id, content, created_at) VALUES (?, ?, ?, ?)'
    ).bind(postId, userId, content, now),
    c.env.DB.prepare(
      'UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = ?'
    ).bind(postId),
  ])

  return c.json({ data: { success: true } }, 201)
})

// DELETE /community/:id/comments/:commentId
communityRoutes.delete('/:id/comments/:commentId', authMiddleware(), async (c) => {
  const postId = Number(c.req.param('id'))
  const commentId = Number(c.req.param('commentId'))
  const userId = (c as any).userId

  const comment = await c.env.DB.prepare(
    'SELECT * FROM community_comments WHERE id = ? AND post_id = ?'
  ).bind(commentId, postId).first()
  if (!comment) return c.json({ error: '댓글을 찾을 수 없습니다.' }, 404)

  if (comment.author_id !== userId) {
    return c.json({ error: '삭제 권한이 없습니다.' }, 403)
  }

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM community_comments WHERE id = ?').bind(commentId),
    c.env.DB.prepare(
      'UPDATE community_posts SET comment_count = CASE WHEN comment_count > 0 THEN comment_count - 1 ELSE 0 END WHERE id = ?'
    ).bind(postId),
  ])

  return c.json({ data: { success: true } })
})

export { communityRoutes }
