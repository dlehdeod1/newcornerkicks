import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../index'
import { authMiddleware } from '../middleware/auth'
import { isClubPro } from '../utils/planUtils'

const clubsRoutes = new Hono<{ Bindings: Env }>()

// 슬러그 가용성 확인 + 추천 후보 반환
clubsRoutes.get('/check-slug', async (c) => {
  const slug = c.req.query('slug')?.toLowerCase().replace(/[^a-z0-9-_]/g, '')
  if (!slug || slug.length < 2) {
    return c.json({ error: '슬러그는 2자 이상의 영문/숫자/-/_만 사용 가능합니다.' }, 400)
  }

  const existing = await c.env.DB.prepare(
    'SELECT id FROM clubs WHERE slug = ?'
  ).bind(slug).first()

  if (!existing) {
    return c.json({ available: true, slug })
  }

  // 중복 시 추천 후보 생성
  const suggestions: string[] = []
  for (let i = 2; i <= 5; i++) {
    const candidate = `${slug}${i}`
    const taken = await c.env.DB.prepare('SELECT id FROM clubs WHERE slug = ?').bind(candidate).first()
    if (!taken) suggestions.push(candidate)
    if (suggestions.length >= 3) break
  }
  // fc 접미사 후보
  const fcCandidate = `${slug}-fc`
  const fcTaken = await c.env.DB.prepare('SELECT id FROM clubs WHERE slug = ?').bind(fcCandidate).first()
  if (!fcTaken && suggestions.length < 3) suggestions.push(fcCandidate)

  return c.json({ available: false, slug, suggestions })
})

// 클럽 생성
const createClubSchema = z.object({
  slug: z.string().min(2).max(30).regex(/^[a-z0-9-_]+$/, '영문 소문자, 숫자, -, _ 만 사용 가능'),
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  enabledEvents: z.array(z.enum(['GOAL', 'DEFENSE', 'TACKLE', 'INTERCEPTION', 'CLEARANCE', 'SAVE', 'KEY_PASS', 'DRIBBLE', 'SHOT_ON', 'SHOT_OFF'])).default(['GOAL', 'DEFENSE']),
})

clubsRoutes.post('/', authMiddleware(), async (c) => {
  try {
    const userId = (c as any).userId
    const body = await c.req.json()
    const { slug, name, description, enabledEvents } = createClubSchema.parse(body)

    // 슬러그 중복 확인
    const existing = await c.env.DB.prepare('SELECT id FROM clubs WHERE slug = ?').bind(slug).first()
    if (existing) {
      return c.json({ error: '이미 사용 중인 클럽 ID입니다.' }, 400)
    }

    // 6자리 초대 코드 생성 (대문자+숫자)
    const inviteCode = generateInviteCode()
    const now = Math.floor(Date.now() / 1000)

    const result = await c.env.DB.prepare(
      `INSERT INTO clubs (slug, name, description, invite_code, enabled_events, plan_type, owner_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'free', ?, ?, ?)`
    ).bind(slug, name, description ?? null, inviteCode, JSON.stringify(enabledEvents), userId, now, now).run()

    const clubId = result.meta.last_row_id

    // 생성자를 owner로 등록
    await c.env.DB.prepare(
      `INSERT INTO club_members (club_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)`
    ).bind(clubId, userId, now).run()

    return c.json({
      message: '클럽이 생성되었습니다.',
      club: { id: clubId, slug, name, inviteCode },
    }, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: '입력값이 올바르지 않습니다.', details: error.errors }, 400)
    }
    throw error
  }
})

