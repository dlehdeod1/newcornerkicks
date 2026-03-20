# 공지 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 클럽 공지 + 시스템 전체 공지 기능 (CRUD, 읽음 추적, 이미지 첨부, 푸시 알림)

**Architecture:** 기존 `notices` 테이블을 DROP하고 `announcements` + `announcement_reads` 테이블 생성. R2는 기존 `PHOTOS` 바인딩 재활용 (`announcements/` prefix). API 라우트 추가 후 Flutter 홈 탭 상단 카드 + 목록/상세 페이지, Web 동일 구조.

**Tech Stack:** Hono API (D1 + R2), Flutter (http + provider), Next.js (TanStack Query + Zustand)

**Spec:** `docs/superpowers/specs/2026-03-20-announcements-design.md`

---

## File Map

### API
| 파일 | 액션 | 역할 |
|------|------|------|
| `api/migrations/0016_announcements.sql` | Create | DB 마이그레이션 |
| `api/src/db/schema.ts` | Modify | notices → announcements 스키마 교체 |
| `api/src/routes/announcements.ts` | Create | 공지 CRUD + 읽음 처리 API |
| `api/src/routes/uploads.ts` | Create | 범용 이미지 업로드 API |
| `api/src/routes/photos.ts` | Modify | announcements 이미지 서빙 추가 |
| `api/src/index.ts` | Modify | 새 라우트 등록 + Env에 SYSTEM_ADMIN_IDS 추가 |

### Flutter
| 파일 | 액션 | 역할 |
|------|------|------|
| `app/lib/services/api_service.dart` | Modify | 공지 + 업로드 API 메서드 추가 |
| `app/lib/screens/announcements_screen.dart` | Create | 공지 목록 페이지 |
| `app/lib/screens/announcement_detail_screen.dart` | Create | 공지 상세 페이지 |
| `app/lib/screens/announcement_form_screen.dart` | Create | 공지 작성/수정 (관리자) |
| `app/lib/screens/home_screen.dart` | Modify | 홈 탭 상단 공지 카드 추가 |
| `app/lib/screens/club_screen.dart` | Modify | 관리자 메뉴에 공지 관리 진입점 |

### Web
| 파일 | 액션 | 역할 |
|------|------|------|
| `web/src/lib/api.ts` | Modify | announcementsApi 추가 |
| `web/src/app/(main)/announcements/page.tsx` | Create | 공지 목록 페이지 |
| `web/src/app/(main)/announcements/[id]/page.tsx` | Create | 공지 상세 페이지 |
| `web/src/app/(main)/admin/announcements/page.tsx` | Create | 관리자 공지 관리 |
| `web/src/app/(main)/admin/page.tsx` | Modify | 관리자 메뉴에 공지 관리 링크 추가 |
| `web/src/app/(main)/page.tsx` | Modify | 홈 상단 공지 카드 추가 |

---

## Task 1: DB 마이그레이션

**Files:**
- Create: `api/migrations/0016_announcements.sql`
- Modify: `api/src/db/schema.ts`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 0016_announcements.sql

-- 기존 notices 테이블 제거 (사용하지 않음)
DROP TABLE IF EXISTS notices;

