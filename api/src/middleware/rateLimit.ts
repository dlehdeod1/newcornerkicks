const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(maxRequests: number, windowMs: number) {
  return async (c: any, next: any) => {
    const key = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
    const now = Date.now()
    const entry = rateLimitMap.get(key)

    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
      await next()
      return
    }

    if (entry.count >= maxRequests) {
      return c.json({ error: 'Too many requests' }, 429)
    }

    entry.count++
    await next()
  }
}
