# 공지 기능 설계

## 개요
클럽 공지 + 시스템 전체 공지. 읽음 추적, 푸시 알림, 이미지 첨부(R2) 포함.

## DB 스키마

### announcements
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK AUTO | |
| club_id | INTEGER FK clubs(id) NULL | NULL = 시스템 공지 |
| title | TEXT NOT NULL | |
| content | TEXT NOT NULL | |
| image_url | TEXT NULL | R2 URL |
| is_pinned | INTEGER DEFAULT 0 | |
| created_by | TEXT NOT NULL FK users(id) | |
| created_at | INTEGER NOT NULL | epoch |
| updated_at | INTEGER NOT NULL | epoch |

### announcement_reads
| 컬럼 | 타입 | 설명 |
|------|------|------|
| announcement_id | INTEGER FK announcements(id) | PK 1 |
| user_id | TEXT FK users(id) | PK 2 |
| read_at | INTEGER NOT NULL | epoch |

기존 `notices` 테이블은 DROP (데이터 없음).

## R2 인프라

- 버킷: `cornerkicks-uploads`
- Workers 바인딩: `UPLOADS` (wrangler.toml에 추가)
- 업로드 API: `POST /uploads` → R2에 저장, URL 반환
- 클라이언트에서 이미지 리사이징 후 업로드 (최대 1MB)
- 경로 규칙: `announcements/{id}/{filename}` 등 prefix로 구분

## API 엔드포인트

파일: `api/src/routes/announcements.ts`

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | /announcements | 인증 유저 | 목록 (클럽+시스템, 읽음 여부 포함, 페이지네이션) |
| GET | /announcements/:id | 인증 유저 | 상세 + 자동 읽음 처리 |
| POST | /announcements | admin/owner (클럽) / 시스템 관리자 (전체) | 작성 |
| PUT | /announcements/:id | 작성자/admin | 수정 |
| DELETE | /announcements/:id | 작성자/admin | 삭제 |
| GET | /announcements/unread-count | 인증 유저 | 안 읽은 공지 수 |

파일: `api/src/routes/uploads.ts`

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| POST | /uploads | 인증 유저 | 이미지 업로드 → R2, URL 반환 |

## 푸시 알림
- 공지 작성 시 기존 notifications 시스템 활용
- 클럽 공지 → 해당 클럽 멤버
- 시스템 공지 → 전체 유저

## Flutter UI

### 홈 탭 상단
- 고정 공지 우선, 최신 공지 카드 (최대 2개)
- "전체 보기" 버튼 → 공지 목록 페이지

### 공지 목록 페이지
- 시스템 공지 / 클럽 공지 구분 표시
- 읽음/안읽음 시각적 구분
- 고정 공지 상단 고정

### 공지 상세 페이지
- 제목, 본문, 이미지, 작성자, 날짜
- 열람 시 자동 읽음 처리

### 공지 작성/수정 (관리자)
- 클럽 관리 화면에서 접근
- 제목, 본문, 이미지 첨부, 고정 여부 토글

## Web UI

### 홈 상단
- 공지 카드 (Flutter와 동일 구조)

### /announcements 페이지
- 공지 목록 + 상세

### 관리자 (/admin/announcements)
- 공지 CRUD UI

## 시스템 관리자 판별
- `club_id = NULL`인 시스템 공지 작성 권한은 별도 판별 필요
- 방법: `users` 테이블에 `is_system_admin` 컬럼 추가 또는 환경변수로 관리자 ID 목록 관리
- 추천: 환경변수 `SYSTEM_ADMIN_IDS` (쉼표 구분) — DB 변경 불필요