-- 공지 테이블
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER REFERENCES clubs(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  is_pinned INTEGER DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_announcements_club ON announcements(club_id, created_at DESC);
CREATE INDEX idx_announcements_system ON announcements(created_at DESC) WHERE club_id IS NULL;

-- 읽음 추적
CREATE TABLE IF NOT EXISTS announcement_reads (
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  read_at INTEGER NOT NULL,
  PRIMARY KEY (announcement_id, user_id)
);
```

- [ ] **Step 2: schema.ts 업데이트**

`api/src/db/schema.ts`에서 기존 `notices` 정의를 제거하고 `announcements` + `announcementReads`로 교체:

```typescript
// notices 정의 삭제 후 아래로 교체

export const announcements = sqliteTable('announcements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clubId: integer('club_id').references(() => clubs.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  imageUrl: text('image_url'),
  isPinned: integer('is_pinned').default(0),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const announcementReads = sqliteTable('announcement_reads', {
  announcementId: integer('announcement_id').notNull().references(() => announcements.id),
  userId: text('user_id').notNull().references(() => users.id),
  readAt: integer('read_at', { mode: 'timestamp' }).notNull(),
})
```

- [ ] **Step 3: 로컬 D1에 마이그레이션 적용 & 확인**

```bash
cd api
npx wrangler d1 execute conerkicks-db --local --file=migrations/0016_announcements.sql
```

- [ ] **Step 4: 원격 D1에 마이그레이션 적용**

```bash
npx wrangler d1 execute conerkicks-db --remote --file=migrations/0016_announcements.sql
```

- [ ] **Step 5: 커밋**

```bash
git add api/migrations/0016_announcements.sql api/src/db/schema.ts
git commit -m "feat: add announcements + announcement_reads tables"
```

---

## Task 2: 범용 이미지 업로드 API

**Files:**
- Create: `api/src/routes/uploads.ts`
- Modify: `api/src/routes/photos.ts` (announcements 이미지 서빙)
- Modify: `api/src/index.ts` (라우트 등록)

- [ ] **Step 1: uploads.ts 작성**

```typescript
import { Hono } from 'hono'
import type { Env } from '../index'
import { authMiddleware } from '../middleware/auth'

const uploadsRoutes = new Hono<{ Bindings: Env }>()

// POST /uploads — 이미지 업로드 (multipart/form-data)
// body: file (binary), prefix (string: 'announcements' | 'players' | 'clubs')
uploadsRoutes.post('/', authMiddleware(), async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']
  const prefix = (body['prefix'] as string) || 'general'

  if (!(file instanceof File)) {
    return c.json({ error: '파일이 필요합니다.' }, 400)
  }

  // 이미지 타입 검증
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return c.json({ error: '허용되지 않는 파일 형식입니다. (jpeg, png, webp, gif)' }, 400)
  }

  // 최대 2MB
  if (file.size > 2 * 1024 * 1024) {
    return c.json({ error: '파일 크기는 2MB 이하여야 합니다.' }, 400)
  }

  const allowedPrefixes = ['announcements', 'players', 'clubs', 'community']
  if (!allowedPrefixes.includes(prefix)) {
    return c.json({ error: '허용되지 않는 prefix입니다.' }, 400)
  }

  const ext = file.name.split('.').pop() || 'webp'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const key = `${prefix}/${filename}`

  await c.env.PHOTOS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  })

  const url = `/photos/${key}`
  return c.json({ data: { url, key } })
})

export { uploadsRoutes }
```

- [ ] **Step 2: photos.ts에 announcements 서빙 라우트 추가**

기존 패턴을 따라 추가:

```typescript
// GET /photos/announcements/:file
photosRoutes.get('/announcements/:file', async (c) => {
  const file = c.req.param('file')
  const key = `announcements/${file}`

  const obj = await c.env.PHOTOS.get(key)
  if (!obj) return c.notFound()

  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('Cache-Control', 'public, max-age=86400')

  return new Response(obj.body, { headers })
})
```

- [ ] **Step 3: index.ts에 라우트 등록**

```typescript
import { uploadsRoutes } from './routes/uploads'
// ...
app.route('/uploads', uploadsRoutes)
```

- [ ] **Step 4: 로컬에서 업로드 테스트**

```bash
cd api && npx wrangler dev
# 별도 터미널에서:
curl -X POST http://localhost:8787/uploads \
  -H "Authorization: Bearer <test-token>" \
  -F "file=@test.png" \
  -F "prefix=announcements"
```

- [ ] **Step 5: 커밋**

```bash
git add api/src/routes/uploads.ts api/src/routes/photos.ts api/src/index.ts
git commit -m "feat: add generic image upload API (R2)"
```

---

## Task 3: 공지 API 라우트

**Files:**
- Create: `api/src/routes/announcements.ts`
- Modify: `api/src/index.ts` (라우트 등록)

- [ ] **Step 1: announcements.ts 작성**

```typescript
import { Hono } from 'hono'
import type { Env } from '../index'
import { authMiddleware } from '../middleware/auth'

const announcementsRoutes = new Hono<{ Bindings: Env }>()

// GET /announcements — 목록 (클럽 공지 + 시스템 공지)
announcementsRoutes.get('/', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId
  const limit = Number(c.req.query('limit')) || 20
  const offset = Number(c.req.query('offset')) || 0

  // 클럽 공지 + 시스템 공지(club_id IS NULL) 합산
  const { results } = await c.env.DB.prepare(`
    SELECT a.*,
      u.username as author_name,
      CASE WHEN ar.user_id IS NOT NULL THEN 1 ELSE 0 END as is_read
    FROM announcements a
    LEFT JOIN users u ON u.id = a.created_by
    LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id AND ar.user_id = ?
    WHERE a.club_id = ? OR a.club_id IS NULL
    ORDER BY a.is_pinned DESC, a.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(userId, clubId, limit, offset).all()

  return c.json({ data: results })
})

// GET /announcements/unread-count
announcementsRoutes.get('/unread-count', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId

  const row = await c.env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM announcements a
    LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id AND ar.user_id = ?
    WHERE (a.club_id = ? OR a.club_id IS NULL)
      AND ar.user_id IS NULL
  `).bind(userId, clubId).first()

  return c.json({ data: { count: row?.count ?? 0 } })
})

