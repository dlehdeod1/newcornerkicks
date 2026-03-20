# 클럽 게시판 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** 클럽 내부 게시판 (카테고리 4개, 댓글, 이미지 첨부)

**Architecture:** posts + post_comments 테이블, 공지 탭은 기존 announcements 재활용, R2 업로드 재활용. Flutter BoardScreen(TabBar) + Web /board 라우트.

**Tech Stack:** Hono API (D1), Flutter, Next.js (TanStack Query)

**Spec:** `docs/superpowers/specs/2026-03-20-club-board-design.md`

---

## File Map

### API
| 파일 | 액션 | 역할 |
|------|------|------|
| `api/migrations/0017_posts.sql` | Create | DB 마이그레이션 |
| `api/src/db/schema.ts` | Modify | posts, postComments 추가 |
| `api/src/routes/posts.ts` | Create | 게시글 + 댓글 CRUD |
| `api/src/index.ts` | Modify | 라우트 등록 |

### Flutter
| 파일 | 액션 | 역할 |
|------|------|------|
| `app/lib/services/api_service.dart` | Modify | 게시판 API 메서드 |
| `app/lib/screens/board_screen.dart` | Create | 게시판 메인 (TabBar 4개) |
| `app/lib/screens/post_detail_screen.dart` | Create | 글 상세 + 댓글 |
| `app/lib/screens/post_form_screen.dart` | Create | 글 작성/수정 |
| `app/lib/screens/club_screen.dart` | Modify | 게시판 진입점 추가 |

### Web
| 파일 | 액션 | 역할 |
|------|------|------|
| `web/src/lib/api.ts` | Modify | postsApi 추가 |
| `web/src/app/(main)/board/page.tsx` | Create | 게시판 목록 (탭) |
| `web/src/app/(main)/board/[id]/page.tsx` | Create | 글 상세 + 댓글 |
| `web/src/app/(main)/board/write/page.tsx` | Create | 글 작성 |

---

## Task 1: DB 마이그레이션

- [ ] 마이그레이션 SQL 작성
- [ ] schema.ts 업데이트
- [ ] 커밋

## Task 2: 게시판 API

- [ ] posts.ts 라우트 작성 (CRUD + 댓글)
- [ ] index.ts에 등록
- [ ] 커밋

## Task 3: Flutter API 메서드 + 게시판 UI

- [ ] ApiService에 posts/comments 메서드 추가
- [ ] BoardScreen (TabBar 4탭)
- [ ] PostDetailScreen (본문 + 댓글)
- [ ] PostFormScreen (작성/수정)
- [ ] ClubScreen에 게시판 진입점
- [ ] 커밋

## Task 4: Web API + 게시판 UI

- [ ] api.ts에 postsApi 추가
- [ ] /board 목록 페이지
- [ ] /board/[id] 상세 페이지
- [ ] /board/write 작성 페이지
- [ ] 커밋
