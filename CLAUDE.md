# CornerKicks — CLAUDE.md

풋살/축구 동호회 관리 앱. Flutter(앱) + Next.js(웹) + Hono API(Cloudflare Workers + D1 SQLite).

## 디렉토리 구조

```
/api   — Hono/TypeScript API (Cloudflare Workers)
/app   — Flutter 모바일 앱
/web   — Next.js 웹
/docs  — 문서
```

## 주요 명령어

### API
```bash
cd api
npx wrangler dev          # 로컬 개발
npx wrangler deploy       # 배포 (Workers)

# DB 마이그레이션 (원격)
npx wrangler d1 execute conerkicks-db --file=migrations/XXXX.sql --remote

# 테스트
node test_realistic.js    # 현실적 시나리오 테스트 (14명 선수단, 5v5)
```

### 앱 (Flutter)
```bash
cd app
flutter run               # 로컬 실행
flutter analyze --no-fatal-infos  # 정적 분석
```

### 웹 (Next.js)
```bash
cd web
npm run dev               # 로컬 개발 (localhost:3000)
npm run build             # 빌드 확인
# 배포: GitHub push → Cloudflare Pages 자동 빌드
```

## 아키텍처 핵심

### 멀티 테넌시
- `clubs` + `club_members` 테이블로 클럽 격리
- 모든 쿼리에 `club_id` 조건 필수
- JWT에는 clubId 없음 → `X-Club-Id` 헤더 + DB 실시간 조회로 결정

### API URL
```
https://cornerkicks-api.conerkicks.workers.dev
```

### 멀티클럽 지원
- 유저는 여러 클럽 소속 가능
- `X-Club-Id` 헤더로 활성 클럽 선택
- 로그인/me 응답에 `clubs[]` 배열 포함 (backward-compat: `club`, `player` 필드도 유지)

## 주의사항 (Gotchas)

### DB
- D1 DB 이름: **`conerkicks-db`** (오타 아님, Cloudflare에 실제로 이 이름으로 등록됨)
- DB ID: `7108af93-707b-46cf-8a70-9be933810001`

### 권한
- `club_members.role` 값은 반드시 소문자: `'admin'`, `'member'`, `'owner'` (대문자 사용 시 버그)

### 세션 상태 흐름
```
recruiting → (진행 중) → ended → completed → closed
```
- `ended`: 풋살 종료, 자동 정산(`autoSettleSession`) 트리거
- `completed`: 수동 정산 완료 후 설정
- 랭킹 계산은 `completed`/`closed` 세션만 포함 (refresh 시)

### 경기 status
- 유효값: `'pending'` | `'playing'` | `'completed'` (`'finished'` 없음)

### Flutter 파일 편집
- `${...}` 템플릿 리터럴 포함 파일은 Edit 도구 실패 → Write로 전체 재작성

### enabled_events
- 클럽 허용 이벤트 타입: `'GOAL'` | `'DEFENSE'` | `'TACKLE'` | `'INTERCEPTION'` | `'CLEARANCE'` | `'SAVE'` | `'KEY_PASS'` | `'DRIBBLE'` | `'SHOT_ON'` | `'SHOT_OFF'`
- DEFENSE(간편 수비)와 TACKLE/INTERCEPTION/CLEARANCE(상세 수비)는 동시 사용 불가 — 설정에서 택1

## 주요 파일

| 파일 | 역할 |
|------|------|
| `api/src/routes/auth.ts` | 로그인/회원가입/Google 연동, `getUserClubs()` |
| `api/src/routes/sessions.ts` | 세션 CRUD, 팀 편성, 출석, 자동 정산 |
| `api/src/routes/matches.ts` | 경기/이벤트, `player_match_stats` 업데이트 |
| `api/src/routes/rankings.ts` | 랭킹 캐시, `buildAndCacheRankings()` |
| `api/src/routes/clubs.ts` | 클럽 CRUD, 설정(enabledEvents, mvpWeights) |
| `api/src/routes/announcements.ts` | 공지사항 CRUD |
| `api/src/routes/posts.ts` | 클럽 게시판 + 커뮤니티 게시글 |
| `api/src/middleware/auth.ts` | JWT 검증 + X-Club-Id 처리 |
| `api/src/utils/season.ts` | 시즌 날짜 범위 계산 |
| `app/lib/services/auth_service.dart` | 토큰/유저/클럽 상태 관리 |
| `app/lib/services/api_service.dart` | API 호출 싱글톤, X-Club-Id 자동 추가 |
| `web/src/stores/auth.ts` | Zustand 인증 스토어 |

## API 응답 구조 패턴 (자주 헷갈림)

| 엔드포인트 | ID/데이터 꺼내는 방법 |
|---|---|
| `POST /sessions` | `r.data.id` |
| `POST /players` | `r.data.id` |
| `POST /clubs` | `r.data.club.id` |
| `GET /rankings` | `r.data.data.rankings` (data 중첩 주의) |
| `POST /rankings/refresh` | `r.data.rankings` |
| `POST /sessions/:id/teams` | `r.data.teamIds[]` + `r.data.teams[]` (teams에는 id 없음) |

## 규칙: 랭킹 계산 포함 조건