// GET /announcements/:id — 상세 + 자동 읽음 처리
announcementsRoutes.get('/:id', authMiddleware(), async (c) => {
  const id = Number(c.req.param('id'))
  const userId = (c as any).userId
  const clubId = (c as any).clubId

  const row = await c.env.DB.prepare(`
    SELECT a.*, u.username as author_name
    FROM announcements a
    LEFT JOIN users u ON u.id = a.created_by
    WHERE a.id = ? AND (a.club_id = ? OR a.club_id IS NULL)
  `).bind(id, clubId).first()

  if (!row) return c.json({ error: '공지를 찾을 수 없습니다.' }, 404)

  // 자동 읽음 처리
  const now = Math.floor(Date.now() / 1000)
  await c.env.DB.prepare(`
    INSERT OR IGNORE INTO announcement_reads (announcement_id, user_id, read_at)
    VALUES (?, ?, ?)
  `).bind(id, userId, now).run()

  return c.json({ data: row })
})

// POST /announcements — 작성
announcementsRoutes.post('/', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId
  const clubRole = (c as any).clubRole
  const userRole = (c as any).userRole

  const { title, content, imageUrl, isPinned, isSystem } = await c.req.json()

  if (!title || !content) {
    return c.json({ error: '제목과 내용은 필수입니다.' }, 400)
  }

  // 시스템 공지: SYSTEM_ADMIN_IDS 환경변수로 관리자 판별
  const isSystemAdmin = (c.env.SYSTEM_ADMIN_IDS || '').split(',').includes(userId)
  let targetClubId = clubId
  if (isSystem) {
    if (!isSystemAdmin) {
      return c.json({ error: '시스템 공지는 시스템 관리자만 작성할 수 있습니다.' }, 403)
    }
    targetClubId = null
  } else {
    // 클럽 공지: admin/owner만
    if (clubRole !== 'admin' && clubRole !== 'owner') {
      return c.json({ error: '클럽 관리자만 공지를 작성할 수 있습니다.' }, 403)
    }
  }

  const now = Math.floor(Date.now() / 1000)
  const result = await c.env.DB.prepare(`
    INSERT INTO announcements (club_id, title, content, image_url, is_pinned, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(targetClubId, title, content, imageUrl || null, isPinned ? 1 : 0, userId, now, now).run()

  const id = result.meta.last_row_id

  // 알림 발송: 기존 notifications 테이블에 삽입
  let members: any
  if (targetClubId) {
    // 클럽 공지 → 해당 클럽 멤버에게
    members = await c.env.DB.prepare(`
      SELECT user_id FROM club_members WHERE club_id = ? AND user_id != ?
    `).bind(targetClubId, userId).all()
  } else {
    // 시스템 공지 → 전체 유저에게
    members = await c.env.DB.prepare(`
      SELECT id as user_id FROM users WHERE id != ?
    `).bind(userId).all()
  }

  if (members.results.length > 0) {
    const values = members.results.map(() => '(?, ?, ?, ?, ?, ?)').join(',')
    const binds = members.results.flatMap((m: any) => [
      m.user_id, 'ANNOUNCEMENT', '새 공지사항', title, `/announcements/${id}`, now
    ])
    await c.env.DB.prepare(`
      INSERT INTO notifications (user_id, type, title, message, link_url, created_at)
      VALUES ${values}
    `).bind(...binds).run()
  }

  return c.json({ data: { id } }, 201)
})

// PUT /announcements/:id — 수정
announcementsRoutes.put('/:id', authMiddleware(), async (c) => {
  const id = Number(c.req.param('id'))
  const userId = (c as any).userId
  const clubRole = (c as any).clubRole

  const existing = await c.env.DB.prepare(
    'SELECT * FROM announcements WHERE id = ?'
  ).bind(id).first()
  if (!existing) return c.json({ error: '공지를 찾을 수 없습니다.' }, 404)

  // 작성자 본인 또는 admin/owner
  if (existing.created_by !== userId && clubRole !== 'admin' && clubRole !== 'owner') {
    return c.json({ error: '수정 권한이 없습니다.' }, 403)
  }

  const body = await c.req.json()
  const now = Math.floor(Date.now() / 1000)

  const updates: string[] = ['updated_at = ?']
  const binds: any[] = [now]

  if (body.title !== undefined) { updates.push('title = ?'); binds.push(body.title) }
  if (body.content !== undefined) { updates.push('content = ?'); binds.push(body.content) }
  if ('imageUrl' in body) { updates.push('image_url = ?'); binds.push(body.imageUrl) } // null로 클리어 가능
  if (body.isPinned !== undefined) { updates.push('is_pinned = ?'); binds.push(body.isPinned ? 1 : 0) }

  binds.push(id)
  await c.env.DB.prepare(
    `UPDATE announcements SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...binds).run()

  return c.json({ data: { id } })
})

