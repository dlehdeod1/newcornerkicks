// 공지 + 클럽게시판 + 커뮤니티 E2E 테스트
// node test_board_community.js

const BASE = 'https://cornerkicks-api.conerkicks.workers.dev';
const TS = Date.now() % 100000;
let passed = 0, failed = 0;

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

function section(title) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(50));
}

function die(msg) {
  console.log(`\n💥 ${msg}`);
  summary();
  process.exit(1);
}

function summary() {
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  결과: ✅ ${passed} | ❌ ${failed}`);
  console.log('═'.repeat(50));
}

async function registerAndLogin(username) {
  const email = `${username}@test.com`;
  const pw = 'test1234!';
  await api('/auth/register', { method: 'POST', body: { username, password: pw, email } });
  const r = await api('/auth/login', { method: 'POST', body: { identifier: username, password: pw } });
  if (!r.ok) die(`로그인 실패 (${username}): ${JSON.stringify(r.data)}`);
  return { token: r.data.token, userId: r.data.user.id };
}

async function main() {
  console.log('══════════════════════════════════════════════════');
  console.log('  CornerKicks 공지/게시판/커뮤니티 E2E 테스트');
  console.log('══════════════════════════════════════════════════');

  // ─── 1. 어드민 계정 & 클럽 생성 ───
  section('1. 계정 & 클럽 준비');

  const adminName = `adm${TS}`;
  const memberName = `mem${TS}`;
  const outsiderName = `out${TS}`;

  // 어드민 가입 + 로그인
  const admin = await registerAndLogin(adminName);
  const adminToken = admin.token;
  const adminId = admin.userId;
  ok('어드민 가입', true);

  // 클럽 생성
  let r = await api('/clubs', { method: 'POST', body: { name: `TC${TS}`, slug: `tc${TS}` }, token: adminToken });
  if (!r.ok) die(`클럽 생성 실패: ${JSON.stringify(r.data)}`);
  const clubId = r.data.club?.id ?? r.data.data?.club?.id;
  const inviteCode = r.data.club?.inviteCode ?? r.data.data?.club?.inviteCode;
  ok('클럽 생성', true);

  // 멤버 가입 + 클럽 참여 (invite code로)
  const member = await registerAndLogin(memberName);
  const memberToken = member.token;
  const memberId = member.userId;
  r = await api('/clubs/join', { method: 'POST', body: { inviteCode }, token: memberToken });
  ok('멤버 클럽 참여', r.ok);

  // 외부인 가입 (클럽 미참여)
  const outsider = await registerAndLogin(outsiderName);
  const outsiderToken = outsider.token;
  ok('외부인 가입', true);

  // ─── 2. 공지 CRUD ───
  section('2. 공지 기능');

  // 멤버가 공지 작성 시도 → 403
  r = await api('/announcements', { method: 'POST', body: { title: '테스트', content: '내용' }, token: memberToken, clubId });
  ok('멤버 공지 작성 거부', r.status === 403);

  // 어드민이 공지 작성
  r = await api('/announcements', { method: 'POST', body: {
    title: '공지테스트', content: '공지 내용입니다', isPinned: true
  }, token: adminToken, clubId });
  ok('어드민 공지 작성', r.ok);
  const announcementId = r.data.data.id;

  // 공지 목록 조회
  r = await api('/announcements', { token: memberToken, clubId });
  ok('공지 목록 조회', r.ok && r.data.data.length >= 1);
  const ann = r.data.data.find(a => a.id === announcementId);
  ok('공지 핀 확인', ann?.is_pinned === 1);
  ok('공지 읽지 않음', ann?.is_read === 0);

  // 공지 상세 (자동 읽음 처리)
  r = await api(`/announcements/${announcementId}`, { token: memberToken, clubId });
  ok('공지 상세 조회', r.ok && r.data.data.title === '공지테스트');

  // 읽음 확인
  r = await api('/announcements', { token: memberToken, clubId });
  const annAfter = r.data.data.find(a => a.id === announcementId);
  ok('공지 읽음 처리됨', annAfter?.is_read === 1);

  // 안 읽은 개수
  r = await api('/announcements/unread-count', { token: adminToken, clubId });
  ok('안 읽은 개수 조회', r.ok && typeof r.data.data.count === 'number');

  // 공지 수정
  r = await api(`/announcements/${announcementId}`, { method: 'PUT', body: { title: '수정된 공지' }, token: adminToken, clubId });
  ok('공지 수정', r.ok);

  // 외부인이 공지 접근 — clubId 멤버 아니면 null → 클럽 공지 안 보임
  r = await api('/announcements', { token: outsiderToken, clubId: 99999 });
  ok('외부인 클럽 공지 접근 차단', r.ok && r.data.data.filter(a => a.club_id === clubId).length === 0);

  // ─── 3. 클럽 게시판 CRUD ───
  section('3. 클럽 게시판');

  // 멤버가 게시글 작성
  r = await api('/posts', { method: 'POST', body: {
    title: '자유글', content: '자유 내용', category: 'free'
  }, token: memberToken, clubId });
  ok('게시글 작성', r.ok);
  const postId = r.data.data.id;

  // 잘못된 카테고리
  r = await api('/posts', { method: 'POST', body: {
    title: '테스트', content: '내용', category: 'invalid'
  }, token: memberToken, clubId });
  ok('잘못된 카테고리 거부', r.status === 400);

  // 게시글 목록
  r = await api('/posts', { token: memberToken, clubId });
  ok('게시글 목록', r.ok && r.data.data.length >= 1);

  // 카테고리 필터
  r = await api('/posts?category=free', { token: memberToken, clubId });
  ok('카테고리 필터', r.ok && r.data.data.every(p => p.category === 'free'));

  // 게시글 상세
  r = await api(`/posts/${postId}`, { token: memberToken, clubId });
  ok('게시글 상세', r.ok && r.data.data.title === '자유글');
  ok('댓글 배열 포함', Array.isArray(r.data.data.comments));

  // 댓글 작성
  r = await api(`/posts/${postId}/comments`, { method: 'POST', body: { content: '댓글 테스트' }, token: adminToken, clubId });
  ok('댓글 작성', r.ok);

  // 댓글 확인
  r = await api(`/posts/${postId}`, { token: memberToken, clubId });
  ok('댓글 조회', r.data.data.comments.length === 1);
  ok('comment_count 증가', r.data.data.comment_count === 1);
  const commentId = r.data.data.comments[0].id;

  // 멤버가 어드민 댓글 삭제 시도 → 403
  r = await api(`/posts/${postId}/comments/${commentId}`, { method: 'DELETE', token: memberToken, clubId });
  ok('타인 댓글 삭제 거부', r.status === 403);

  // 어드민이 본인 댓글 삭제
  r = await api(`/posts/${postId}/comments/${commentId}`, { method: 'DELETE', token: adminToken, clubId });
  ok('본인 댓글 삭제', r.ok);

  // comment_count 감소 확인
  r = await api(`/posts/${postId}`, { token: memberToken, clubId });
  ok('comment_count 감소', r.data.data.comment_count === 0);

  // PUT 카테고리 검증
  r = await api(`/posts/${postId}`, { method: 'PUT', body: { category: 'hacked' }, token: memberToken, clubId });
  ok('PUT 잘못된 카테고리 거부', r.status === 400);

  // 정상 수정
  r = await api(`/posts/${postId}`, { method: 'PUT', body: { title: '수정된 글', category: 'review' }, token: memberToken, clubId });
  ok('게시글 수정', r.ok);

  // 외부인이 클럽 게시글 접근 차단
  r = await api('/posts', { token: outsiderToken, clubId: 99999 });
  ok('외부인 게시판 접근 차단', r.ok && r.data.data.filter(p => p.club_id === clubId).length === 0);

  // 핀 — 멤버는 불가
  r = await api('/posts', { method: 'POST', body: {
    title: '핀 테스트', content: '핀', isPinned: true
  }, token: memberToken, clubId });
  ok('멤버 핀 무시됨', r.ok);
  const pinnedCheckId = r.data.data.id;
  r = await api(`/posts/${pinnedCheckId}`, { token: memberToken, clubId });
  ok('멤버 작성 핀=0', r.data.data.is_pinned === 0);

  // 어드민이 핀 게시글
  r = await api('/posts', { method: 'POST', body: {
    title: '어드민 핀', content: '핀', isPinned: true
  }, token: adminToken, clubId });
  ok('어드민 핀 게시글', r.ok);
  const adminPinId = r.data.data.id;
  r = await api(`/posts/${adminPinId}`, { token: adminToken, clubId });
  ok('어드민 핀=1', r.data.data.is_pinned === 1);

  // ─── 4. 커뮤니티 CRUD ───
  section('4. 전체 커뮤니티');

  // 자유 게시글
  r = await api('/community', { method: 'POST', body: {
    title: '커뮤니티 자유글', content: '내용', category: 'free'
  }, token: memberToken, clubId });
  ok('커뮤니티 게시글 작성', r.ok);
  const communityPostId = r.data.data.id;

  // 팀모집 게시글 (메타데이터)
  r = await api('/community', { method: 'POST', body: {
    title: '팀원 구합니다', content: '서울 5v5', category: 'recruit',
    region: '서울', dayOfWeek: '토', timeSlot: '오후', skillLevel: '중급', headcount: 2
  }, token: memberToken, clubId });
  ok('팀모집 게시글', r.ok);
  const recruitId = r.data.data.id;

  // 매칭 게시글
  r = await api('/community', { method: 'POST', body: {
    title: '매칭 구합니다', content: '경기 신청', category: 'match',
    region: '경기', dayOfWeek: '일', timeSlot: '오전'
  }, token: adminToken, clubId });
  ok('매칭 게시글', r.ok);
  const matchId = r.data.data.id;

  // 잘못된 카테고리
  r = await api('/community', { method: 'POST', body: {
    title: '테스트', content: '내용', category: 'hacked'
  }, token: memberToken, clubId });
  ok('커뮤니티 잘못된 카테고리 거부', r.status === 400);

  // 목록 조회 (전체)
  r = await api('/community', { token: memberToken, clubId });
  ok('커뮤니티 목록 조회', r.ok && r.data.data.length >= 3);

  // 카테고리 필터
  r = await api('/community?category=recruit', { token: memberToken, clubId });
  ok('recruit 필터', r.ok && r.data.data.every(p => p.category === 'recruit'));

  // 지역 필터
  r = await api('/community?region=%EC%84%9C%EC%9A%B8', { token: memberToken, clubId });
  ok('지역 필터', r.ok && r.data.data.every(p => p.region === '서울'));

  // 요일 필터
  r = await api('/community?dayOfWeek=%ED%86%A0', { token: memberToken, clubId });
  ok('요일 필터', r.ok && r.data.data.length >= 1);

  // 상세 (전체 공개 — 외부인도 접근 가능)
  r = await api(`/community/${recruitId}`, { token: outsiderToken });
  ok('외부인 커뮤니티 상세 접근 가능', r.ok && r.data.data.title === '팀원 구합니다');
  ok('메타데이터 확인', r.data.data.region === '서울' && r.data.data.skill_level === '중급');

  // 커뮤니티 댓글
  r = await api(`/community/${communityPostId}/comments`, { method: 'POST', body: { content: '좋은 글이네요' }, token: outsiderToken });
  ok('커뮤니티 댓글 작성', r.ok);

  r = await api(`/community/${communityPostId}`, { token: memberToken, clubId });
  ok('커뮤니티 댓글 조회', r.data.data.comments.length === 1);
  ok('커뮤니티 comment_count', r.data.data.comment_count === 1);
  const cCommentId = r.data.data.comments[0].id;

  // 다른 사람 댓글 삭제 시도 → 403
  r = await api(`/community/${communityPostId}/comments/${cCommentId}`, { method: 'DELETE', token: memberToken, clubId });
  ok('타인 커뮤니티 댓글 삭제 거부', r.status === 403);

  // 본인 댓글 삭제
  r = await api(`/community/${communityPostId}/comments/${cCommentId}`, { method: 'DELETE', token: outsiderToken });
  ok('본인 커뮤니티 댓글 삭제', r.ok);

  // 상태 변경
  r = await api(`/community/${recruitId}`, { method: 'PUT', body: { status: 'closed' }, token: memberToken, clubId });
  ok('상태 closed 변경', r.ok);

  r = await api(`/community/${recruitId}`, { token: memberToken, clubId });
  ok('상태 확인', r.data.data.status === 'closed');

  // 잘못된 상태값 거부
  r = await api(`/community/${recruitId}`, { method: 'PUT', body: { status: 'hacked' }, token: memberToken, clubId });
  ok('잘못된 상태값 거부', r.status === 400);

  // 잘못된 카테고리 PUT 거부
  r = await api(`/community/${recruitId}`, { method: 'PUT', body: { category: 'invalid' }, token: memberToken, clubId });
  ok('커뮤니티 PUT 잘못된 카테고리 거부', r.status === 400);

  // 타인 수정 불가
  r = await api(`/community/${recruitId}`, { method: 'PUT', body: { title: '해킹' }, token: outsiderToken });
  ok('타인 게시글 수정 거부', r.status === 403);

  // 타인 삭제 불가
  r = await api(`/community/${recruitId}`, { method: 'DELETE', token: outsiderToken });
  ok('타인 게시글 삭제 거부', r.status === 403);

  // ─── 5. 상태 필터 ───
  section('5. 상태 필터');
  r = await api('/community?status=open', { token: memberToken, clubId });
  ok('open 필터', r.ok && r.data.data.every(p => p.status === 'open'));

  r = await api('/community?status=closed', { token: memberToken, clubId });
  ok('closed 필터', r.ok && r.data.data.every(p => p.status === 'closed'));

  // ─── 6. pagination bounds ───
  section('6. Pagination 안전성');
  r = await api('/announcements?limit=999&offset=-5', { token: memberToken, clubId });
  ok('공지 pagination bounds', r.ok);

  r = await api('/posts?limit=999', { token: memberToken, clubId });
  ok('게시판 pagination bounds', r.ok);

  r = await api('/community?limit=999', { token: memberToken, clubId });
  ok('커뮤니티 pagination bounds', r.ok);

  // ─── 7. 삭제 테스트 ───
  section('7. 삭제 테스트');

  // 게시글 삭제
  r = await api(`/posts/${postId}`, { method: 'DELETE', token: memberToken, clubId });
  ok('게시글 삭제', r.ok);

  // 삭제 후 조회 → 404
  r = await api(`/posts/${postId}`, { token: memberToken, clubId });
  ok('삭제 후 404', r.status === 404);

  // 커뮤니티 게시글 삭제
  r = await api(`/community/${communityPostId}`, { method: 'DELETE', token: memberToken, clubId });
  ok('커뮤니티 게시글 삭제', r.ok);

  // 공지 삭제
  r = await api(`/announcements/${announcementId}`, { method: 'DELETE', token: adminToken, clubId });
  ok('공지 삭제', r.ok);

  // ─── 결과 ───
  summary();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
