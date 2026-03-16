import { Hono } from 'hono'
import type { Env } from '../index'
import { authMiddleware } from '../middleware/auth'

const paymentsRoutes = new Hono<{ Bindings: Env }>()

// ─── 세션 납부 내역 ────────────────────────────────────

// 멤버: 내 세션 납부 내역 / 어드민: 클럽 전체 세션 납부 요약
paymentsRoutes.get('/sessions', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId
  const clubRole = (c as any).clubRole

  if (!clubId) return c.json({ payments: [] })

  if (clubRole === 'admin') {
    // 어드민: 클럽 세션 목록 + 납부 현황 요약
    const rows = await c.env.DB.prepare(`
      SELECT
        s.id as session_id, s.session_date, s.title,
        st.id as settlement_id, st.base_fee, st.total_pot, st.status,
        COUNT(sp.id) as total_members,
        SUM(sp.paid) as paid_count,
        SUM(CASE WHEN sp.exempt = 1 THEN 1 ELSE 0 END) as exempt_count,
        SUM(CASE WHEN sp.paid = 0 AND sp.exempt = 0 THEN sp.amount ELSE 0 END) as unpaid_amount,
        SUM(CASE WHEN sp.exempt = 0 THEN sp.amount ELSE 0 END) as total_amount,
        SUM(CASE WHEN sp.paid = 1 AND sp.exempt = 0 THEN sp.amount ELSE 0 END) as paid_amount
      FROM sessions s
      LEFT JOIN settlements st ON st.session_id = s.id
      LEFT JOIN session_payments sp ON sp.session_id = s.id
      WHERE s.club_id = ?
      GROUP BY s.id
      ORDER BY s.session_date DESC
      LIMIT 30
    `).bind(clubId).all()

    return c.json({ role: 'admin', sessions: rows.results })
  } else {
    // 멤버: 내 납부 내역
    const player = await c.env.DB.prepare(
      'SELECT id FROM players WHERE user_id = ? AND club_id = ?'
    ).bind(userId, clubId).first<{ id: number }>()

    if (!player) return c.json({ payments: [] })

    const rows = await c.env.DB.prepare(`
      SELECT sp.*, s.session_date, s.title as session_title
      FROM session_payments sp
      JOIN sessions s ON sp.session_id = s.id
      WHERE sp.player_id = ?
      ORDER BY s.session_date DESC
      LIMIT 50
    `).bind(player.id).all()

    return c.json({ role: 'member', payments: rows.results })
  }
})

// 어드민: 특정 세션의 멤버별 납부 상세
paymentsRoutes.get('/sessions/:sessionId', authMiddleware('ADMIN'), async (c) => {
  const sessionId = c.req.param('sessionId')
  const clubId = (c as any).clubId

  // 세션이 이 클럽 것인지 확인
  const session = await c.env.DB.prepare(
    'SELECT id FROM sessions WHERE id = ? AND club_id = ?'
  ).bind(sessionId, clubId).first()
  if (!session) return c.json({ error: '세션을 찾을 수 없습니다.' }, 404)

  const payments = await c.env.DB.prepare(`
    SELECT sp.*, t.name as team_name, t.vest_color as team_color
    FROM session_payments sp
    LEFT JOIN team_members tm ON tm.player_id = sp.player_id
    LEFT JOIN teams t ON tm.team_id = t.id AND t.session_id = sp.session_id
    WHERE sp.session_id = ?
    ORDER BY sp.paid ASC, sp.player_name ASC
  `).bind(sessionId).all()

  // 정산 정보
  const settlement = await c.env.DB.prepare(
    'SELECT * FROM settlements WHERE session_id = ?'
  ).bind(sessionId).first()

  const nonExempt = (payments.results as any[]).filter((p: any) => !p.exempt)
  const summary = {
    total: payments.results.length,
    paid: (payments.results as any[]).filter((p: any) => p.paid === 1).length,
    exempt: (payments.results as any[]).filter((p: any) => p.exempt === 1).length,
    unpaidAmount: nonExempt
      .filter((p: any) => !p.paid)
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
    totalAmount: nonExempt
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
    paidAmount: nonExempt
      .filter((p: any) => p.paid === 1)
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
  }

  return c.json({ payments: payments.results, settlement, summary })
})

// 어드민: 납부 상태 토글
paymentsRoutes.put('/:id/paid', authMiddleware('ADMIN'), async (c) => {
  const id = c.req.param('id')
  const clubId = (c as any).clubId
  const body = await c.req.json()
  const { paid } = body  // true/false

  // 이 클럽 소속 결제인지 확인
  const payment = await c.env.DB.prepare(`
    SELECT sp.id FROM session_payments sp
    JOIN sessions s ON sp.session_id = s.id
    WHERE sp.id = ? AND s.club_id = ?
  `).bind(id, clubId).first()
  if (!payment) return c.json({ error: '납부 내역을 찾을 수 없습니다.' }, 404)

  const now = Math.floor(Date.now() / 1000)
  await c.env.DB.prepare(
    'UPDATE session_payments SET paid = ?, paid_at = ? WHERE id = ?'
  ).bind(paid ? 1 : 0, paid ? now : null, id).run()

  // 해당 세션의 미납(비면제) 건수 확인 → 0이면 세션 completed 로 전환
  const unpaid = await c.env.DB.prepare(`
    SELECT COUNT(*) as cnt FROM session_payments
    WHERE session_id = (SELECT session_id FROM session_payments WHERE id = ?)
      AND paid = 0 AND exempt = 0
  `).bind(id).first<{ cnt: number }>()

  if ((unpaid?.cnt ?? 1) === 0) {
    await c.env.DB.prepare(
      "UPDATE sessions SET status = 'completed', updated_at = ? WHERE id = (SELECT session_id FROM session_payments WHERE id = ?)"
    ).bind(now, id).run()
  }

  return c.json({ ok: true, paid: !!paid })
})

