import { Hono } from 'hono'
import { z } from 'zod'
import * as jose from 'jose'
import type { Env } from '../index'

const authRoutes = new Hono<{ Bindings: Env }>()

// 로그인 스키마
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
})

// 회원가입 스키마
const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(2).max(20),
  password: z.string().min(4),
  playerCode: z.string().optional(), // 선수 연동 코드
})

// 로그인
authRoutes.post('/login', async (c) => {
  try {
    const body = await c.req.json()
    console.log('Login attempt:', body.email)

    const { email, password } = loginSchema.parse(body)

    // 유저 조회
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first<{
      id: string
      email: string
      username: string
      password: string
      role: string
    }>()

    if (!user) {
      console.log('User not found:', email)
      return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401)
    }

    // 비밀번호 확인 (간단한 비교 - 실제로는 bcrypt 사용)
    if (user.password !== password) {
      console.log('Password mismatch for:', email)
      return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401)
    }

    // JWT 생성
    const secret = new TextEncoder().encode(c.env.JWT_SECRET || 'fallback-secret-key')
    const token = await new jose.SignJWT({
      userId: user.id,
      email: user.email,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(secret)

    // 연동된 선수 정보 조회
    let player = null
    try {
      player = await c.env.DB.prepare(
        'SELECT id, name, nickname FROM players WHERE user_id = ?'
      ).bind(user.id).first()
    } catch {
      console.log('No linked player for user:', user.id)
    }

    console.log('Login successful:', email)

    return c.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      player: player ? {
        id: player.id,
        name: player.name,
        nickname: player.nickname,
      } : null,
    })
  } catch (error) {
    console.error('Login error:', error)
    if (error instanceof z.ZodError) {
      return c.json({ error: '입력값이 올바르지 않습니다.', details: error.errors }, 400)
    }
    throw error
  }
})

// 회원가입
authRoutes.post('/register', async (c) => {
  try {
    const body = await c.req.json()
    const { email, username, password, playerCode } = registerSchema.parse(body)

    // 이메일 중복 확인
    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first()

    if (existing) {
      return c.json({ error: '이미 사용 중인 이메일입니다.' }, 400)
    }

    // UUID 생성
    const userId = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)

    // 유저 생성
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, username, password, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'member', ?, ?)`
    ).bind(userId, email, username, password, now, now).run()

    // 프로필 생성
    await c.env.DB.prepare(
      `INSERT INTO profiles (user_id, created_at, updated_at)
       VALUES (?, ?, ?)`
    ).bind(userId, now, now).run()

    // 선수 코드로 연동
    if (playerCode) {
      const player = await c.env.DB.prepare(
        'SELECT * FROM players WHERE player_code = ? AND link_status = ?'
      ).bind(playerCode, 'UNLINKED').first()

      if (player) {
        await c.env.DB.prepare(
          `UPDATE players SET user_id = ?, link_status = 'PENDING', updated_at = ?
           WHERE id = ?`
        ).bind(userId, now, player.id).run()
      }
    }

    return c.json({
      message: '회원가입이 완료되었습니다.',
      userId,
    }, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: '입력값이 올바르지 않습니다.', details: error.errors }, 400)
    }
    throw error
  }
})

// 내 정보 조회
authRoutes.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: '인증이 필요합니다.' }, 401)
  }

  try {
    const token = authHeader.slice(7)
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    const { payload } = await jose.jwtVerify(token, secret)

    const user = await c.env.DB.prepare(
      'SELECT id, email, username, role, created_at FROM users WHERE id = ?'
    ).bind(payload.userId).first()

    if (!user) {
      return c.json({ error: '유저를 찾을 수 없습니다.' }, 404)
    }

    const profile = await c.env.DB.prepare(
      'SELECT * FROM profiles WHERE user_id = ?'
    ).bind(user.id).first()

    const player = await c.env.DB.prepare(
      'SELECT * FROM players WHERE user_id = ?'
    ).bind(user.id).first()

    return c.json({
      user,
      profile,
      player,
    })
  } catch {
    return c.json({ error: '유효하지 않은 토큰입니다.' }, 401)
  }
})

// 프로필 업데이트
authRoutes.put('/profile', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: '인증이 필요합니다.' }, 401)
  }

  try {
    const token = authHeader.slice(7)
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    const { payload } = await jose.jwtVerify(token, secret)

    const body = await c.req.json()
    const { username, nickname } = body
    const now = Math.floor(Date.now() / 1000)

    // 유저명 업데이트
    if (username) {
      await c.env.DB.prepare(
        'UPDATE users SET username = ?, updated_at = ? WHERE id = ?'
      ).bind(username, now, payload.userId).run()
    }

    // 닉네임 업데이트 (연동된 선수가 있는 경우)
    if (nickname !== undefined) {
      await c.env.DB.prepare(
        'UPDATE players SET nickname = ?, updated_at = ? WHERE user_id = ?'
      ).bind(nickname, now, payload.userId).run()
    }

    return c.json({ message: '프로필이 업데이트되었습니다.' })
  } catch {
    return c.json({ error: '유효하지 않은 토큰입니다.' }, 401)
  }
})

// 비밀번호 변경
authRoutes.put('/password', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: '인증이 필요합니다.' }, 401)
  }

  try {
    const token = authHeader.slice(7)
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    const { payload } = await jose.jwtVerify(token, secret)

    const body = await c.req.json()
    const { oldPassword, newPassword } = body

    if (!oldPassword || !newPassword) {
      return c.json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' }, 400)
    }

    if (newPassword.length < 6) {
      return c.json({ error: '비밀번호는 6자 이상이어야 합니다.' }, 400)
    }

    // 현재 비밀번호 확인
    const user = await c.env.DB.prepare(
      'SELECT password FROM users WHERE id = ?'
    ).bind(payload.userId).first<{ password: string }>()

    if (!user || user.password !== oldPassword) {
      return c.json({ error: '현재 비밀번호가 일치하지 않습니다.' }, 400)
    }

    // 비밀번호 업데이트
    const now = Math.floor(Date.now() / 1000)
    await c.env.DB.prepare(
      'UPDATE users SET password = ?, updated_at = ? WHERE id = ?'
    ).bind(newPassword, now, payload.userId).run()

    return c.json({ message: '비밀번호가 변경되었습니다.' })
  } catch {
    return c.json({ error: '유효하지 않은 토큰입니다.' }, 401)
  }
})

export { authRoutes }
