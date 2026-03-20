# 클럽 게시판 설계

## 개요
클럽 내부 게시판. 카테고리 4개(공지/자유/경기후기/일정논의), 댓글, 이미지 첨부.

## 카테고리
| 카테고리 | DB값 | 작성 권한 | 비고 |
|---------|------|----------|------|
| 공지 | - | admin/owner | 기존 announcements API 재활용 |
| 자유 | `free` | 모든 멤버 | |
| 경기 후기 | `review` | 모든 멤버 | |
| 일정 논의 | `schedule` | 모든 멤버 | 투표 기능은 2단계 |

## DB 스키마

### posts
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK AUTO | |
| club_id | INTEGER NOT NULL FK clubs(id) | |
| author_id | TEXT NOT NULL FK users(id) | |
| category | TEXT NOT NULL DEFAULT 'free' | 'free' / 'review' / 'schedule' |
| title | TEXT NOT NULL | |
| content | TEXT NOT NULL | max ~5000자 |
| image_url | TEXT NULL | R2 URL |
| is_pinned | INTEGER DEFAULT 0 | admin/owner만 설정 |
| comment_count | INTEGER DEFAULT 0 | 비정규화, 댓글 추가/삭제 시 동기화 |
| created_at | INTEGER NOT NULL | epoch |
| updated_at | INTEGER NOT NULL | epoch |

### post_comments
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK AUTO | |
| post_id | INTEGER NOT NULL FK posts(id) ON DELETE CASCADE | |
| author_id | TEXT NOT NULL FK users(id) | |
| content | TEXT NOT NULL | |
| created_at | INTEGER NOT NULL | epoch |

## API

파일: `api/src/routes/posts.ts`

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | /posts | 인증 멤버 | 목록 (category 필터, 페이지네이션) |
| GET | /posts/:id | 인증 멤버 | 상세 + 댓글 목록 |
| POST | /posts | 인증 멤버 | 작성 |
| PUT | /posts/:id | 본인/admin | 수정 |
| DELETE | /posts/:id | 본인/admin | 삭제 |
| POST | /posts/:id/comments | 인증 멤버 | 댓글 작성 |
| DELETE | /posts/:id/comments/:cid | 본인/admin | 댓글 삭제 |

## UI

### Flutter
- Club 탭 → "게시판" 버튼 → BoardScreen
- BoardScreen: TabBar 4개 (공지/자유/경기후기/일정논의)
  - 공지 탭 → AnnouncementsScreen 위젯 재활용
  - 나머지 탭 → PostListView(category)
- PostDetailScreen: 본문 + 이미지 + 댓글 목록/입력
- PostFormScreen: 제목/내용/이미지/카테고리

### Web
- `/board` 라우트
- 탭 4개 동일 구조
- 글 상세: `/board/[id]`
- 작성: 모달 또는 인라인 폼
