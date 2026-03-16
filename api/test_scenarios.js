// 종합 시나리오 테스트
// node test_scenarios.js

const BASE = 'https://cornerkicks-api.conerkicks.workers.dev';
let passed = 0, failed = 0;

async function req(endpoint, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${endpoint}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

function test(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function main() {
  console.log('========================================');
  console.log('  CornerKicks API 시나리오 테스트');
  console.log('========================================\n');

  // ── 1. 인증 시나리오 ──────────────────────────────
  console.log('【1】 인증 시나리오');

  // 1-1. 회원가입 성공
  const testUser = `tester_${Date.now()}`;
  const r1 = await req('/auth/register', {
    method: 'POST',
    body: { email: `${testUser}@test.com`, username: testUser, password: 'pass1234' },
  });
  test('회원가입 성공', r1.status === 201, JSON.stringify(r1.data));

  // 1-2. 중복 회원가입
  const r2 = await req('/auth/register', {
    method: 'POST',
    body: { email: `${testUser}@test.com`, username: testUser, password: 'pass1234' },
  });
  test('중복 이메일 거부', r2.status === 400);

  // 1-3. 짧은 비밀번호
  const r3 = await req('/auth/register', {
    method: 'POST',
    body: { email: `short@test.com`, username: `short_${Date.now()}`, password: '123' },
  });
  test('짧은 비밀번호 거부', r3.status === 400);

  // 1-4. 로그인 성공
  const r4 = await req('/auth/login', {
    method: 'POST',
    body: { identifier: testUser, password: 'pass1234' },
  });
  test('로그인 성공', r4.status === 200 && r4.data.token);
  const userToken = r4.data.token;

  // 1-5. 잘못된 비밀번호
  const r5 = await req('/auth/login', {
    method: 'POST',
    body: { identifier: testUser, password: 'wrongpw' },
  });
  test('잘못된 비밀번호 거부', r5.status === 401);

  // 1-6. /me 조회
  const r6 = await req('/auth/me', { token: userToken });
  test('/me 조회 성공', r6.status === 200 && r6.data.user?.username === testUser);

  // 1-7. 토큰 없이 보호 엔드포인트
  const r7 = await req('/players', { method: 'POST', body: { name: '무권한테스트' } });
  test('토큰 없이 거부됨', r7.status === 401);

  // 1-8. 잘못된 토큰
  const r8 = await req('/players', { method: 'POST', body: { name: '테스트' }, token: 'invalid.token.here' });
  test('유효하지 않은 토큰 거부', r8.status === 401);

  // ── 2. 클럽 생성 시나리오 ────────────────────────
  console.log('\n【2】 클럽 시나리오');

  // 2-1. 클럽 없이 세션 조회 → 빈 배열
  const r9 = await req('/sessions', { token: userToken });
  test('클럽 없으면 세션 빈 배열', r9.status === 200 && Array.isArray(r9.data.sessions) && r9.data.sessions.length === 0);

  // 2-2. 유효하지 않은 slug
  const r10 = await req('/clubs', {
    method: 'POST',
    body: { slug: 'a b c!', name: '테스트클럽', enabledEvents: ['GOAL', 'SAVE'] },
    token: userToken,
  });
  test('잘못된 slug 거부', r10.status === 400);

  // 2-3. 클럽 생성 성공
  const clubSlug = `testclub-${Date.now()}`;
  const r11 = await req('/clubs', {
    method: 'POST',
    body: { slug: clubSlug, name: '테스트FC', enabledEvents: ['GOAL', 'SAVE', 'SHOT'] },
    token: userToken,
  });
  test('클럽 생성 성공', r11.status === 201, JSON.stringify(r11.data));

  // 재로그인 (clubRole 포함 토큰)
  const reLogin = await req('/auth/login', {
    method: 'POST',
    body: { identifier: testUser, password: 'pass1234' },
  });
  const adminToken = reLogin.data.token;
  const clubId = reLogin.data.club?.id;
  test('재로그인 후 클럽 정보 포함', !!clubId && reLogin.data.club?.myRole === 'admin');

  // 2-4. slug 중복
  const r12 = await req('/clubs', {
    method: 'POST',
    body: { slug: clubSlug, name: '중복테스트', enabledEvents: ['GOAL'] },
    token: adminToken,
  });
  test('중복 slug 거부', r12.status === 400);

  // 2-5. 클럽 없는 유저가 admin 전용 API 호출
  const userWithNoClub = `noclub_${Date.now()}`;
  await req('/auth/register', {
    method: 'POST',
    body: { email: `${userWithNoClub}@test.com`, username: userWithNoClub, password: 'pass1234' },
  });
  const noClubLogin = await req('/auth/login', {
    method: 'POST',
    body: { identifier: userWithNoClub, password: 'pass1234' },
  });
  const noClubToken = noClubLogin.data.token;
  const r13 = await req('/players', { method: 'POST', body: { name: '침입자' }, token: noClubToken });
  test('다른 클럽 없는 유저 선수 생성 불가', r13.status === 403);

  // ── 3. 선수 관리 시나리오 ────────────────────────
  console.log('\n【3】 선수 관리 시나리오');

  // 3-1. 선수 생성
  const p1 = await req('/players', { method: 'POST', body: { name: '테스트선수1', nickname: '테스터' }, token: adminToken });
  test('선수 생성 성공', p1.status === 201 && p1.data.id);
  const playerId1 = p1.data.id;

  const p2 = await req('/players', { method: 'POST', body: { name: '테스트선수2' }, token: adminToken });
  const p3 = await req('/players', { method: 'POST', body: { name: '테스트선수3' }, token: adminToken });
  const p4 = await req('/players', { method: 'POST', body: { name: '테스트선수4' }, token: adminToken });
  test('선수 3명 추가 생성', p2.status === 201 && p3.status === 201 && p4.status === 201);
  const playerIds = [playerId1, p2.data.id, p3.data.id, p4.data.id];

  // 3-2. 이름 1글자 거부
  const p5 = await req('/players', { method: 'POST', body: { name: '김' }, token: adminToken });
  test('1글자 이름 거부', p5.status === 400);

  // 3-3. 선수 목록 조회
  const pList = await req('/players', { token: adminToken });
  test('선수 목록 조회', pList.status === 200 && Array.isArray(pList.data.players));
  test('생성된 선수 포함됨', pList.data.players?.some(p => p.id === playerId1));

  // 3-4. 선수 상세 조회
  const pDetail = await req(`/players/${playerId1}`);
  test('선수 상세 조회', pDetail.status === 200 && pDetail.data.player?.name === '테스트선수1');

  // 3-5. 없는 선수 조회
  const pNotFound = await req('/players/999999');
  test('없는 선수 404', pNotFound.status === 404);

  // 3-6. 선수 수정
  const pUpdate = await req(`/players/${playerId1}`, {
    method: 'PUT',
    body: { nickname: '업데이트닉' },
    token: adminToken,
  });
  test('선수 수정 성공', pUpdate.status === 200);

  // 3-7. 능력치 평가 (일반 유저도 가능)
  const rating = await req(`/players/${playerId1}/ratings`, {
    method: 'POST',
    body: {
      shooting: 70, offballRun: 65, ballKeeping: 60, passing: 75, linkup: 70,
      intercept: 55, marking: 50, stamina: 80, speed: 75, physical: 65,
    },
    token: adminToken,
  });
  test('능력치 평가 저장', rating.status === 200);

  // 3-8. 모든 0 능력치 거부
  const ratingZero = await req(`/players/${playerId1}/ratings`, {
    method: 'POST',
    body: {
      shooting: 0, offballRun: 0, ballKeeping: 0, passing: 0, linkup: 0,
      intercept: 0, marking: 0, stamina: 0, speed: 0, physical: 0,
    },
    token: adminToken,
  });
  test('모두 0 능력치 거부', ratingZero.status === 400);

  // ── 4. 세션 시나리오 ─────────────────────────────
  console.log('\n【4】 세션 시나리오');

  // 4-1. 세션 생성
  const sess = await req('/sessions', {
    method: 'POST',
    body: { sessionDate: '2026-04-05', title: '테스트 세션' },
    token: adminToken,
  });
  test('세션 생성 성공', sess.status === 201 && sess.data.id);
  const sessId = sess.data.id;

  // 4-2. 날짜 형식 오류
  const sessErr = await req('/sessions', {
    method: 'POST',
    body: { sessionDate: '2026/04/05' },
    token: adminToken,
  });
  test('잘못된 날짜 형식 거부', sessErr.status === 400);

  // 4-3. 세션 목록 조회
  const sessList = await req('/sessions?limit=5', { token: adminToken });
  test('세션 목록 조회', sessList.status === 200 && Array.isArray(sessList.data.sessions));
  test('생성한 세션 포함', sessList.data.sessions?.some(s => s.id === sessId));

  // 4-4. 팀 구성 (4명)
  const attendees = playerIds.map(pid => ({ playerId: pid, isGuest: false }));
  const teams = await req(`/sessions/${sessId}/teams`, {
    method: 'POST',
    body: { attendees },
    token: adminToken,
  });
  test('팀 자동 배정 성공', teams.status === 200 && teams.data.teams?.length === 2);

  // 4-5. 세션 상세 조회
  const sessDetail = await req(`/sessions/${sessId}`);
  test('세션 상세 조회', sessDetail.status === 200);
  test('팀 2개 생성됨', sessDetail.data.teams?.length === 2);
  test('경기 생성됨', Array.isArray(sessDetail.data.matches) && sessDetail.data.matches?.length > 0);
  const matchId = sessDetail.data.matches?.[0]?.id;

  // 4-6. 경기 결과 입력
  if (matchId) {
    const matchUpdate = await req(`/matches/${matchId}`, {
      method: 'PUT',
      body: { team1Score: 3, team2Score: 1, status: 'completed' },
      token: adminToken,
    });
    test('경기 결과 입력', matchUpdate.status === 200);

    // 4-7. 매치 이벤트 추가 (teamId 필수)
    const team = sessDetail.data.teams?.[0];
    const member = team?.members?.[0];
    if (member?.player_id && team?.id) {
      const event = await req(`/matches/${matchId}/events`, {
        method: 'POST',
        body: { playerId: member.player_id, teamId: team.id, eventType: 'GOAL' },
        token: adminToken,
      });
      test('골 이벤트 추가', event.status === 201 || event.status === 200, JSON.stringify(event.data));
    } else {
      test('골 이벤트 추가 (선수 없어 스킵)', true);
    }
  }

  // 4-8. 세션 상태 변경
  const sessClose = await req(`/sessions/${sessId}`, {
    method: 'PUT',
    body: { status: 'completed' },
    token: adminToken,
  });
  test('세션 완료 처리', sessClose.status === 200);

  // ── 5. RSVP 시나리오 ─────────────────────────────
  console.log('\n【5】 RSVP 시나리오');

  // 새 모집중 세션
  const rsvpSess = await req('/sessions', {
    method: 'POST',
    body: { sessionDate: '2026-04-12', title: 'RSVP 테스트 세션' },
    token: adminToken,
  });
  const rsvpSessId = rsvpSess.data.id;

  // 5-1. 클럽 없는 유저 RSVP 불가
  const rsvpFail = await req(`/sessions/${rsvpSessId}/rsvp`, {
    method: 'POST',
    body: { status: 'going' },
    token: noClubToken,
  });
  test('클럽 없는 유저 RSVP 불가', rsvpFail.status === 403 || rsvpFail.status === 404);

  // 5-2. 어드민 RSVP 참석
  const rsvp1 = await req(`/sessions/${rsvpSessId}/rsvp`, {
    method: 'POST',
    body: { status: 'going' },
    token: adminToken,
  });
  test('RSVP 참석 등록', rsvp1.status === 200 && rsvp1.data.status === 'going');

  // 5-3. 같은 상태로 다시 → 취소 (토글)
  const rsvp2 = await req(`/sessions/${rsvpSessId}/rsvp`, {
    method: 'POST',
    body: { status: 'going' },
    token: adminToken,
  });
  test('RSVP 재클릭 → 취소', rsvp2.status === 200 && rsvp2.data.status === null);

  // 5-4. not_going 등록
  const rsvp3 = await req(`/sessions/${rsvpSessId}/rsvp`, {
    method: 'POST',
    body: { status: 'not_going' },
    token: adminToken,
  });
  test('RSVP 불참 등록', rsvp3.status === 200);

  // 5-5. going으로 전환
  const rsvp4 = await req(`/sessions/${rsvpSessId}/rsvp`, {
    method: 'POST',
    body: { status: 'going' },
    token: adminToken,
  });
  test('RSVP 불참→참석 전환', rsvp4.status === 200 && rsvp4.data.status === 'going');

  // 5-6. 세션 상세에서 RSVP 목록 확인
  const rsvpDetail = await req(`/sessions/${rsvpSessId}`);
  test('세션 상세에 RSVP 목록 존재', Array.isArray(rsvpDetail.data.rsvp));
  test('RSVP 카운트 1명', rsvpDetail.data.rsvpCount === 1);

  // ── 6. 랭킹 시나리오 ─────────────────────────────
  console.log('\n【6】 랭킹 시나리오');

  const rank = await req('/rankings', { token: adminToken });
  test('랭킹 조회 성공', rank.status === 200);
  test('랭킹 데이터 배열', Array.isArray(rank.data.data?.rankings));

  const rank2025 = await req('/rankings?year=2025', { token: adminToken });
  test('연도별 랭킹 조회', rank2025.status === 200);

  // ── 7. 멀티테넌시 격리 시나리오 ──────────────────
  console.log('\n【7】 멀티테넌시 격리 시나리오');

  // 별도 클럽 생성
  const user2 = `club2admin_${Date.now()}`;
  await req('/auth/register', {
    method: 'POST',
    body: { email: `${user2}@test.com`, username: user2, password: 'pass1234' },
  });
  const u2Login = await req('/auth/login', { method: 'POST', body: { identifier: user2, password: 'pass1234' } });
  const u2Token = u2Login.data.token;

  await req('/clubs', {
    method: 'POST',
    body: { slug: `club2-${Date.now()}`, name: '클럽B', enabledEvents: ['GOAL'] },
    token: u2Token,
  });
  const u2Relogin = await req('/auth/login', { method: 'POST', body: { identifier: user2, password: 'pass1234' } });
  const u2AdminToken = u2Relogin.data.token;

  // 7-1. 클럽A 선수는 클럽B에서 안 보임
  const club2Players = await req('/players', { token: u2AdminToken });
  const hasClub1Player = club2Players.data.players?.some(p => p.id === playerId1);
  test('클럽B는 클럽A 선수 못 봄', !hasClub1Player);

  // 7-2. 클럽A 세션은 클럽B에서 안 보임
  const club2Sessions = await req('/sessions', { token: u2AdminToken });
  const hasClub1Session = club2Sessions.data.sessions?.some(s => s.id === sessId);
  test('클럽B는 클럽A 세션 못 봄', !hasClub1Session);

  // 7-3. 클럽B가 클럽A 세션에 RSVP 시도
  const crossRsvp = await req(`/sessions/${sessId}/rsvp`, {
    method: 'POST',
    body: { status: 'going' },
    token: u2AdminToken,
  });
  test('타 클럽 세션 RSVP 거부', crossRsvp.status !== 200, `got ${crossRsvp.status}`);

  // ── 8. 알림 시나리오 ─────────────────────────────
  console.log('\n【8】 알림 시나리오');

  const notifs = await req('/notifications?limit=10', { token: adminToken });
  test('알림 조회 성공', notifs.status === 200 && Array.isArray(notifs.data.notifications));

  // 토큰 없이 알림 조회
  const notifsNoAuth = await req('/notifications');
  test('토큰 없이 알림 거부', notifsNoAuth.status === 401);

  // ── 9. 프로필 수정 시나리오 ───────────────────────
  console.log('\n【9】 프로필 수정 시나리오');

  const profileUpdate = await req('/auth/profile', {
    method: 'PUT',
    body: { displayName: '테스터닉네임' },
    token: adminToken,
  });
  test('프로필 수정 성공', profileUpdate.status === 200);

  // 비밀번호 변경
  const pwChange = await req('/auth/password', {
    method: 'PUT',
    body: { oldPassword: 'pass1234', newPassword: 'newpass5678' },
    token: adminToken,
  });
  test('비밀번호 변경 성공', pwChange.status === 200);

  // 변경된 비밀번호로 로그인
  const newLogin = await req('/auth/login', {
    method: 'POST',
    body: { identifier: testUser, password: 'newpass5678' },
  });
  test('새 비밀번호로 로그인', newLogin.status === 200);

  // 구 비밀번호로 로그인 실패
  const oldLogin = await req('/auth/login', {
    method: 'POST',
    body: { identifier: testUser, password: 'pass1234' },
  });
  test('구 비밀번호 로그인 실패', oldLogin.status === 401);

  // ── 결과 ──────────────────────────────────────────
  console.log('\n========================================');
  console.log(`  결과: ✅ ${passed}개 통과 / ❌ ${failed}개 실패`);
  console.log('========================================');

  if (failed > 0) process.exit(1);
}

main().catch(e => {
  console.error('\n테스트 오류:', e.message);
  process.exit(1);
});
