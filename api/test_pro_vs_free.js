// PRO vs FREE 플랜 기능 비교 테스트
const BASE = 'https://cornerkicks-api.conerkicks.workers.dev';
async function req(endpoint, opts = {}) {
  const headers = {'Content-Type': 'application/json'};
  if (opts.token) headers['Authorization'] = 'Bearer ' + opts.token;
  const res = await fetch(BASE + endpoint, {
    method: opts.method || 'GET', headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

let pass = 0, fail = 0;
function t(name, ok, detail) {
  if (ok) { console.log('  ✅', name); pass++; }
  else { console.log('  ❌', name, detail ? '→ '+detail : ''); fail++; }
}

async function run() {
  // ── PRO 어드민 재로그인 ──────────────────────────
  console.log('[ PRO 플랜 어드민 테스트 ]');
  const login = await req('/auth/login', { method:'POST', body:{ identifier:'pro_admin_test', password:'protest1234' }});
  const token = login.data && login.data.token;
  const club = login.data && login.data.club;
  t('PRO 어드민 로그인', login.status === 200);
  t('planType=pro (login)', club && club.planType === 'pro', 'planType=' + (club && club.planType));

  const me = await req('/auth/me', { token: token });
  t('planType=pro (/me)', me.data && me.data.club && me.data.club.planType === 'pro', 'planType=' + (me.data && me.data.club && me.data.club.planType));

  // ── 세션 + 선수 생성 ──────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const sess = await req('/sessions', { method:'POST', body:{ sessionDate: today, title:'PRO 테스트 세션' }, token: token });
  t('세션 생성', sess.status === 201, JSON.stringify(sess.data));
  const sessionId = sess.data && sess.data.sessionId;

  const names = ['김프로', '이프로', '박프로', '최프로', '정프로', '강프로'];
  const playerIds = [];
  for (const name of names) {
    const p = await req('/players', { method:'POST', body:{ name: name }, token: token });
    if (p.data && p.data.playerId) playerIds.push(p.data.playerId);
  }
  t('선수 6명 추가', playerIds.length === 6, playerIds.length + '명');

  // ── PRO 팀 편성 ───────────────────────────────────
  if (sessionId && playerIds.length >= 4) {
    const attendees = playerIds.map(function(id) { return { playerId: id, isGuest: false }; });
    const teamsRes = await req('/sessions/' + sessionId + '/teams', { method:'POST', body:{ attendees: attendees }, token: token });
    t('PRO 팀 편성 성공', teamsRes.status === 200, teamsRes.data && teamsRes.data.message);
    t('isPro=true 반환', teamsRes.data && teamsRes.data.isPro === true, 'isPro=' + (teamsRes.data && teamsRes.data.isPro));
    t('AI 편성 메시지', teamsRes.data && teamsRes.data.message && teamsRes.data.message.includes('AI'), 'msg=' + (teamsRes.data && teamsRes.data.message));

    // ── PRO AI 세션 분석 ──────────────────────────────
    const aiRes = await req('/sessions/' + sessionId + '/ai-analysis', { method:'POST', token: token });
    t('PRO AI 분석 → 403 아님 (게이트 통과)', aiRes.status !== 403, 'status=' + aiRes.status);
    t('PRO AI 분석 → 유효 응답(200/400/500)', [200,400,500].includes(aiRes.status), 'status=' + aiRes.status);
    console.log('  AI분석 응답:', aiRes.status, JSON.stringify(aiRes.data).slice(0, 150));
  }

  // ── FREE 플랜과 비교 ──────────────────────────────
  console.log('\n[ FREE 플랜 비교 ]');
  const fcLogin = await req('/auth/login', { method:'POST', body:{ identifier:'fcseoul_admin', password:'test1234' }});
  const fcToken = fcLogin.data && fcLogin.data.token;
  const fcClub = fcLogin.data && fcLogin.data.club;
  t('FREE 어드민 로그인', fcLogin.status === 200);
  t('planType=free', fcClub && fcClub.planType === 'free', 'planType=' + (fcClub && fcClub.planType));

  const fcSessions = await req('/sessions?limit=1', { token: fcToken });
  const fcSid = fcSessions.data && fcSessions.data.sessions && fcSessions.data.sessions[0] && fcSessions.data.sessions[0].id;

  if (fcSid) {
    const fcAi = await req('/sessions/' + fcSid + '/ai-analysis', { method:'POST', token: fcToken });
    t('FREE AI분석 → 403 차단', fcAi.status === 403, 'status=' + fcAi.status + ' err=' + (fcAi.data && fcAi.data.error));
  }

  // ── 초대코드 재생성 ───────────────────────────────
  console.log('\n[ 초대코드 재생성 ]');
  const me2 = await req('/auth/me', { token: token });
  const oldCode = me2.data && me2.data.club && me2.data.club.inviteCode;
  const regen = await req('/clubs/me/regenerate-invite', { method:'POST', token: token });
  t('재생성 성공', regen.status === 200);
  const newCode = regen.data && regen.data.inviteCode;
  t('코드 변경됨', newCode && newCode !== oldCode, oldCode + ' → ' + newCode);
  console.log('  ' + oldCode + ' → ' + newCode);

  // ── 결과 ──────────────────────────────────────────
  console.log('\n' + '─'.repeat(40));
  console.log('결과:', pass + '/' + (pass + fail) + ' 통과', fail > 0 ? '(' + fail + '개 실패)' : '✅ 전부 통과');
}

run().catch(console.error);
