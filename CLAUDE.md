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
npx wrangler d1 execute conerkicks-db --file=migrations/XXXX.sql --remote
node test_realistic.js    # 현실적 시나리오 테스트
```

### 앱 (Flutter)
```bash
cd app
flutter run
flutter analyze --no-fatal-infos
```

### 웹 (Next.js)
```bash
cd web
npm run dev    # localhost:3000
npm run build  # 배포: GitHub push → Cloudflare Pages 자동
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
- 로그인/me 응답에 `clubs[]` 배열 포함

## 주의사항 (Gotchas)

### DB
- D1 DB 이름: **`conerkicks-db`** (오타 아님, 실제 등록명)
- DB ID: `7108af93-707b-46cf-8a70-9be933810001`

### 권한
- `club_members.role` 값은 반드시 소문자: `'admin'`, `'member'`, `'owner'`

### 세션 상태 흐름
```
recruiting → (진행 중) → ended → completed → closed
```
- `ended`: 풋살 종료, 자동 정산 트리거
- `completed`: 수동 정산 완료 후
- 랭킹 계산은 `completed`/`closed` 세션만 포함

### 경기 status
- 유효값: `'pending'` | `'playing'` | `'completed'` (`'finished'` 없음)

### Flutter 파일 편집
- `${...}` 포함 파일은 Edit 도구 실패 → Write로 전체 재작성

### enabled_events
- 허용 타입: `'GOAL'` | `'DEFENSE'` | `'TACKLE'` | `'INTERCEPTION'` | `'CLEARANCE'` | `'SAVE'` | `'KEY_PASS'` | `'DRIBBLE'` | `'SHOT_ON'` | `'SHOT_OFF'`
- DEFENSE(간편)와 TACKLE/INTERCEPTION/CLEARANCE(상세)는 동시 사용 불가 — 택1

## 주요 파일

| 파일 | 역할 |
|------|------|
| `api/src/routes/auth.ts` | 로그인/회원가입/Google 연동 |
| `api/src/routes/sessions.ts` | 세션 CRUD, 팀 편성, 출석, 자동 정산 |
| `api/src/routes/matches.ts` | 경기/이벤트, player_match_stats |
| `api/src/routes/rankings.ts` | 랭킹 캐시, buildAndCacheRankings() |
| `api/src/routes/clubs.ts` | 클럽 CRUD, 설정 |
| `api/src/routes/announcements.ts` | 공지사항 |
| `api/src/routes/posts.ts` | 클럽 게시판 + 커뮤니티 |
| `api/src/middleware/auth.ts` | JWT 검증 + X-Club-Id |
| `app/lib/services/auth_service.dart` | 토큰/유저/클럽 상태 |
| `app/lib/services/api_service.dart` | API 호출, X-Club-Id 자동 추가 |
| `web/src/stores/auth.ts` | Zustand 인증 스토어 |

## API 응답 구조 (자주 헷갈림)

| 엔드포인트 | ID/데이터 꺼내는 방법 |
|---|---|
| `POST /sessions` | `r.data.id` |
| `POST /players` | `r.data.id` |
| `POST /clubs` | `r.data.club.id` |
| `GET /rankings` | `r.data.data.rankings` (data 중첩 주의) |
| `POST /rankings/refresh` | `r.data.rankings` |
| `POST /sessions/:id/teams` | `r.data.teamIds[]` + `r.data.teams[]` |

## 랭킹 규칙
- `completed` / `closed` 세션만 집계
- `ended`로 끝내도 랭킹 미반영 — 수동 정산까지 해야 `completed` 전환

## username 제한
- 최대 20자. 테스트에서 타임스탬프 붙일 때 `TS % 100000`으로 잘라 사용

## 디자인 시스템

### 브랜드 컬러
- **메인**: `#2ECC71` (다크/라이트 공통)
- Tailwind: `brand.green` → `bg-brand-green`
- Flutter: `kBrandGreen = Color(0xFF2ECC71)`

### Web CSS 변수 (globals.css)
| 변수 | 라이트 | 다크 |
|------|--------|------|
| `--primary` | `145 63% 49%` | 동일 |
| `--background` | `0 0% 100%` | `222 47% 7%` |
| `--card` | `0 0% 100%` | `217 33% 17%` |
| `--border` | `214 32% 91%` | `217 33% 27%` |

### Flutter 테마
- `ThemeMode.system`
- 다크: `scaffoldBg #0F172A`, `surface #1E293B`
- 라이트: `scaffoldBg #F8FAFC`

## 랭킹 / 평점(MVP) 시스템

- 랭킹 컬럼은 클럽의 `enabled_events`에 따라 동적 표시
- **평점 가중치**: `clubs.mvp_weights` (JSON) — 관리자 커스텀 가능
- 기본: GOAL 2.0, ASSIST 1.5, SESSION_WIN 1.5, DEFENSE 0.5, TACKLE/CLEARANCE 0.6, INTERCEPTION 0.6, SAVE 0.8, KEY_PASS 0.7, DRIBBLE 0.5, SHOT_ON 0.4, SHOT_OFF 0.1
- 승/패: 1등팀=승, 꼴찌팀=패, 중간=무 (3팀+ 세션)

## 구조 레퍼런스
- 웹 상세 구조: `docs/web-structure.md` — 새 페이지/기능 추가 전 반드시 참고
- 중복 페이지, 중복 API 모듈, 기존과 안 맞는 카테고리 생성 금지

## 마이그레이션
- 새 마이그레이션 작성 전 `docs/migration-manifest.md` 반드시 확인 (중복 테이블/컬럼 방지)
- 마이그레이션 추가 후 해당 파일도 함께 업데이트할 것
