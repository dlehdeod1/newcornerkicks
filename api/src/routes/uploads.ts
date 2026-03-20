import { Hono } from 'hono'
import type { Env } from '../index'
import { authMiddleware } from '../middleware/auth'

const uploadsRoutes = new Hono<{ Bindings: Env }>()

// POST /uploads — 이미지 업로드 (multipart/form-data)
uploadsRoutes.post('/', authMiddleware(), async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']
  const prefix = (body['prefix'] as string) || 'general'

  if (!(file instanceof File)) {
    return c.json({ error: '파일이 필요합니다.' }, 400)
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return c.json({ error: '허용되지 않는 파일 형식입니다. (jpeg, png, webp, gif)' }, 400)
  }

  if (file.size > 2 * 1024 * 1024) {
    return c.json({ error: '파일 크기는 2MB 이하여야 합니다.' }, 400)
  }

  const allowedPrefixes = ['announcements', 'players', 'clubs', 'community']
  if (!allowedPrefixes.includes(prefix)) {
    return c.json({ error: '허용되지 않는 prefix입니다.' }, 400)
  }

  const ext = file.name.split('.').pop() || 'webp'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const key = `${prefix}/${filename}`

  await c.env.PHOTOS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  })

  const url = `/photos/${key}`
  return c.json({ data: { url, key } })
})

export { uploadsRoutes }