// 초대 코드로 클럽 가입
clubsRoutes.post('/join', authMiddleware(), async (c) => {
  try {
    const userId = (c as any).userId
    const { inviteCode } = await c.req.json()

    if (!inviteCode) {
      return c.json({ error: '초대 코드를 입력해주세요.' }, 400)
    }

    const club = await c.env.DB.prepare(
      'SELECT * FROM clubs WHERE invite_code = ?'
    ).bind(inviteCode.toUpperCase()).first<{ id: number; slug: string; name: string }>()

    if (!club) {
      return c.json({ error: '유효하지 않은 초대 코드입니다.' }, 404)
    }

    // 이미 해당 클럽 멤버인지 확인
    const existing = await c.env.DB.prepare(
      'SELECT id FROM club_members WHERE club_id = ? AND user_id = ?'
    ).bind(club.id, userId).first()

    if (existing) {
      return c.json({ error: '이미 해당 클럽의 멤버입니다.' }, 400)
    }

    const now = Math.floor(Date.now() / 1000)
    await c.env.DB.prepare(
      `INSERT INTO club_members (club_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)`
    ).bind(club.id, userId, now).run()

    return c.json({
      message: `${club.name} 클럽에 가입했습니다.`,
      club: { id: club.id, slug: club.slug, name: club.name },
    })
  } catch (error) {
    throw error
  }
})

// 내 클럽 정보 조회
clubsRoutes.get('/me', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const activeClubId = (c as any).clubId

  let membership: any
  if (activeClubId) {
    membership = await c.env.DB.prepare(`
      SELECT c.*, cm.role as my_role
      FROM clubs c INNER JOIN club_members cm ON c.id = cm.club_id
      WHERE cm.user_id = ? AND c.id = ?
    `).bind(userId, activeClubId).first<any>()
  } else {
    membership = await c.env.DB.prepare(`
      SELECT c.*, cm.role as my_role
      FROM clubs c INNER JOIN club_members cm ON c.id = cm.club_id
      WHERE cm.user_id = ?
    `).bind(userId).first<any>()
  }

  if (!membership) {
    return c.json({ club: null, message: '소속 클럽이 없습니다.' })
  }

  const memberCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM club_members WHERE club_id = ?'
  ).bind(membership.id).first<{ count: number }>()

  return c.json({
    club: {
      id: membership.id,
      slug: membership.slug,
      name: membership.name,
      description: membership.description,
      inviteCode: membership.invite_code,
      enabledEvents: JSON.parse(membership.enabled_events ?? '["GOAL","DEFENSE"]'),
      planType: membership.plan_type,
      isPro: isClubPro(membership.plan_type),
      myRole: membership.my_role,
      memberCount: memberCount?.count ?? 0,
      entryFee: membership.entry_fee ?? 0,
      monthlyFee: membership.monthly_fee ?? 0,
      perGameFee: membership.per_game_fee ?? 0,
      feeNotes: membership.fee_notes ?? '',
      feeTiers: JSON.parse(membership.fee_tiers ?? '[]'),
      seasonStartMonth: membership.season_start_month ?? 1,
      mvpVoteEnabled: membership.mvp_vote_enabled === 1,
      logoUrl: membership.logo_url ?? null,
      bankAccount: JSON.parse(membership.bank_account ?? 'null'),
      notificationConfig: JSON.parse(membership.notification_config ?? '{"sessionCreated":true,"sessionDayRemind":true,"settlementRemind":true}'),
      feeConfig: JSON.parse(membership.fee_config ?? '{}'),
      mvpWeights: JSON.parse(membership.mvp_weights ?? 'null'),
    },
  })
})

