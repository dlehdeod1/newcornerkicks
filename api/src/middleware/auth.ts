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

      // DB에서 최신 클럽 멤버십 실시간 조회 (stale JWT 문제 방지)
      const membership = await c.env.DB.prepare(
        'SELECT club_id, role FROM club_members WHERE user_id = ? LIMIT 1'
      ).bind(payload.userId).first<{ club_id: number; role: string }>()

      const clubId = membership?.club_id ?? null
      const clubRole = membership?.role?.toLowerCase() ?? null

      // 역할 체크: 시스템 ADMIN 또는 클럽 owner/admin 모두 허용
      if (requiredRole === 'ADMIN') {
        const isSystemAdmin = payload.role === 'ADMIN'
        const isClubAdmin = clubRole === 'admin' || clubRole === 'owner'
        if (!isSystemAdmin && !isClubAdmin) {
          return c.json({ error: '권한이 없습니다.' }, 403)
        }
      } else if (requiredRole && payload.role !== requiredRole) {
        return c.json({ error: '권한이 없습니다.' }, 403)
      }

      // Context에 유저 정보 저장
      ;(c as any).userId = payload.userId
      ;(c as any).userRole = payload.role
      ;(c as any).clubId = clubId
      ;(c as any).clubRole = clubRole

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

      // DB에서 최신 클럽 멤버십 실시간 조회 (stale JWT 문제 방지)
      const membership = await c.env.DB.prepare(
        'SELECT club_id, role FROM club_members WHERE user_id = ? LIMIT 1'
      ).bind(payload.userId).first<{ club_id: number; role: string }>()

      ;(c as any).userId = payload.userId
      ;(c as any).userRole = payload.role
      ;(c as any).clubId = membership?.club_id ?? null
      ;(c as any).clubRole = membership?.role?.toLowerCase() ?? null
    } catch {
      // 토큰 무효해도 그냥 진행
    }
  }

  await next()
}
