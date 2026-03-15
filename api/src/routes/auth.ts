import { Hono } from 'hono'
import { z } from 'zod'
import * as jose from 'jose'
import type { Env } from '../index'
import { isClubPro } from '../utils/planUtils'

const authRoutes = new Hono<{ Bindings: Env }>()

// 로그인 스키마
const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(4),
})

// 회원가입 스키마
const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(2).max(20),
  password: z.string().min(4),
  playerCode: z.string().optional(),
  inviteCode: z.string().optional(), // 클럽 초대 코드
})

// 유저의 전체 클럽 목록 + 클럽별 선수 정보 반환
async function getUserClubs(db: any, userId: string) {
  const memberships = await db.prepare(`
    SELECT c.id as club_id, c.slug, c.name as club_name, c.enabled_events,
           c.invite_code, c.plan_type, c.season_start_month, cm.role as club_role
    FROM club_members cm
    INNER JOIN clubs c ON c.id = cm.club_id
    WHERE cm.user_id = ?
    ORDER BY cm.joined_at ASC
  `).bind(userId).all()

  const clubs = await Promise.all((memberships.results as any[]).map(async (m: any) => {
    const player = await db.prepare(
      'SELECT id, name, nickname FROM players WHERE user_id = ? AND club_id = ? LIMIT 1'
    ).bind(userId, m.club_id).first()
    return {
      id: m.club_id,
      slug: m.slug,
      name: m.club_name,
      enabledEvents: JSON.parse(m.enabled_events ?? '["GOAL","SAVE"]'),
      inviteCode: m.invite_code,
      myRole: m.club_role,
      planType: m.plan_type ?? 'free',
      isPro: isClubPro(m.plan_type),
      seasonStartMonth: m.season_start_month ?? 1,
      player: player ? { id: player.id, name: player.name, nickname: player.nickname } : null,
    }
  }))
  return clubs
}