// 클럽 설정 변경 (admin만)
clubsRoutes.put('/me', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const activeClubId = (c as any).clubId

  let membership: { id: number; role: string } | null = null
  if (activeClubId) {
    membership = await c.env.DB.prepare(`
      SELECT c.id, cm.role FROM clubs c
      INNER JOIN club_members cm ON c.id = cm.club_id
      WHERE cm.user_id = ? AND c.id = ?
    `).bind(userId, activeClubId).first<{ id: number; role: string }>()
  } else {
    membership = await c.env.DB.prepare(`
      SELECT c.id, cm.role FROM clubs c
      INNER JOIN club_members cm ON c.id = cm.club_id
      WHERE cm.user_id = ?
    `).bind(userId).first<{ id: number; role: string }>()
  }

  if (!membership) return c.json({ error: '소속 클럽이 없습니다.' }, 404)
  const role = membership.role.toLowerCase()
  if (role !== 'admin' && role !== 'owner') return c.json({ error: '관리자만 설정을 변경할 수 있습니다.' }, 403)

  const body = await c.req.json()
  const updates: string[] = []
  const vals: any[] = []

  if (body.name) { updates.push('name = ?'); vals.push(body.name) }
  if (body.description !== undefined) { updates.push('description = ?'); vals.push(body.description) }
  if (body.enabledEvents) { updates.push('enabled_events = ?'); vals.push(JSON.stringify(body.enabledEvents)) }
  if (body.entryFee !== undefined) { updates.push('entry_fee = ?'); vals.push(body.entryFee) }
  if (body.monthlyFee !== undefined) { updates.push('monthly_fee = ?'); vals.push(body.monthlyFee) }
  if (body.perGameFee !== undefined) { updates.push('per_game_fee = ?'); vals.push(body.perGameFee) }
  if (body.feeNotes !== undefined) { updates.push('fee_notes = ?'); vals.push(body.feeNotes) }
  if (body.feeTiers !== undefined) { updates.push('fee_tiers = ?'); vals.push(JSON.stringify(body.feeTiers)) }
  if (body.seasonStartMonth !== undefined) { updates.push('season_start_month = ?'); vals.push(Number(body.seasonStartMonth)) }
  if (body.mvpVoteEnabled !== undefined) { updates.push('mvp_vote_enabled = ?'); vals.push(body.mvpVoteEnabled ? 1 : 0) }
  if (body.bankAccount !== undefined) { updates.push('bank_account = ?'); vals.push(JSON.stringify(body.bankAccount)) }
  if (body.notificationConfig !== undefined) { updates.push('notification_config = ?'); vals.push(JSON.stringify(body.notificationConfig)) }
  if (body.feeConfig !== undefined) { updates.push('fee_config = ?'); vals.push(JSON.stringify(body.feeConfig)) }
  if (body.mvpWeights !== undefined) { updates.push('mvp_weights = ?'); vals.push(body.mvpWeights ? JSON.stringify(body.mvpWeights) : null) }

  if (updates.length === 0) return c.json({ error: '변경할 내용이 없습니다.' }, 400)

  const now = Math.floor(Date.now() / 1000)
  updates.push('updated_at = ?')
  vals.push(now, membership.id)

  await c.env.DB.prepare(
    `UPDATE clubs SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...vals).run()

  return c.json({ message: '클럽 설정이 업데이트되었습니다.' })
})

// 클럽 초대 코드 재발급 (admin만)
clubsRoutes.post('/me/regenerate-invite', authMiddleware(), async (c) => {
  const userId = (c as any).userId

  const membership = await c.env.DB.prepare(`
    SELECT c.id, cm.role FROM clubs c
    INNER JOIN club_members cm ON c.id = cm.club_id
    WHERE cm.user_id = ?
  `).bind(userId).first<{ id: number; role: string }>()

  if (!membership) return c.json({ error: '소속 클럽이 없습니다.' }, 404)
  const memberRole = membership.role.toLowerCase()
  if (memberRole !== 'admin' && memberRole !== 'owner') return c.json({ error: '관리자만 초대 코드를 변경할 수 있습니다.' }, 403)

  const newCode = generateInviteCode()
  const now = Math.floor(Date.now() / 1000)

  await c.env.DB.prepare(
    'UPDATE clubs SET invite_code = ?, updated_at = ? WHERE id = ?'
  ).bind(newCode, now, membership.id).run()

  return c.json({ inviteCode: newCode })
})

// 클럽 멤버 목록 (멤버만 조회 가능)
clubsRoutes.get('/me/members', authMiddleware(), async (c) => {
  const userId = (c as any).userId

  const membership = await c.env.DB.prepare(
    'SELECT club_id FROM club_members WHERE user_id = ?'
  ).bind(userId).first<{ club_id: number }>()

  if (!membership) return c.json({ error: '소속 클럽이 없습니다.' }, 404)

  const members = await c.env.DB.prepare(`
    SELECT u.id, u.username, u.email, cm.role, cm.joined_at,
           p.id as player_id, p.name as player_name, p.nickname
    FROM club_members cm
    INNER JOIN users u ON cm.user_id = u.id
    LEFT JOIN players p ON p.user_id = u.id AND p.club_id = cm.club_id
    WHERE cm.club_id = ?
    ORDER BY cm.role DESC, cm.joined_at ASC
  `).bind(membership.club_id).all()

  return c.json({ members: members.results })
})

// ─── 회비 설정 ────────────────────────────────────────

const DEFAULT_FEE_CONFIG = {
  sessionFee: { enabled: true, model: 'result_based', baseAmount: 6000, winDiscount: 1500, place2Discount: 500 },
  membershipFee: { enabled: false, type: 'monthly', amount: 0 },
  joiningFee: { enabled: false, amount: 0 },
}

// 회비 설정 조회
clubsRoutes.get('/me/fee-config', authMiddleware(), async (c) => {
  const userId = (c as any).userId

  const club = await c.env.DB.prepare(`
    SELECT c.fee_config, cm.role FROM clubs c
    INNER JOIN club_members cm ON c.id = cm.club_id
    WHERE cm.user_id = ?
  `).bind(userId).first<{ fee_config: string; role: string }>()

  if (!club) return c.json({ error: '소속 클럽이 없습니다.' }, 404)

  let feeConfig = DEFAULT_FEE_CONFIG
  try { feeConfig = JSON.parse(club.fee_config || '{}') } catch {}

  return c.json({ feeConfig })
})

// 회비 설정 저장 (admin만)
clubsRoutes.put('/me/fee-config', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const body = await c.req.json()

  const club = await c.env.DB.prepare(`
    SELECT c.id, cm.role FROM clubs c
    INNER JOIN club_members cm ON c.id = cm.club_id
    WHERE cm.user_id = ?
  `).bind(userId).first<{ id: number; role: string }>()

  if (!club) return c.json({ error: '소속 클럽이 없습니다.' }, 404)

  const now = Math.floor(Date.now() / 1000)
  await c.env.DB.prepare(
    'UPDATE clubs SET fee_config = ?, updated_at = ? WHERE id = ?'
  ).bind(JSON.stringify(body.feeConfig), now, club.id).run()

  return c.json({ message: '회비 설정이 저장되었습니다.' })
})

// 멤버 면제/입단비 설정 (admin만)
clubsRoutes.put('/me/members/:userId/exemption', authMiddleware('ADMIN'), async (c) => {
  const targetUserId = c.req.param('userId')
  const clubId = (c as any).clubId
  const body = await c.req.json()
  const { sessionFeeExempt, membershipFeeExempt, joiningFeePaid, exemptReason } = body

  const member = await c.env.DB.prepare(
    'SELECT user_id FROM club_members WHERE club_id = ? AND user_id = ?'
  ).bind(clubId, targetUserId).first()
  if (!member) return c.json({ error: '멤버를 찾을 수 없습니다.' }, 404)

  const updates: string[] = []
  const vals: any[] = []
  if (sessionFeeExempt !== undefined) { updates.push('session_fee_exempt = ?'); vals.push(sessionFeeExempt ? 1 : 0) }
  if (membershipFeeExempt !== undefined) { updates.push('membership_fee_exempt = ?'); vals.push(membershipFeeExempt ? 1 : 0) }
  if (joiningFeePaid !== undefined) { updates.push('joining_fee_paid = ?'); vals.push(joiningFeePaid ? 1 : 0) }
  if (exemptReason !== undefined) { updates.push('exempt_reason = ?'); vals.push(exemptReason) }

  if (updates.length === 0) return c.json({ error: '변경할 내용이 없습니다.' }, 400)

  vals.push(clubId, targetUserId)
  await c.env.DB.prepare(
    `UPDATE club_members SET ${updates.join(', ')} WHERE club_id = ? AND user_id = ?`
  ).bind(...vals).run()

  return c.json({ message: '설정이 저장되었습니다.' })
})

// 멤버 면제 현황 포함한 멤버 목록 (admin)
clubsRoutes.get('/me/members/exemptions', authMiddleware('ADMIN'), async (c) => {
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ members: [] })

  const members = await c.env.DB.prepare(`
    SELECT cm.user_id, cm.role, cm.session_fee_exempt, cm.membership_fee_exempt,
           cm.joining_fee_paid, cm.exempt_reason, cm.joined_at,
           p.id as player_id, p.name as player_name, p.nickname
    FROM club_members cm
    LEFT JOIN players p ON p.user_id = cm.user_id AND p.club_id = cm.club_id
    WHERE cm.club_id = ?
    ORDER BY cm.role DESC, cm.joined_at ASC
  `).bind(clubId).all()

  return c.json({ members: members.results })
})

// ─── 멤버 역할 변경 (owner만, PRO 전용) ───────────────
clubsRoutes.put('/me/members/:userId/role', authMiddleware(), async (c) => {
  const requesterId = (c as any).userId
  const clubId = (c as any).clubId
  const targetUserId = c.req.param('userId')

  if (!clubId) return c.json({ error: '소속 클럽이 없습니다.' }, 404)

  // 요청자가 owner인지 확인
  const requester = await c.env.DB.prepare(
    'SELECT role FROM club_members WHERE club_id = ? AND user_id = ?'
  ).bind(clubId, requesterId).first<{ role: string }>()
  if (!requester || requester.role !== 'owner') {
    return c.json({ error: '클럽 소유자만 역할을 변경할 수 있습니다.' }, 403)
  }

  // PRO 플랜 확인
  const club = await c.env.DB.prepare('SELECT plan_type FROM clubs WHERE id = ?').bind(clubId).first<{ plan_type: string }>()
  if (!isClubPro(club?.plan_type)) {
    return c.json({ error: 'PRO 플랜에서만 다중 관리자를 설정할 수 있습니다.' }, 403)
  }

  const { role } = await c.req.json()
  if (!['admin', 'member'].includes(role)) {
    return c.json({ error: '역할은 admin 또는 member만 가능합니다.' }, 400)
  }

  const target = await c.env.DB.prepare(
    'SELECT role FROM club_members WHERE club_id = ? AND user_id = ?'
  ).bind(clubId, targetUserId).first<{ role: string }>()
  if (!target) return c.json({ error: '해당 멤버를 찾을 수 없습니다.' }, 404)
  if (target.role === 'owner') return c.json({ error: 'owner 역할은 변경할 수 없습니다.' }, 400)

  await c.env.DB.prepare(
    'UPDATE club_members SET role = ? WHERE club_id = ? AND user_id = ?'
  ).bind(role, clubId, targetUserId).run()

  return c.json({ message: '역할이 변경되었습니다.' })
})

// ─── 클럽 로고 업로드/삭제 ───────────────────────────
clubsRoutes.post('/me/logo', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ error: '소속 클럽이 없습니다.' }, 404)

  const member = await c.env.DB.prepare(
    'SELECT role FROM club_members WHERE club_id = ? AND user_id = ?'
  ).bind(clubId, userId).first<{ role: string }>()
  if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
    return c.json({ error: '관리자만 로고를 변경할 수 있습니다.' }, 403)
  }

  const formData = await c.req.formData()
  const file = formData.get('logo') as File | null
  if (!file) return c.json({ error: '파일이 없습니다.' }, 400)

  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) return c.json({ error: '파일 크기는 5MB 이하여야 합니다.' }, 400)

  const key = `clubs/${clubId}/logo.webp`
  const buf = await file.arrayBuffer()
  await c.env.PHOTOS.put(key, buf, { httpMetadata: { contentType: 'image/webp' } })

  const logoUrl = `/photos/${key}`
  const now = Math.floor(Date.now() / 1000)
  await c.env.DB.prepare(
    'UPDATE clubs SET logo_url = ?, updated_at = ? WHERE id = ?'
  ).bind(logoUrl, now, clubId).run()

  return c.json({ logoUrl })
})

clubsRoutes.delete('/me/logo', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ error: '소속 클럽이 없습니다.' }, 404)

  const member = await c.env.DB.prepare(
    'SELECT role FROM club_members WHERE club_id = ? AND user_id = ?'
  ).bind(clubId, userId).first<{ role: string }>()
  if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
    return c.json({ error: '관리자만 로고를 변경할 수 있습니다.' }, 403)
  }

  await c.env.PHOTOS.delete(`clubs/${clubId}/logo.webp`)
  const now = Math.floor(Date.now() / 1000)
  await c.env.DB.prepare(
    'UPDATE clubs SET logo_url = NULL, updated_at = ? WHERE id = ?'
  ).bind(now, clubId).run()

  return c.json({ message: '로고가 삭제되었습니다.' })
})

// 클럽 삭제 (owner만 가능)
clubsRoutes.delete('/me', authMiddleware(), async (c) => {
  try {
    const userId = (c as any).userId
    const clubId = (c as any).clubId
    if (!clubId) return c.json({ error: '클럽이 선택되지 않았습니다.' }, 400)

    // owner 확인
    const club = await c.env.DB.prepare(
      'SELECT owner_user_id FROM clubs WHERE id = ?'
    ).bind(clubId).first()
    if (!club || club.owner_user_id !== userId) {
      return c.json({ error: '클럽 소유자만 삭제할 수 있습니다.' }, 403)
    }

    // 관련 데이터 삭제 (순서 중요 - FK 의존성)
    const tables = [
      'player_ratings', 'player_preferences', 'match_events', 'player_match_stats',
      'team_members', 'teams', 'matches', 'attendance', 'session_payments',
      'sessions', 'rankings_cache', 'club_members', 'players',
    ]
    for (const table of tables) {
      if (['player_ratings', 'player_preferences', 'player_match_stats'].includes(table)) {
        await c.env.DB.prepare(
          `DELETE FROM ${table} WHERE player_id IN (SELECT id FROM players WHERE club_id = ?)`
        ).bind(clubId).run()
      } else if (['match_events'].includes(table)) {
        await c.env.DB.prepare(
          `DELETE FROM ${table} WHERE match_id IN (SELECT m.id FROM matches m JOIN sessions s ON m.session_id = s.id WHERE s.club_id = ?)`
        ).bind(clubId).run()
      } else if (['team_members'].includes(table)) {
        await c.env.DB.prepare(
          `DELETE FROM ${table} WHERE team_id IN (SELECT t.id FROM teams t JOIN sessions s ON t.session_id = s.id WHERE s.club_id = ?)`
        ).bind(clubId).run()
      } else if (['teams', 'matches'].includes(table)) {
        await c.env.DB.prepare(
          `DELETE FROM ${table} WHERE session_id IN (SELECT id FROM sessions WHERE club_id = ?)`
        ).bind(clubId).run()
      } else if (['attendance', 'session_payments', 'sessions'].includes(table)) {
        await c.env.DB.prepare(
          `DELETE FROM ${table} WHERE ${table === 'sessions' ? 'club_id' : 'session_id IN (SELECT id FROM sessions WHERE club_id'} = ?${table === 'sessions' ? '' : ')'}`
        ).bind(clubId).run()
      } else if (table === 'rankings_cache') {
        await c.env.DB.prepare('DELETE FROM rankings_cache WHERE club_id = ?').bind(clubId).run()
      } else {
        await c.env.DB.prepare(`DELETE FROM ${table} WHERE club_id = ?`).bind(clubId).run()
      }
    }

    // 클럽 삭제
    await c.env.DB.prepare('DELETE FROM clubs WHERE id = ?').bind(clubId).run()

    return c.json({ message: '클럽이 삭제되었습니다.' })
  } catch (err: any) {
    console.error('Club delete error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// ─── 클럽 공개 프로필 ────────────────────────────────

// GET /clubs/:slug/profile — 공개 클럽 정보
clubsRoutes.get('/:slug/profile', authMiddleware(), async (c) => {
  const slug = c.req.param('slug')

  const club = await c.env.DB.prepare(`
    SELECT id, slug, name, description, logo_url, plan_type, created_at
    FROM clubs WHERE slug = ?
  `).bind(slug).first()

  if (!club) return c.json({ error: '클럽을 찾을 수 없습니다.' }, 404)

  const clubId = club.id as number

  // 멤버 수
  const memberCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM club_members WHERE club_id = ?'
  ).bind(clubId).first()

  // 총 세션 수 + 최근 세션
  const sessionStats = await c.env.DB.prepare(`
    SELECT COUNT(*) as total,
           MAX(session_date) as last_session_date
    FROM sessions WHERE club_id = ? AND status IN ('completed', 'closed')
  `).bind(clubId).first()

  // 리뷰 평균 + 개수
  const reviewStats = await c.env.DB.prepare(`
    SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
    FROM club_reviews WHERE club_id = ?
  `).bind(clubId).first()

  // 최근 리뷰 5개
  const { results: reviews } = await c.env.DB.prepare(`
    SELECT cr.*, u.username as author_name
    FROM club_reviews cr
    LEFT JOIN users u ON u.id = cr.author_id
    WHERE cr.club_id = ?
    ORDER BY cr.created_at DESC LIMIT 5
  `).bind(clubId).all()

  // 현재 사용자의 리뷰
  const userId = (c as any).userId
  const myReview = userId ? await c.env.DB.prepare(
    'SELECT * FROM club_reviews WHERE club_id = ? AND author_id = ?'
  ).bind(clubId, userId).first() : null

  // 현재 사용자가 이 클럽 멤버인지
  const isMember = userId ? await c.env.DB.prepare(
    'SELECT role FROM club_members WHERE club_id = ? AND user_id = ?'
  ).bind(clubId, userId).first() : null

  return c.json({
    club: {
      id: clubId,
      slug: club.slug,
      name: club.name,
      description: club.description,
      logoUrl: club.logo_url,
      isPro: isClubPro(club.plan_type as string),
      createdAt: club.created_at,
      memberCount: memberCount?.cnt || 0,
      totalSessions: sessionStats?.total || 0,
      lastSessionDate: sessionStats?.last_session_date || null,
      avgRating: reviewStats?.avg_rating ? Math.round((reviewStats.avg_rating as number) * 10) / 10 : null,
      reviewCount: reviewStats?.review_count || 0,
    },
    reviews,
    myReview,
    isMember: !!isMember,
    myRole: isMember?.role || null,
  })
})

// POST /clubs/:slug/reviews — 리뷰 작성
clubsRoutes.post('/:slug/reviews', authMiddleware(), async (c) => {
  const slug = c.req.param('slug')
  const userId = (c as any).userId

  const club = await c.env.DB.prepare(
    'SELECT id FROM clubs WHERE slug = ?'
  ).bind(slug).first()
  if (!club) return c.json({ error: '클럽을 찾을 수 없습니다.' }, 404)

  const { rating, content } = await c.req.json()
  if (!rating || rating < 1 || rating > 5) {
    return c.json({ error: '평점은 1~5 사이여야 합니다.' }, 400)
  }

  const now = Math.floor(Date.now() / 1000)

  // UPSERT: 이미 리뷰가 있으면 업데이트
  const existing = await c.env.DB.prepare(
    'SELECT id FROM club_reviews WHERE club_id = ? AND author_id = ?'
  ).bind(club.id, userId).first()

  if (existing) {
    await c.env.DB.prepare(
      'UPDATE club_reviews SET rating = ?, content = ?, updated_at = ? WHERE id = ?'
    ).bind(rating, content || null, now, existing.id).run()
    return c.json({ data: { id: existing.id, updated: true } })
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO club_reviews (club_id, author_id, rating, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(club.id, userId, rating, content || null, now, now).run()

  return c.json({ data: { id: result.meta.last_row_id } }, 201)
})

// DELETE /clubs/:slug/reviews — 내 리뷰 삭제
clubsRoutes.delete('/:slug/reviews', authMiddleware(), async (c) => {
  const slug = c.req.param('slug')
  const userId = (c as any).userId

  const club = await c.env.DB.prepare(
    'SELECT id FROM clubs WHERE slug = ?'
  ).bind(slug).first()
  if (!club) return c.json({ error: '클럽을 찾을 수 없습니다.' }, 404)

  await c.env.DB.prepare(
    'DELETE FROM club_reviews WHERE club_id = ? AND author_id = ?'
  ).bind(club.id, userId).run()

  return c.json({ data: { success: true } })
})

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export { clubsRoutes }
