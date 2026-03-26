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
    SELECT p.*, u.username as author_name,
      (SELECT GROUP_CONCAT(emoji || ':' || cnt) FROM (
        SELECT emoji, COUNT(*) as cnt FROM post_reactions WHERE post_id = p.id GROUP BY emoji
      )) as reaction_summary
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

// GET /posts/:id — 상세 + 댓글 + 투표
postsRoutes.get('/:id', authMiddleware(), async (c) => {
  const id = Number(c.req.param('id'))
  const clubId = (c as any).clubId
  const userId = (c as any).userId

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

  // 투표 정보
  let poll = null
  const pollRow = await c.env.DB.prepare(
    'SELECT * FROM post_polls WHERE post_id = ?'
  ).bind(id).first()

  if (pollRow) {
    const { results: options } = await c.env.DB.prepare(
      'SELECT * FROM post_poll_options WHERE poll_id = ? ORDER BY sort_order ASC'
    ).bind(pollRow.id).all()

    const { results: myVotes } = await c.env.DB.prepare(
      'SELECT option_id FROM post_poll_votes WHERE poll_id = ? AND user_id = ?'
    ).bind(pollRow.id, userId).all()

    const totalVotes = options.reduce((sum: number, o: any) => sum + (o.vote_count as number), 0)

    poll = {
      id: pollRow.id,
      title: pollRow.title,
      allowMultiple: pollRow.allow_multiple === 1,
      totalVotes,
      options: options.map((o: any) => ({
        id: o.id,
        label: o.label,
        voteCount: o.vote_count,
      })),
      myVotes: myVotes.map((v: any) => v.option_id),
    }
  }

  return c.json({ data: { ...post, comments, poll } })
})

// POST /posts — 작성
postsRoutes.post('/', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId
  const clubRole = (c as any).clubRole

  const { title, content, category, imageUrl, isPinned, poll } = await c.req.json()

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

  const postId = result.meta.last_row_id

  // 투표 생성
  if (poll && poll.title && Array.isArray(poll.options) && poll.options.length >= 2) {
    const pollResult = await c.env.DB.prepare(
      'INSERT INTO post_polls (post_id, title, allow_multiple, created_at) VALUES (?, ?, ?, ?)'
    ).bind(postId, poll.title, poll.allowMultiple ? 1 : 0, now).run()

    const pollId = pollResult.meta.last_row_id
    for (let i = 0; i < poll.options.length; i++) {
      await c.env.DB.prepare(
        'INSERT INTO post_poll_options (poll_id, label, vote_count, sort_order) VALUES (?, ?, 0, ?)'
      ).bind(pollId, poll.options[i], i).run()
    }
  }

  return c.json({ data: { id: postId } }, 201)
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

// PUT /posts/:id/comments/:commentId — 댓글 수정
postsRoutes.put('/:id/comments/:commentId', authMiddleware(), async (c) => {
  const postId = Number(c.req.param('id'))
  const commentId = Number(c.req.param('commentId'))
  const userId = (c as any).userId

  const comment = await c.env.DB.prepare(
    'SELECT * FROM post_comments WHERE id = ? AND post_id = ?'
  ).bind(commentId, postId).first()
  if (!comment) return c.json({ error: '댓글을 찾을 수 없습니다.' }, 404)

  if (comment.author_id !== userId) {
    return c.json({ error: '수정 권한이 없습니다.' }, 403)
  }

  const { content } = await c.req.json()
  if (!content) return c.json({ error: '내용은 필수입니다.' }, 400)

  const now = Math.floor(Date.now() / 1000)
  await c.env.DB.prepare(
    'UPDATE post_comments SET content = ?, updated_at = ? WHERE id = ?'
  ).bind(content, now, commentId).run()

  const updated = await c.env.DB.prepare(
    `SELECT c.*, u.username as author_name FROM post_comments c LEFT JOIN users u ON u.id = c.author_id WHERE c.id = ?`
  ).bind(commentId).first()

  return c.json({ data: updated })
})

// POST /posts/:id/reactions — 리액션 토글
postsRoutes.post('/:id/reactions', authMiddleware(), async (c) => {
  const postId = Number(c.req.param('id'))
  const userId = (c as any).userId
  const clubId = (c as any).clubId

  const post = await c.env.DB.prepare(
    'SELECT id FROM posts WHERE id = ? AND club_id = ?'
  ).bind(postId, clubId).first()
  if (!post) return c.json({ error: '게시글을 찾을 수 없습니다.' }, 404)

  const { emoji } = await c.req.json()
  const validEmojis = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F525}', '\u{1F44F}', '\u{1F622}']
  if (!emoji || !validEmojis.includes(emoji)) {
    return c.json({ error: '유효하지 않은 이모지입니다.' }, 400)
  }

  const existing = await c.env.DB.prepare(
    'SELECT id FROM post_reactions WHERE post_id = ? AND user_id = ? AND emoji = ?'
  ).bind(postId, userId, emoji).first()

  if (existing) {
    await c.env.DB.prepare('DELETE FROM post_reactions WHERE id = ?').bind(existing.id).run()
    return c.json({ data: { action: 'removed', emoji } })
  } else {
    const now = Math.floor(Date.now() / 1000)
    await c.env.DB.prepare(
      'INSERT INTO post_reactions (post_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)'
    ).bind(postId, userId, emoji, now).run()
    return c.json({ data: { action: 'added', emoji } })
  }
})

