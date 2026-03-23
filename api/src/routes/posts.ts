import { Hono } from 'hono'
import type { Env } from '../index'
import { authMiddleware } from '../middleware/auth'

const postsRoutes = new Hono<{ Bindings: Env }>()

// GET /posts — 목록 (카테고리 필터)
postsRoutes.get('/', authMiddleware(), async (c) => {
  const clubId = (c as any).clubId
  const category = c.req.query('category') || null
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100)
  const offset = Math.max(Number(c.req.query('offset')) || 0, 0)

  let sql = `
    SELECT p.*, u.username as author_name
    FROM posts p
    LEFT JOIN users u ON u.id = p.author_id
    WHERE p.club_id = ?
  `
  const binds: any[] = [clubId]

  if (category) {
    sql += ' AND p.category = ?'
    binds.push(category)
  }

  sql += ' ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT ? OFFSET ?'
  binds.push(limit, offset)

  const { results } = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json({ data: results })
})

// GET /posts/:id — 상세 + 댓글
postsRoutes.get('/:id', authMiddleware(), async (c) => {
  const id = Number(c.req.param('id'))
  const clubId = (c as any).clubId

  const post = await c.env.DB.prepare(`
    SELECT p.*, u.username as author_name
    FROM posts p
    LEFT JOIN users u ON u.id = p.author_id
    WHERE p.id = ? AND p.club_id = ?
  `).bind(id, clubId).first()

  if (!post) return c.json({ error: '게시글을 찾을 수 없습니다.' }, 404)

  const { results: comments } = await c.env.DB.prepare(`
    SELECT c.*, u.username as author_name
    FROM post_comments c
    LEFT JOIN users u ON u.id = c.author_id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `).bind(id).all()

  return c.json({ data: { ...post, comments } })
})

// POST /posts — 작성
postsRoutes.post('/', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId
  const clubRole = (c as any).clubRole

  const { title, content, category, imageUrl, isPinned } = await c.req.json()

  if (!title || !content) {
    return c.json({ error: '제목과 내용은 필수입니다.' }, 400)
  }

  const validCategories = ['free', 'review', 'schedule']
  if (category && !validCategories.includes(category)) {
    return c.json({ error: '유효하지 않은 카테고리입니다.' }, 400)
  }

  // isPinned는 admin/owner만
  const pinValue = (isPinned && (clubRole === 'admin' || clubRole === 'owner')) ? 1 : 0

  const now = Math.floor(Date.now() / 1000)
  const result = await c.env.DB.prepare(`
    INSERT INTO posts (club_id, author_id, category, title, content, image_url, is_pinned, comment_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).bind(clubId, userId, category || 'free', title, content, imageUrl || null, pinValue, now, now).run()

  return c.json({ data: { id: result.meta.last_row_id } }, 201)
})

// PUT /posts/:id — 수정
postsRoutes.put('/:id', authMiddleware(), async (c) => {
  const id = Number(c.req.param('id'))
  const userId = (c as any).userId
  const clubId = (c as any).clubId
  const clubRole = (c as any).clubRole

  const existing = await c.env.DB.prepare(
    'SELECT * FROM posts WHERE id = ? AND club_id = ?'
  ).bind(id, clubId).first()
  if (!existing) return c.json({ error: '게시글을 찾을 수 없습니다.' }, 404)

  if (existing.author_id !== userId && clubRole !== 'admin' && clubRole !== 'owner') {
    return c.json({ error: '수정 권한이 없습니다.' }, 403)
  }

  const body = await c.req.json()
  const now = Math.floor(Date.now() / 1000)

  const updates: string[] = ['updated_at = ?']
  const binds: any[] = [now]

  if (body.title !== undefined) { updates.push('title = ?'); binds.push(body.title) }
  if (body.content !== undefined) { updates.push('content = ?'); binds.push(body.content) }
  if ('imageUrl' in body) { updates.push('image_url = ?'); binds.push(body.imageUrl) }
  if (body.isPinned !== undefined && (clubRole === 'admin' || clubRole === 'owner')) {
    updates.push('is_pinned = ?'); binds.push(body.isPinned ? 1 : 0)
  }
  if (body.category !== undefined) {
    const validCats = ['free', 'review', 'schedule']
    if (!validCats.includes(body.category)) {
      return c.json({ error: '유효하지 않은 카테고리입니다.' }, 400)
    }
    updates.push('category = ?'); binds.push(body.category)
  }

  binds.push(id)
  await c.env.DB.prepare(
    `UPDATE posts SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...binds).run()

  return c.json({ data: { id } })
})

