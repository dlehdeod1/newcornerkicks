import { Hono } from 'hono'
import type { Env } from '../index'

const photosRoutes = new Hono<{ Bindings: Env }>()

// GET /photos/players/:clubId/:file
photosRoutes.get('/players/:clubId/:file', async (c) => {
  const clubId = c.req.param('clubId')
  const file = c.req.param('file')
  const key = `players/${clubId}/${file}`

  const obj = await c.env.PHOTOS.get(key)
  if (!obj) return c.notFound()

  const headers = new Headers()
  headers.set('Content-Type', 'image/webp')
  headers.set('Cache-Control', 'public, max-age=86400')
  obj.writeHttpMetadata(headers)

  return new Response(obj.body, { headers })
})

// GET /photos/clubs/:clubId/:file
photosRoutes.get('/clubs/:clubId/:file', async (c) => {
  const clubId = c.req.param('clubId')
  const file = c.req.param('file')
  const key = `clubs/${clubId}/${file}`

  const obj = await c.env.PHOTOS.get(key)
  if (!obj) return c.notFound()

  const headers = new Headers()
  headers.set('Content-Type', 'image/webp')
  headers.set('Cache-Control', 'public, max-age=86400')
  obj.writeHttpMetadata(headers)

  return new Response(obj.body, { headers })
})

export { photosRoutes }
