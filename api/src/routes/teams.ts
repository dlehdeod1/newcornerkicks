import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../index'
import { authMiddleware } from '../middleware/auth'

const teamsRoutes = new Hono<{ Bindings: Env }>()

// 팀 멤버 이동
teamsRoutes.post('/:teamId/members/:memberId/move', authMiddleware(), async (c) => {
  try {
    const fromTeamId = c.req.param('teamId')
    const memberId = c.req.param('memberId')
    const body = await c.req.json()
    const clubId = (c as any).clubId

    const schema = z.object({
      toTeamId: z.number(),
    })

    const { toTeamId } = schema.parse(body)

    // 팀이 요청자의 클럽 소속인지 확인
    const fromTeam = await c.env.DB.prepare(
      'SELECT t.id, s.club_id FROM teams t JOIN sessions s ON t.session_id = s.id WHERE t.id = ?'
    ).bind(fromTeamId).first()
    if (!fromTeam || (fromTeam as any).club_id !== clubId) {
      return c.json({ error: '해당 클럽 소속 팀이 아닙니다.' }, 403)
    }

    // 멤버 확인
    const member = await c.env.DB.prepare(
      'SELECT * FROM team_members WHERE id = ? AND team_id = ?'
    ).bind(memberId, fromTeamId).first()

    if (!member) {
      return c.json({ error: '멤버를 찾을 수 없습니다.' }, 404)
    }

    // 대상 팀 확인 및 같은 클럽 소속인지 확인
    const toTeam = await c.env.DB.prepare(
      'SELECT t.id, s.club_id FROM teams t JOIN sessions s ON t.session_id = s.id WHERE t.id = ?'
    ).bind(toTeamId).first()

    if (!toTeam) {
      return c.json({ error: '대상 팀을 찾을 수 없습니다.' }, 404)
    }

    if ((toTeam as any).club_id !== clubId) {
      return c.json({ error: '대상 팀이 해당 클럽 소속이 아닙니다.' }, 403)
    }

    // 팀 이동
    await c.env.DB.prepare(
      'UPDATE team_members SET team_id = ? WHERE id = ?'
    ).bind(toTeamId, memberId).run()

    return c.json({ message: '멤버가 이동되었습니다.' })
  } catch (err: any) {
    console.error('Move member error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// 팀 조끼색 변경
teamsRoutes.put('/:teamId/color', authMiddleware(), async (c) => {
  try {
    const teamId = c.req.param('teamId')
    const body = await c.req.json()
    const clubId = (c as any).clubId

    // 팀이 요청자의 클럽 소속인지 확인
    const team = await c.env.DB.prepare(
      'SELECT t.id, s.club_id FROM teams t JOIN sessions s ON t.session_id = s.id WHERE t.id = ?'
    ).bind(teamId).first()
    if (!team || (team as any).club_id !== clubId) {
      return c.json({ error: '해당 클럽 소속 팀이 아닙니다.' }, 403)
    }

    const schema = z.object({
      vestColor: z.enum(['yellow', 'orange', 'white']),
    })

    const { vestColor } = schema.parse(body)

    await c.env.DB.prepare(
      'UPDATE teams SET vest_color = ? WHERE id = ?'
    ).bind(vestColor, teamId).run()

    return c.json({ message: '조끼색이 변경되었습니다.' })
  } catch (err: any) {
    console.error('Change color error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// 팀 정보 수정 (이름, 조끼색 등)
teamsRoutes.put('/:teamId', authMiddleware(), async (c) => {
  try {
    const teamId = c.req.param('teamId')
    const body = await c.req.json()
    const clubId = (c as any).clubId

    // 팀이 요청자의 클럽 소속인지 확인
    const team = await c.env.DB.prepare(
      'SELECT t.id, s.club_id FROM teams t JOIN sessions s ON t.session_id = s.id WHERE t.id = ?'
    ).bind(teamId).first()
    if (!team || (team as any).club_id !== clubId) {
      return c.json({ error: '해당 클럽 소속 팀이 아닙니다.' }, 403)
    }

    const updates: string[] = []
    const values: any[] = []

    if (body.name !== undefined) {
      updates.push('name = ?')
      values.push(body.name)
    }
    if (body.vestColor !== undefined) {
      updates.push('vest_color = ?')
      values.push(body.vestColor)
    }
    if (body.emoji !== undefined) {
      updates.push('emoji = ?')
      values.push(body.emoji)
    }

    if (updates.length === 0) {
      return c.json({ error: '수정할 내용이 없습니다.' }, 400)
    }

    values.push(teamId)

    await c.env.DB.prepare(
      `UPDATE teams SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run()

    return c.json({ message: '팀이 수정되었습니다.' })
  } catch (err: any) {
    console.error('Update team error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// 팀 멤버 순서 변경
teamsRoutes.put('/:teamId/reorder', authMiddleware(), async (c) => {
  try {
    const teamId = c.req.param('teamId')
    const body = await c.req.json()
    const clubId = (c as any).clubId

    // 팀이 요청자의 클럽 소속인지 확인
    const team = await c.env.DB.prepare(
      'SELECT t.id, s.club_id FROM teams t JOIN sessions s ON t.session_id = s.id WHERE t.id = ?'
    ).bind(teamId).first()
    if (!team || (team as any).club_id !== clubId) {
      return c.json({ error: '해당 클럽 소속 팀이 아닙니다.' }, 403)
    }

    const schema = z.object({
      memberIds: z.array(z.number()),
    })

    const { memberIds } = schema.parse(body)

    for (let i = 0; i < memberIds.length; i++) {
      await c.env.DB.prepare(
        'UPDATE team_members SET order_index = ? WHERE id = ? AND team_id = ?'
      ).bind(i, memberIds[i], teamId).run()
    }

    return c.json({ message: '순서가 변경되었습니다.' })
  } catch (err: any) {
    console.error('Reorder members error:', err)
    return c.json({ error: err.message }, 500)
  }
})

export { teamsRoutes }
