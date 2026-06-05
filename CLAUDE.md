# CornerKicks — CLAUDE.md

풋살/축구 동호회 관리 앱. Flutter(앱) + Next.js(웹) + Hono API(Cloudflare Workers + D1 SQLite).
각 폴더에 상세 규칙 있음: `api/CLAUDE.md`, `app/CLAUDE.md`, `web/CLAUDE.md`

## 디렉토리 구조

```
/api   — Hono/TypeScript API (Cloudflare Workers)
/app   — Flutter 모바일 앱
/web   — Next.js 웹
/docs  — 문서
```

## 아키텍처 핵심

### 멀티 테넌시
- `clubs` + `club_members` 테이블로 클럽 격리
- JWT에는 clubId 없음 → `X-Club-Id` 헤더 + DB 실시간 조회로 결정
- 유저는 여러 클럽 소속 가능, 로그인/me 응답에 `clubs[]` 포함

### API URL
```
https://cornerkicks-api.conerkicks.workers.dev
```

## 상태 머신

### 세션 상태 흐름
```
recruiting → ended → completed → closed
```
- `ended`: 풋살 종료, 자동 정산 트리거
- `completed`: 수동 정산 완료 후
- 랭킹 계산은 `completed`/`closed` 세션만 포함

### 경기 status
- `'pending'` | `'playing'` | `'completed'` (`'finished'` 없음)

## enabled_events
- 허용: `GOAL` | `DEFENSE` | `TACKLE` | `INTERCEPTION` | `CLEARANCE` | `SAVE` | `KEY_PASS` | `DRIBBLE` | `SHOT_ON` | `SHOT_OFF`
- DEFENSE(간편)와 TACKLE/INTERCEPTION/CLEARANCE(상세)는 **동시 사용 불가** — 택1

## 랭킹 / MVP 시스템
- 랭킹 컬럼은 클럽의 `enabled_events`에 따라 동적 표시
- **평점 가중치**: `clubs.mvp_weights` (JSON) — 관리자 커스텀 가능
- 기본: GOAL 2.0, ASSIST 1.5, SESSION_WIN 1.5, DEFENSE 0.5, TACKLE/CLEARANCE 0.6, INTERCEPTION 0.6, SAVE 0.8, KEY_PASS 0.7, DRIBBLE 0.5, SHOT_ON 0.4, SHOT_OFF 0.1
- 승/패: 1등팀=승, 꼴찌팀=패, 중간=무 (3팀+ 세션)

## API 응답 구조 (자주 헷갈림)

| 엔드포인트 | 접근 방법 |
|---|---|
| `POST /sessions` | `r.data.id` |
| `POST /clubs` | `r.data.club.id` |
| `GET /rankings` | `r.data.data.rankings` (data 중첩 주의) |
| `POST /rankings/refresh` | `r.data.rankings` |
| `POST /sessions/:id/teams` | `r.data.teamIds[]` + `r.data.teams[]` |

## 브랜드 컬러
- **메인**: `#2ECC71` (다크/라이트 공통)
- 플랫폼별 사용법은 각 폴더 CLAUDE.md 참조

## username 제한
- 최대 20자. 테스트에서 타임스탬프 붙일 때 `TS % 100000`으로 잘라 사용

## 구조 레퍼런스
- 웹 상세 구조: `docs/web-structure.md`
- DB 마이그레이션: `docs/migration-manifest.md` — 새 마이그레이션 전 반드시 확인
- 중복 페이지, 중복 API 모듈, 기존과 안 맞는 카테고리 생성 금지

## 세션 규칙
- 세션 완료 시 반드시 다음을 포함:
  1. **완료 요약** — 무엇을 했고, 무엇이 변경되었는지
  2. **/clear 후 새 세션에서 사용할 프롬프트** — 이어서 할 작업이 있으면 복사-붙여넣기 가능한 프롬프트 제공
