import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../index'
import { authMiddleware } from '../middleware/auth'

const sessionsRoutes = new Hono<{ Bindings: Env }>()

// 세션 목록 조회
sessionsRoutes.get('/', async (c) => {
  const status = c.req.query('status')
  const limit = Number(c.req.query('limit')) || 10

  let query = 'SELECT * FROM sessions'
  const params: string[] = []

  if (status) {
    query += ' WHERE status = ?'
    params.push(status)
  }

  query += ' ORDER BY session_date DESC LIMIT ?'
  params.push(String(limit))

  const sessions = await c.env.DB.prepare(query).bind(...params).all()

  return c.json({ sessions: sessions.results })
})

// 세션 상세 조회
sessionsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')

  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ?'
  ).bind(id).first()

  if (!session) {
    return c.json({ error: '세션을 찾을 수 없습니다.' }, 404)
  }

  // 팀 조회
  const teams = await c.env.DB.prepare(
    'SELECT * FROM teams WHERE session_id = ? ORDER BY rank'
  ).bind(id).all()

  // 팀별 멤버 조회
  const teamsWithMembers = await Promise.all(
    teams.results.map(async (team: any) => {
      const members = await c.env.DB.prepare(`
        SELECT tm.*, p.name, p.nickname, p.photo_url
        FROM team_members tm
        LEFT JOIN players p ON tm.player_id = p.id
        WHERE tm.team_id = ?
        ORDER BY tm.order_index ASC, tm.id ASC
      `).bind(team.id).all()

      return {
        ...team,
        members: members.results,
      }
    })
  )

  // 경기 조회
  const matches = await c.env.DB.prepare(`
    SELECT m.*,
           t1.name as team1_name, t1.vest_color as team1_color,
           t2.name as team2_name, t2.vest_color as team2_color
    FROM matches m
    JOIN teams t1 ON m.team1_id = t1.id
    JOIN teams t2 ON m.team2_id = t2.id
    WHERE m.session_id = ?
    ORDER BY m.match_no
  `).bind(id).all()

  // 경기별 이벤트 조회
  const matchesWithEvents = await Promise.all(
    matches.results.map(async (match: any) => {
      const events = await c.env.DB.prepare(`
        SELECT me.*, p.name as player_name, p.is_guest as player_is_guest,
               a.name as assister_name, a.is_guest as assister_is_guest
        FROM match_events me
        LEFT JOIN players p ON me.player_id = p.id
        LEFT JOIN players a ON me.assister_id = a.id
        WHERE me.match_id = ?
        ORDER BY me.event_time ASC
      `).bind(match.id).all()

      return {
        ...match,
        events: events.results,
      }
    })
  )

  // 출석 조회 (정규 선수 + 용병)
  const attendance = await c.env.DB.prepare(`
    SELECT a.*, p.name, p.nickname,
           CASE WHEN a.player_id IS NULL THEN a.guest_name ELSE p.name END as display_name
    FROM attendance a
    LEFT JOIN players p ON a.player_id = p.id
    WHERE a.session_id = ?
  `).bind(id).all()

  return c.json({
    session,
    teams: teamsWithMembers,
    matches: matchesWithEvents,
    attendance: attendance.results,
  })
})

// 세션 생성 (관리자)
sessionsRoutes.post('/', authMiddleware('ADMIN'), async (c) => {
  const body = await c.req.json()

  const schema = z.object({
    sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: z.string().optional(),
    notes: z.string().optional(),
  })

  const data = schema.parse(body)
  const now = Math.floor(Date.now() / 1000)

  const result = await c.env.DB.prepare(`
    INSERT INTO sessions (session_date, title, status, created_at)
    VALUES (?, ?, 'recruiting', ?)
  `).bind(
    data.sessionDate,
    data.title || '코너킥스 정기 풋살',
    now
  ).run()

  return c.json({
    id: result.meta.last_row_id,
    message: '세션이 생성되었습니다.',
  }, 201)
})

// 세션 수정 (관리자)
sessionsRoutes.put('/:id', authMiddleware('ADMIN'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { title, sessionDate, status, notes } = body

  // 동적으로 업데이트할 필드 구성
  const updates: string[] = []
  const params: any[] = []

  if (title !== undefined) {
    updates.push('title = ?')
    params.push(title)
  }
  if (sessionDate !== undefined) {
    updates.push('session_date = ?')
    params.push(sessionDate)
  }
  if (status !== undefined) {
    updates.push('status = ?')
    params.push(status)
  }
  if (notes !== undefined) {
    updates.push('notes = ?')
    params.push(notes)
  }

  if (updates.length === 0) {
    return c.json({ error: '수정할 내용이 없습니다.' }, 400)
  }

  params.push(id)

  await c.env.DB.prepare(`
    UPDATE sessions SET ${updates.join(', ')} WHERE id = ?
  `).bind(...params).run()

  return c.json({ message: '세션이 수정되었습니다.' })
})

// 카카오톡 텍스트 파싱
sessionsRoutes.post('/:id/parse', authMiddleware('ADMIN'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { text } = body

  if (!text) {
    return c.json({ error: '텍스트를 입력해주세요.' }, 400)
  }

  // 파싱 로직
  const lines = text.trim().split('\n')
  const result = parseKakaoVote(lines)

  // 선수 매칭
  const players = await c.env.DB.prepare(
    'SELECT id, name, nickname FROM players WHERE is_guest = 0'
  ).all()

  const playerMap = new Map<string, any>()
  players.results.forEach((p: any) => {
    playerMap.set(p.name, p)
    if (p.nickname) {
      playerMap.set(p.nickname, p)
    }
  })

  const attendees: { name: string; playerId: number | null; isGuest: boolean }[] = []

  result.names.forEach((name) => {
    const player = playerMap.get(name)

    if (player) {
      attendees.push({
        name: player.name,
        playerId: player.id,
        isGuest: false,
      })
    } else {
      // "용병" 포함된 이름은 용병, 그 외 미등록 선수
      const isGuest = name.includes('용병')
      attendees.push({
        name,
        playerId: null,
        isGuest,
      })
    }
  })

  return c.json({
    date: result.date,
    attendees,
    totalCount: attendees.length,
    playerCount: attendees.filter(a => !a.isGuest).length,
    guestCount: attendees.filter(a => a.isGuest).length,
    unknownCount: attendees.filter(a => !a.playerId && !a.isGuest).length,
  })
})