// 로그인
authRoutes.post('/login', async (c) => {
  try {
    const body = await c.req.json()
    const parsed = { identifier: body.identifier ?? body.email, password: body.password }
    console.log('Login attempt:', parsed.identifier)

    const { identifier, password } = loginSchema.parse(parsed)

    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ? OR username = ?'
    ).bind(identifier, identifier).first<{
      id: string; email: string; username: string; password: string; role: string
    }>()

    if (!user) {
      return c.json({ error: '아이디(이메일) 또는 비밀번호가 올바르지 않습니다.' }, 401)
    }

    if (user.password !== password) {
      return c.json({ error: '아이디(이메일) 또는 비밀번호가 올바르지 않습니다.' }, 401)
    }

    // JWT 생성
    const secret = new TextEncoder().encode(c.env.JWT_SECRET || 'fallback-secret-key')
    const token = await new jose.SignJWT({
      userId: user.id,
      email: user.email,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('30d')
      .sign(secret)

    // 전체 클럽 목록 조회
    const clubs = await getUserClubs(c.env.DB, user.id)

    console.log('Login successful:', identifier)

    return c.json({
      token,
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
      clubs,
      // 하위 호환성 유지
      player: clubs[0]?.player ?? null,
      club: clubs[0] ?? null,
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
    const { email, username, password, playerCode, inviteCode } = registerSchema.parse(body)

    // 이메일/username 중복 확인
    const existingEmail = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first()
    if (existingEmail) {
      return c.json({ error: '이미 사용 중인 이메일입니다.' }, 400)
    }

    const existingUsername = await c.env.DB.prepare(
      'SELECT id FROM users WHERE username = ?'
    ).bind(username).first()
    if (existingUsername) {
      return c.json({ error: '이미 사용 중인 아이디입니다.' }, 400)
    }

    // 초대 코드로 클럽 확인
    let clubId: number | null = null
    if (inviteCode) {
      const club = await c.env.DB.prepare(
        'SELECT id FROM clubs WHERE invite_code = ?'
      ).bind(inviteCode.toUpperCase()).first<{ id: number }>()
      if (!club) {
        return c.json({ error: '유효하지 않은 초대 코드입니다.' }, 400)
      }
      clubId = club.id
    }

    const userId = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)

    // 유저 생성
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, username, password, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'member', ?, ?)`
    ).bind(userId, email, username, password, now, now).run()

    // 프로필 생성
    await c.env.DB.prepare(
      `INSERT INTO profiles (user_id, created_at, updated_at) VALUES (?, ?, ?)`
    ).bind(userId, now, now).run()

    // 클럽 가입
    if (clubId) {
      await c.env.DB.prepare(
        `INSERT INTO club_members (club_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)`
      ).bind(clubId, userId, now).run()
    }

    // 선수 코드로 연동
    if (playerCode) {
      const player = await c.env.DB.prepare(
        'SELECT * FROM players WHERE player_code = ? AND link_status = ?'
      ).bind(playerCode, 'UNLINKED').first<any>()

      if (player) {
        await c.env.DB.prepare(
          `UPDATE players SET user_id = ?, link_status = 'PENDING', updated_at = ? WHERE id = ?`
        ).bind(userId, now, player.id).run()
      }
    }

    return c.json({
      message: '회원가입이 완료되었습니다.',
      userId,
      hasClub: !!clubId,
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
      'SELECT id, email, username, role, google_id, created_at FROM users WHERE id = ?'
    ).bind(payload.userId).first()

    if (!user) {
      return c.json({ error: '유저를 찾을 수 없습니다.' }, 404)
    }

    const profile = await c.env.DB.prepare(
      'SELECT * FROM profiles WHERE user_id = ?'
    ).bind((user as any).id).first()

    // 전체 클럽 목록 조회
    const clubs = await getUserClubs(c.env.DB, (user as any).id)

    return c.json({
      user: { ...(user as any), googleLinked: !!(user as any).google_id },
      profile,
      clubs,
      // 하위 호환성 유지
      player: clubs[0]?.player ?? null,
      club: clubs[0] ?? null,
    })
  } catch {
    return c.json({ error: '유효하지 않은 토큰입니다.' }, 401)
  }
})

// ─── 구글 계정 연동 ───────────────────────────────────────────
authRoutes.post('/link-google', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: '인증이 필요합니다.' }, 401)

  try {
    const token = authHeader.slice(7)
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    const { payload } = await jose.jwtVerify(token, secret)

    const { idToken } = await c.req.json()
    if (!idToken) return c.json({ error: 'idToken이 필요합니다.' }, 400)

    // Google 토큰 검증
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`)
    if (!verifyRes.ok) return c.json({ error: '유효하지 않은 Google 토큰입니다.' }, 401)
    const googleUser = await verifyRes.json() as any
    const { sub: googleId, email: googleEmail } = googleUser

    const db = c.env.DB
    const now = Math.floor(Date.now() / 1000)

    // 이미 다른 계정에 연동된 google_id인지 확인
    const existing = await db.prepare(
      'SELECT id FROM users WHERE google_id = ? AND id != ?'
    ).bind(googleId, payload.userId).first()
    if (existing) return c.json({ error: '이 구글 계정은 이미 다른 계정에 연동되어 있습니다.' }, 409)

    await db.prepare('UPDATE users SET google_id = ?, updated_at = ? WHERE id = ?')
      .bind(googleId, now, payload.userId).run()

    return c.json({ message: `${googleEmail} 구글 계정이 연동되었습니다.`, googleEmail })
  } catch {
    return c.json({ error: '유효하지 않은 토큰입니다.' }, 401)
  }
})

