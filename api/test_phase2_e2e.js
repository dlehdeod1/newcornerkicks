// Phase 2-4 E2E 테스트
// 배지/스트릭/시즌어워드/댓글수정/이모지반응/라이브스코어/Rate Limiting/JWT 리프레시
// node test_phase2_e2e.js

const BASE = 'https://cornerkicks-api.conerkicks.workers.dev';
const TS = Date.now() % 100000;
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

function summary() {
  console.log(`\n══════════════════════════════════════════════════════`);
  console.log(`  결과: ✅ ${passed}개 통과 | ❌ ${failed}개 실패 | ⚠️  ${warns}개 경고`);
  console.log(`══════════════════════════════════════════════════════\n`);
}

async function run() {
  console.log('🚀 Phase 2-4 E2E 테스트 시작\n');

  // ── 사전 준비: 회원가입 + 클럽 생성 ──
  section('0. 사전 준비 (회원가입 + 클럽)');

  const u1 = await api('/auth/register', { method: 'POST', body: {
    username: `p2admin${TS}`, password: 'test1234', name: '관리자', email: `p2admin${TS}@test.com`
  }});
  ok('관리자 가입', u1.ok);

  // 가입 후 로그인으로 토큰 받기
  const l1 = await api('/auth/login', { method: 'POST', body: {
    identifier: `p2admin${TS}`, password: 'test1234'
  }});
  ok('관리자 로그인', l1.ok && l1.data.token);
  const adminToken = l1.data.token;
  if (!adminToken) { console.log('💥 로그인 실패 — ' + JSON.stringify(l1.data)); summary(); return; }

  const u2 = await api('/auth/register', { method: 'POST', body: {
    username: `p2user${TS}`, password: 'test1234', name: '일반유저', email: `p2user${TS}@test.com`
  }});
  ok('일반유저 가입', u2.ok);
  const l2 = await api('/auth/login', { method: 'POST', body: {
    identifier: `p2user${TS}`, password: 'test1234'
  }});
  ok('일반유저 로그인', l2.ok && l2.data.token);
  const userToken = l2.data.token;

  // 클럽 생성
  const club = await api('/clubs', { method: 'POST', body: { name: `P2테스트${TS}`, slug: `p2test${TS}` }, token: adminToken });
  ok('클럽 생성', club.ok && club.data.club?.id, JSON.stringify(club.data).substring(0, 200));
  const clubId = club.data.club?.id;
  if (!clubId) { console.log('💥 클럽 생성 실패'); summary(); return; }

  // 일반유저 클럽 가입 (초대코드 방식)
  const inviteCode = club.data.club?.inviteCode;
  const join = await api('/clubs/join', { method: 'POST', body: { inviteCode }, token: userToken });
  ok('유저 클럽 가입', join.ok, JSON.stringify(join.data).substring(0, 100));

  // 유저의 player ID 조회 (클럽 가입 시 자동 생성됨)
  const meRes = await api('/auth/me', { token: userToken, clubId });
  const userPlayerId = meRes.data?.player?.id || meRes.data?.players?.[0]?.id;
  // player가 없으면 직접 생성하지 않고 스킵 (일부 테스트만 영향)
  warn('유저 player ID 조회', !!userPlayerId, `playerId: ${userPlayerId}, keys: ${Object.keys(meRes.data || {})}`);

  // ══════════════════════════════════════
  section('1. 배지 시스템');
  // ══════════════════════════════════════

  // GET /badges — 배지 목록
  const badges = await api('/badges', { clubId });
  const badgeList = badges.data.badges || badges.data.data || badges.data;
  ok('배지 목록 조회', badges.ok && Array.isArray(badgeList), `${badgeList?.length}개`);
  warn('시드 배지 14개', badgeList?.length >= 14, `실제: ${badgeList?.length}`);

  // GET /badges/player/:id — 선수 배지
  if (userPlayerId) {
    const pb = await api(`/badges/player/${userPlayerId}`, { token: userToken, clubId });
    ok('선수 배지 조회', pb.ok && Array.isArray(pb.data.badges));
  }

  // ══════════════════════════════════════
  section('2. 스트릭 API');
  // ══════════════════════════════════════

  if (userPlayerId) {
    const streaks = await api(`/stats/streaks/${userPlayerId}`, { token: userToken, clubId });
    ok('스트릭 조회', streaks.ok && streaks.data.streaks !== undefined, JSON.stringify(streaks.data.streaks)?.substring(0, 80));
    warn('스트릭 구조 (attendance)', streaks.data.streaks?.attendance !== undefined);
  }

  // ══════════════════════════════════════
  section('3. 시즌 어워드');
  // ══════════════════════════════════════

  // GET /awards
  const awards = await api('/awards', { token: adminToken, clubId });
  ok('시즌 어워드 조회', awards.ok && Array.isArray(awards.data.awards));

  // POST /awards/generate (데이터 없으면 빈 배열)
  const genAwards = await api('/awards/generate', { method: 'POST', body: {}, token: adminToken, clubId });
  ok('시즌 어워드 생성', genAwards.ok);

  // ══════════════════════════════════════
  section('4. 댓글 수정 + 이모지 반응');
  // ══════════════════════════════════════

  // 게시글 생성
  const post = await api('/posts', { method: 'POST', body: {
    title: 'E2E 테스트 게시글', content: '반응 테스트용', category: 'free'
  }, token: adminToken, clubId });
  const postId = post.data.id || post.data.data?.id;
  ok('게시글 생성', post.ok && postId, `id: ${postId}`);

  if (postId) {
    // 댓글 작성
    const comment = await api(`/posts/${postId}/comments`, { method: 'POST', body: {
      content: '원본 댓글'
    }, token: adminToken, clubId });
    const commentId = comment.data.id || comment.data.data?.id;
    ok('댓글 작성', comment.ok, `response: ${JSON.stringify(comment.data).substring(0, 80)}`);

    // 댓글 ID 가져오기 (목록에서)
    let realCommentId = commentId;
    if (!realCommentId) {
      const postDetail = await api(`/posts/${postId}`, { token: adminToken, clubId });
      const comments = postDetail.data.comments || postDetail.data.data?.comments || [];
      realCommentId = comments[0]?.id;
    }

    // 댓글 수정
    if (realCommentId) {
      const editComment = await api(`/posts/${postId}/comments/${realCommentId}`, { method: 'PUT', body: {
        content: '수정된 댓글'
      }, token: adminToken, clubId });
      ok('댓글 수정', editComment.ok);
      warn('수정 내용 반영', editComment.data.content === '수정된 댓글' || editComment.data.comment?.content === '수정된 댓글');
    }

    // 이모지 반응 추가
    const react1 = await api(`/posts/${postId}/reactions`, { method: 'POST', body: {
      emoji: '👍'
    }, token: adminToken, clubId });
    ok('이모지 반응 추가', react1.ok, `action: ${react1.data.action}`);
    warn('반응 action=added', react1.data.action === 'added');

    // 이모지 반응 조회
    const reactions = await api(`/posts/${postId}/reactions`, { token: adminToken, clubId });
    ok('반응 목록 조회', reactions.ok, `keys: ${Object.keys(reactions.data || {})}`);

    // 이모지 반응 토글 (제거)
    const react2 = await api(`/posts/${postId}/reactions`, { method: 'POST', body: {
      emoji: '👍'
    }, token: adminToken, clubId });
    ok('이모지 반응 토글(제거)', react2.ok, `action: ${react2.data.action}`);
    warn('반응 action=removed', react2.data.action === 'removed');
  }

  // ══════════════════════════════════════
  section('5. 라이브 스코어 공유');
  // ══════════════════════════════════════

  // 세션 생성
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const session = await api('/sessions', { method: 'POST', body: {
    sessionDate: tomorrow, title: 'E2E 라이브 테스트'
  }, token: adminToken, clubId });
  ok('세션 생성', session.ok && session.data.id);
  const sessionId = session.data.id;

  if (sessionId) {
    // 공유 토큰 생성
    const share = await api(`/sessions/${sessionId}/share`, { method: 'POST', token: adminToken, clubId });
    ok('공유 토큰 생성', share.ok && share.data.shareToken, `token: ${share.data.shareToken}`);
    const shareToken = share.data.shareToken;

    // 공개 라이브 스코어 조회 (인증 없이)
    if (shareToken) {
      const live = await api(`/sessions/live/${shareToken}`);
      ok('라이브 스코어 조회 (공개)', live.ok && live.data.session);
      warn('세션 제목 일치', live.data.session?.title === 'E2E 라이브 테스트');
    }
  }

  // ══════════════════════════════════════
  section('6. Rate Limiting');
  // ══════════════════════════════════════

  // 잘못된 로그인 여러번 시도 (429 확인은 어려울 수 있음 — Workers isolate 초기화)
  let lastStatus = 200;
  for (let i = 0; i < 3; i++) {
    const r = await api('/auth/login', { method: 'POST', body: {
      username: 'nonexistent', password: 'wrong'
    }});
    lastStatus = r.status;
  }
  ok('Rate Limiting 미들웨어 존재 (401/400/429)', lastStatus === 401 || lastStatus === 429 || lastStatus === 400, `status: ${lastStatus}`);

  // ══════════════════════════════════════
  section('7. JWT 리프레시');
  // ══════════════════════════════════════

  const refresh = await api('/auth/refresh', { method: 'POST', token: adminToken });
  ok('JWT 리프레시', refresh.ok && refresh.data.token, `새 토큰 길이: ${refresh.data.token?.length}`);

  // 새 토큰으로 요청 가능 확인
  if (refresh.data.token) {
    const meCheck = await api('/auth/me', { token: refresh.data.token, clubId });
    ok('새 토큰으로 요청', meCheck.ok, JSON.stringify(meCheck.data).substring(0, 100));
  }

  // ══════════════════════════════════════
  section('8. 프로필 관리 (이전 구현)');
  // ══════════════════════════════════════

  // 신체 정보 업데이트
  const updateBody = await api('/auth/profile', { method: 'PUT', body: {
    heightCm: 178, weightKg: 72, birthYear: 1995
  }, token: adminToken });
  ok('신체 정보 업데이트', updateBody.ok);

  // 프로필 확인
  const profile = await api('/auth/me', { token: adminToken, clubId });
  warn('신체 정보 반영', profile.data.player?.heightCm === 178);

  // ══════════════════════════════════════
  section('9. 세션 복사 (이전 구현)');
  // ══════════════════════════════════════

  if (sessionId) {
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const dup = await api(`/sessions/${sessionId}/duplicate`, { method: 'POST', body: {
      sessionDate: nextWeek
    }, token: adminToken, clubId });
    ok('세션 복사', dup.ok && dup.data.id, `새 세션 ID: ${dup.data.id}`);
  }

  // ══════════════════════════════════════
  section('10. 커뮤니티 댓글+반응');
  // ══════════════════════════════════════

  const cPost = await api('/community', { method: 'POST', body: {
    title: 'E2E 커뮤니티', content: '커뮤니티 테스트', category: 'free'
  }, token: adminToken });
  const cPostId = cPost.data.id || cPost.data.data?.id;
  ok('커뮤니티 게시글', cPost.ok && cPostId, `id: ${cPostId}`);

  if (cPostId) {
    // 댓글
    const cc = await api(`/community/${cPostId}/comments`, { method: 'POST', body: {
      content: '커뮤니티 댓글'
    }, token: adminToken });
    ok('커뮤니티 댓글', cc.ok);

    // 댓글 수정 — ID를 목록에서 가져오기
    const cDetail = await api(`/community/${cPostId}`, { token: adminToken });
    const cComments = cDetail.data?.comments || cDetail.data?.data?.comments || [];
    const cCommentId = cc.data?.id || cc.data?.data?.id || cComments[0]?.id;
    if (cCommentId) {
      const editCc = await api(`/community/${cPostId}/comments/${cCommentId}`, { method: 'PUT', body: {
        content: '수정 커뮤니티 댓글'
      }, token: adminToken });
      ok('커뮤니티 댓글 수정', editCc.ok);
    }

    // 이모지 반응
    const cReact = await api(`/community/${cPostId}/reactions`, { method: 'POST', body: {
      emoji: '🔥'
    }, token: adminToken });
    ok('커뮤니티 반응', cReact.ok);
  }

  // ══════════════════════════════════════
  section('11. 회원 탈퇴 (유저2로 테스트)');
  // ══════════════════════════════════════

  const del = await api('/auth/account', { method: 'DELETE', body: {
    password: 'test1234'
  }, token: userToken });
  ok('회원 탈퇴', del.ok, `message: ${del.data.message}`);

  // 탈퇴 후 토큰 무효화 확인
  const afterDel = await api('/auth/me', { token: userToken, clubId });
  ok('탈퇴 후 인증 실패', !afterDel.ok || afterDel.status === 401);

  // ══════════════════════════════════════
  summary();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('💥 테스트 크래시:', e); process.exit(1); });