// GET /posts/:id/reactions — 리액션 목록
postsRoutes.get('/:id/reactions', authMiddleware(), async (c) => {
  const postId = Number(c.req.param('id'))
  const userId = (c as any).userId

  const { results } = await c.env.DB.prepare(
    'SELECT emoji, user_id FROM post_reactions WHERE post_id = ?'
  ).bind(postId).all()

  const grouped: Record<string, { emoji: string; count: number; users: string[]; reacted: boolean }> = {}
  for (const r of results) {
    const e = r.emoji as string
    if (!grouped[e]) grouped[e] = { emoji: e, count: 0, users: [], reacted: false }
    grouped[e].count++
    grouped[e].users.push(r.user_id as string)
    if (r.user_id === userId) grouped[e].reacted = true
  }

  return c.json({ data: { reactions: Object.values(grouped) } })
})

// POST /posts/:id/poll/vote — 투표
postsRoutes.post('/:id/poll/vote', authMiddleware(), async (c) => {
  const postId = Number(c.req.param('id'))
  const userId = (c as any).userId
  const clubId = (c as any).clubId

  const post = await c.env.DB.prepare(
    'SELECT id FROM posts WHERE id = ? AND club_id = ?'
  ).bind(postId, clubId).first()
  if (!post) return c.json({ error: '게시글을 찾을 수 없습니다.' }, 404)

  const poll = await c.env.DB.prepare(
    'SELECT * FROM post_polls WHERE post_id = ?'
  ).bind(postId).first()
  if (!poll) return c.json({ error: '투표가 없습니다.' }, 404)

  const { optionId } = await c.req.json()
  if (!optionId) return c.json({ error: 'optionId가 필요합니다.' }, 400)

  // 옵션이 이 poll에 속하는지 확인
  const option = await c.env.DB.prepare(
    'SELECT id FROM post_poll_options WHERE id = ? AND poll_id = ?'
  ).bind(optionId, poll.id).first()
  if (!option) return c.json({ error: '유효하지 않은 선택지입니다.' }, 400)

  // 복수 선택 불가일 때 기존 투표 제거
  if (!poll.allow_multiple) {
    const existing = await c.env.DB.prepare(
      'SELECT option_id FROM post_poll_votes WHERE poll_id = ? AND user_id = ?'
    ).bind(poll.id, userId).all()

    for (const v of existing.results) {
      await c.env.DB.prepare(
        'DELETE FROM post_poll_votes WHERE poll_id = ? AND option_id = ? AND user_id = ?'
      ).bind(poll.id, v.option_id, userId).run()
      await c.env.DB.prepare(
        'UPDATE post_poll_options SET vote_count = MAX(vote_count - 1, 0) WHERE id = ?'
      ).bind(v.option_id).run()
    }
  }

  // 이미 같은 옵션에 투표했는지 확인
  const alreadyVoted = await c.env.DB.prepare(
    'SELECT id FROM post_poll_votes WHERE poll_id = ? AND option_id = ? AND user_id = ?'
  ).bind(poll.id, optionId, userId).first()

  if (alreadyVoted) {
    return c.json({ message: '이미 투표했습니다.' })
  }

  const now = Math.floor(Date.now() / 1000)
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO post_poll_votes (poll_id, option_id, user_id, created_at) VALUES (?, ?, ?, ?)'
    ).bind(poll.id, optionId, userId, now),
    c.env.DB.prepare(
      'UPDATE post_poll_options SET vote_count = vote_count + 1 WHERE id = ?'
    ).bind(optionId),
  ])

  return c.json({ data: { success: true } })
})

// DELETE /posts/:id/poll/vote — 투표 취소
postsRoutes.delete('/:id/poll/vote', authMiddleware(), async (c) => {
  const postId = Number(c.req.param('id'))
  const userId = (c as any).userId

  const poll = await c.env.DB.prepare(
    'SELECT id FROM post_polls WHERE post_id = ?'
  ).bind(postId).first()
  if (!poll) return c.json({ error: '투표가 없습니다.' }, 404)

  const { optionId } = await c.req.json()

  if (optionId) {
    // 특정 옵션만 취소
    const vote = await c.env.DB.prepare(
      'SELECT id FROM post_poll_votes WHERE poll_id = ? AND option_id = ? AND user_id = ?'
    ).bind(poll.id, optionId, userId).first()
    if (!vote) return c.json({ error: '투표 기록이 없습니다.' }, 404)

    await c.env.DB.batch([
      c.env.DB.prepare(
        'DELETE FROM post_poll_votes WHERE poll_id = ? AND option_id = ? AND user_id = ?'
      ).bind(poll.id, optionId, userId),
      c.env.DB.prepare(
        'UPDATE post_poll_options SET vote_count = MAX(vote_count - 1, 0) WHERE id = ?'
      ).bind(optionId),
    ])
  } else {
    // 전체 취소
    const { results: votes } = await c.env.DB.prepare(
      'SELECT option_id FROM post_poll_votes WHERE poll_id = ? AND user_id = ?'
    ).bind(poll.id, userId).all()

    for (const v of votes) {
      await c.env.DB.prepare(
        'UPDATE post_poll_options SET vote_count = MAX(vote_count - 1, 0) WHERE id = ?'
      ).bind(v.option_id).run()
    }
    await c.env.DB.prepare(
      'DELETE FROM post_poll_votes WHERE poll_id = ? AND user_id = ?'
    ).bind(poll.id, userId).run()
  }

  return c.json({ data: { success: true } })
})

export { postsRoutes }