// DELETE /posts/:id
postsRoutes.delete('/:id', authMiddleware(), async (c) => {
  const id = Number(c.req.param('id'))
  const userId = (c as any).userId
  const clubId = (c as any).clubId
  const clubRole = (c as any).clubRole

  const existing = await c.env.DB.prepare(
    'SELECT * FROM posts WHERE id = ? AND club_id = ?'
  ).bind(id, clubId).first()
  if (!existing) return c.json({ error: '게시글을 찾을 수 없습니다.' }, 404)

  if (existing.author_id !== userId && clubRole !== 'admin' && clubRole !== 'owner') {
    return c.json({ error: '삭제 권한이 없습니다.' }, 403)
  }

  // R2 이미지 삭제
  if (existing.image_url) {
    const key = (existing.image_url as string).replace('/photos/', '')
    await c.env.PHOTOS.delete(key).catch(() => {})
  }

  // CASCADE로 댓글도 자동 삭제됨
  await c.env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run()
  return c.json({ data: { success: true } })
})

// POST /posts/:id/comments — 댓글 작성
postsRoutes.post('/:id/comments', authMiddleware(), async (c) => {
  const postId = Number(c.req.param('id'))
  const userId = (c as any).userId
  const clubId = (c as any).clubId

  const post = await c.env.DB.prepare(
    'SELECT id FROM posts WHERE id = ? AND club_id = ?'
  ).bind(postId, clubId).first()
  if (!post) return c.json({ error: '게시글을 찾을 수 없습니다.' }, 404)

  const { content } = await c.req.json()
  if (!content) return c.json({ error: '내용은 필수입니다.' }, 400)

  const now = Math.floor(Date.now() / 1000)

  // 댓글 삽입 + comment_count 증가
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO post_comments (post_id, author_id, content, created_at) VALUES (?, ?, ?, ?)'
    ).bind(postId, userId, content, now),
    c.env.DB.prepare(
      'UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?'
    ).bind(postId),
  ])

  return c.json({ data: { success: true } }, 201)
})

// DELETE /posts/:id/comments/:commentId — 댓글 삭제
postsRoutes.delete('/:id/comments/:commentId', authMiddleware(), async (c) => {
  const postId = Number(c.req.param('id'))
  const commentId = Number(c.req.param('commentId'))
  const userId = (c as any).userId
  const clubRole = (c as any).clubRole

  const comment = await c.env.DB.prepare(
    'SELECT * FROM post_comments WHERE id = ? AND post_id = ?'
  ).bind(commentId, postId).first()
  if (!comment) return c.json({ error: '댓글을 찾을 수 없습니다.' }, 404)

  if (comment.author_id !== userId && clubRole !== 'admin' && clubRole !== 'owner') {
    return c.json({ error: '삭제 권한이 없습니다.' }, 403)
  }

  // 댓글 삭제 + comment_count 감소
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM post_comments WHERE id = ?').bind(commentId),
    c.env.DB.prepare(
      'UPDATE posts SET comment_count = CASE WHEN comment_count > 0 THEN comment_count - 1 ELSE 0 END WHERE id = ?'
    ).bind(postId),
  ])

  return c.json({ data: { success: true } })
})

export { postsRoutes }