// DELETE /announcements/:id
announcementsRoutes.delete('/:id', authMiddleware(), async (c) => {
  const id = Number(c.req.param('id'))
  const userId = (c as any).userId
  const clubRole = (c as any).clubRole

  const existing = await c.env.DB.prepare(
    'SELECT * FROM announcements WHERE id = ?'
  ).bind(id).first()
  if (!existing) return c.json({ error: '공지를 찾을 수 없습니다.' }, 404)

  if (existing.created_by !== userId && clubRole !== 'admin' && clubRole !== 'owner') {
    return c.json({ error: '삭제 권한이 없습니다.' }, 403)
  }

  // R2 이미지도 삭제
  if (existing.image_url) {
    const key = (existing.image_url as string).replace('/photos/', '')
    await c.env.PHOTOS.delete(key)
  }

  await c.env.DB.prepare('DELETE FROM announcements WHERE id = ?').bind(id).run()

  return c.json({ data: { success: true } })
})

export { announcementsRoutes }
```

- [ ] **Step 2: index.ts에 라우트 등록**

```typescript
import { announcementsRoutes } from './routes/announcements'
// ...
app.route('/announcements', announcementsRoutes)
```

- [ ] **Step 3: wrangler dev로 로컬 테스트**

GET /announcements, POST /announcements, GET /announcements/:id 순서로 curl 테스트.

- [ ] **Step 4: 커밋**

```bash
git add api/src/routes/announcements.ts api/src/index.ts
git commit -m "feat: add announcements CRUD API with read tracking"
```

---

## Task 4: Flutter — ApiService 메서드 추가

**Files:**
- Modify: `app/lib/services/api_service.dart`

- [ ] **Step 1: 공지 + 업로드 API 메서드 추가**

`api_service.dart`에 다음 메서드 추가:

```dart
// Announcements
Future<dynamic> getAnnouncements(String token, {int? limit, int? offset}) {
  final params = <String>[];
  if (limit != null) params.add('limit=$limit');
  if (offset != null) params.add('offset=$offset');
  final qs = params.isNotEmpty ? '?${params.join('&')}' : '';
  return request('/announcements$qs', token: token);
}

Future<dynamic> getAnnouncement(int id, String token) =>
    request('/announcements/$id', token: token);

Future<dynamic> getAnnouncementUnreadCount(String token) =>
    request('/announcements/unread-count', token: token);

Future<dynamic> createAnnouncement(Map<String, dynamic> data, String token) =>
    request('/announcements', method: 'POST', body: data, token: token);

Future<dynamic> updateAnnouncement(int id, Map<String, dynamic> data, String token) =>
    request('/announcements/$id', method: 'PUT', body: data, token: token);

Future<dynamic> deleteAnnouncement(int id, String token) =>
    request('/announcements/$id', method: 'DELETE', token: token);

