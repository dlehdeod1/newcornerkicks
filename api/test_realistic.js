// 현실적인 풋살 시나리오 테스트 (5v5, 14명 선수단)
// node test_realistic.js

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
  const data = await res.json();
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
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(50));
}

function die(msg) {
  console.log(`\n💥 ${msg}`);
  console.log(`\n결과: ✅ ${passed} | ❌ ${failed} | ⚠️  ${warns}\n`);
  process.exit(1);
}

// 14명 선수단
const PLAYERS = [
  '김민준','이서준','박도윤','정시우','최주원','강지호','윤현우',
  '임준서','한지훈','오지환','서민혁','노태양','권승현','백재원',
];

async function main() {
  console.log('══════════════════════════════════════════════════');
  console.log('  CornerKicks 현실적 풋살 시나리오 테스트');
  console.log('  선수 14명 | 세션 2회 | 5v5/6v6 라운드로빈');
  console.log('══════════════════════════════════════════════════');

  // ────────────────────────────────────────────
  section('1. 어드민 계정 & 클럽 생성');
  // ────────────────────────────────────────────

  const adminUser = `admin_${TS}`;
  const clubSlug = `fc-test-${TS}`;

  let r = await api('/auth/register', {
    method: 'POST',
    body: { email: `${adminUser}@test.com`, username: adminUser, password: 'test1234' },
  });
  ok('어드민 회원가입', r.status === 201);

  r = await api('/auth/login', {
    method: 'POST',
    body: { identifier: adminUser, password: 'test1234' },
  });
  ok('어드민 로그인', r.ok);
  const adminToken = r.data.token;
  if (!adminToken) die('로그인 실패');

  r = await api('/clubs', {
    method: 'POST',
    body: {
      slug: clubSlug,
      name: 'FC 테스트 유나이티드',
      description: '현실 테스트용 풋살 동호회',
      enabledEvents: ['GOAL', 'SAVE', 'SHOT', 'KEY_PASS'],
    },
    token: adminToken,
  });
  ok('클럽 생성', r.ok, JSON.stringify(r.data));
  const clubId = r.data.club?.id;
  if (!clubId) die(`클럽 ID 없음: ${JSON.stringify(r.data)}`);
  ok('클럽 ID 반환', !!clubId, `clubId=${clubId}`);

  r = await api('/clubs/me', { token: adminToken, clubId });
  ok('클럽 정보 조회', r.ok);
  const inviteCode = r.data.club?.inviteCode;
  ok('초대코드 존재', !!inviteCode);
  console.log(`  ℹ️  초대코드: ${inviteCode}`);

  // ────────────────────────────────────────────
  section('2. 선수 14명 등록');
  // ────────────────────────────────────────────

  // 응답 구조: { id, playerCode, message }
  const playerIds = [];
  for (const name of PLAYERS) {
    r = await api('/players', {
      method: 'POST',
      body: { name },
      token: adminToken,
      clubId,
    });
    if (r.ok && r.data.id) {
      playerIds.push(r.data.id);
    } else {
      console.log(`  ❌ ${name} 등록 실패: ${JSON.stringify(r.data)}`);
      failed++;
    }
  }
  ok(`선수 14명 등록 (실제: ${playerIds.length}명)`, playerIds.length === 14);

  r = await api('/players', { token: adminToken, clubId });
  const dbCount = r.data.players?.length ?? 0;
  ok(`선수 목록 조회 (${dbCount}명)`, r.ok && dbCount >= 14);

  // ────────────────────────────────────────────
  section('3. 세션1 — 12명 참석, 6v6, 3경기');
  // ────────────────────────────────────────────

  // 응답 구조: { id, message }
  r = await api('/sessions', {
    method: 'POST',
    body: { sessionDate: '2026-03-11', title: '3월 2주차 정기 풋살' },
    token: adminToken,
    clubId,
  });
  ok('세션1 생성', r.ok, JSON.stringify(r.data));
  const session1Id = r.data.id;
  if (!session1Id) die(`세션1 ID 없음: ${JSON.stringify(r.data)}`);
  ok('세션1 ID 반환', !!session1Id, `id=${session1Id}`);

  // 12명 출석
  const s1Attendees = playerIds.slice(0, 12);
  r = await api(`/sessions/${session1Id}/attendance`, {
    method: 'POST',
    body: { attendees: s1Attendees.map(id => ({ playerId: id, attended: true })) },
    token: adminToken,
    clubId,
  });
  ok('세션1 출석 12명 저장', r.ok, JSON.stringify(r.data));

  // 팀 편성 - 응답: { teamIds, teams (summary), ... }
  r = await api(`/sessions/${session1Id}/teams`, {
    method: 'POST',
    body: { attendees: s1Attendees.map(id => ({ playerId: id, attended: true })) },
    token: adminToken,
    clubId,
  });
  ok('세션1 팀 편성 (6v6)', r.ok, JSON.stringify(r.data));
  const s1TeamIds = r.data.teamIds ?? [];
  ok(`팀 2개 생성 (실제: ${s1TeamIds.length}개)`, s1TeamIds.length === 2);
  if (s1TeamIds.length < 2) die('팀 편성 실패');

  const [s1t1Id, s1t2Id] = s1TeamIds;
  console.log(`  ℹ️  팀 ID: ${s1t1Id}, ${s1t2Id}`);

  // 라운드로빈 3경기
  r = await api('/matches/round-robin', {
    method: 'POST',
    body: { sessionId: session1Id, teamIds: [s1t1Id, s1t2Id], rounds: 3 },
    token: adminToken,
    clubId,
  });
  ok('세션1 라운드로빈 3경기 생성', r.ok, JSON.stringify(r.data));
  const s1Matches = r.data.matches ?? [];
  ok(`경기 3개 생성 (실제: ${s1Matches.length}개)`, s1Matches.length === 3);
  if (s1Matches.length < 3) die('경기 생성 실패');

  // 이벤트 기록을 위해 실제 팀 멤버 조회
  // GET /sessions/:id → teams 포함 여부 확인
  r = await api(`/sessions/${session1Id}`, { token: adminToken, clubId });
  ok('세션1 상세 조회', r.ok);
  const s1Teams = r.data.teams ?? [];
  const s1T1Players = s1Teams.find(t => t.id === s1t1Id)?.players ?? [];
  const s1T2Players = s1Teams.find(t => t.id === s1t2Id)?.players ?? [];
  console.log(`  ℹ️  팀1 선수: ${s1T1Players.length}명, 팀2 선수: ${s1T2Players.length}명`);

  // 편의상 playerIds에서 직접 분배 (6명/6명)
  const team1Pids = s1Attendees.slice(0, 6);
  const team2Pids = s1Attendees.slice(6, 12);

  // 경기1: 2-1
  const m1 = s1Matches[0];
  const ev1 = [
    { type: 'GOAL', playerId: team1Pids[0], teamId: s1t1Id, minute: 3 },
    { type: 'KEY_PASS', playerId: team1Pids[1], teamId: s1t1Id, minute: 3 },
    { type: 'GOAL', playerId: team2Pids[0], teamId: s1t2Id, minute: 7 },
    { type: 'GOAL', playerId: team1Pids[2], teamId: s1t1Id, minute: 9 },
  ];
  for (const ev of ev1) {
    await api(`/matches/${m1.id}/events`, { method: 'POST', body: ev, token: adminToken, clubId });
  }
  r = await api(`/matches/${m1.id}`, {
    method: 'PUT',
    body: { score1: 2, score2: 1, status: 'completed' },
    token: adminToken, clubId,
  });
  ok('경기1 결과 (2-1)', r.ok, JSON.stringify(r.data));

  // 경기2: 2-3
  const m2 = s1Matches[1];
  const ev2 = [
    { type: 'GOAL', playerId: team2Pids[1], teamId: s1t2Id, minute: 2 },
    { type: 'GOAL', playerId: team1Pids[3], teamId: s1t1Id, minute: 4 },
    { type: 'GOAL', playerId: team2Pids[2], teamId: s1t2Id, minute: 6 },
    { type: 'GOAL', playerId: team2Pids[3], teamId: s1t2Id, minute: 8 },
    { type: 'GOAL', playerId: team1Pids[0], teamId: s1t1Id, minute: 9 },
    { type: 'SHOT', playerId: team1Pids[4], teamId: s1t1Id, minute: 7 },
  ];
  for (const ev of ev2) {
    await api(`/matches/${m2.id}/events`, { method: 'POST', body: ev, token: adminToken, clubId });
  }
  r = await api(`/matches/${m2.id}`, {
    method: 'PUT',
    body: { score1: 2, score2: 3, status: 'completed' },
    token: adminToken, clubId,
  });
  ok('경기2 결과 (2-3)', r.ok);

  // 경기3: 1-1
  const m3 = s1Matches[2];
  const ev3 = [
    { type: 'GOAL', playerId: team1Pids[1], teamId: s1t1Id, minute: 5 },
    { type: 'KEY_PASS', playerId: team1Pids[2], teamId: s1t1Id, minute: 5 },
    { type: 'GOAL', playerId: team2Pids[0], teamId: s1t2Id, minute: 8 },
  ];
  for (const ev of ev3) {
    await api(`/matches/${m3.id}/events`, { method: 'POST', body: ev, token: adminToken, clubId });
  }
  r = await api(`/matches/${m3.id}`, {
    method: 'PUT',
    body: { score1: 1, score2: 1, status: 'completed' },
    token: adminToken, clubId,
  });
  ok('경기3 결과 (1-1 무)', r.ok);

  // 세션1 종료
  r = await api(`/sessions/${session1Id}`, {
    method: 'PUT',
    body: { status: 'ended' },
    token: adminToken, clubId,
  });
  ok('세션1 종료', r.ok, JSON.stringify(r.data));

  // ────────────────────────────────────────────
  section('4. 세션2 — 10명 참석, 5v5, 4경기');
  // ────────────────────────────────────────────

  r = await api('/sessions', {
    method: 'POST',
    body: { sessionDate: '2026-03-18', title: '3월 3주차 정기 풋살' },
    token: adminToken, clubId,
  });
  ok('세션2 생성', r.ok);
  const session2Id = r.data.id;
  if (!session2Id) die(`세션2 ID 없음`);

  // 10명 (앞 8명 + 10,11번 — 12,13번은 불참)
  const s2Attendees = [...playerIds.slice(0, 8), playerIds[10], playerIds[11]];
  r = await api(`/sessions/${session2Id}/attendance`, {
    method: 'POST',
    body: { attendees: s2Attendees.map(id => ({ playerId: id, attended: true })) },
    token: adminToken, clubId,
  });
  ok('세션2 출석 10명', r.ok);

  r = await api(`/sessions/${session2Id}/teams`, {
    method: 'POST',
    body: { attendees: s2Attendees.map(id => ({ playerId: id, attended: true })) },
    token: adminToken, clubId,
  });
  ok('세션2 팀 편성 (5v5)', r.ok, JSON.stringify(r.data));
  const s2TeamIds = r.data.teamIds ?? [];
  ok(`팀 2개 생성 (실제: ${s2TeamIds.length}개)`, s2TeamIds.length === 2);

  if (s2TeamIds.length === 2) {
    r = await api('/matches/round-robin', {
      method: 'POST',
      body: { sessionId: session2Id, teamIds: [s2TeamIds[0], s2TeamIds[1]], rounds: 4 },
      token: adminToken, clubId,
    });
    ok('세션2 라운드로빈 4경기 생성', r.ok);
    const s2Matches = r.data.matches ?? [];
    ok(`경기 4개 (실제: ${s2Matches.length}개)`, s2Matches.length === 4);

    const scores = [[3,1],[2,2],[1,3],[2,1]];
    for (let i = 0; i < s2Matches.length && i < scores.length; i++) {
      const [sc1, sc2] = scores[i];
      // 골 이벤트 기록
      const team1Pids2 = s2Attendees.slice(0, 5);
      const team2Pids2 = s2Attendees.slice(5, 10);
      for (let g = 0; g < sc1; g++) {
        await api(`/matches/${s2Matches[i].id}/events`, {
          method: 'POST',
          body: { type: 'GOAL', playerId: team1Pids2[g % team1Pids2.length], teamId: s2TeamIds[0], minute: g * 2 + 2 },
          token: adminToken, clubId,
        });
      }
      for (let g = 0; g < sc2; g++) {
        await api(`/matches/${s2Matches[i].id}/events`, {
          method: 'POST',
          body: { type: 'GOAL', playerId: team2Pids2[g % team2Pids2.length], teamId: s2TeamIds[1], minute: g * 2 + 3 },
          token: adminToken, clubId,
        });
      }
      await api(`/matches/${s2Matches[i].id}`, {
        method: 'PUT',
        body: { score1: sc1, score2: sc2, status: 'completed' },
        token: adminToken, clubId,
      });
    }
    console.log(`  ℹ️  경기 결과: ${scores.map(s => s.join('-')).join(', ')}`);
  }

  r = await api(`/sessions/${session2Id}`, {
    method: 'PUT',
    body: { status: 'ended' },
    token: adminToken, clubId,
  });
  ok('세션2 종료', r.ok);

  // ────────────────────────────────────────────
  section('5. 랭킹 & 통계 검증');
  // ────────────────────────────────────────────

  r = await api('/rankings/refresh?year=2026', {
    method: 'POST', token: adminToken, clubId,
  });
  ok('랭킹 갱신', r.ok, JSON.stringify(r.data));

  r = await api('/rankings?year=2026', { token: adminToken, clubId });
  ok('랭킹 조회', r.ok);
  // GET /rankings 응답 구조: { data: { rankings, ... }, updatedAt }
  const rankings = r.data.data?.rankings ?? r.data.rankings ?? [];
  warn(`랭킹 선수 존재 (${rankings.length}명)`, rankings.length > 0);

  if (rankings.length > 0) {
    const top = rankings[0];
    const topName = top.name ?? '?';
    const topGames = top.games ?? '?';
    const topGoals = top.goals ?? '?';
    const topAttendance = top.attendance ?? '?';
    console.log(`  ℹ️  1위: ${topName} — 경기 ${topGames}회, 출석 ${topAttendance}회, 골 ${topGoals}`);
  } else {
    // refresh 응답에 포함된 랭킹 확인 (POST refresh는 { rankings } 반환)
    const refreshRankings = r.data.rankings ?? [];
    console.log(`  ℹ️  응답 키: ${Object.keys(r.data).join(', ')}`);
  }

  r = await api('/rankings/fun-stats?year=2026', { token: adminToken, clubId });
  warn('재미 통계', r.ok, r.ok ? '' : JSON.stringify(r.data));

  r = await api('/rankings/hall-of-fame', { token: adminToken, clubId });
  warn('명예의 전당', r.ok, r.ok ? '' : JSON.stringify(r.data));

  // 특정 선수 my-stats
  r = await api(`/rankings/my-stats?playerId=${playerIds[0]}&year=2026`, {
    token: adminToken, clubId,
  });
  warn(`선수1 my-stats`, r.ok, r.ok ? '' : JSON.stringify(r.data));
  if (r.ok) {
    const ms = r.data;
    console.log(`  ℹ️  선수1 stats: 골 ${ms.goals ?? '?'}, 출전 ${ms.sessionsPlayed ?? ms.sessions_played ?? '?'}`);
  }

  // ────────────────────────────────────────────
  section('6. 멀티클럽 시나리오');
  // ────────────────────────────────────────────

  const user2 = `p2_${TS % 100000}`; // 20자 이내
  r = await api('/auth/register', {
    method: 'POST',
    body: { email: `${user2}@test.com`, username: user2, password: 'test1234' },
  });
  ok('2번 유저 회원가입', r.ok, JSON.stringify(r.data));

  r = await api('/auth/login', {
    method: 'POST',
    body: { identifier: user2, password: 'test1234' },
  });
  ok('2번 유저 로그인', r.ok, JSON.stringify(r.data));
  const user2Token = r.data.token;

  r = await api('/clubs/join', {
    method: 'POST',
    body: { inviteCode },
    token: user2Token,
  });
  ok('초대코드로 클럽1 가입', r.ok, JSON.stringify(r.data));

  r = await api('/clubs', {
    method: 'POST',
    body: { slug: `fc-second-${TS}`, name: '두 번째 클럽' },
    token: user2Token,
  });
  ok('2번 유저 두 번째 클럽 생성', r.ok, JSON.stringify(r.data));
  const club2Id = r.data.club?.id;

  r = await api('/auth/me', { token: user2Token });
  ok('me 재조회 (clubs 배열)', r.ok && Array.isArray(r.data.clubs));
  const clubsAfter = r.data.clubs ?? [];
  ok(`2개 클럽 보유 (실제: ${clubsAfter.length}개)`, clubsAfter.length === 2);

  if (club2Id) {
    r = await api('/clubs/me', { token: user2Token, clubId });
    ok(`X-Club-Id 클럽1 조회`, r.ok && r.data.club?.id === clubId);

    r = await api('/clubs/me', { token: user2Token, clubId: club2Id });
    ok(`X-Club-Id 클럽2 조회`, r.ok && r.data.club?.id === club2Id);
  }

  // ────────────────────────────────────────────
  section('7. 클럽 격리 검증');
  // ────────────────────────────────────────────

  r = await api('/sessions', { token: adminToken, clubId });
  const c1Sessions = r.data.sessions ?? [];
  ok(`클럽1 세션 2개 (실제: ${c1Sessions.length}개)`, c1Sessions.length === 2);

  if (club2Id) {
    r = await api('/sessions', { token: user2Token, clubId: club2Id });
    const c2Sessions = r.data.sessions ?? [];
    ok(`클럽2 세션 0개 격리 (실제: ${c2Sessions.length}개)`, c2Sessions.length === 0);

    r = await api('/rankings?year=2026', { token: user2Token, clubId: club2Id });
    const c2Rankings = r.data.rankings ?? [];
    ok(`클럽2 랭킹 격리 (0명, 실제: ${c2Rankings.length}명)`, c2Rankings.length === 0);
  }

  // ────────────────────────────────────────────
  section('8. 정산 확인');
  // ────────────────────────────────────────────

  r = await api(`/sessions/${session1Id}/settlement`, { token: adminToken, clubId });
  warn('세션1 정산 조회', r.ok, JSON.stringify(r.data).slice(0, 200));

  r = await api('/settlements/summary?year=2026', { token: adminToken, clubId });
  warn('정산 요약', r.ok, r.ok ? '' : JSON.stringify(r.data));

  // ────────────────────────────────────────────
  section('9. 권한 경계 테스트');
  // ────────────────────────────────────────────

  // 클럽1 멤버(비관리자)가 선수 등록 시도
  r = await api('/players', {
    method: 'POST',
    body: { name: '불법선수' },
    token: user2Token,
    clubId,
  });
  ok('비관리자 선수 등록 거부', r.status === 403, `실제: ${r.status}`);

  // 미인증 세션 생성
  r = await api('/sessions', { method: 'POST', body: { sessionDate: '2026-01-01' } });
  ok('미인증 세션 생성 거부 (401)', r.status === 401, `실제: ${r.status}`);

  // 다른 클럽 세션 접근
  if (club2Id) {
    r = await api(`/sessions/${session1Id}`, { token: user2Token, clubId: club2Id });
    ok('다른 클럽 세션 접근 거부 (404)', r.status === 404, `실제: ${r.status}`);
  }

  // ────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════');
  console.log(`  결과: ✅ ${passed}개 통과 | ❌ ${failed}개 실패 | ⚠️  ${warns}개 경고`);
  console.log('══════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error('\n💥 예외:', e); process.exit(1); });