// ─── 구글 계정 연동 해제 ──────────────────────────────────────
authRoutes.delete('/link-google', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: '인증이 필요합니다.' }, 401)

  try {
    const token = authHeader.slice(7)
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    const { payload } = await jose.jwtVerify(token, secret)

    const db = c.env.DB

    // 비밀번호 없는 계정(구글 전용)은 해제 불가
    const user = await db.prepare('SELECT password FROM users WHERE id = ?')
      .bind(payload.userId).first<{ password: string }>()
    if (!user?.password) {
      return c.json({ error: '비밀번호 로그인이 설정되지 않은 계정은 구글 연동을 해제할 수 없습니다.' }, 400)
    }

    const now = Math.floor(Date.now() / 1000)
    await db.prepare('UPDATE users SET google_id = NULL, updated_at = ? WHERE id = ?')
      .bind(now, payload.userId).run()

    return c.json({ message: '구글 계정 연동이 해제되었습니다.' })
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
    const { username, nickname, email, heightCm, weightKg, phone, birthYear } = body
    const now = Math.floor(Date.now() / 1000)

    if (username) {
      await c.env.DB.prepare(
        'UPDATE users SET username = ?, updated_at = ? WHERE id = ?'
      ).bind(username, now, payload.userId).run()
    }

    if (email) {
      const existing = await c.env.DB.prepare(
        'SELECT id FROM users WHERE email = ? AND id != ?'
      ).bind(email, payload.userId).first()
      if (existing) {
        return c.json({ error: '이미 사용 중인 이메일입니다.' }, 400)
      }
      await c.env.DB.prepare(
        'UPDATE users SET email = ?, updated_at = ? WHERE id = ?'
      ).bind(email, now, payload.userId).run()
    }

    const playerUpdates: string[] = []
    const playerVals: any[] = []
    if (nickname !== undefined) { playerUpdates.push('nickname = ?'); playerVals.push(nickname) }
    if (heightCm !== undefined) { playerUpdates.push('height_cm = ?'); playerVals.push(Number(heightCm)) }
    if (weightKg !== undefined) { playerUpdates.push('weight_kg = ?'); playerVals.push(Number(weightKg)) }
    if (birthYear !== undefined) { playerUpdates.push('birth_year = ?'); playerVals.push(Number(birthYear)) }
    if (playerUpdates.length > 0) {
      playerVals.push(now, payload.userId)
      await c.env.DB.prepare(
        `UPDATE players SET ${playerUpdates.join(', ')}, updated_at = ? WHERE user_id = ?`
      ).bind(...playerVals).run()
    }

    if (phone !== undefined) {
      await c.env.DB.prepare(
        'UPDATE profiles SET phone = ?, updated_at = ? WHERE user_id = ?'
      ).bind(phone, now, payload.userId).run()
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

    const user = await c.env.DB.prepare(
      'SELECT password FROM users WHERE id = ?'
    ).bind(payload.userId).first<{ password: string }>()

    if (!user || user.password !== oldPassword) {
      return c.json({ error: '현재 비밀번호가 일치하지 않습니다.' }, 400)
    }

    const now = Math.floor(Date.now() / 1000)
    await c.env.DB.prepare(
      'UPDATE users SET password = ?, updated_at = ? WHERE id = ?'
    ).bind(newPassword, now, payload.userId).run()

    return c.json({ message: '비밀번호가 변경되었습니다.' })
  } catch {
    return c.json({ error: '유효하지 않은 토큰입니다.' }, 401)
  }
})

// 아이디(이메일) 찾기
authRoutes.post('/find-email', async (c) => {
  try {
    const { playerName } = await c.req.json()
    if (!playerName) {
      return c.json({ error: '선수 이름을 입력해주세요.' }, 400)
    }

    const row = await c.env.DB.prepare(
      `SELECT u.username, u.email FROM users u
       INNER JOIN players p ON p.user_id = u.id
       WHERE p.name = ? LIMIT 1`
    ).bind(playerName).first<{ username: string; email: string }>()

    if (!row) {
      return c.json({ error: '해당 선수 이름으로 연동된 계정이 없습니다.' }, 404)
    }

    return c.json({ username: row.username, email: row.email })
  } catch (error) {
    console.error('Find email error:', error)
    throw error
  }
})

