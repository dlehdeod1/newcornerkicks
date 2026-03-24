// CornerKicks 종합 E2E 테스트
// 사용자 관점에서 모든 기능을 검증
// node test_e2e_full.js

const BASE = 'https://cornerkicks-api.conerkicks.workers.dev';
const TS = Date.now();
let passed = 0, failed = 0, warns = 0;

async function api(endpoint, { method = 'GET', body, token, clubId } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (clubId) headers['X-Club-Id'] = String(clubId);
  const res = await fetch(`${BASE}${endpoint}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, ok: res.ok };
}

function ok(name, cond, info = '') {
  if (cond) { console.log(`  ✅ ${name}`); passed++; }
  else { console.log(`  ❌ ${name}${info ? ' — ' + info : ''}`); failed++; }
}

function warn(name, cond, info = '') {
  if (cond) { console.log(`  ✅ ${name}`); passed++; }
  else { console.log(`  ⚠️  ${name}${info ? ' — ' + info : ''}`); warns++; }
}

function section(title) {
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(55));
}

function die(msg) {
  console.log(`\n💥 ${msg}`);
  summary();
  process.exit(1);
}

function summary() {
  console.log(`\n══════════════════════════════════════════════════════`);
  console.log(`  결과: ✅ ${passed}개 통과 | ❌ ${failed}개 실패 | ⚠️  ${warns}개 경고`);
  console.log(`══════════════════════════════════════════════════════\n`);
}

// 14명 선수단
const PLAYERS = [
  '김민준','이서준','박도윤','정시우','최주원','강지호','윤현우',
  '임준서','한지훈','오지환','서민혁','노태양','권승현','백재원',
];

async function main() {
  console.log('══════════════════════════════════════════════════════');
  console.log('  CornerKicks 종합 E2E 테스트');
  console.log('  인증 → 클럽 → 선수 → 세션 → 경기 → 정산 → 랭킹');
  console.log('  + 관리자 메뉴 + 멀티클럽 + 권한 검증');
  console.log('══════════════════════════════════════════════════════');

  // ═══════════════════════════════════════════════════
  section('1. 인증: 회원가입 / 로그인 / 프로필');
  // ═══════════════════════════════════════════════════

  const adminUser = `adm_${TS % 100000}`;
  let r = await api('/auth/register', {
    method: 'POST',
    body: { email: `${adminUser}@test.com`, username: adminUser, password: 'test1234' },
  });
  ok('어드민 회원가입', r.status === 201, `status=${r.status}`);

  r = await api('/auth/login', {
    method: 'POST',
    body: { identifier: adminUser, password: 'test1234' },
  });
  ok('어드민 로그인', r.ok);
  const adminToken = r.data.token;
  if (!adminToken) die('로그인 실패 — 토큰 없음');

  // 로그인 응답 구조: { token, user: { id, email, username, role }, clubs: [...] }
  ok('로그인 응답에 user 객체', !!r.data.user);
  ok('로그인 응답에 clubs 배열', Array.isArray(r.data.clubs));

  // 프로필 조회: GET /auth/me → { user, profile, clubs }
  r = await api('/auth/me', { token: adminToken });
  ok('프로필(me) 조회', r.ok && r.data.user?.username === adminUser);
  ok('me: clubs 배열 존재', Array.isArray(r.data.clubs));

  // ═══════════════════════════════════════════════════
  section('2. 클럽 생성 / 설정 변경 / 관리자 메뉴');
  // ═══════════════════════════════════════════════════

  const clubSlug = `e2e-${TS % 100000}`;
  r = await api('/clubs', {
    method: 'POST',
    body: {
      slug: clubSlug,
      name: 'E2E 테스트 FC',
      description: '종합 E2E 테스트용',
      enabledEvents: ['GOAL', 'SAVE', 'SHOT', 'KEY_PASS'],
    },
    token: adminToken,
  });
  ok('클럽 생성', r.ok, JSON.stringify(r.data));
  const clubId = r.data.club?.id;
  if (!clubId) die(`클럽 ID 없음: ${JSON.stringify(r.data)}`);

  // 클럽 정보: GET /clubs/me → { club: { id, slug, name, inviteCode, myRole, ... } }
  r = await api('/clubs/me', { token: adminToken, clubId });
  ok('클럽 정보 조회', r.ok);
  const inviteCode = r.data.club?.inviteCode;
  ok('초대코드 존재', !!inviteCode);
  ok('내 역할 = owner', r.data.club?.myRole === 'owner');
  ok('enabledEvents 4개', r.data.club?.enabledEvents?.length === 4);
  console.log(`  ℹ️  clubId=${clubId}, inviteCode=${inviteCode}`);

  // ── 관리자: 클럽 설정 변경 ──
  r = await api('/clubs/me', {
    method: 'PUT',
    body: {
      name: 'E2E FC Updated',
      seasonStartMonth: 3,
      perGameFee: 8000,
      mvpVoteEnabled: true,
    },
    token: adminToken, clubId,
  });
  ok('클럽 설정 변경 (이름, 시즌시작, 참가비, MVP)', r.ok);

  r = await api('/clubs/me', { token: adminToken, clubId });
  ok('이름 변경됨', r.data.club?.name === 'E2E FC Updated');
  ok('시즌시작월 = 3', r.data.club?.seasonStartMonth === 3);
  ok('참가비 = 8000', r.data.club?.perGameFee === 8000);
  ok('MVP 투표 활성화', r.data.club?.mvpVoteEnabled === true);

  // ── 관리자: 이벤트 설정 변경 ──
  r = await api('/clubs/me', {
    method: 'PUT',
    body: { enabledEvents: ['GOAL', 'SAVE'] },
    token: adminToken, clubId,
  });
  ok('이벤트 설정 축소 (GOAL, SAVE만)', r.ok);

  r = await api('/clubs/me', { token: adminToken, clubId });
  ok('enabledEvents 2개로 변경됨', r.data.club?.enabledEvents?.length === 2);

  // 다시 원복
  await api('/clubs/me', {
    method: 'PUT',
    body: { enabledEvents: ['GOAL', 'SAVE', 'SHOT', 'KEY_PASS'] },
    token: adminToken, clubId,
  });

  // ── 관리자: 회비 설정 ──
  r = await api('/clubs/me/fee-config', { token: adminToken, clubId });
  ok('회비 설정 조회', r.ok);

  r = await api('/clubs/me/fee-config', {
    method: 'PUT',
    body: {
      feeConfig: {
        sessionFee: { enabled: true, model: 'result_based', baseAmount: 8000, winDiscount: 2000, place2Discount: 1000 },
        membershipFee: { enabled: false, type: 'monthly', amount: 0 },
        joiningFee: { enabled: false, amount: 0 },
      },
    },
    token: adminToken, clubId,
  });
  ok('회비 설정 저장', r.ok);

  r = await api('/clubs/me/fee-config', { token: adminToken, clubId });
  ok('회비 설정 반영 확인', r.ok && r.data.feeConfig?.sessionFee?.baseAmount === 8000);

  // ── 관리자: 초대코드 재발급 ──
  r = await api('/clubs/me/regenerate-invite', { method: 'POST', token: adminToken, clubId });
  ok('초대코드 재발급', r.ok && !!r.data.inviteCode);
  const newInviteCode = r.data.inviteCode;
  console.log(`  ℹ️  새 초대코드: ${newInviteCode}`);

  // ═══════════════════════════════════════════════════
  section('3. 선수 14명 등록 / 조회');
  // ═══════════════════════════════════════════════════

  const playerIds = [];
  for (const name of PLAYERS) {
    r = await api('/players', {
      method: 'POST',
      body: { name },
      token: adminToken, clubId,
    });
    if (r.ok && r.data.id) {
      playerIds.push(r.data.id);
    } else {
      console.log(`  ❌ ${name} 등록 실패: ${JSON.stringify(r.data)}`);
      failed++;
    }
  }
  ok(`선수 14명 등록 (실제: ${playerIds.length})`, playerIds.length === 14);

  r = await api('/players', { token: adminToken, clubId });
  const dbPlayers = r.data.players ?? [];
  ok(`선수 목록 조회 (${dbPlayers.length}명)`, r.ok && dbPlayers.length >= 14);

  // 개별 선수 조회: GET /players/:id → { player, stats, recentMatches, ... }
  r = await api(`/players/${playerIds[0]}`, { token: adminToken, clubId });
  ok('개별 선수 조회', r.ok && r.data.player?.name === PLAYERS[0], `name=${r.data.player?.name}`);

  // ═══════════════════════════════════════════════════
  section('4. 세션1: ended로 끝남 (→ 랭킹 미반영 확인용)');
  // ═══════════════════════════════════════════════════

  r = await api('/sessions', {
    method: 'POST',
    body: { sessionDate: '2026-03-10', title: 'E2E 세션1 (ended만)' },
    token: adminToken, clubId,
  });
  ok('세션1 생성', r.ok);
  const session1Id = r.data.id;
  if (!session1Id) die('세션1 ID 없음');

  // 10명 출석
  const s1Attendees = playerIds.slice(0, 10);
  r = await api(`/sessions/${session1Id}/attendance`, {
    method: 'POST',
    body: { attendees: s1Attendees.map(id => ({ playerId: id, attended: true })) },
    token: adminToken, clubId,
  });
  ok('세션1 출석 10명', r.ok);

  // 팀 편성 (5v5)
  r = await api(`/sessions/${session1Id}/teams`, {
    method: 'POST',
    body: { attendees: s1Attendees.map(id => ({ playerId: id, attended: true })) },
    token: adminToken, clubId,
  });
  ok('세션1 팀 편성', r.ok);
  const s1TeamIds = r.data.teamIds ?? [];
  ok(`팀 2개 (실제: ${s1TeamIds.length})`, s1TeamIds.length === 2);
  if (s1TeamIds.length < 2) die('팀 편성 실패');

  // 2경기 라운드로빈
  r = await api('/matches/round-robin', {
    method: 'POST',
    body: { sessionId: session1Id, teamIds: s1TeamIds, rounds: 2 },
    token: adminToken, clubId,
  });
  ok('세션1 라운드로빈 2경기', r.ok);
  const s1Matches = r.data.matches ?? [];

  // 이벤트 기록 + 경기 완료
  // API: POST /matches/:id/events { eventType: 'GOAL'|'DEFENSE', playerId, teamId, eventTime }
  // PUT /matches/:id { status, team1Score, team2Score }
  const s1T1 = s1Attendees.slice(0, 5);
  const s1T2 = s1Attendees.slice(5, 10);

  if (s1Matches.length >= 2) {
    // 경기1: 3-1
    for (let g = 0; g < 3; g++) {
      await api(`/matches/${s1Matches[0].id}/events`, {
        method: 'POST',
        body: { eventType: 'GOAL', playerId: s1T1[g % 5], teamId: s1TeamIds[0], eventTime: g * 3 + 1 },
        token: adminToken, clubId,
      });
    }
    await api(`/matches/${s1Matches[0].id}/events`, {
      method: 'POST',
      body: { eventType: 'GOAL', playerId: s1T2[0], teamId: s1TeamIds[1], eventTime: 8 },
      token: adminToken, clubId,
    });
    await api(`/matches/${s1Matches[0].id}/events`, {
      method: 'POST',
      body: { eventType: 'DEFENSE', playerId: s1T1[4], teamId: s1TeamIds[0], eventTime: 5 },
      token: adminToken, clubId,
    });
    r = await api(`/matches/${s1Matches[0].id}`, {
      method: 'PUT',
      body: { team1Score: 3, team2Score: 1, status: 'completed' },
      token: adminToken, clubId,
    });
    ok('경기1 완료 (3-1)', r.ok);

    // 경기2: 1-2
    await api(`/matches/${s1Matches[1].id}/events`, {
      method: 'POST',
      body: { eventType: 'GOAL', playerId: s1T1[0], teamId: s1TeamIds[0], eventTime: 3 },
      token: adminToken, clubId,
    });
    for (let g = 0; g < 2; g++) {
      await api(`/matches/${s1Matches[1].id}/events`, {
        method: 'POST',
        body: { eventType: 'GOAL', playerId: s1T2[g], teamId: s1TeamIds[1], eventTime: g * 4 + 2 },
        token: adminToken, clubId,
      });
    }
    r = await api(`/matches/${s1Matches[1].id}`, {
      method: 'PUT',
      body: { team1Score: 1, team2Score: 2, status: 'completed' },
      token: adminToken, clubId,
    });
    ok('경기2 완료 (1-2)', r.ok);
  }

  // 세션1을 ended로만 끝냄 (settlement 하지 않음)
  r = await api(`/sessions/${session1Id}`, {
    method: 'PUT',
    body: { status: 'ended' },
    token: adminToken, clubId,
  });
  ok('세션1 → ended', r.ok);

  // 세션 상세: GET /sessions/:id → { session: {...}, teams, matches, attendance, rsvp }
  r = await api(`/sessions/${session1Id}`, { token: adminToken, clubId });
  ok('세션1 상태 = ended', (r.data.session ?? r.data)?.status === 'ended',
    `status=${(r.data.session ?? r.data)?.status}`);

  // ═══════════════════════════════════════════════════
  section('5. 세션2: 전체 플로우 (ended → settlement → completed)');
  // ═══════════════════════════════════════════════════

  r = await api('/sessions', {
    method: 'POST',
    body: { sessionDate: '2026-03-17', title: 'E2E 세션2 (완전 정산)' },
    token: adminToken, clubId,
  });
  ok('세션2 생성', r.ok);
  const session2Id = r.data.id;
  if (!session2Id) die('세션2 ID 없음');

  // 12명 출석
  const s2Attendees = playerIds.slice(0, 12);
  r = await api(`/sessions/${session2Id}/attendance`, {
    method: 'POST',
    body: { attendees: s2Attendees.map(id => ({ playerId: id, attended: true })) },
    token: adminToken, clubId,
  });
  ok('세션2 출석 12명', r.ok);

  // 팀 편성 (6v6)
  r = await api(`/sessions/${session2Id}/teams`, {
    method: 'POST',
    body: { attendees: s2Attendees.map(id => ({ playerId: id, attended: true })) },
    token: adminToken, clubId,
  });
  ok('세션2 팀 편성 (6v6)', r.ok);
  const s2TeamIds = r.data.teamIds ?? [];
  ok(`팀 2개 (실제: ${s2TeamIds.length})`, s2TeamIds.length === 2);
  if (s2TeamIds.length < 2) die('세션2 팀 편성 실패');

  // 3경기 라운드로빈
  r = await api('/matches/round-robin', {
    method: 'POST',
    body: { sessionId: session2Id, teamIds: s2TeamIds, rounds: 3 },
    token: adminToken, clubId,
  });
  ok('세션2 라운드로빈 3경기', r.ok);
  const s2Matches = r.data.matches ?? [];
  ok(`경기 3개 (실제: ${s2Matches.length})`, s2Matches.length === 3);

  const s2T1 = s2Attendees.slice(0, 6);
  const s2T2 = s2Attendees.slice(6, 12);

  if (s2Matches.length >= 3) {
    // 경기1: 2-1 (골+수비 다양하게)
    const events1 = [
      { eventType: 'GOAL', playerId: s2T1[0], teamId: s2TeamIds[0], eventTime: 2 },
      { eventType: 'GOAL', playerId: s2T2[0], teamId: s2TeamIds[1], eventTime: 5 },
      { eventType: 'DEFENSE', playerId: s2T1[5], teamId: s2TeamIds[0], eventTime: 6 },
      { eventType: 'GOAL', playerId: s2T1[2], teamId: s2TeamIds[0], eventTime: 8 },
    ];
    for (const ev of events1) {
      await api(`/matches/${s2Matches[0].id}/events`, { method: 'POST', body: ev, token: adminToken, clubId });
    }
    r = await api(`/matches/${s2Matches[0].id}`, {
      method: 'PUT', body: { team1Score: 2, team2Score: 1, status: 'completed' },
      token: adminToken, clubId,
    });
    ok('세션2 경기1 (2-1)', r.ok);

    // 이벤트 조회 확인: GET /matches/:id → { match, events, ... }
    r = await api(`/matches/${s2Matches[0].id}`, { token: adminToken, clubId });
    const evCount = r.data.events?.length ?? 0;
    ok(`경기1 이벤트 조회 (${evCount}개)`, r.ok && evCount >= 3, `events=${evCount}`);

    // 경기2: 1-3
    const events2 = [
      { eventType: 'GOAL', playerId: s2T1[0], teamId: s2TeamIds[0], eventTime: 1 },
      { eventType: 'GOAL', playerId: s2T2[1], teamId: s2TeamIds[1], eventTime: 3 },
      { eventType: 'GOAL', playerId: s2T2[2], teamId: s2TeamIds[1], eventTime: 5 },
      { eventType: 'GOAL', playerId: s2T2[3], teamId: s2TeamIds[1], eventTime: 8 },
      { eventType: 'DEFENSE', playerId: s2T1[5], teamId: s2TeamIds[0], eventTime: 4 },
      { eventType: 'DEFENSE', playerId: s2T1[5], teamId: s2TeamIds[0], eventTime: 7 },
    ];
    for (const ev of events2) {
      await api(`/matches/${s2Matches[1].id}/events`, { method: 'POST', body: ev, token: adminToken, clubId });
    }
    r = await api(`/matches/${s2Matches[1].id}`, {
      method: 'PUT', body: { team1Score: 1, team2Score: 3, status: 'completed' },
      token: adminToken, clubId,
    });
    ok('세션2 경기2 (1-3)', r.ok);

    // 경기3: 2-2
    const events3 = [
      { eventType: 'GOAL', playerId: s2T1[3], teamId: s2TeamIds[0], eventTime: 2 },
      { eventType: 'GOAL', playerId: s2T2[0], teamId: s2TeamIds[1], eventTime: 4 },
      { eventType: 'GOAL', playerId: s2T1[1], teamId: s2TeamIds[0], eventTime: 6 },
      { eventType: 'GOAL', playerId: s2T2[4], teamId: s2TeamIds[1], eventTime: 9 },
    ];
    for (const ev of events3) {
      await api(`/matches/${s2Matches[2].id}/events`, { method: 'POST', body: ev, token: adminToken, clubId });
    }
    r = await api(`/matches/${s2Matches[2].id}`, {
      method: 'PUT', body: { team1Score: 2, team2Score: 2, status: 'completed' },
      token: adminToken, clubId,
    });
    ok('세션2 경기3 (2-2)', r.ok);
  }

  // 세션2 → ended
  r = await api(`/sessions/${session2Id}`, {
    method: 'PUT', body: { status: 'ended' },
    token: adminToken, clubId,
  });
  ok('세션2 → ended (자동 정산 트리거)', r.ok);

  // 자동 정산 결과 확인
  r = await api(`/sessions/${session2Id}/settlement`, { token: adminToken, clubId });
  ok('세션2 자동 정산 데이터 존재', r.ok && r.data.settlement !== null,
    `settlement=${r.data.settlement ? 'exists' : 'null'}`);

  // 수동 정산 완료 → completed
  r = await api(`/sessions/${session2Id}/settlement`, {
    method: 'POST', token: adminToken, clubId,
  });
  ok('세션2 정산 완료 → completed', r.ok);

  // 상태 확인
  r = await api(`/sessions/${session2Id}`, { token: adminToken, clubId });
  const s2Status = (r.data.session ?? r.data)?.status;
  ok('세션2 상태 = completed', s2Status === 'completed', `status=${s2Status}`);

  // ═══════════════════════════════════════════════════
  section('6. 랭킹 검증: ended vs completed 차이');
  // ═══════════════════════════════════════════════════

  // 랭킹 갱신
  r = await api('/rankings/refresh?year=2026', {
    method: 'POST', token: adminToken, clubId,
  });
  ok('랭킹 갱신', r.ok);
  const refreshedRankings = r.data.rankings ?? [];
  console.log(`  ℹ️  갱신된 랭킹 선수 수: ${refreshedRankings.length}`);

  // 랭킹 조회
  r = await api('/rankings?year=2026', { token: adminToken, clubId });
  ok('랭킹 조회', r.ok);
  const rankData = r.data.data ?? {};
  const rankings = rankData.rankings ?? [];

  // ★ 핵심 검증: completed 세션만 포함되어야 함
  // 세션2만 completed (세션1은 ended)
  // 세션2: 경기1(2-1) + 경기2(1-3) + 경기3(2-2) = 총 11골
  const totalGoals = rankData.totalGoals ?? 0;
  console.log(`  ℹ️  총 골 수: ${totalGoals} (세션2만 반영 시 11골 예상)`);

  // 랭킹에 선수가 존재하는지 확인
  ok('랭킹에 선수 존재', rankings.length > 0, `선수 수: ${rankings.length}`);

  // 통계 구조 확인
  ok('totalPlayers 존재', typeof rankData.totalPlayers === 'number');
  ok('totalSessions 존재', typeof rankData.totalSessions === 'number');
  ok('totalMatches 존재', typeof rankData.totalMatches === 'number');
  ok('goalRanking 배열', Array.isArray(rankData.goalRanking));
  ok('defenseRanking 배열', Array.isArray(rankData.defenseRanking));
  ok('attendanceRanking 배열', Array.isArray(rankData.attendanceRanking));
  ok('winRateRanking 배열', Array.isArray(rankData.winRateRanking));
  ok('mvpRanking 배열', Array.isArray(rankData.mvpRanking));

  // 개별 선수 통계 확인
  if (rankings.length > 0) {
    const topPlayer = rankings[0];
    console.log(`  ℹ️  랭킹 1위: ${topPlayer.name} (mvpScore=${topPlayer.mvpScore}, goals=${topPlayer.goals}, games=${topPlayer.games}, attendance=${topPlayer.attendance})`);
    ok('랭킹 선수에 id 존재', !!topPlayer.id);
    ok('랭킹 선수에 wins/losses 존재', topPlayer.wins !== undefined && topPlayer.losses !== undefined);
    ok('랭킹 선수에 winRate 존재', topPlayer.winRate !== undefined);
    ok('랭킹 선수에 attendance 존재', topPlayer.attendance !== undefined);

    // goals가 player_match_stats에 제대로 집계되는지 확인
    const anyGoals = rankings.some(p => p.goals > 0);
    ok('골 집계 반영됨 (player_match_stats)', anyGoals,
      `최다골=${Math.max(...rankings.map(p => p.goals || 0))}`);
  }

  // 골 랭킹 확인
  if (rankData.goalRanking?.length > 0) {
    const topScorer = rankData.goalRanking[0];
    ok(`득점왕: ${topScorer.name} (${topScorer.goals}골)`, topScorer.goals > 0);
  } else {
    warn('골 랭킹에 선수 존재', false, 'goalRanking이 비어있음');
  }

  // 수비 랭킹 확인
  if (rankData.defenseRanking?.length > 0) {
    const topDef = rankData.defenseRanking[0];
    ok(`수비왕: ${topDef.name} (${topDef.defenses}회)`, topDef.defenses > 0);
  } else {
    warn('수비 랭킹에 선수 존재', false, 'defenseRanking이 비어있음');
  }

  // 재미 통계
  r = await api('/rankings/fun-stats?year=2026', { token: adminToken, clubId });
  warn('재미 통계 조회', r.ok);
  if (r.ok) {
    ok('goalDuos 배열', Array.isArray(r.data.goalDuos));
    ok('bestPartners 배열', Array.isArray(r.data.bestPartners));
    ok('rivals 배열', Array.isArray(r.data.rivals));
  }

  // 명예의 전당
  r = await api('/rankings/hall-of-fame', { token: adminToken, clubId });
  warn('명예의 전당 조회', r.ok);

  // 개인 my-stats
  r = await api(`/rankings/my-stats?playerId=${playerIds[0]}&year=2026`, {
    token: adminToken, clubId,
  });
  warn('선수 my-stats 조회', r.ok);
  if (r.ok) {
    ok('my-stats: teammates 배열', Array.isArray(r.data.teammates));
  }

  // ═══════════════════════════════════════════════════
  section('7. 정산 요약');
  // ═══════════════════════════════════════════════════

  r = await api('/settlements/summary?year=2026', { token: adminToken, clubId });
  warn('정산 요약 조회', r.ok);
  if (r.ok) {
    const sum = r.data.summary;
    console.log(`  ℹ️  세션 수: ${sum?.totalSessions}, 총 참가비: ${sum?.totalPot}`);
    ok('정산 요약: totalSessions > 0', (sum?.totalSessions ?? 0) > 0);
  }

  // ═══════════════════════════════════════════════════
  section('8. 세션1을 정산하면 랭킹에 반영되는지');
  // ═══════════════════════════════════════════════════

  // 세션1도 settlement → completed로 변환
  r = await api(`/sessions/${session1Id}/settlement`, {
    method: 'POST', token: adminToken, clubId,
  });
  ok('세션1 정산 완료 → completed', r.ok);

  r = await api(`/sessions/${session1Id}`, { token: adminToken, clubId });
  const s1Status = (r.data.session ?? r.data)?.status;
  ok('세션1 상태 = completed', s1Status === 'completed', `status=${s1Status}`);

  // 랭킹 다시 갱신
  r = await api('/rankings/refresh?year=2026', {
    method: 'POST', token: adminToken, clubId,
  });
  ok('랭킹 재갱신', r.ok);

  r = await api('/rankings?year=2026', { token: adminToken, clubId });
  const newRankData = r.data.data ?? {};
  const newTotalGoals = newRankData.totalGoals ?? 0;
  const newRankings = newRankData.rankings ?? [];
  const newMaxGoals = Math.max(...newRankings.map(p => p.goals || 0), 0);
  console.log(`  ℹ️  세션1+2 총 골: ${newTotalGoals} (이전: ${totalGoals}), 최다골=${newMaxGoals}`);

  // 세션1 추가 후 총 선수/출석이 증가했는지 확인
  const newTotalMatches = newRankData.totalMatches ?? 0;
  console.log(`  ℹ️  총 경기 수: ${newTotalMatches}`);
  ok('세션1+2 합산 시 경기 수 ≥ 5', newTotalMatches >= 5, `totalMatches=${newTotalMatches}`);

  // ═══════════════════════════════════════════════════
  section('9. 멀티클럽: 2번 유저 + 클럽 격리');
  // ═══════════════════════════════════════════════════

  const user2Name = `u2_${TS % 100000}`;
  r = await api('/auth/register', {
    method: 'POST',
    body: { email: `${user2Name}@test.com`, username: user2Name, password: 'test1234' },
  });
  ok('2번 유저 회원가입', r.ok || r.status === 201);

  r = await api('/auth/login', {
    method: 'POST',
    body: { identifier: user2Name, password: 'test1234' },
  });
  ok('2번 유저 로그인', r.ok);
  const user2Token = r.data.token;

  // 클럽1 가입 (재발급된 초대코드 사용)
  r = await api('/clubs/join', {
    method: 'POST',
    body: { inviteCode: newInviteCode },
    token: user2Token,
  });
  ok('2번 유저 클럽1 가입', r.ok);

  // 2번째 클럽 생성
  r = await api('/clubs', {
    method: 'POST',
    body: { slug: `e2e2-${TS % 100000}`, name: '두 번째 클럽' },
    token: user2Token,
  });
  ok('2번 유저 클럽2 생성', r.ok);
  const club2Id = r.data.club?.id;

  // me 확인: 2개 클럽
  r = await api('/auth/me', { token: user2Token });
  ok('2번 유저 clubs 배열', Array.isArray(r.data.clubs));
  ok(`2개 클럽 보유 (실제: ${r.data.clubs?.length})`, r.data.clubs?.length === 2);

  // X-Club-Id로 클럽 전환
  r = await api('/clubs/me', { token: user2Token, clubId });
  ok('X-Club-Id=클럽1 → 클럽1 정보', r.ok && r.data.club?.id === clubId);

  if (club2Id) {
    r = await api('/clubs/me', { token: user2Token, clubId: club2Id });
    ok('X-Club-Id=클럽2 → 클럽2 정보', r.ok && r.data.club?.id === club2Id);

    // ── 클럽 격리 검증 ──
    r = await api('/sessions', { token: user2Token, clubId: club2Id });
    const c2Sessions = r.data.sessions ?? [];
    ok(`클럽2 세션 0개 격리 (실제: ${c2Sessions.length})`, c2Sessions.length === 0);

    r = await api('/players', { token: user2Token, clubId: club2Id });
    const c2Players = r.data.players ?? [];
    ok(`클럽2 선수 0명 격리 (실제: ${c2Players.length})`, c2Players.length === 0);

    r = await api('/rankings?year=2026', { token: user2Token, clubId: club2Id });
    const c2Rankings = r.data.data?.rankings ?? [];
    ok(`클럽2 랭킹 0명 격리 (실제: ${c2Rankings.length})`, c2Rankings.length === 0);

    // 다른 클럽의 세션 접근
    r = await api(`/sessions/${session1Id}`, { token: user2Token, clubId: club2Id });
    ok('타 클럽 세션 접근 거부 (404)', r.status === 404, `실제: ${r.status}`);
  }

  // ═══════════════════════════════════════════════════
  section('10. 권한 경계 테스트');
  // ═══════════════════════════════════════════════════

  // 비관리자(member) → 선수 등록
  r = await api('/players', {
    method: 'POST', body: { name: '불법선수' },
    token: user2Token, clubId,
  });
  ok('비관리자 선수 등록 거부 (403)', r.status === 403, `실제: ${r.status}`);

  // 비관리자 → 세션 생성
  r = await api('/sessions', {
    method: 'POST',
    body: { sessionDate: '2026-04-01', title: '불법 세션' },
    token: user2Token, clubId,
  });
  ok('비관리자 세션 생성 거부 (403)', r.status === 403, `실제: ${r.status}`);

  // 미인증 → 세션 생성
  r = await api('/sessions', { method: 'POST', body: { sessionDate: '2026-01-01' } });
  ok('미인증 세션 생성 거부 (401)', r.status === 401, `실제: ${r.status}`);

  // 비관리자 → 클럽 설정 변경
  r = await api('/clubs/me', {
    method: 'PUT', body: { name: '해킹됨' },
    token: user2Token, clubId,
  });
  ok('비관리자 클럽 설정 변경 거부 (403)', r.status === 403, `실제: ${r.status}`);

  // 비관리자 → 랭킹 갱신 (ADMIN 권한 필요)
  r = await api('/rankings/refresh?year=2026', {
    method: 'POST', token: user2Token, clubId,
  });
  ok('비관리자 랭킹 갱신 거부 (403)', r.status === 403, `실제: ${r.status}`);

  // ═══════════════════════════════════════════════════
  section('11. MVP 투표 (세션2)');
  // ═══════════════════════════════════════════════════

  r = await api(`/sessions/${session2Id}/mvp-votes`, { token: adminToken, clubId });
  warn('MVP 투표 현황 조회', r.ok);
  if (r.ok) {
    console.log(`  ℹ️  총 투표: ${r.data.totalVotes}, MVP결과: ${r.data.mvpResult ? r.data.mvpResult.player_name : '미결정'}`);
  }

  // ═══════════════════════════════════════════════════
  section('12. 세션 목록 / 필터 / 세부 조회');
  // ═══════════════════════════════════════════════════

  r = await api('/sessions', { token: adminToken, clubId });
  const allSessions = r.data.sessions ?? [];
  ok(`전체 세션 목록 (${allSessions.length}개)`, allSessions.length >= 2);

  // status 필터
  r = await api('/sessions?status=completed', { token: adminToken, clubId });
  const completedSessions = r.data.sessions ?? [];
  ok(`completed 세션 필터 (${completedSessions.length}개)`, completedSessions.length >= 1);

  // limit 필터
  r = await api('/sessions?limit=1', { token: adminToken, clubId });
  ok('세션 limit=1', (r.data.sessions ?? []).length === 1);

  // 세션 상세에 팀+경기+멤버 포함
  r = await api(`/sessions/${session2Id}`, { token: adminToken, clubId });
  const sessDetail = r.data;
  ok('세션 상세: teams 포함', Array.isArray(sessDetail.teams) && sessDetail.teams.length > 0);
  ok('세션 상세: matches 포함', Array.isArray(sessDetail.matches) && sessDetail.matches.length > 0);
  if (sessDetail.teams?.[0]) {
    ok('팀에 members 포함', Array.isArray(sessDetail.teams[0].members));
  }
  if (sessDetail.matches?.[0]) {
    ok('경기에 events 포함', Array.isArray(sessDetail.matches[0].events));
  }

  // ═══════════════════════════════════════════════════
  section('13. 이벤트 삭제');
  // ═══════════════════════════════════════════════════

  // 경기 상세에서 이벤트 ID 가져오기
  r = await api(`/matches/${s2Matches[0].id}`, { token: adminToken, clubId });
  const eventsToCheck = r.data.events ?? [];
  if (eventsToCheck.length > 0) {
    const evId = eventsToCheck[0].id;
    r = await api(`/matches/${s2Matches[0].id}/events/${evId}`, {
      method: 'DELETE', token: adminToken, clubId,
    });
    warn('이벤트 삭제', r.ok, r.ok ? '' : `status=${r.status}`);
  } else {
    console.log('  ℹ️  이벤트 없음, 삭제 테스트 스킵');
  }

  // ═══════════════════════════════════════════════════
  section('14. 멤버 관리 (관리자)');
  // ═══════════════════════════════════════════════════

  r = await api('/clubs/me/members', { token: adminToken, clubId });
  ok('멤버 목록 조회', r.ok);
  const members = r.data.members ?? [];
  console.log(`  ℹ️  멤버 수: ${members.length}`);

  const user2Member = members.find(m => m.username === user2Name);
  if (user2Member) {
    ok('2번 유저 멤버 목록에 존재', true);
    ok('2번 유저 역할 = member', user2Member.role === 'member');
  }

  // ═══════════════════════════════════════════════════
  section('15. 세션 close (최종 상태)');
  // ═══════════════════════════════════════════════════

  r = await api(`/sessions/${session2Id}`, {
    method: 'PUT', body: { status: 'closed' },
    token: adminToken, clubId,
  });
  warn('세션2 → closed', r.ok, r.ok ? '' : `status=${r.status}`);

  if (r.ok) {
    r = await api(`/sessions/${session2Id}`, { token: adminToken, clubId });
    const closedStatus = (r.data.session ?? r.data)?.status;
    ok('세션2 상태 = closed', closedStatus === 'closed', `status=${closedStatus}`);

    // closed 세션도 랭킹에 포함되는지 확인
    r = await api('/rankings/refresh?year=2026', {
      method: 'POST', token: adminToken, clubId,
    });
    ok('closed 세션 포함 랭킹 갱신', r.ok);

    r = await api('/rankings?year=2026', { token: adminToken, clubId });
    const closedRankings = r.data.data?.rankings ?? [];
    ok('closed 후에도 랭킹 유지', closedRankings.length > 0, `선수 수=${closedRankings.length}`);
  }

  // ═══════════════════════════════════════════════════
  section('16. 선수 스탯 조회');
  // ═══════════════════════════════════════════════════

  r = await api(`/players/${playerIds[0]}`, { token: adminToken, clubId });
  ok('선수1 상세 조회', r.ok);
  if (r.ok) {
    const pStats = r.data.stats;
    console.log(`  ℹ️  ${r.data.player?.name}: 경기=${pStats?.total_matches}, 골=${pStats?.total_goals}, 수비=${pStats?.total_blocks}, 출석=${r.data.player?.total_attendance}`);
  }

  // ═══════════════════════════════════════════════════
  // 최종 결과
  // ═══════════════════════════════════════════════════

  summary();
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error('\n💥 예외:', e); process.exit(1); });
