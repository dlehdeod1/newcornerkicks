# 상/하반기 + 연간 랭킹·결산 설계

날짜: 2026-07-29
범위: API + 웹 (Flutter 앱은 다음 세션)

## 목적

랭킹을 연간뿐 아니라 상반기/하반기 단위로 조회하고, 랭킹 페이지에 시상식형 TOP3 결산 섹션을 추가한다.

## 확정 요구사항

- 반기 기준: **달력 고정** — 상반기 = 1/1~6/30, 하반기 = 7/1~12/31 (`season_start_month` 무관)
- 연간(full)은 기존 `season_start_month` 기반 시즌 로직 그대로 유지
- 결산 부문: 기존 명예의전당 7개 — 득점왕/도움왕/공격포인트왕/수비왕/MVP/승률왕/출석왕
  - 클럽 `enabled_events`에 따라 동적 표시 (예: 수비 이벤트 미사용 클럽은 수비왕 숨김)
  - 승률왕은 기존 최소 5경기 조건 유지
- 부문별 **TOP3** 표시
- `completed`/`closed` 세션만 집계 (기존 규칙)

## 1. DB — 마이그레이션 1개

- `rankings_cache`에 `period TEXT NOT NULL DEFAULT 'full'` 추가 — `'full' | 'h1' | 'h2'`
- `UNIQUE(club_id, year, period)` 인덱스 추가
- 기존 행은 DEFAULT로 자동 `'full'` — 데이터 이전 불필요
- id 규칙: full 행은 기존 `clubId*10000 + year` 유지, 반기 행은 `clubId*100000 + year*10 + (1|2)` (기존 id와 충돌 없음)
- `docs/migration-manifest.md` 확인 후 번호 부여 + 갱신

## 2. API

### `api/src/utils/season.ts`
- `getPeriodDateRange(year, period, seasonStartMonth)` 추가
  - `full` → 기존 `getSeasonDateRange(year, seasonStartMonth)`
  - `h1` → `{year}-01-01 ~ {year}-06-30`
  - `h2` → `{year}-07-01 ~ {year}-12-31`

### `api/src/routes/rankings.ts`
- `GET /rankings?year=&period=` — `period` 기본값 `full` (하위호환 100%)
  - 캐시 조회/저장 쿼리에 `AND period = ?` 추가, 미스 시 `buildAndCacheRankings`에 반기 날짜 범위 전달
- `POST /rankings/refresh?year=&period=` — period 지원
- `buildAndCacheRankings`에 period 파라미터 추가 (id 규칙 분기 + INSERT에 period 포함)
- **hall-of-fame 쿼리에 `WHERE period = 'full'` 추가** — 반기 캐시 행이 역대 명예의전당 연도 목록에 섞이는 것 방지 (필수)
- period 값은 Zod/화이트리스트로 검증 (`full|h1|h2` 외 400)

## 3. 웹

### `web/src/lib/api.ts`
- `rankingsApi.get(year, period?)` — period 쿼리 전달

### `web/src/app/(main)/ranking/page.tsx`
- 연도 선택 옆 기간 세그먼트: **연간 | 상반기 | 하반기** (기본 연간)
- queryKey에 period 포함
- 시상식형 TOP3 섹션 (신규 컴포넌트 `PeriodAwards`):
  - 7개 부문 × TOP3, 응답의 `goalRanking/assistRanking/defenseRanking/attendanceRanking/winRateRanking/mvpRanking` 슬라이스
  - 공격포인트왕만 `rankings` 배열에서 goals+assists 클라이언트 계산
  - `enabled_events` 기반 동적 표시
- 연 단위 데이터인 `SeasonAwards`(어워드), fun-stats 섹션은 **연간 선택 시에만** 표시
- CSV export 파일명/내용에 기간 반영

### 손대지 않는 것
- 명예의전당 페이지(역대 연간 1위 전용 유지), stats 페이지

## 4. 검증

- API: `npx wrangler dev` 로컬에서 `period=h1|h2|full` 응답 확인, `node test_realistic.js` 회귀
- 웹: `npm run build` + 랭킹 페이지 기간 전환 동작 확인

## 범위 제외

- Flutter 앱 (다음 세션)
- 시즌 기준 반기 (달력 고정만)
- `fun-stats`/`my-stats`의 `season_start_month` 무시(1/1~12/31 하드코딩) — 기존 버그, 별도 작업
- 프로덕션 D1 마이그레이션 적용은 구현·검증 완료 후 사용자 확인을 받고 실행