// 이미지 업로드 (multipart)
Future<dynamic> uploadImage(File file, String prefix, String token) async {
  final url = Uri.parse('${ApiConfig.baseUrl}/uploads');
  final req = http.MultipartRequest('POST', url);
  req.headers['Authorization'] = 'Bearer $token';
  if (activeClubId != null) {
    req.headers['X-Club-Id'] = activeClubId.toString();
  }
  req.fields['prefix'] = prefix;
  req.files.add(await http.MultipartFile.fromPath('file', file.path));
  final streamed = await req.send();
  final body = await streamed.stream.bytesToString();
  final data = jsonDecode(body);
  if (streamed.statusCode >= 400) {
    throw ApiException(data['error'] ?? '업로드 실패', streamed.statusCode);
  }
  return data;
}
```

- [ ] **Step 2: 커밋**

```bash
git add app/lib/services/api_service.dart
git commit -m "feat: add announcement & upload API methods to Flutter"
```

---

## Task 5: Flutter — 공지 목록 페이지

**Files:**
- Create: `app/lib/screens/announcements_screen.dart`

- [ ] **Step 1: 공지 목록 화면 작성**

주요 구성:
- AppBar: "공지사항" 타이틀
- 시스템 공지 / 클럽 공지 구분 (club_id null 여부로 태그 표시)
- 고정 공지 상단, 읽음/안읽음 시각적 구분 (볼드 vs 일반)
- 이미지 썸네일 (image_url 있으면)
- 탭하면 상세 페이지로 이동
- RefreshIndicator로 당겨서 새로고침
- 관리자면 FloatingActionButton으로 작성 버튼

- [ ] **Step 2: 커밋**

```bash
git add app/lib/screens/announcements_screen.dart
git commit -m "feat: add announcements list screen (Flutter)"
```

---

## Task 6: Flutter — 공지 상세 페이지

**Files:**
- Create: `app/lib/screens/announcement_detail_screen.dart`

- [ ] **Step 1: 공지 상세 화면 작성**

주요 구성:
- AppBar: 공지 제목
- 본문 (텍스트)
- 이미지 (image_url 있으면 전체 너비로 표시)
- 작성자, 작성일
- 관리자면 수정/삭제 메뉴 (PopupMenuButton)
- 열람 시 자동 읽음 (API GET이 자동으로 처리)

- [ ] **Step 2: 커밋**

```bash
git add app/lib/screens/announcement_detail_screen.dart
git commit -m "feat: add announcement detail screen (Flutter)"
```

---

## Task 7: Flutter — 공지 작성/수정 폼

**Files:**
- Create: `app/lib/screens/announcement_form_screen.dart`

- [ ] **Step 1: 공지 작성/수정 폼 작성**

주요 구성:
- title TextField, content TextField (multiline)
- 이미지 첨부: ImagePicker → uploadImage() → imageUrl 저장
- 고정 여부 Switch
- 수정 모드: 기존 데이터 pre-fill
- 저장 버튼 → createAnnouncement / updateAnnouncement

- [ ] **Step 2: 커밋**

```bash
git add app/lib/screens/announcement_form_screen.dart
git commit -m "feat: add announcement form screen (Flutter)"
```

---

## Task 8: Flutter — 홈 탭에 공지 카드 추가

**Files:**
- Modify: `app/lib/screens/home_screen.dart`
- Modify: `app/lib/screens/club_screen.dart`

- [ ] **Step 1: home_screen.dart 수정**

`_loadData()`에서 공지 목록도 함께 로드 (limit: 3, 고정 우선).
build()에서 상단에 공지 카드 섹션 추가:
- 고정/최신 공지 1~2개 카드 표시
- "전체 보기" 버튼 → AnnouncementsScreen으로 이동
- 안 읽은 공지 배지 표시

- [ ] **Step 2: club_screen.dart에 공지 관리 진입점 추가**

관리자 메뉴 섹션에 "공지 관리" ListTile 추가 → AnnouncementsScreen(isAdmin: true)으로 이동.

- [ ] **Step 3: 커밋**

```bash
git add app/lib/screens/home_screen.dart app/lib/screens/club_screen.dart
git commit -m "feat: add announcement cards to home tab + admin entry point"
```

---

## Task 9: Web — API 레이어 추가

**Files:**
- Modify: `web/src/lib/api.ts`

- [ ] **Step 1: announcementsApi 객체 추가**

```typescript
export const announcementsApi = {
  list: (token: string, options?: { limit?: number; offset?: number }) => {
    const params = new URLSearchParams()
    if (options?.limit) params.set('limit', String(options.limit))
    if (options?.offset) params.set('offset', String(options.offset))
    return api(`/announcements${params.toString() ? `?${params}` : ''}`, { token })
  },

  get: (id: number, token: string) =>
    api(`/announcements/${id}`, { token }),

  unreadCount: (token: string) =>
    api('/announcements/unread-count', { token }),

  create: (data: { title: string; content: string; imageUrl?: string; isPinned?: boolean; isSystem?: boolean }, token: string) =>
    api('/announcements', { method: 'POST', body: data, token }),

  update: (id: number, data: { title?: string; content?: string; imageUrl?: string; isPinned?: boolean }, token: string) =>
    api(`/announcements/${id}`, { method: 'PUT', body: data, token }),

  delete: (id: number, token: string) =>
    api(`/announcements/${id}`, { method: 'DELETE', token }),
}