// 어드민: 면제 상태 토글
paymentsRoutes.put('/:id/exempt', authMiddleware('ADMIN'), async (c) => {
  const id = c.req.param('id')
  const clubId = (c as any).clubId
  const body = await c.req.json()
  const { exempt } = body

  const payment = await c.env.DB.prepare(`
    SELECT sp.id FROM session_payments sp
    JOIN sessions s ON sp.session_id = s.id
    WHERE sp.id = ? AND s.club_id = ?
  `).bind(id, clubId).first()
  if (!payment) return c.json({ error: '납부 내역을 찾을 수 없습니다.' }, 404)

  await c.env.DB.prepare(
    'UPDATE session_payments SET exempt = ?, paid = ? WHERE id = ?'
  ).bind(exempt ? 1 : 0, exempt ? 1 : 0, id).run()

  return c.json({ ok: true, exempt: !!exempt })
})

// ─── 정기 회비 (월/연/입단비) ─────────────────────────

// 어드민: 정기 회비 목록 (전체 멤버)
paymentsRoutes.get('/membership', authMiddleware('ADMIN'), async (c) => {
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ payments: [] })

  const rows = await c.env.DB.prepare(`
    SELECT mp.*, p.name as player_name_linked
    FROM membership_payments mp
    LEFT JOIN players p ON p.user_id = mp.user_id AND p.club_id = ?
    WHERE mp.club_id = ?
    ORDER BY mp.created_at DESC
  `).bind(clubId, clubId).all()

  return c.json({ payments: rows.results })
})

// 멤버: 내 정기 회비 내역
paymentsRoutes.get('/membership/me', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId

  const rows = await c.env.DB.prepare(
    'SELECT * FROM membership_payments WHERE club_id = ? AND user_id = ? ORDER BY created_at DESC'
  ).bind(clubId, userId).all()

  return c.json({ payments: rows.results })
})

// 어드민: 정기 회비 납부 처리
paymentsRoutes.put('/membership/:id/paid', authMiddleware('ADMIN'), async (c) => {
  const id = c.req.param('id')
  const clubId = (c as any).clubId
  const body = await c.req.json()
  const { paid } = body

  const payment = await c.env.DB.prepare(
    'SELECT id FROM membership_payments WHERE id = ? AND club_id = ?'
  ).bind(id, clubId).first()
  if (!payment) return c.json({ error: '납부 내역을 찾을 수 없습니다.' }, 404)

  const now = Math.floor(Date.now() / 1000)
  await c.env.DB.prepare(
    'UPDATE membership_payments SET paid = ?, paid_at = ? WHERE id = ?'
  ).bind(paid ? 1 : 0, paid ? now : null, id).run()

  return c.json({ ok: true })
})

// 어드민: 회비 레코드 직접 생성 (월회비 발송 등)
paymentsRoutes.post('/membership/generate', authMiddleware('ADMIN'), async (c) => {
  const clubId = (c as any).clubId
  const body = await c.req.json()
  const { feeType, amount, period } = body  // feeType: monthly|annual|joining, period: '2026-03'

  if (!feeType || !amount) return c.json({ error: 'feeType, amount 필수' }, 400)

  // 클럽 멤버 전원에게 회비 레코드 생성
  const members = await c.env.DB.prepare(`
    SELECT cm.user_id, p.name as player_name
    FROM club_members cm
    LEFT JOIN players p ON p.user_id = cm.user_id AND p.club_id = cm.club_id
    WHERE cm.club_id = ?
      AND cm.membership_fee_exempt = 0
      AND (? = 'joining' OR cm.joining_fee_paid = 1 OR ? != 'joining')
  `).bind(clubId, feeType, feeType).all()

  const now = Math.floor(Date.now() / 1000)
  let created = 0

  for (const m of members.results as any[]) {
    // 이미 해당 기간 레코드 있으면 스킵
    if (period) {
      const existing = await c.env.DB.prepare(
        'SELECT id FROM membership_payments WHERE club_id = ? AND user_id = ? AND fee_type = ? AND period = ?'
      ).bind(clubId, m.user_id, feeType, period).first()
      if (existing) continue
    }

    await c.env.DB.prepare(`
      INSERT INTO membership_payments (club_id, user_id, player_name, fee_type, amount, period, paid, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).bind(clubId, m.user_id, m.player_name || '미연동', feeType, amount, period || null, now).run()
    created++
  }

  return c.json({ message: `${created}명의 회비 레코드가 생성되었습니다.`, created })
})

export { paymentsRoutes }
