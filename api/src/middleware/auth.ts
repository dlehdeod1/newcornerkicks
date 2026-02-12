import { Context, Next } from 'hono'
import * as jose from 'jose'
import type { Env } from '../index'

// 인증 필수 미들웨어 (역할 체크 포함)
export function authMiddleware(requiredRole?: string) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const authHeader = c.req.header('Authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: '인증이 필요합니다.' }, 401)
    }

    try {
      const token = authHeader.slice(7)
      const secret = new TextEncoder().encode(c.env.JWT_SECRET)
      const { payload } = await jose.jwtVerify(token, secret)

      // 역할 체크
      if (requiredRole && payload.role !== requiredRole) {
        return c.json({ error: '권한이 없습니다.' }, 403)
      }

      // Context에 유저 정보 저장
      ;(c as any).userId = payload.userId
      ;(c as any).userRole = payload.role

      await next()
    } catch (error) {
      return c.json({ error: '유효하지 않은 토큰입니다.' }, 401)
    }
  }
}

// 인증 선택적 미들웨어 (로그인 안 해도 됨)
export async function optionalAuthMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7)
      const secret = new TextEncoder().encode(c.env.JWT_SECRET)
      const { payload } = await jose.jwtVerify(token, secret)

      ;(c as any).userId = payload.userId
      ;(c as any).userRole = payload.role
    } catch {
      // 토큰 무효해도 그냥 진행
    }
  }

  await next()
}