// 비밀번호 재설정
authRoutes.post('/reset-password', async (c) => {
  try {
    const { username, playerName, newPassword } = await c.req.json()

    if (!username || !playerName || !newPassword) {
      return c.json({ error: '아이디, 선수 이름, 새 비밀번호를 모두 입력해주세요.' }, 400)
    }
    if (newPassword.length < 4) {
      return c.json({ error: '비밀번호는 4자 이상이어야 합니다.' }, 400)
    }

    const row = await c.env.DB.prepare(
      `SELECT u.id FROM users u
       INNER JOIN players p ON p.user_id = u.id
       WHERE u.username = ? AND p.name = ? LIMIT 1`
    ).bind(username, playerName).first<{ id: string }>()

    if (!row) {
      return c.json({ error: '아이디와 선수 이름이 일치하는 계정이 없습니다.' }, 404)
    }

    const now = Math.floor(Date.now() / 1000)
    await c.env.DB.prepare(
      'UPDATE users SET password = ?, updated_at = ? WHERE id = ?'
    ).bind(newPassword, now, row.id).run()

    return c.json({ message: '비밀번호가 재설정되었습니다.' })
  } catch (error) {
    console.error('Reset password error:', error)
    throw error
  }
})


// ─── Google OAuth 로그인 ───
authRoutes.post('/google', async (c) => {
  try {
    const { idToken } = await c.req.json()
    if (!idToken) return c.json({ error: 'idToken이 필요합니다.' }, 400)

    // Google tokeninfo endpoint로 토큰 검증
    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    )
    if (!verifyRes.ok) {
      return c.json({ error: '유효하지 않은 Google 토큰입니다.' }, 401)
    }
    const googleUser = await verifyRes.json() as any
    const { email, name, sub: googleId } = googleUser

    if (!email) return c.json({ error: '이메일 정보를 가져올 수 없습니다.' }, 400)

    const now = Math.floor(Date.now() / 1000)
    const db = c.env.DB

    // 기존 유저 찾기: google_id 우선, 없으면 이메일로 조회
    let user = await db.prepare('SELECT * FROM users WHERE google_id = ?').bind(googleId).first<any>()
    if (!user) {
      user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<any>()
      // 이메일로 찾은 경우 google_id 업데이트 (연동)
      if (user && !user.google_id) {
        await db.prepare('UPDATE users SET google_id = ?, updated_at = ? WHERE id = ?')
          .bind(googleId, now, user.id).run()
      }
    }

    if (!user) {
      // 신규 가입: username 생성 (이메일 앞부분, 중복 시 숫자 붙임)
      let baseUsername = (name ?? email.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'user'
      let username = baseUsername
      let attempt = 1
      while (await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()) {
        username = baseUsername + attempt++
      }

      const userId = crypto.randomUUID()
      await db.prepare(`
        INSERT INTO users (id, email, username, password, google_id, role, created_at, updated_at)
        VALUES (?, ?, ?, '', ?, 'member', ?, ?)
      `).bind(userId, email, username, googleId, now, now).run()

      user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<any>()
    }

    // 전체 클럽 목록 조회
    const clubs = await getUserClubs(db, user.id)

    // JWT 생성
    const jwtPayload = {
      userId: user.id,
      role: user.role,
    }
    const secret = new TextEncoder().encode(c.env.JWT_SECRET || 'fallback-secret-key')
    const token = await new jose.SignJWT(jwtPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('30d')
      .sign(secret)

    return c.json({
      token,
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
      clubs,
      // 하위 호환성 유지
      player: clubs[0]?.player ?? null,
      club: clubs[0] ?? null,
    })
  } catch (e: any) {
    console.error('Google login error:', e)
    return c.json({ error: e?.message || 'Google 로그인에 실패했습니다.' }, 500)
  }
})

export { authRoutes }