export const uploadsApi = {
  uploadImage: async (file: File, prefix: string, token: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('prefix', prefix)

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cornerkicks-api.conerkicks.workers.dev'
    const res = await fetch(`${API_BASE}/uploads`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Club-Id': String(getActiveClubId() ?? ''),
      },
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '업로드 실패')
    return data
  },
}
```

- [ ] **Step 2: 커밋**

```bash
git add web/src/lib/api.ts
git commit -m "feat: add announcements & uploads API layer (web)"
```

---

## Task 10: Web — 공지 목록 페이지

**Files:**
- Create: `web/src/app/(main)/announcements/page.tsx`

- [ ] **Step 1: 공지 목록 페이지 작성**

주요 구성:
- `useQuery({ queryKey: ['announcements'] })` 로 목록 로드
- 시스템 공지 / 클럽 공지 구분 배지
- 고정 공지 상단 고정 (📌 아이콘)
- 읽음/안읽음 시각적 구분 (배경색 또는 볼드)
- 이미지 썸네일
- 클릭 → `/announcements/[id]`
- 관리자면 "새 공지 작성" 버튼

기존 notifications 페이지 패턴(useQuery, useMutation, 카드 레이아웃) 참고.

- [ ] **Step 2: 커밋**

```bash
git add web/src/app/(main)/announcements/page.tsx
git commit -m "feat: add announcements list page (web)"
```

---

## Task 11: Web — 공지 상세 페이지

**Files:**
- Create: `web/src/app/(main)/announcements/[id]/page.tsx`

- [ ] **Step 1: 공지 상세 페이지 작성**

주요 구성:
- `useQuery({ queryKey: ['announcement', id] })` 로 상세 로드 (자동 읽음 처리)
- 제목, 본문, 이미지, 작성자, 날짜
- 관리자면 수정/삭제 버튼
- 수정 시 모달 또는 인라인 폼
- 삭제 시 confirm 후 목록으로 이동

- [ ] **Step 2: 커밋**

```bash
git add "web/src/app/(main)/announcements/[id]/page.tsx"
git commit -m "feat: add announcement detail page (web)"
```

---

## Task 12: Web — 관리자 공지 관리

**Files:**
- Create: `web/src/app/(main)/admin/announcements/page.tsx`

- [ ] **Step 1: 관리자 공지 관리 페이지 작성**

주요 구성:
- 공지 목록 (CRUD 전체)
- 새 공지 작성 폼 (모달 또는 섹션)
- 제목, 내용, 이미지 업로드 (드래그&드롭 또는 파일 선택), 고정 토글
- 수정/삭제 액션
- 시스템 관리자면 "시스템 공지" 체크박스 추가

- [ ] **Step 2: admin 페이지 사이드바에 공지 관리 링크 추가**

기존 admin 레이아웃/네비게이션에 "공지 관리" 메뉴 항목 추가.

- [ ] **Step 3: 커밋**

```bash
git add "web/src/app/(main)/admin/announcements/page.tsx"
git commit -m "feat: add admin announcements management page (web)"
```

---

## Task 13: Web — 홈 페이지에 공지 카드

**Files:**
- Modify: `web/src/app/(main)/page.tsx`

- [ ] **Step 1: 홈 상단에 공지 섹션 추가**

- `useQuery({ queryKey: ['announcements-home'] })` 로 최신 공지 2~3개 로드
- Hero 섹션 바로 아래에 공지 카드 배치
- 고정 공지 우선, 안 읽은 공지 강조
- "전체 보기" 링크 → `/announcements`

- [ ] **Step 2: 커밋**

```bash
git add "web/src/app/(main)/page.tsx"
git commit -m "feat: add announcement cards to web home page"
```

---

## Task 14: 배포 & 검증

- [ ] **Step 1: API 배포**

```bash
cd api && npx wrangler deploy
```

- [ ] **Step 2: Flutter 앱 실행 및 수동 테스트**

```bash
cd app && flutter run
```
- 홈 탭 공지 카드 확인
- 공지 목록/상세 이동
- 관리자로 공지 작성/수정/삭제
- 이미지 첨부 테스트
- 읽음 표시 확인

- [ ] **Step 3: 웹 빌드 확인**

```bash
cd web && npm run build
```

- [ ] **Step 4: 전체 커밋 & 푸시**

```bash
git add -A && git commit -m "feat: announcements feature complete"
git push
```
