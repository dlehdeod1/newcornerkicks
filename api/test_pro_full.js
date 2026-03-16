// PRO vs FREE 플랜 완전 검증
const BASE = 'https://cornerkicks-api.conerkicks.workers.dev';
async function req(endpoint, opts) {
  opts = opts || {};
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
  else { console.log('  ❌', name, detail ? '→ ' + detail : ''); fail++; }
}

async function run() {
  // ── PRO 어드민 ────────────────────────────────────
  console.log('[ PRO 플랜 어드민 ]');
  const login = await req('/auth/login', { method:'POST', body:{ identifier:'pro_admin_test', password:'protest1234' }});
  const token = login.data.token;
  t('PRO 로그인', login.status === 200);
  t('planType=pro (login)', login.data.club && login.data.club.planType === 'pro', String(login.data.club && login.data.club.planType));

  const me = await req('/auth/me', { token: token });
  t('planType=pro (/me)', me.data.club && me.data.club.planType === 'pro', String(me.data.club && me.data.club.planType));

  // 기존 선수 사용
  const playersRes = await req('/players', { token: token });
  const playerIds = (playersRes.data.players || []).slice(0, 6).map(function(p) { return p.id; });
  t('선수 6명 확보', playerIds.length >= 6, playerIds.length + '명');

  // 세션 확보
  const sessionsRes = await req('/sessions?limit=3', { token: token });
  const sessions = sessionsRes.data.sessions || [];
  const sessionId = sessions.length > 0 ? sessions[0].id : null;
  const hasSession = sessionId !== null;
  t('세션 확보', hasSession, 'id=' + sessionId);

  if (hasSession && playerIds.length >= 4) {
    // PRO 팀 편성
    const attendees = playerIds.map(function(id) { return { playerId: id, isGuest: false }; });
    const teamsRes = await req('/sessions/' + sessionId + '/teams', { method:'POST', body:{ attendees: attendees }, token: token });
    t('PRO 팀 편성 성공(200)', teamsRes.status === 200, teamsRes.data.message);
    t('isPro=true 반환', teamsRes.data.isPro === true, 'isPro=' + teamsRes.data.isPro);
    t('메시지에 AI 포함', teamsRes.data.message && teamsRes.data.message.indexOf('AI') >= 0, teamsRes.data.message);

    // PRO AI 세션 분석 게이트 통과 확인
    const aiRes = await req('/sessions/' + sessionId + '/ai-analysis', { method:'POST', token: token });
    t('PRO AI분석 → 403 아님 (게이트 통과)', aiRes.status !== 403, 'status=' + aiRes.status);
    t('PRO AI분석 → 유효 응답(200/400/500)', [200, 400, 500].indexOf(aiRes.status) >= 0, 'status=' + aiRes.status);
    console.log('  AI분석 결과:', aiRes.status, JSON.stringify(aiRes.data).slice(0, 200));
  }

  // ── FREE 플랜 비교 ────────────────────────────────
  console.log('\n[ FREE 플랜 비교 ]');
  const fcLogin = await req('/auth/login', { method:'POST', body:{ identifier:'fcseoul_admin', password:'test1234' }});
  const fcToken = fcLogin.data.token;
  t('FREE 로그인', fcLogin.status === 200);
  t('planType=free', fcLogin.data.club && fcLogin.data.club.planType === 'free', String(fcLogin.data.club && fcLogin.data.club.planType));

  const fcSessRes = await req('/sessions?limit=1', { token: fcToken });
  const fcSessions = fcSessRes.data.sessions || [];
  const fcSid = fcSessions.length > 0 ? fcSessions[0].id : null;

  if (fcSid) {
    // FREE AI 분석 → 403 차단
    const fcAi = await req('/sessions/' + fcSid + '/ai-analysis', { method:'POST', token: fcToken });
    t('FREE AI분석 → 403 차단', fcAi.status === 403, 'status=' + fcAi.status + ' msg=' + fcAi.data.error);
  }

  // FREE 팀 편성 → 랜덤 메시지
  const fcPlayersRes = await req('/players', { token: fcToken });
  const fcPids = (fcPlayersRes.data.players || []).slice(0, 4).map(function(p) { return p.id; });
  const fcRecrRes = await req('/sessions?limit=1&status=recruiting', { token: fcToken });
  const fcRecrSessions = fcRecrRes.data.sessions || [];
  const fcRecrSid = fcRecrSessions.length > 0 ? fcRecrSessions[0].id : null;

  if (fcRecrSid && fcPids.length >= 4) {
    const fcAtt = fcPids.map(function(id) { return { playerId: id, isGuest: false }; });
    const fcTeams = await req('/sessions/' + fcRecrSid + '/teams', { method:'POST', body:{ attendees: fcAtt }, token: fcToken });
    t('FREE 팀 편성 성공(200)', fcTeams.status === 200);
    t('isPro=false 반환', fcTeams.data.isPro === false, 'isPro=' + fcTeams.data.isPro);
    t('메시지에 🎲 포함', fcTeams.data.message && fcTeams.data.message.indexOf('🎲') >= 0, fcTeams.data.message);
  } else {
    console.log('  (모집중 세션 없어 팀편성 스킵, sid=' + fcRecrSid + ', 선수수=' + fcPids.length + ')');
  }

  // ── 초대코드 재생성 ───────────────────────────────
  console.log('\n[ 초대코드 재생성 ]');
  const me2 = await req('/auth/me', { token: token });
  const oldCode = me2.data.club ? me2.data.club.inviteCode : null;
  const regen = await req('/clubs/me/regenerate-invite', { method:'POST', token: token });
  t('재생성 성공(200)', regen.status === 200);
  t('새 코드 반환', regen.data.inviteCode !== undefined);
  t('코드 변경됨', regen.data.inviteCode && regen.data.inviteCode !== oldCode, oldCode + ' → ' + regen.data.inviteCode);
  console.log('  ' + oldCode + ' → ' + regen.data.inviteCode);

  // ── 결과 ──────────────────────────────────────────
  console.log('\n' + '─'.repeat(40));
  console.log('결과: ' + pass + '/' + (pass + fail) + ' 통과', fail > 0 ? '(' + fail + '개 실패)' : '✅ 전부 통과');
}

run().catch(console.error);
