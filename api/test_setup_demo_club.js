const BASE = 'https://cornerkicks-api.conerkicks.workers.dev'

async function api(path, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : null,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data)}`)
  return data
}

async function main() {
  const ADMIN_EMAIL = 'demo_admin@cornerkicks.test'
  const ADMIN_PW = 'DemoAdmin123!'
  const ADMIN_UN = 'demo_admin'
  const M1_EMAIL = 'demo_member1@cornerkicks.test'
  const M1_PW = 'DemoMember123!'
  const M1_UN = 'demo_member1'
  const M2_EMAIL = 'demo_member2@cornerkicks.test'
  const M2_PW = 'DemoMember123!'
  const M2_UN = 'demo_member2'
  const M3_EMAIL = 'demo_member3@cornerkicks.test'
  const M3_PW = 'DemoMember123!'
  const M3_UN = 'demo_member3'

  // 1. 유저 생성 / 로그인
  console.log('\n--- 1. 유저 생성 ---')
  const users = [
    [ADMIN_EMAIL, ADMIN_UN, ADMIN_PW, 'admin'],
    [M1_EMAIL, M1_UN, M1_PW, 'member1'],
    [M2_EMAIL, M2_UN, M2_PW, 'member2'],
    [M3_EMAIL, M3_UN, M3_PW, 'member3'],
  ]
  const tokens = {}
  for (const [email, username, pw, key] of users) {
    try {
      const r = await api('/auth/register', 'POST', { email, username, password: pw })
      tokens[key] = r.token
      console.log('created:', username)
    } catch {
      const r = await api('/auth/login', 'POST', { identifier: email, password: pw })
      tokens[key] = r.token
      console.log('logged in:', username)
    }
  }

  // 2. 클럽 생성
  console.log('\n--- 2. 클럽 생성 ---')
  let club, inviteCode
  try {
    const r = await api('/clubs', 'POST', {
      slug: 'demo-fc',
      name: '데모 FC',
      description: '테스트용 풋살 클럽',
      enabledEvents: ['GOAL', 'SAVE', 'SHOT', 'KEY_PASS'],
    }, tokens.admin)
    club = r.club
    inviteCode = r.club.inviteCode
    console.log('클럽 생성:', club.name, '초대코드:', inviteCode)
  } catch (e) {
    console.log('클럽 생성 실패:', e.message)
    const r = await api('/clubs/me', 'GET', null, tokens.admin)
    club = r.club
    inviteCode = r.club.inviteCode
    console.log('기존 클럽:', club.name, '초대코드:', inviteCode)
  }

  // 클럽 생성/가입 후 admin 재로그인 (JWT에 clubId/clubRole 갱신)
  const relogin = await api('/auth/login', 'POST', { identifier: ADMIN_EMAIL, password: ADMIN_PW })
  tokens.admin = relogin.token
  console.log('관리자 재로그인 (JWT 갱신)')

  // 3. 멤버 클럽 가입
  console.log('\n--- 3. 클럽 가입 ---')
  const memberCredentials = [
    ['member1', M1_EMAIL, M1_PW],
    ['member2', M2_EMAIL, M2_PW],
    ['member3', M3_EMAIL, M3_PW],
  ]
  for (const [key, email, pw] of memberCredentials) {
    try {
      await api('/clubs/join', 'POST', { inviteCode }, tokens[key])
      console.log(key, '가입 완료')
    } catch {
      console.log(key, '이미 가입됨')
    }
    // 재로그인으로 JWT 갱신
    const r = await api('/auth/login', 'POST', { identifier: email, password: pw })
    tokens[key] = r.token
  }

  // 4. 회비 설정
  await api('/clubs/me/fee-config', 'PUT', {
    feeConfig: {
      sessionFee: { enabled: true, model: 'result_based', baseAmount: 6000, winDiscount: 1500, place2Discount: 500 },
      membershipFee: { enabled: false, type: 'monthly', amount: 0 },
      joiningFee: { enabled: false, amount: 0 },
    }
  }, tokens.admin)
  console.log('회비 설정 완료')

  // 5. 선수 등록
  console.log('\n--- 4. 선수 등록 ---')
  // 이미 있는 선수 이름 조회
  const existingPlayersList = await api('/players', 'GET', null, tokens.admin)
  const existingNames = new Set((existingPlayersList.players || []).filter(p => p.club_id === club.id).map(p => p.name))

  const playerDefs = [
    { name: '김관리', nickname: '에이스', position: 'FW' },
    { name: '이멤버', nickname: '미들킹', position: 'MF' },
    { name: '박멤버', nickname: '철벽', position: 'DF' },
    { name: '최멤버', nickname: '철문', position: 'GK' },
  ]
  for (const p of playerDefs) {
    if (existingNames.has(p.name)) { console.log('선수 기존 존재:', p.name); continue }
    try {
      const r = await api('/players', 'POST', p, tokens.admin)
      console.log('선수 생성:', p.name, 'id:', r.id ?? r.playerId)
    } catch (e) {
      console.log('선수 생성 실패:', p.name, e.message.substring(0, 80))
    }
  }

  const playersList = await api('/players', 'GET', null, tokens.admin)
  // 중복 제거: 이름 기준 첫 번째만 사용
  const allPlayers = (playersList.players || []).filter(p => p.club_id === club.id)
  const seen = new Set()
  const players = allPlayers.filter(p => { if (seen.has(p.name)) return false; seen.add(p.name); return true })
  console.log('선수 목록:', players.map(p => `${p.name}(${p.id})`).join(', '))

  if (players.length < 2) {
    console.log('선수 부족으로 세션 테스트 스킵')
    printSummary(ADMIN_EMAIL, ADMIN_PW, M1_EMAIL, M1_PW, M2_EMAIL, M2_PW, M3_EMAIL, M3_PW, inviteCode)
    return
  }

  // 6. 세션 생성
  console.log('\n--- 5. 세션 생성 ---')
  const fmt = d => d.toISOString().split('T')[0]
  const today = new Date()
  const d14 = new Date(today); d14.setDate(today.getDate() - 14)
  const d7  = new Date(today); d7.setDate(today.getDate() - 7)
  const d3  = new Date(today); d3.setDate(today.getDate() - 3)
  const d7f = new Date(today); d7f.setDate(today.getDate() + 7)

  // 세션A: 2주 전 - 정산완료 시나리오
  const sA = await api('/sessions', 'POST', { sessionDate: fmt(d14), title: '[데모] 2주 전 정기 풋살' }, tokens.admin)
  await api(`/sessions/${sA.id}`, 'PUT', { startTime: '20:00', endTime: '22:00', location: '용인 실내풋살장', targetMembers: 4 }, tokens.admin)
  console.log('세션A 생성 (id:', sA.id, ') - 2주전, 정산완료 예정')

  // 세션B: 지난주 - 경기완료(납부 대기) 시나리오
  const sB = await api('/sessions', 'POST', { sessionDate: fmt(d7), title: '[데모] 지난주 정기 풋살' }, tokens.admin)
  await api(`/sessions/${sB.id}`, 'PUT', { startTime: '20:00', endTime: '22:00', location: '용인 실내풋살장', targetMembers: 4 }, tokens.admin)
  console.log('세션B 생성 (id:', sB.id, ') - 지난주, 경기완료 예정')

  // 세션C: 3일 전 - 마감 상태 (정산 예정)
  const sC = await api('/sessions', 'POST', { sessionDate: fmt(d3), title: '[데모] 3일 전 정기 풋살' }, tokens.admin)
  await api(`/sessions/${sC.id}`, 'PUT', { startTime: '20:00', endTime: '22:00', location: '용인 실내풋살장', targetMembers: 4, status: 'closed' }, tokens.admin)
  console.log('세션C 생성 (id:', sC.id, ') - 3일전, 마감')

  // 세션D: 다음주 - 모집중 (RSVP 대기)
  const sD = await api('/sessions', 'POST', { sessionDate: fmt(d7f), title: '[데모] 다음주 정기 풋살' }, tokens.admin)
  await api(`/sessions/${sD.id}`, 'PUT', { startTime: '20:00', endTime: '22:00', location: '용인 실내풋살장', targetMembers: 4 }, tokens.admin)
  console.log('세션D 생성 (id:', sD.id, ') - 다음주, 모집중')

  // 7. 팀 편성 (세션A, B, C)
  console.log('\n--- 6. 팀 편성 ---')
  const attendees = players.map(p => ({ playerId: p.id, name: p.name }))
  for (const [sid, label] of [[sA.id, 'A'], [sB.id, 'B'], [sC.id, 'C']]) {
    try {
      const r = await api(`/sessions/${sid}/teams`, 'POST', { attendees }, tokens.admin)
      console.log(`세션${label} 팀편성 완료: 팀수 ${r.teamCount}`)
    } catch (e) {
      console.log(`세션${label} 팀편성 오류: ${e.message}`)
    }
  }

  // 세션별 팀 조회 후 매치 & 이벤트
  console.log('\n--- 7. 매치 & 이벤트 ---')
  for (const [sid, label] of [[sA.id, 'A'], [sB.id, 'B']]) {
    try {
      const detail = await api(`/sessions/${sid}`, 'GET', null, tokens.admin)
      const teams = detail.teams || []
      if (teams.length < 2) { console.log(`세션${label} 팀 없음`); continue }

      const t1 = teams[0], t2 = teams[1]
      const t1players = (t1.players || []).map(p => p.id).filter(Boolean)
      const t2players = (t2.players || []).map(p => p.id).filter(Boolean)

      // 매치 생성
      let matchRes
      try {
        matchRes = await api(`/sessions/${sid}/matches`, 'POST', { team1Id: t1.id, team2Id: t2.id }, tokens.admin)
      } catch (e) {
        const ms = detail.matches || []
        matchRes = ms[0]
      }
      const matchId = matchRes?.id || matchRes?.matchId
      if (!matchId) { console.log(`세션${label} 매치ID 없음`); continue }

      // 이벤트
      if (t1players[0]) await api(`/matches/${matchId}/events`, 'POST', { eventType: 'GOAL', playerId: t1players[0], teamId: t1.id }, tokens.admin)
      if (t1players[0]) await api(`/matches/${matchId}/events`, 'POST', { eventType: 'GOAL', playerId: t1players[0], teamId: t1.id }, tokens.admin)
      if (t2players[0]) await api(`/matches/${matchId}/events`, 'POST', { eventType: 'GOAL', playerId: t2players[0], teamId: t2.id, assisterId: t1players[1] || null }, tokens.admin)
      await api(`/matches/${matchId}`, 'PUT', { status: 'completed', score1: 2, score2: 1 }, tokens.admin)
      console.log(`세션${label} 매치 완료 (2:1)`)
    } catch (e) {
      console.log(`세션${label} 매치 오류: ${e.message.substring(0, 100)}`)
    }
  }

  // 8. 정산 (세션A: 완전 정산 + 전원 납부, 세션B: 정산 후 일부만 납부)
  console.log('\n--- 8. 정산 ---')

  // 세션A 정산
  try {
    const detailA = await api(`/sessions/${sA.id}`, 'GET', null, tokens.admin)
    const teamsA = detailA.teams || []
    if (teamsA.length >= 2) {
      const r = await api(`/sessions/${sA.id}/settlement`, 'POST', {
        baseFee: 6000,
        totalPot: players.length * 6000,
        prizeDistribution: { operations: 0 },
        teamResults: [
          { teamId: teamsA[0].id, rank: 1, prizeAmount: 6000, perPerson: 1500 },
          { teamId: teamsA[1].id, rank: 2, prizeAmount: 2000, perPerson: 500 },
        ],
      }, tokens.admin)
      console.log('세션A 정산 완료, settlementId:', r.settlementId)

      // 전원 납부
      const pmts = await api(`/payments/sessions/${sA.id}`, 'GET', null, tokens.admin)
      for (const p of (pmts.payments || [])) {
        await api(`/payments/${p.id}/paid`, 'PUT', { paid: true }, tokens.admin)
      }
      console.log('세션A 전원 납부 처리 ->', (pmts.payments || []).length, '명')
    }
  } catch (e) {
    console.log('세션A 정산 오류:', e.message.substring(0, 100))
  }

  // 세션B 정산 + 일부만 납부 (마지막 한 명 미납)
  try {
    const detailB = await api(`/sessions/${sB.id}`, 'GET', null, tokens.admin)
    const teamsB = detailB.teams || []
    if (teamsB.length >= 2) {
      const r = await api(`/sessions/${sB.id}/settlement`, 'POST', {
        baseFee: 6000,
        totalPot: players.length * 6000,
        prizeDistribution: { operations: 0 },
        teamResults: [
          { teamId: teamsB[0].id, rank: 1, prizeAmount: 6000, perPerson: 1500 },
          { teamId: teamsB[1].id, rank: 2, prizeAmount: 2000, perPerson: 500 },
        ],
      }, tokens.admin)
      console.log('세션B 정산 완료, settlementId:', r.settlementId)

      // 첫 번째 제외 나머지만 납부
      const pmts = await api(`/payments/sessions/${sB.id}`, 'GET', null, tokens.admin)
      const list = pmts.payments || []
      for (let i = 0; i < list.length - 1; i++) {
        await api(`/payments/${list[i].id}/paid`, 'PUT', { paid: true }, tokens.admin)
      }
      console.log('세션B 납부 처리:', list.length - 1, '명 납부,', 1, '명 미납')
    }
  } catch (e) {
    console.log('세션B 정산 오류:', e.message.substring(0, 100))
  }

  // 세션D RSVP (다음주 - 3명만 참석 확정으로 목표 4명 미달 상태 유지)
  console.log('\n--- 9. RSVP ---')
  for (const [key, name] of [['admin', '관리자'], ['member1', '멤버1'], ['member2', '멤버2']]) {
    try {
      await api(`/sessions/${sD.id}/rsvp`, 'POST', { status: 'going' }, tokens[key])
      console.log(name, 'RSVP 참석')
    } catch (e) {
      console.log(name, 'RSVP 오류:', e.message.substring(0, 60))
    }
  }
  const rsvpStatus = await api(`/sessions/${sD.id}`, 'GET', null, tokens.admin)
  console.log('세션D RSVP 현황:', rsvpStatus.rsvpCount || rsvpStatus.rsvp_count, '명 / 4명')

  printSummary(ADMIN_EMAIL, ADMIN_PW, M1_EMAIL, M1_PW, M2_EMAIL, M2_PW, M3_EMAIL, M3_PW, inviteCode)
}

function printSummary(ae, ap, m1e, m1p, m2e, m2p, m3e, m3p, inv) {
  console.log(`
=========================================
           데모 클럽 세팅 완료
=========================================
클럽명  : 데모 FC
클럽ID  : demo-fc
초대코드: ${inv}

[관리자]
  이메일  : ${ae}
  비밀번호: ${ap}

[멤버1]
  이메일  : ${m1e}
  비밀번호: ${m1p}

[멤버2]
  이메일  : ${m2e}
  비밀번호: ${m2p}

[멤버3]
  이메일  : ${m3e}
  비밀번호: ${m3p}

[시나리오]
  세션A (2주전): 정산완료 (모두 납부)
  세션B (지난주): 경기완료, 1명 미납
  세션C (3일전): 마감 상태 (정산 예정)
  세션D (다음주): 모집중, 3/4명 RSVP
=========================================
  `)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