// 참석자 저장
sessionsRoutes.post('/:id/attendance', authMiddleware('ADMIN'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { attendees } = body // [{ playerId, isGuest, guestName }]

  const now = Math.floor(Date.now() / 1000)

  // 기존 출석 삭제
  await c.env.DB.prepare(
    'DELETE FROM attendance WHERE session_id = ?'
  ).bind(id).run()

  // 새 출석 등록
  for (const attendee of attendees) {
    if (attendee.playerId) {
      // 정규 선수
      await c.env.DB.prepare(`
        INSERT INTO attendance (session_id, player_id, created_at)
        VALUES (?, ?, ?)
      `).bind(id, attendee.playerId, now).run()
    } else if (attendee.isGuest && attendee.guestName) {
      // 용병 - guest_name 필드에 저장
      await c.env.DB.prepare(`
        INSERT INTO attendance (session_id, guest_name, created_at)
        VALUES (?, ?, ?)
      `).bind(id, attendee.guestName, now).run()
    }
  }

  return c.json({ message: '참석자가 저장되었습니다.' })
})

// 선수 종합 능력치 계산
function calculateOverall(player: any): number {
  const stats = [
    player.shooting || 5,
    player.offball_run || 5,
    player.ball_keeping || 5,
    player.passing || 5,
    player.linkup || 5,
    player.intercept || 5,
    player.marking || 5,
    player.stamina || 5,
    player.speed || 5,
    player.physical || 5,
  ]
  return stats.reduce((sum, s) => sum + s, 0) / stats.length
}

// 공격/수비 성향 계산
function calculateRole(player: any): { attack: number; defense: number } {
  const attack = (
    (player.shooting || 5) * 1.5 +
    (player.offball_run || 5) +
    (player.ball_keeping || 5) +
    (player.linkup || 5)
  ) / 4.5

  const defense = (
    (player.intercept || 5) * 1.5 +
    (player.marking || 5) * 1.5 +
    (player.physical || 5) +
    (player.stamina || 5)
  ) / 5

  return { attack, defense }
}

// AI 팀 밸런싱 알고리즘
function balanceTeams(players: any[], teamCount: number): any[][] {
  // 종합 능력치와 역할 계산
  const playersWithStats = players.map(p => ({
    ...p,
    overall: calculateOverall(p),
    role: calculateRole(p),
  }))

  // 능력치 높은 순으로 정렬
  playersWithStats.sort((a, b) => b.overall - a.overall)

  // 팀 초기화
  const teams: any[][] = Array.from({ length: teamCount }, () => [])
  const teamStats = Array.from({ length: teamCount }, () => ({
    totalOverall: 0,
    totalAttack: 0,
    totalDefense: 0,
    count: 0,
  }))

  // 스네이크 드래프트 + 밸런스 보정
  for (let i = 0; i < playersWithStats.length; i++) {
    const player = playersWithStats[i]

    // 가장 약한 팀 찾기 (종합 점수 기준)
    let targetTeamIndex = 0
    let minScore = Infinity

    for (let t = 0; t < teamCount; t++) {
      // 인원수 차이가 2명 이상이면 해당 팀 우선
      const countDiff = teams[t].length - Math.min(...teams.map(team => team.length))
      if (countDiff >= 1) continue

      const avgOverall = teamStats[t].count > 0
        ? teamStats[t].totalOverall / teamStats[t].count
        : 0

      // 팀 밸런스 점수 (종합 + 공수 균형)
      const balanceScore = avgOverall * teamStats[t].count

      if (balanceScore < minScore) {
        minScore = balanceScore
        targetTeamIndex = t
      }
    }

    // 팀에 배치
    teams[targetTeamIndex].push(player)
    teamStats[targetTeamIndex].totalOverall += player.overall
    teamStats[targetTeamIndex].totalAttack += player.role.attack
    teamStats[targetTeamIndex].totalDefense += player.role.defense
    teamStats[targetTeamIndex].count++
  }

  return teams
}