랭킹은 `completed` / `closed` 세션만 집계됨.
세션을 `ended`로 끝내도 **랭킹에 반영되지 않음** — 수동 정산(`POST /sessions/:id/settlement`)까지 해야 `completed`로 전환됨.

## 규칙: 유저 username 제한

`username` 최대 20자. 테스트 코드에서 타임스탬프 붙일 때 초과 주의.
→ `TS % 100000` 같이 잘라서 사용할 것.

## 컨텍스트 관리 (/clear 타이밍)

**컨텍스트 70% 초과 시 → 반드시 사용자에게 알리고 /clear 타이밍 제안할 것**

### /clear 해도 되는 타이밍
- 독립적인 새 작업을 시작할 때 (이전 작업과 무관한 경우)
- 작업이 완전히 완료되고 커밋/푸시까지 끝났을 때
- 컨텍스트가 너무 길어져 응답이 느려지거나 부정확해질 때
- 컨텍스트 70% 미만이더라도 현재 작업이 완료되고 메모가 필요 없는 경우, /clear 해도 좋다고 먼저 알려줄 것

### /clear 하면 안 되는 타이밍
- 작업이 중간에 끊긴 상태일 때 (미완성 코드, 미저장 변경사항)
- 에러를 분석 중이거나 디버깅 흐름이 이어지는 중일 때
- 여러 파일을 동시에 수정하는 작업이 진행 중일 때

### /clear 전에 반드시 할 것
1. 미커밋 변경사항 커밋 + 푸시 (`/commit-push`)
2. 앞으로도 지켜야 할 규칙/패턴은 CLAUDE.md에 추가
3. 진행 중인 작업이 있으면 TODO 주석 또는 메모 남기기
4. 중요한 결정사항은 memory 파일에 저장

## CLAUDE.md 관리 규칙

이 파일이 200줄을 넘어가면 중복되거나 오래된 내용을 정리해서 200줄 이내로 유지할 것.
정리 전에 사용자에게 어떤 내용 삭제할지 먼저 보여주고 승인받을 것.

## 디자인 시스템

### 브랜드 컬러
- **메인**: `#2ECC71` (다크/라이트 공통)
- Tailwind: `brand.green` → `bg-brand-green`, `text-brand-green`
- Flutter: `kBrandGreen = Color(0xFF2ECC71)` (app/lib/main.dart)

### Web CSS 변수 (globals.css)
| 변수 | 라이트 | 다크 |
|------|--------|------|
| `--primary` | `145 63% 49%` (#2ECC71) | 동일 |
| `--background` | `0 0% 100%` | `222 47% 7%` (#0f172a) |
| `--card` | `0 0% 100%` | `217 33% 17%` (#1e293b) |
| `--border` | `214 32% 91%` | `217 33% 27%` (#334155) |

Tailwind에서 시맨틱 컬러: `bg-background`, `text-foreground`, `bg-card`, `bg-primary`, `text-primary`

### Flutter 테마
- `ThemeMode.system` (시스템 설정 따름)
- 다크: `scaffoldBg #0F172A`, `surface #1E293B`
- 라이트: `scaffoldBg #F8FAFC`

## 랭킹 / 평점(MVP) 시스템

- 랭킹 표시 컬럼은 클럽의 `enabled_events`에 따라 동적 표시
- **평점 가중치**: `clubs.mvp_weights` (JSON) — 관리자가 클럽별 커스텀 가능
- 기본 가중치: GOAL 2.0, ASSIST 1.5, SESSION_WIN 1.5, DEFENSE 0.5, TACKLE/CLEARANCE 0.6, INTERCEPTION 0.6, SAVE 0.8, KEY_PASS 0.7, DRIBBLE 0.5, SHOT_ON 0.4, SHOT_OFF 0.1
- 승/패: 세션 내 1등팀=승, 꼴찌팀=패, 중간=무 (3팀+ 세션)

## 마이그레이션 파일 순서

```
0000_init_schema.sql
0001_add_clubs.sql
0006_session_rsvp.sql
0007_fee_config.sql          ← session_payments, membership_payments
0008_session_auto_status.sql
0009_season_config.sql
0010_google_id.sql           ← users.google_id
0011_fix_session_payments.sql ← guest_name 추가, settlement_id nullable
0012_subscriptions.sql       ← subscriptions 테이블, clubs.owner_user_id
0013_bm_redesign.sql         ← tags, chemistry_cache, AI 카운터, MVP vote_bonus
0014_club_logo.sql           ← clubs.logo_url
0015_fee_system_v2.sql       ← 정산 시스템 v2
0016_announcements.sql       ← 공지사항
0017_posts.sql               ← 클럽 게시판
0018_community.sql           ← 전체 커뮤니티
0019_post_polls.sql          ← 게시글 투표
0020_club_reviews.sql        ← 클럽 리뷰
0021_defense_detail_events.sql ← TACKLE/INTERCEPTION/CLEARANCE 컬럼
0022_attack_gk_events.sql    ← DRIBBLE/SHOT_ON/SHOT_OFF 컬럼
0023_rankings_expansion.sql  ← clubs.mvp_weights
0025_phase2_gamification.sql ← 배지/시즌어워드/반응/댓글수정/라이브공유/출석UNIQUE
```
