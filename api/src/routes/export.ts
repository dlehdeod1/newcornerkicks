import { Hono } from 'hono'
import type { Env } from '../index'
import { authMiddleware } from '../middleware/auth'
import { isClubPro, proLockedResponse } from '../utils/planUtils'
import { toCsv } from '../utils/csvExport'
import { getSeasonDateRange, getClubSeasonStartMonth } from '../utils/season'

const exportRoutes = new Hono<{ Bindings: Env }>()

exportRoutes.get('/:type', authMiddleware('ADMIN'), async (c) => {
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ error: '클럽이 없습니다.' }, 400)

  const club = await c.env.DB.prepare('SELECT plan_type FROM clubs WHERE id = ?').bind(clubId).first<any>()
  if (!isClubPro(club?.plan_type)) return proLockedResponse(c)

  const type = c.req.param('type')
  const year = Number(c.req.query('season')) || new Date().getFullYear()
  const startMonth = await getClubSeasonStartMonth(c.env.DB, clubId)
  const { yearStart: start, yearEnd: end } = getSeasonDateRange(year, startMonth)

  let csv = ''
  let filename = ''

  if (type === 'rankings') {
    const cache = await c.env.DB.prepare(
      "SELECT data FROM rankings_cache WHERE club_id = ? AND year = ? AND period = 'full'"
    ).bind(clubId, year).first<any>()

    if (cache?.data) {
      const data = JSON.parse(cache.data) as any[]
      const headers = ['이름', '골', '도움', '블록', '출석', '경기수', '승', '무', '패', '승률', 'MVP']
      const rows = data.map((r: any) => [
        r.name, r.goals, r.assists, r.defenses, r.attendance,
        r.totalGames, r.wins, r.draws, r.losses,
        r.winRate ? `${(r.winRate * 100).toFixed(1)}%` : '0%',
        r.mvpCount,
      ])
      csv = toCsv(headers, rows)
    } else {
      csv = toCsv(['이름'], [['데이터 없음']])
    }
    filename = `cornerkicks-rankings-${year}.csv`

  } else if (type === 'sessions') {
    const sessions = await c.env.DB.prepare(`
      SELECT s.id, s.title, s.session_date, s.start_time, s.end_time,
             s.status, s.location,
             (SELECT COUNT(*) FROM attendance a WHERE a.session_id = s.id) as attendee_count
      FROM sessions s
      WHERE s.club_id = ? AND s.session_date >= ? AND s.session_date <= ?
      ORDER BY s.session_date DESC
    `).bind(clubId, start, end).all()

    const headers = ['날짜', '제목', '장소', '시작', '종료', '상태', '참가자수']
    const rows = (sessions.results as any[]).map(s => [
      s.session_date, s.title || '', s.location || '',
      s.start_time || '', s.end_time || '', s.status, s.attendee_count,
    ])
    csv = toCsv(headers, rows)
    filename = `cornerkicks-sessions-${year}.csv`

  } else if (type === 'payments') {
    const payments = await c.env.DB.prepare(`
      SELECT s.session_date, s.title, p.name as player_name,
             sp.amount, sp.status, sp.payment_method
      FROM session_payments sp
      JOIN sessions s ON sp.session_id = s.id
      JOIN players p ON sp.player_id = p.id
      WHERE s.club_id = ? AND s.session_date >= ? AND s.session_date <= ?
      ORDER BY s.session_date DESC, p.name
    `).bind(clubId, start, end).all()

    const headers = ['날짜', '세션', '선수', '금액', '상태', '결제방법']
    const rows = (payments.results as any[]).map(p => [
      p.session_date, p.title || '', p.player_name,
      p.amount, p.status, p.payment_method || '',
    ])
    csv = toCsv(headers, rows)
    filename = `cornerkicks-payments-${year}.csv`

  } else {
    return c.json({ error: '유효하지 않은 내보내기 타입입니다.' }, 400)
  }

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})

export { exportRoutes }
