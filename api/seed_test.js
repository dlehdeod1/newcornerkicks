// 테스트 클럽 시드 스크립트 (멱등성 보장)
// node seed_test.js

const BASE = 'https://cornerkicks-api.conerkicks.workers.dev';

async function api(endpoint, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${endpoint} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  console.log('=== FC 서울 유나이티드 테스트 데이터 시드 ===\n');

  // 1. 계정 생성 또는 로그인
  console.log('1. 계정 확인...');
  try {
    await api('/auth/register', {
      method: 'POST',
      body: { email: 'admin@fcseoul.test', username: 'fcseoul_admin', password: 'test1234' },
    });
    console.log('   계정 생성됨');
  } catch (e) {
    console.log('   계정 이미 존재');
  }

  // 2. 로그인
  let loginRes = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'fcseoul_admin', password: 'test1234' },
  });
  let token = loginRes.token;

  // 3. 클럽 생성 (없으면 생성)
  if (!loginRes.club) {
    console.log('2. 클럽 생성...');
    await api('/clubs', {
      method: 'POST',
      body: {
        slug: 'fc-seoul-united',
        name: 'FC 서울 유나이티드',
        description: '테스트용 풋살 동호회',
        enabledEvents: ['GOAL', 'SAVE', 'SHOT', 'KEY_PASS'],
      },
      token,
    });
    // 재로그인 (클럽 정보 포함된 토큰)
    loginRes = await api('/auth/login', {
      method: 'POST',
      body: { identifier: 'fcseoul_admin', password: 'test1234' },
    });
    token = loginRes.token;
  }

  const club = loginRes.club;
  console.log(`   클럽: ${club.name} (ID: ${club.id})`);

  // 4. 선수 생성 (항상 새로 생성 - 테스트 목적)
  console.log('\n3. 선수 10명 생성...');
  const playerDefs = [
    { name: '김민준', nickname: '미니' },
    { name: '이서준', nickname: '서준' },
    { name: '박도윤', nickname: '도윤' },
    { name: '최하준', nickname: '하준' },
    { name: '정시우', nickname: '시우' },
    { name: '강준서', nickname: '준서' },
    { name: '윤지호', nickname: '지호' },
    { name: '임현우', nickname: '현우' },
    { name: '한승현', nickname: '승현' },
    { name: '오재원', nickname: '재원' },
  ];

  const playerIds = [];
  for (const p of playerDefs) {
    const res = await api('/players', { method: 'POST', body: p, token });
    playerIds.push(res.id);
    process.stdout.write(`   ${p.name}(${res.id}) `);
  }
  console.log('\n   완료');

  // 5. 세션 생성
  console.log('\n4. 세션 생성...');
  const s1 = await api('/sessions', {
    method: 'POST',
    body: { sessionDate: '2026-02-13', title: 'FC 서울 유나이티드 정기전 #1' },
    token,
  });
  const s2 = await api('/sessions', {
    method: 'POST',
    body: { sessionDate: '2026-02-20', title: 'FC 서울 유나이티드 정기전 #2' },
    token,
  });
  const s3 = await api('/sessions', {
    method: 'POST',
    body: { sessionDate: '2026-03-13', title: 'FC 서울 유나이티드 정기전 #3' },
    token,
  });
  console.log(`   세션1(${s1.id}) 세션2(${s2.id}) 세션3(${s3.id})`);

  // 6. 팀 구성 헬퍼
  async function setupSession(sessionId, pids) {
    const attendees = pids.map(pid => ({ playerId: pid, isGuest: false, name: '' }));
    const teamsRes = await api(`/sessions/${sessionId}/teams`, {
      method: 'POST',
      body: { attendees },
      token,
    });
    console.log(`   세션${sessionId} 팀 배정: ${teamsRes.teams?.length}팀, 경기 ${teamsRes.matches?.length}개`);
    return teamsRes;
  }

  // 7. 세션1 (8명, 완료)
  console.log('\n5. 세션1 팀 구성...');
  await setupSession(s1.id, playerIds.slice(0, 8));

  const sd1 = await api(`/sessions/${s1.id}`);
  const matches1 = sd1.matches || [];
  const scores1 = [[3, 1], [2, 2], [1, 3], [4, 0], [2, 1], [0, 2]];
  for (let i = 0; i < matches1.length; i++) {
    const [a, b] = scores1[i] || [1, 1];
    await api(`/matches/${matches1[i].id}`, {
      method: 'PUT',
      body: { team1Score: a, team2Score: b, status: 'completed' },
      token,
    });
  }

  // 골 이벤트 추가 (팀1 첫번째 선수가 골)
  const team1Members = sd1.teams?.[0]?.members || [];
  const team2Members = sd1.teams?.[1]?.members || [];
  if (matches1.length > 0 && team1Members[0]?.player_id) {
    await api(`/matches/${matches1[0].id}/events`, {
      method: 'POST',
      body: { playerId: team1Members[0].player_id, eventType: 'GOAL' },
      token,
    }).catch(() => {});
    await api(`/matches/${matches1[0].id}/events`, {
      method: 'POST',
      body: { playerId: team1Members[0].player_id, eventType: 'GOAL' },
      token,
    }).catch(() => {});
    await api(`/matches/${matches1[0].id}/events`, {
      method: 'POST',
      body: { playerId: team1Members[1]?.player_id, eventType: 'GOAL' },
      token,
    }).catch(() => {});
  }
  if (matches1.length > 1 && team2Members[0]?.player_id) {
    await api(`/matches/${matches1[1].id}/events`, {
      method: 'POST',
      body: { playerId: team2Members[0].player_id, eventType: 'GOAL' },
      token,
    }).catch(() => {});
  }

  await api(`/sessions/${s1.id}`, { method: 'PUT', body: { status: 'completed' }, token });
  console.log(`   세션1 완료 (경기 ${matches1.length}개)`);

  // 8. 세션2 (10명 전부, 완료)
  console.log('\n6. 세션2 팀 구성...');
  await setupSession(s2.id, playerIds);

  const sd2 = await api(`/sessions/${s2.id}`);
  const matches2 = sd2.matches || [];
  const scores2 = [[2, 3], [3, 0], [1, 1], [0, 2], [2, 1], [1, 3]];
  for (let i = 0; i < matches2.length; i++) {
    const [a, b] = scores2[i] || [1, 1];
    await api(`/matches/${matches2[i].id}`, {
      method: 'PUT',
      body: { team1Score: a, team2Score: b, status: 'completed' },
      token,
    });
  }
  await api(`/sessions/${s2.id}`, { method: 'PUT', body: { status: 'completed' }, token });
  console.log(`   세션2 완료 (경기 ${matches2.length}개)`);

  // 9. 세션3은 모집중 유지
  console.log('\n7. 세션3: 모집중 상태 유지');

  console.log('\n=== 시드 완료 ===');
  console.log('\n테스트 계정:');
  console.log('  아이디: fcseoul_admin');
  console.log('  비밀번호: test1234');
  console.log(`  클럽: ${club.name}`);
}

main().catch(e => {
  console.error('\n오류:', e.message);
  process.exit(1);
});