// 팀 편성 (AI 밸런싱)
sessionsRoutes.post('/:id/teams', authMiddleware('ADMIN'), async (c) => {
  const id = c.req.param('id')

  try {
    const body = await c.req.json()
    const { attendees } = body

    const playerAttendees = attendees.filter((a: any) => a.playerId)
    const guestAttendees = attendees.filter((a: any) => !a.playerId)

    const playerCount = playerAttendees.length + guestAttendees.length
    const teamCount = playerCount >= 15 ? 3 : 2

    // 기존 팀 삭제 (외래 키 순서: match_events → matches → team_members → teams)
    const existingTeams = await c.env.DB.prepare(
      'SELECT id FROM teams WHERE session_id = ?'
    ).bind(id).all()

    // 경기 이벤트 삭제
    const existingMatches = await c.env.DB.prepare(
      'SELECT id FROM matches WHERE session_id = ?'
    ).bind(id).all()

    for (const match of (existingMatches.results || [])) {
      await c.env.DB.prepare('DELETE FROM match_events WHERE match_id = ?').bind((match as any).id).run()
    }

    // 경기 삭제
    await c.env.DB.prepare('DELETE FROM matches WHERE session_id = ?').bind(id).run()

    // 팀 멤버 및 팀 삭제
    for (const team of existingTeams.results) {
      await c.env.DB.prepare('DELETE FROM team_members WHERE team_id = ?').bind((team as any).id).run()
      await c.env.DB.prepare('DELETE FROM teams WHERE id = ?').bind((team as any).id).run()
    }

    // 선수 능력치 조회
    const playerIds = playerAttendees.map((a: any) => a.playerId)
    let playersWithStats: any[] = []

    if (playerIds.length > 0) {
      const placeholders = playerIds.map(() => '?').join(',')
      const playersResult = await c.env.DB.prepare(`
        SELECT * FROM players WHERE id IN (${placeholders})
      `).bind(...playerIds).all()
      playersWithStats = playersResult.results as any[]
    }

    // 용병은 기본 능력치(5)로 설정
    const guestsWithStats = guestAttendees.map((g: any) => ({
      id: null,
      guestName: g.guestName || g.name,
      isGuest: true,
      shooting: 5, offball_run: 5, ball_keeping: 5, passing: 5, linkup: 5,
      intercept: 5, marking: 5, stamina: 5, speed: 5, physical: 5,
    }))

    // 모든 참가자 합치기
    const allPlayers = [...playersWithStats, ...guestsWithStats]

    // AI 밸런싱으로 팀 구성
    const balancedTeams = balanceTeams(allPlayers, teamCount)

    // 팀 생성 및 멤버 배치
    const teamNames = ['A팀', 'B팀', 'C팀']
    const teamColors = ['yellow', 'orange', 'white']  // 조끼색: 노랑, 주황, 하양
    const teamEmojis = ['🟡', '🟠', '⚪']
    const teamIds: number[] = []
    const teamSummaries: any[] = []

    for (let i = 0; i < teamCount; i++) {
      const teamPlayers = balancedTeams[i]
      const avgOverall = teamPlayers.length > 0
        ? teamPlayers.reduce((sum, p) => sum + calculateOverall(p), 0) / teamPlayers.length
        : 0

      // 팀 타입 결정
      const avgAttack = teamPlayers.reduce((sum, p) => sum + calculateRole(p).attack, 0) / (teamPlayers.length || 1)
      const avgDefense = teamPlayers.reduce((sum, p) => sum + calculateRole(p).defense, 0) / (teamPlayers.length || 1)
      const teamType = avgAttack > avgDefense + 0.5 ? '공격형' : avgDefense > avgAttack + 0.5 ? '수비형' : '밸런스형'

      // 키플레이어 (가장 높은 능력치)
      const keyPlayer = teamPlayers.reduce((best, p) =>
        calculateOverall(p) > calculateOverall(best) ? p : best, teamPlayers[0])

      const result = await c.env.DB.prepare(`
        INSERT INTO teams (session_id, name, vest_color, emoji, type, key_player, key_player_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        teamNames[i],
        teamColors[i],
        teamEmojis[i],
        teamType,
        keyPlayer?.name || keyPlayer?.guestName || null,
        keyPlayer ? `종합 ${calculateOverall(keyPlayer).toFixed(1)}점` : null
      ).run()

      const teamId = result.meta.last_row_id as number
      teamIds.push(teamId)

      // 팀 멤버 추가
      for (const player of teamPlayers) {
        if (player.isGuest) {
          await c.env.DB.prepare(`
            INSERT INTO team_members (team_id, guest_name)
            VALUES (?, ?)
          `).bind(teamId, player.guestName).run()
        } else {
          await c.env.DB.prepare(`
            INSERT INTO team_members (team_id, player_id)
            VALUES (?, ?)
          `).bind(teamId, player.id).run()
        }
      }

      teamSummaries.push({
        name: teamNames[i],
        type: teamType,
        avgOverall: avgOverall.toFixed(1),
        playerCount: teamPlayers.length,
        keyPlayer: keyPlayer?.name || keyPlayer?.guestName,
      })
    }

    // 경기 일정 생성
    await createMatchSchedule(c.env.DB, Number(id), teamIds)

    return c.json({
      message: '🤖 AI 팀 편성이 완료되었습니다!',
      teamCount,
      teamIds,
      teams: teamSummaries,
      balanceScore: calculateBalanceScore(balancedTeams),
    })
  } catch (err: any) {
    console.error('Create teams error:', err)
    return c.json({ error: `팀 편성 실패: ${err?.message || String(err)}` }, 500)
  }
})

// 팀 편성 해체 (관리자)
sessionsRoutes.delete('/:id/teams', authMiddleware('ADMIN'), async (c) => {
  const id = c.req.param('id')

  try {
    // 기존 팀 조회
    const existingTeams = await c.env.DB.prepare(
      'SELECT id FROM teams WHERE session_id = ?'
    ).bind(id).all()

    if (!existingTeams.results || existingTeams.results.length === 0) {
      return c.json({ error: '해체할 팀이 없습니다.' }, 400)
    }

    // 경기 이벤트 삭제 (match_events → matches 외래키)
    const matches = await c.env.DB.prepare(
      'SELECT id FROM matches WHERE session_id = ?'
    ).bind(id).all()

    for (const match of (matches.results || [])) {
      await c.env.DB.prepare('DELETE FROM match_events WHERE match_id = ?').bind((match as any).id).run()
    }

    // 경기 일정 삭제
    await c.env.DB.prepare('DELETE FROM matches WHERE session_id = ?').bind(id).run()

    // 팀 멤버 삭제
    for (const team of existingTeams.results) {
      await c.env.DB.prepare('DELETE FROM team_members WHERE team_id = ?').bind((team as any).id).run()
    }

    // 팀 삭제
    await c.env.DB.prepare('DELETE FROM teams WHERE session_id = ?').bind(id).run()

    return c.json({ message: '팀 편성이 해체되었습니다.' })
  } catch (err: any) {
    console.error('Disband teams error:', err)
    return c.json({ error: `팀 해체 실패: ${err?.message || String(err)}` }, 500)
  }
})

// 수동 팀 생성 (카카오톡 파싱 결과)
sessionsRoutes.post('/:id/teams/manual', authMiddleware('ADMIN'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { teams: parsedTeams } = body

  if (!parsedTeams || parsedTeams.length === 0) {
    return c.json({ error: '팀 정보가 없습니다.' }, 400)
  }

  // 기존 팀 삭제
  const existingTeams = await c.env.DB.prepare(
    'SELECT id FROM teams WHERE session_id = ?'
  ).bind(id).all()

  for (const team of existingTeams.results) {
    await c.env.DB.prepare('DELETE FROM team_members WHERE team_id = ?').bind((team as any).id).run()
    await c.env.DB.prepare('DELETE FROM teams WHERE id = ?').bind((team as any).id).run()
  }

  // 기존 경기 삭제
  await c.env.DB.prepare('DELETE FROM matches WHERE session_id = ?').bind(id).run()

  const teamIds: number[] = []
  const teamEmojis: Record<string, string> = { yellow: '🟡', orange: '🟠', white: '⚪' }

  // 참석자도 함께 저장 (attendance 테이블)
  const now = Math.floor(Date.now() / 1000)
  await c.env.DB.prepare('DELETE FROM attendance WHERE session_id = ?').bind(id).run()

  for (let i = 0; i < parsedTeams.length; i++) {
    const team = parsedTeams[i]

    // 팀 생성
    const result = await c.env.DB.prepare(`
      INSERT INTO teams (session_id, name, vest_color, emoji)
      VALUES (?, ?, ?, ?)
    `).bind(
      id,
      team.name,
      team.color,
      teamEmojis[team.color] || '🟡'
    ).run()

    const teamId = result.meta.last_row_id as number
    teamIds.push(teamId)

    // 팀 멤버 추가
    for (const member of team.members) {
      if (member.playerId) {
        await c.env.DB.prepare(`
          INSERT INTO team_members (team_id, player_id)
          VALUES (?, ?)
        `).bind(teamId, member.playerId).run()

        // 참석자 등록
        await c.env.DB.prepare(`
          INSERT OR IGNORE INTO attendance (session_id, player_id, created_at)
          VALUES (?, ?, ?)
        `).bind(id, member.playerId, now).run()
      } else {
        await c.env.DB.prepare(`
          INSERT INTO team_members (team_id, guest_name)
          VALUES (?, ?)
        `).bind(teamId, member.name).run()

        // 용병 참석자 등록
        await c.env.DB.prepare(`
          INSERT INTO attendance (session_id, guest_name, created_at)
          VALUES (?, ?, ?)
        `).bind(id, member.name, now).run()
      }
    }
  }

  // 경기 일정 생성
  await createMatchSchedule(c.env.DB, Number(id), teamIds)

  return c.json({
    message: '팀이 생성되었습니다!',
    teamCount: teamIds.length,
    teamIds,
  })
})

// 팀 밸런스 점수 계산 (100점 만점)
function calculateBalanceScore(teams: any[][]): number {
  if (teams.length < 2) return 100

  const teamOveralls = teams.map(team =>
    team.length > 0
      ? team.reduce((sum, p) => sum + calculateOverall(p), 0) / team.length
      : 0
  )

  const maxDiff = Math.max(...teamOveralls) - Math.min(...teamOveralls)
  // 차이가 0이면 100점, 차이가 2점이면 0점
  return Math.max(0, Math.round((1 - maxDiff / 2) * 100))
}

// 경기 일정 생성 헬퍼
async function createMatchSchedule(db: D1Database, sessionId: number, teamIds: number[]) {
  // 기존 경기 삭제
  await db.prepare('DELETE FROM matches WHERE session_id = ?').bind(sessionId).run()

  const now = Math.floor(Date.now() / 1000)

  if (teamIds.length === 2) {
    // 2팀: 단순 대결 (여러 경기)
    for (let i = 1; i <= 6; i++) {
      const [team1, team2] = i % 2 === 1 ? [teamIds[0], teamIds[1]] : [teamIds[1], teamIds[0]]
      await db.prepare(`
        INSERT INTO matches (session_id, match_no, team1_id, team2_id, played_at, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `).bind(sessionId, i, team1, team2, now).run()
    }
  } else if (teamIds.length === 3) {
    // 3팀: 라운드 로빈 3회 = 9경기
    // AB, CA, BC, AB, CA, BC, AB, CA, BC
    const matchups = [
      [0, 1], [2, 0], [1, 2], // 1라운드
      [0, 1], [2, 0], [1, 2], // 2라운드
      [0, 1], [2, 0], [1, 2], // 3라운드
    ]

    for (let i = 0; i < matchups.length; i++) {
      const [t1, t2] = matchups[i]
      await db.prepare(`
        INSERT INTO matches (session_id, match_no, team1_id, team2_id, played_at, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `).bind(sessionId, i + 1, teamIds[t1], teamIds[t2], now).run()
    }
  }
}

// 카카오톡 파싱 헬퍼
function parseKakaoVote(lines: string[]): { date: string | null; names: string[] } {
  let date: string | null = null
  const rawNames: string[] = []

  for (const line of lines) {
    // 날짜 추출 (예: 2/11(수))
    const dateMatch = line.match(/(\d{1,2})\/(\d{1,2})/)
    if (dateMatch) {
      const month = dateMatch[1].padStart(2, '0')
      const day = dateMatch[2].padStart(2, '0')
      const year = new Date().getFullYear()
      date = `${year}-${month}-${day}`
    }

    // 정확히 2글자인 단어만 이름으로 파싱 (날짜·인원수 등 자동 제외됨)
    const words = line.split(/\s+/).filter(Boolean)
    for (const word of words) {
      if (word.length !== 2) continue
      if (/\d/.test(word)) continue  // 숫자 포함 스킵
      rawNames.push(word)
    }
  }

  // 중복 이름 처리: 상훈→상훈, 상훈→상훈용병, 상훈→상훈용병2 ...
  const names: string[] = []
  const seenCounts = new Map<string, number>()

  for (const name of rawNames) {
    const seen = seenCounts.get(name) || 0
    if (seen === 0) {
      names.push(name)
    } else if (seen === 1) {
      names.push(`${name}용병`)
    } else {
      names.push(`${name}용병${seen}`)
    }
    seenCounts.set(name, seen + 1)
  }

  return { date, names }
}

// 정산 정보 조회
sessionsRoutes.get('/:id/settlement', async (c) => {
  const id = c.req.param('id')

  // 세션 정보
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ?'
  ).bind(id).first()

  if (!session) {
    return c.json({ error: '세션을 찾을 수 없습니다.' }, 404)
  }

  // 정산 정보 조회
  const settlement = await c.env.DB.prepare(
    'SELECT * FROM settlements WHERE session_id = ?'
  ).bind(id).first()

  // 정산 상세 조회 (팀별, 개인별)
  let details: any[] = []
  if (settlement) {
    const teamSettlements = await c.env.DB.prepare(`
      SELECT ts.*, t.name as team_name
      FROM team_settlements ts
      JOIN teams t ON ts.team_id = t.id
      WHERE ts.settlement_id = ?
      ORDER BY ts.rank
    `).bind(settlement.id).all()

    const playerSettlements = await c.env.DB.prepare(`
      SELECT ps.*, p.name as player_name
      FROM player_settlements ps
      JOIN players p ON ps.player_id = p.id
      WHERE ps.settlement_id = ?
    `).bind(settlement.id).all()

    details = {
      teams: teamSettlements.results,
      players: playerSettlements.results,
    }
  }

  return c.json({
    session,
    settlement,
    details,
  })
})

// 정산 완료 (관리자)
sessionsRoutes.post('/:id/settlement', authMiddleware('ADMIN'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { baseFee, totalPot, prizeDistribution, teamResults, mvp } = body

  const now = Math.floor(Date.now() / 1000)

  // 기존 정산 삭제
  const existingSettlement = await c.env.DB.prepare(
    'SELECT id FROM settlements WHERE session_id = ?'
  ).bind(id).first()

  if (existingSettlement) {
    await c.env.DB.prepare('DELETE FROM player_settlements WHERE settlement_id = ?')
      .bind(existingSettlement.id).run()
    await c.env.DB.prepare('DELETE FROM team_settlements WHERE settlement_id = ?')
      .bind(existingSettlement.id).run()
    await c.env.DB.prepare('DELETE FROM settlements WHERE id = ?')
      .bind(existingSettlement.id).run()
  }

  // 정산 생성
  const settlementResult = await c.env.DB.prepare(`
    INSERT INTO settlements (session_id, base_fee, total_pot, operation_fee, status, created_at)
    VALUES (?, ?, ?, ?, 'completed', ?)
  `).bind(
    id,
    baseFee,
    totalPot,
    prizeDistribution?.operations || Math.floor(totalPot * 0.15),
    now
  ).run()

  const settlementId = settlementResult.meta.last_row_id

  // 팀별 정산 저장
  for (const team of teamResults) {
    await c.env.DB.prepare(`
      INSERT INTO team_settlements (settlement_id, team_id, rank, prize_amount, per_person)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      settlementId,
      team.teamId,
      team.rank,
      team.prizeAmount,
      team.perPerson
    ).run()
  }

  // MVP 정산 저장
  if (mvp?.playerId) {
    await c.env.DB.prepare(`
      INSERT INTO player_settlements (settlement_id, player_id, prize_type, prize_amount)
      VALUES (?, ?, 'mvp', ?)
    `).bind(settlementId, mvp.playerId, mvp.prizeAmount).run()

    // session_mvp_results에도 저장 (기존 결과 삭제 후)
    await c.env.DB.prepare(
      'DELETE FROM session_mvp_results WHERE session_id = ?'
    ).bind(id).run()

    await c.env.DB.prepare(`
      INSERT INTO session_mvp_results (session_id, player_id, vote_count, decided_at)
      VALUES (?, ?, 0, ?)
    `).bind(id, mvp.playerId, now).run()
  }

  // 세션 상태 업데이트
  await c.env.DB.prepare(
    'UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?'
  ).bind('completed', now, id).run()

  return c.json({
    message: '정산이 완료되었습니다.',
    settlementId,
  })
})

// ===== MVP 투표 API =====

// MVP 투표 현황 조회
sessionsRoutes.get('/:id/mvp-votes', async (c) => {
  const id = c.req.param('id')

  // 세션 확인
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ?'
  ).bind(id).first()

  if (!session) {
    return c.json({ error: '세션을 찾을 수 없습니다.' }, 404)
  }

  // 투표 집계
  const voteResults = await c.env.DB.prepare(`
    SELECT
      v.voted_player_id,
      p.name as player_name,
      p.photo_url,
      COUNT(*) as vote_count
    FROM session_mvp_votes v
    JOIN players p ON v.voted_player_id = p.id
    WHERE v.session_id = ?
    GROUP BY v.voted_player_id
    ORDER BY vote_count DESC
  `).bind(id).all()

  // 총 투표수
  const totalVotes = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM session_mvp_votes WHERE session_id = ?
  `).bind(id).first()

  // MVP 결과 (이미 확정된 경우)
  const mvpResult = await c.env.DB.prepare(`
    SELECT r.*, p.name as player_name, p.photo_url
    FROM session_mvp_results r
    JOIN players p ON r.player_id = p.id
    WHERE r.session_id = ?
  `).bind(id).first()

  return c.json({
    votes: voteResults.results,
    totalVotes: (totalVotes as any)?.count || 0,
    mvpResult,
    isVotingClosed: !!(session as any).status === 'completed' || !!mvpResult,
  })
})

// MVP 투표하기 (로그인 필수)
sessionsRoutes.post('/:id/mvp-votes', authMiddleware(), async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')
  const body = await c.req.json()
  const { playerId } = body

  if (!playerId) {
    return c.json({ error: '투표할 선수를 선택해주세요.' }, 400)
  }

  // 세션 확인
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ?'
  ).bind(id).first()

  if (!session) {
    return c.json({ error: '세션을 찾을 수 없습니다.' }, 404)
  }

  // 이미 MVP 결정됐는지 확인
  const existingResult = await c.env.DB.prepare(
    'SELECT id FROM session_mvp_results WHERE session_id = ?'
  ).bind(id).first()

  if (existingResult) {
    return c.json({ error: 'MVP가 이미 결정되었습니다.' }, 400)
  }

  // 투표할 선수가 해당 세션에 참석했는지 확인
  const attendance = await c.env.DB.prepare(`
    SELECT id FROM attendance WHERE session_id = ? AND player_id = ?
  `).bind(id, playerId).first()

  if (!attendance) {
    return c.json({ error: '해당 세션에 참석한 선수만 투표할 수 있습니다.' }, 400)
  }

  // 기존 투표 확인 (중복 투표 방지 또는 변경)
  const existingVote = await c.env.DB.prepare(`
    SELECT id FROM session_mvp_votes WHERE session_id = ? AND voter_user_id = ?
  `).bind(id, userId).first()

  const now = Math.floor(Date.now() / 1000)

  if (existingVote) {
    // 기존 투표 수정
    await c.env.DB.prepare(`
      UPDATE session_mvp_votes SET voted_player_id = ?, created_at = ?
      WHERE id = ?
    `).bind(playerId, now, existingVote.id).run()

    return c.json({ message: '투표가 변경되었습니다.' })
  } else {
    // 새 투표
    await c.env.DB.prepare(`
      INSERT INTO session_mvp_votes (session_id, voter_user_id, voted_player_id, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(id, userId, playerId, now).run()

    return c.json({ message: '투표가 완료되었습니다.' })
  }
})

// 내 투표 확인
sessionsRoutes.get('/:id/mvp-votes/me', authMiddleware(), async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')

  const myVote = await c.env.DB.prepare(`
    SELECT v.*, p.name as player_name
    FROM session_mvp_votes v
    JOIN players p ON v.voted_player_id = p.id
    WHERE v.session_id = ? AND v.voter_user_id = ?
  `).bind(id, userId).first()

  return c.json({ myVote })
})

// MVP 확정하기 (관리자)
sessionsRoutes.post('/:id/mvp-result', authMiddleware('ADMIN'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { playerId, voteCount } = body

  if (!playerId) {
    return c.json({ error: 'MVP 선수를 지정해주세요.' }, 400)
  }

  // 기존 결과 확인
  const existingResult = await c.env.DB.prepare(
    'SELECT id FROM session_mvp_results WHERE session_id = ?'
  ).bind(id).first()

  if (existingResult) {
    return c.json({ error: 'MVP가 이미 결정되었습니다.' }, 400)
  }

  const now = Math.floor(Date.now() / 1000)

  // MVP 결과 저장
  await c.env.DB.prepare(`
    INSERT INTO session_mvp_results (session_id, player_id, vote_count, decided_at)
    VALUES (?, ?, ?, ?)
  `).bind(id, playerId, voteCount || 0, now).run()

  // 선수 이름 가져오기
  const player = await c.env.DB.prepare(
    'SELECT name FROM players WHERE id = ?'
  ).bind(playerId).first()

  return c.json({
    message: `${(player as any)?.name || '선수'}님이 MVP로 선정되었습니다!`,
    playerId,
    playerName: (player as any)?.name,
  })
})

// ===== AI 팀 분석 API =====

// AI 팀 분석 (Gemini)
// AI 분석 결과 조회 (모든 사용자)
sessionsRoutes.get('/:id/ai-analysis', async (c) => {
  const id = c.req.param('id')

  // 팀 조회 (저장된 분석 결과 포함)
  const teams = await c.env.DB.prepare(
    'SELECT * FROM teams WHERE session_id = ? ORDER BY id'
  ).bind(id).all()

  if (!teams.results || teams.results.length === 0) {
    return c.json({ analysis: [], hasAnalysis: false })
  }

  // 멤버 정보와 능력치도 함께 조회
  const teamsWithMembers = await Promise.all(
    teams.results.map(async (team: any) => {
      const members = await c.env.DB.prepare(`
        SELECT tm.*, p.name, p.nickname, p.shooting, p.offball_run, p.ball_keeping,
               p.passing, p.linkup, p.intercept, p.marking, p.stamina, p.speed, p.physical
        FROM team_members tm
        LEFT JOIN players p ON tm.player_id = p.id
        WHERE tm.team_id = ?
      `).bind(team.id).all()

      const membersWithOverall = members.results.map((m: any) => {
        if (m.player_id) {
          const overall = calculateOverall(m)
          const role = calculateRole(m)
          return { name: m.name || m.nickname, overall: overall.toFixed(1), attack: role.attack.toFixed(1), defense: role.defense.toFixed(1), isGuest: false }
        }
        return { name: m.guest_name, overall: '5.0', attack: '5.0', defense: '5.0', isGuest: true }
      })

      const avgOverall = membersWithOverall.length > 0 ? membersWithOverall.reduce((sum: number, m: any) => sum + parseFloat(m.overall), 0) / membersWithOverall.length : 0
      const avgAttack = membersWithOverall.length > 0 ? membersWithOverall.reduce((sum: number, m: any) => sum + parseFloat(m.attack), 0) / membersWithOverall.length : 0
      const avgDefense = membersWithOverall.length > 0 ? membersWithOverall.reduce((sum: number, m: any) => sum + parseFloat(m.defense), 0) / membersWithOverall.length : 0

      // score_stats JSON 파싱
      let scoreStats: any = null
      try { scoreStats = team.score_stats ? JSON.parse(team.score_stats) : null } catch { }

      return {
        teamName: team.name,
        color: team.vest_color,
        type: scoreStats?.type || team.type || '밸런스형',
        avgOverall: avgOverall.toFixed(1),
        avgAttack: avgAttack.toFixed(1),
        avgDefense: avgDefense.toFixed(1),
        keyPlayer: scoreStats?.keyPlayer || team.key_player || null,
        keyPlayerReason: scoreStats?.keyPlayerReason || team.key_player_reason || null,
        aiStrategy: scoreStats?.aiStrategy || team.strategy || null,
        watchOut: scoreStats?.watchOut || null,
      }
    })
  )

  const hasAnalysis = teamsWithMembers.some(t => t.aiStrategy || t.watchOut)

  return c.json({ analysis: teamsWithMembers, hasAnalysis })
})

// AI 팀 분석 실행 (관리자 전용 - Gemini API 비용 발생)
sessionsRoutes.post('/:id/ai-analysis', authMiddleware('ADMIN'), async (c) => {
  const id = c.req.param('id')

  // 팀 조회
  const teams = await c.env.DB.prepare(
    'SELECT * FROM teams WHERE session_id = ? ORDER BY id'
  ).bind(id).all()

  if (!teams.results || teams.results.length === 0) {
    return c.json({ error: '팀 정보가 없습니다.' }, 400)
  }

  // 팀별 멤버 및 능력치 조회
  const teamsWithStats = await Promise.all(
    teams.results.map(async (team: any) => {
      const members = await c.env.DB.prepare(`
        SELECT tm.*, p.name, p.nickname, p.shooting, p.offball_run, p.ball_keeping,
               p.passing, p.linkup, p.intercept, p.marking, p.stamina, p.speed, p.physical
        FROM team_members tm
        LEFT JOIN players p ON tm.player_id = p.id
        WHERE tm.team_id = ?
      `).bind(team.id).all()

      const membersWithOverall = members.results.map((m: any) => {
        if (m.player_id) {
          const overall = calculateOverall(m)
          const role = calculateRole(m)
          return {
            name: m.name || m.nickname,
            overall: overall.toFixed(1),
            attack: role.attack.toFixed(1),
            defense: role.defense.toFixed(1),
            isGuest: false,
          }
        }
        return {
          name: m.guest_name,
          overall: '5.0',
          attack: '5.0',
          defense: '5.0',
          isGuest: true,
        }
      })

      const avgOverall = membersWithOverall.length > 0
        ? membersWithOverall.reduce((sum: number, m: any) => sum + parseFloat(m.overall), 0) / membersWithOverall.length
        : 0

      const avgAttack = membersWithOverall.length > 0
        ? membersWithOverall.reduce((sum: number, m: any) => sum + parseFloat(m.attack), 0) / membersWithOverall.length
        : 0

      const avgDefense = membersWithOverall.length > 0
        ? membersWithOverall.reduce((sum: number, m: any) => sum + parseFloat(m.defense), 0) / membersWithOverall.length
        : 0

      return {
        name: team.name,
        color: team.vest_color,
        members: membersWithOverall,
        avgOverall: avgOverall.toFixed(1),
        avgAttack: avgAttack.toFixed(1),
        avgDefense: avgDefense.toFixed(1),
      }
    })
  )

  // Gemini API 키 확인
  const apiKey = c.env.GEMINI_API_KEY
  if (!apiKey) {
    // API 키 없으면 기본 분석 반환
    return c.json({
      analysis: teamsWithStats.map(team => ({
        teamName: team.name,
        color: team.color,
        type: parseFloat(team.avgAttack) > parseFloat(team.avgDefense) + 0.5 ? '공격형'
          : parseFloat(team.avgDefense) > parseFloat(team.avgAttack) + 0.5 ? '수비형'
            : '밸런스형',
        avgOverall: team.avgOverall,
        avgAttack: team.avgAttack,
        avgDefense: team.avgDefense,
        members: team.members,
        aiStrategy: null,
        keyPlayer: team.members.reduce((best: any, m: any) =>
          parseFloat(m.overall) > parseFloat(best?.overall || '0') ? m : best, null
        )?.name || null,
      })),
      isAiGenerated: false,
    })
  }

  // Gemini API 호출
  try {
    // 총 인원 수 계산
    const totalPlayers = teamsWithStats.reduce((sum, team) => sum + team.members.length, 0)

    // 경기 형식 결정
    let matchFormat = ''
    if (totalPlayers >= 18) {
      matchFormat = '6:6 순환 경기 (3팀)'
    } else if (totalPlayers >= 15) {
      matchFormat = '5:5 또는 6:6 순환 경기 (3팀, 키퍼 지원 가능)'
    } else if (totalPlayers >= 12) {
      matchFormat = '6:6 경기'
    } else if (totalPlayers >= 10) {
      matchFormat = '5:5 경기'
    } else {
      matchFormat = '소규모 경기'
    }

    const prompt = `당신은 10년 경력의 풋살 전문 감독입니다. 아래 팀 구성을 분석하고 실전에서 바로 적용 가능한 구체적인 전술을 제안해주세요.

## 경기 규칙
- 경기 형식: ${matchFormat}
- 선수 교체 없음 (풀타임 뛰어야 함)
- 3팀 순환전일 경우 한 팀이 쉬는 동안 체력 회복
- 능력치는 0~100점 기준 (70점 이상이면 상위권, 80점 이상이면 최상위권)

## 팀별 전력 분석
${teamsWithStats.map(team => {
      const regularMembers = team.members.filter((m: any) => !m.isGuest)
      const guestMembers = team.members.filter((m: any) => m.isGuest)
      const regularList = regularMembers.map((m: any) => m.name + '(종합:' + m.overall + ', 공격:' + m.attack + ', 수비:' + m.defense + ')').join(', ') || '없음'
      const guestList = guestMembers.map((m: any) => m.name).join(', ') || '없음'
      const colorName = team.color === 'yellow' ? '노랑' : team.color === 'orange' ? '주황' : '하양'
      return '### ' + team.name + ' (' + colorName + ' 조끼)\n' +
        '- 인원: ' + team.members.length + '명 (정규 ' + regularMembers.length + '명, 용병 ' + guestMembers.length + '명)\n' +
        '- 팀 평균 - 종합: ' + team.avgOverall + '점 / 공격: ' + team.avgAttack + '점 / 수비: ' + team.avgDefense + '점\n' +
        '- 정규 선수 상세: ' + regularList + '\n' +
        '- 용병: ' + guestList + ' (능력치 미상, 변수 요소)'
    }).join('\n\n')}

## 분석 요청사항
1. **핵심 선수**: 정규 선수 중 가장 임팩트 있는 선수 1명과 그 이유
2. **팀 스타일**: 공격/수비/밸런스 중 하나와 구체적 근거
3. **추천 전술**: 해당 팀의 장점을 살리는 구체적인 공격/수비 전술
4. **주의 상대**: 가장 경계해야 할 상대팀과 그 이유
5. **승리 키포인트**: 이 팀이 우승하려면 반드시 해야 할 것

JSON 형식으로만 응답 (다른 텍스트 없이):
{
  "teams": [
    {
      "name": "팀명",
      "type": "공격형/수비형/밸런스형",
      "keyPlayer": "선수명",
      "keyPlayerReason": "핵심 선수 선정 이유 (구체적으로, 30자)",
      "strategy": "추천 전술 (구체적인 플레이 방식, 80자)",
      "watchOut": "주의해야 할 상대팀명과 이유 (40자)"
    }
  ]
}`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('Gemini API error:', response.status, errorBody)
      throw new Error(`Gemini API 호출 실패: ${response.status}`)
    }

    const geminiResult = await response.json() as any
    const textContent = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || ''
    console.log('Gemini raw response:', textContent.substring(0, 500))

    // JSON 파싱 (코드블록 마크다운 제거)
    let cleanedText = textContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
    let aiAnalysis = null

    if (jsonMatch) {
      try {
        aiAnalysis = JSON.parse(jsonMatch[0])
        console.log('Parsed AI analysis:', JSON.stringify(aiAnalysis).substring(0, 500))
      } catch (parseErr) {
        console.error('JSON parse error, attempting truncated JSON fix:', parseErr)
        // truncated JSON 복구 시도: 잘린 JSON의 열린 괄호를 닫아줌
        try {
          let truncated = jsonMatch[0]
          // 문자열이 열려있으면 닫기
          const quoteCount = (truncated.match(/(?<!\\)"/g) || []).length
          if (quoteCount % 2 !== 0) truncated += '"'
          // 열린 배열/객체 닫기
          const openBrackets = (truncated.match(/\[/g) || []).length - (truncated.match(/\]/g) || []).length
          const openBraces = (truncated.match(/\{/g) || []).length - (truncated.match(/\}/g) || []).length
          for (let i = 0; i < openBrackets; i++) truncated += ']'
          for (let i = 0; i < openBraces; i++) truncated += '}'
          aiAnalysis = JSON.parse(truncated)
          console.log('Truncated JSON recovery succeeded')
        } catch (retryErr) {
          console.error('Truncated JSON recovery also failed:', retryErr)
        }
      }
    } else {
      console.error('No JSON found in Gemini response:', textContent.substring(0, 300))
    }

    // Gemini가 배열로 직접 반환할 수도 있음 (teams 없이)
    let teamsArray = aiAnalysis?.teams || (Array.isArray(aiAnalysis) ? aiAnalysis : null)

    // 결과 조합 + DB 저장
    const analysis = await Promise.all(teamsWithStats.map(async (team, index) => {
      const aiTeam = teamsArray?.find((t: any) => t.name === team.name) || teamsArray?.[index]
      const teamType = aiTeam?.type || (parseFloat(team.avgAttack) > parseFloat(team.avgDefense) + 0.5 ? '공격형'
        : parseFloat(team.avgDefense) > parseFloat(team.avgAttack) + 0.5 ? '수비형' : '밸런스형')

      const result = {
        teamName: team.name,
        color: team.color,
        type: teamType,
        avgOverall: team.avgOverall,
        avgAttack: team.avgAttack,
        avgDefense: team.avgDefense,
        members: team.members,
        keyPlayer: aiTeam?.keyPlayer || null,
        keyPlayerReason: aiTeam?.keyPlayerReason || null,
        aiStrategy: aiTeam?.strategy || null,
        watchOut: aiTeam?.watchOut || null,
      }

      // DB에 저장 (teams 테이블 업데이트)
      const teamRecord = teams.results[index] as any
      if (teamRecord) {
        const scoreStats = JSON.stringify({
          type: teamType,
          keyPlayer: result.keyPlayer,
          keyPlayerReason: result.keyPlayerReason,
          aiStrategy: result.aiStrategy,
          watchOut: result.watchOut,
          avgOverall: result.avgOverall,
          avgAttack: result.avgAttack,
          avgDefense: result.avgDefense,
          analyzedAt: Math.floor(Date.now() / 1000),
        })
        await c.env.DB.prepare(`
          UPDATE teams SET type = ?, strategy = ?, key_player = ?, key_player_reason = ?, score_stats = ?
          WHERE id = ?
        `).bind(
          teamType,
          result.aiStrategy,
          result.keyPlayer,
          result.keyPlayerReason,
          scoreStats,
          teamRecord.id
        ).run()
      }

      return result
    }))

    return c.json({ analysis, isAiGenerated: true })
  } catch (err: any) {
    const errorMsg = err?.message || String(err)
    console.error('AI analysis error:', errorMsg)

    // 에러 시 에러 메시지 포함하여 기본 분석 반환
    return c.json({
      analysis: teamsWithStats.map(team => ({
        teamName: team.name,
        color: team.color,
        type: parseFloat(team.avgAttack) > parseFloat(team.avgDefense) + 0.5 ? '공격형'
          : parseFloat(team.avgDefense) > parseFloat(team.avgAttack) + 0.5 ? '수비형'
            : '밸런스형',
        avgOverall: team.avgOverall,
        avgAttack: team.avgAttack,
        avgDefense: team.avgDefense,
        members: team.members,
        aiStrategy: null,
        keyPlayer: team.members.reduce((best: any, m: any) =>
          parseFloat(m.overall) > parseFloat(best?.overall || '0') ? m : best, null
        )?.name || null,
      })),
      isAiGenerated: false,
      error: `Gemini API 실패: ${errorMsg}`,
    })
  }
})

export { sessionsRoutes }
