// 신규 기능 테스트: planType, 초대코드 재생성, AI 게이팅, 광고 배너 로직
// node test_new_features.js

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
    console.log(`  ❌ ${name}${detail ? ' → ' + detail : ''}`);
    failed++;
  }
}

async function run() {
  console.log('=== 신규 기능 테스트 ===\n');

  // ─── 1. planType 응답 포함 여부 ───────────────────────────
  console.log('[ 1. planType 응답 ]');

  // 기존 코너킥스 어드민 로그인
  const loginRes = await req('/auth/login', { method: 'POST', body: { identifier: 'admin', password: 'admin1234' } });
  const adminToken = loginRes.data?.token;
  const adminClub = loginRes.data?.club;
  test('로그인 성공', loginRes.status === 200, JSON.stringify(loginRes.data).slice(0, 100));
  test('club.planType 포함 (login)', adminClub?.planType !== undefined, `planType=${adminClub?.planType}`);

  // /me 응답에도 planType 있는지
  if (adminToken) {
    const meRes = await req('/auth/me', { token: adminToken });
    const meClub = meRes.data?.club;
    test('club.planType 포함 (/me)', meClub?.planType !== undefined, `planType=${meClub?.planType}`);
  }

  // FC 서울 유나이티드 (free 플랜) 로그인
  const fcRes = await req('/auth/login', { method: 'POST', body: { identifier: 'fcseoul_admin', password: 'test1234' } });
  const fcToken = fcRes.data?.token;
  const fcClub = fcRes.data?.club;
  test('FC서울 로그인', fcRes.status === 200, JSON.stringify(fcRes.data).slice(0, 80));
  test('FC서울 planType=free', fcClub?.planType === 'free', `planType=${fcClub?.planType}`);

  // ─── 2. 초대코드 재생성 ──────────────────────────────────
  console.log('\n[ 2. 초대코드 재생성 ]');

  if (adminToken) {
    // 기존 코드 확인
    const meRes = await req('/auth/me', { token: adminToken });
    const oldCode = meRes.data?.club?.inviteCode;
    console.log(`  기존 초대코드: ${oldCode}`);

    const regenRes = await req('/clubs/me/regenerate-invite', { method: 'POST', token: adminToken });
    test('재생성 성공 (200)', regenRes.status === 200, JSON.stringify(regenRes.data));
    test('새 코드 반환', regenRes.data?.inviteCode !== undefined, `newCode=${regenRes.data?.inviteCode}`);
    test('코드 변경됨', regenRes.data?.inviteCode !== oldCode, `old=${oldCode} new=${regenRes.data?.inviteCode}`);
  }

  if (fcToken) {
    // 비어드민 유저로 재생성 시도 (member 계정)
    // fcseoul_admin은 admin이므로 다른 멤버 계정 필요 → 직접 DB 없이 fcToken으로 테스트는 admin이라 성공해야 함
    const regenRes = await req('/clubs/me/regenerate-invite', { method: 'POST', token: fcToken });
    test('FC서울 어드민도 재생성 가능', regenRes.status === 200, JSON.stringify(regenRes.data));
  }

  // ─── 3. AI 분석 PRO 게이팅 ───────────────────────────────
  console.log('\n[ 3. AI 세션 분석 PRO 게이팅 ]');

  if (fcToken) {
    // FC서울(free) 세션 목록 가져오기
    const sessionsRes = await req('/sessions?limit=5', { token: fcToken });
    const sessions = sessionsRes.data?.sessions ?? [];
    console.log(`  FC서울 세션 수: ${sessions.length}`);

    if (sessions.length > 0) {
      const sid = sessions[0].id;
      // free 플랜으로 AI 분석 시도 → 403이어야 함
      const analysisRes = await req(`/sessions/${sid}/ai-analysis`, { method: 'POST', token: fcToken });
      test('free 플랜 AI분석 → 403 거부', analysisRes.status === 403, `status=${analysisRes.status}, msg=${analysisRes.data?.error}`);
    } else {
      console.log('  (세션 없어서 AI 게이팅 테스트 스킵)');
    }
  }

  if (adminToken) {
    // 코너킥스(플랜 확인 필요) 세션으로 AI 분석 시도
    const sessionsRes = await req('/sessions?limit=3', { token: adminToken });
    const sessions = sessionsRes.data?.sessions ?? [];
    const planType = adminClub?.planType;
    console.log(`  코너킥스 planType=${planType}, 세션수=${sessions.length}`);

    if (sessions.length > 0) {
      const sid = sessions[0].id;
      const analysisRes = await req(`/sessions/${sid}/ai-analysis`, { method: 'POST', token: adminToken });
      if (planType === 'pro') {
        // pro면 403이 아니어야 함 (400이나 200)
        test('pro 플랜 AI분석 → 403 아님', analysisRes.status !== 403, `status=${analysisRes.status}`);
      } else {
        // free면 403이어야 함
        test('코너킥스 free AI분석 → 403', analysisRes.status === 403, `status=${analysisRes.status}`);
      }
    }
  }

  // ─── 4. 팀 편성 planType 분기 ────────────────────────────
  console.log('\n[ 4. 팀 편성 planType 분기 ]');

  if (fcToken) {
    const sessionsRes = await req('/sessions?status=recruiting&limit=3', { token: fcToken });
    const sessions = sessionsRes.data?.sessions ?? [];

    if (sessions.length > 0) {
      const sid = sessions[0].id;
      // 선수 목록 가져오기
      const playersRes = await req('/players', { token: fcToken });
      const players = (playersRes.data?.players ?? []).filter((p) => !p.is_guest).slice(0, 6);

      if (players.length >= 4) {
        const attendees = players.map((p) => ({ playerId: p.id, isGuest: false }));
        const teamsRes = await req(`/sessions/${sid}/teams`, { method: 'POST', body: { attendees }, token: fcToken });
        test('free 팀 편성 성공 (200)', teamsRes.status === 200, `status=${teamsRes.status}`);
        test('free 메시지에 "랜덤" 또는 "편성" 포함', teamsRes.data?.message?.includes('편성'), `msg=${teamsRes.data?.message}`);
        test('isPro=false 반환', teamsRes.data?.isPro === false, `isPro=${teamsRes.data?.isPro}`);
        console.log(`  메시지: ${teamsRes.data?.message}`);
      } else {
        console.log(`  (선수 ${players.length}명 → 팀편성 테스트 스킵)`);
      }
    } else {
      console.log('  (모집중 세션 없어서 팀 편성 테스트 스킵)');
    }
  }

  // ─── 5. 결과 ─────────────────────────────────────────────
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`결과: ${passed}/${passed + failed} 통과 ${failed > 0 ? `(${failed}개 실패)` : '✅'}`);
}

run().catch(console.error);
