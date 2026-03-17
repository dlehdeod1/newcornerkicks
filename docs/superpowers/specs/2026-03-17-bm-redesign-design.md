# BM(비즈니스 모델) 재설계 — 설계 문서

## 개요

CornerKicks 앱의 구독 비즈니스 모델을 재설계한다. FREE/PRO 티어 기능 재배치, AI 세션 단위 횟수제, 신규 기능(태그 투표, 케미, 풋살 DNA, MVP 투표 가산점, 사진 업로드, 데이터 내보내기) 추가.

## 배경

- 기존 `balanceTeams()` (스탯 밸런스)가 PRO에 가둬져 있었으나 AI 호출이 아닌 자체 알고리즘이라 FREE에서 제공해야 함
- PRO의 실질적 차별점이 부족했음 (AI 팀편성, AI 분석, 광고 제거 3가지뿐)
- 크레딧 시스템은 복잡도 대비 Gemini Flash API 비용이 세션당 ₩13 수준으로 불필요
- 케미, 통계, 태그 등 동호회에서 재미를 느낄 수 있는 요소 부족

## PRO vs FREE 최종 기능 매트릭스

| 기능 | FREE | PRO |
|------|------|-----|
| 팀 편성 | `balanceTeams()` 스탯 밸런스 | AI 편성 Gemini (세션당 3회) + 스탯 편성 |
| AI 분석 리포트 | 잠금 (버튼 노출, 업그레이드 팝업 유도) | 세션당 3회 |
| 광고 | 있음 | 없음 |
| 상세 통계 (파트너/천적/연속기록) | 블러 처리 + PRO 유도 | 전체 공개 |
| 데이터 내보내기 (CSV) | 잠금 | 가능 |
| 풋살 DNA | ✅ | ✅ |
| 태그 투표 | ✅ | ✅ |
| MVP 투표 | ✅ | ✅ |
| 사진 업로드 | ✅ | ✅ |
| 다중 관리자 | ✅ | ✅ |

## 구독 구조

- 클럽 단위 구독 (클럽 오너가 결제, 해당 클럽 전체 멤버에 PRO 적용)
- 유저가 PRO 클럽에 접속(X-Club-Id)한 상태에서만 혜택 적용
- 요금: 월간 ₩4,900 / 연간 ₩39,000 (33% 할인)
- 크레딧 시스템 없음 — 세션 단위 사용 횟수만 추적

---

## DB 스키마 변경

### 마이그레이션 파일: `0013_bm_redesign.sql`

#### clubs 테이블 추가 컬럼

```sql
ALTER TABLE clubs ADD COLUMN mvp_vote_enabled INTEGER NOT NULL DEFAULT 0;
```

#### sessions 테이블 추가 컬럼

```sql
ALTER TABLE sessions ADD COLUMN ai_team_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN ai_analysis_count INTEGER NOT NULL DEFAULT 0;
```

#### player_preferences 테이블 (기존 코드 참조, 마이그레이션 누락 보완)

```sql
CREATE TABLE IF NOT EXISTS player_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  preferred_player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  UNIQUE(player_id, preferred_player_id)
);
```

> 기존 코드(`players.ts`)에서 사용 중이나 마이그레이션 파일이 없었으므로 `0013`에 `IF NOT EXISTS`로 포함.

#### 새 테이블: player_tag_votes

선수 태그 투표. 멤버들이 특정 선수에게 태그를 투표. 상위 3개가 공식 태그로 표시.

```sql
CREATE TABLE player_tag_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  voter_user_id TEXT NOT NULL REFERENCES users(id),
  tag TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(player_id, voter_user_id, tag)
);
CREATE INDEX idx_tag_votes_player ON player_tag_votes(player_id);
```

#### 새 테이블: player_chemistry_cache

케미 점수 사전 계산 캐시. 랭킹 리프레시(`POST /rankings/refresh`) 시 함께 갱신.

```sql
CREATE TABLE player_chemistry_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  partner_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  games_together INTEGER NOT NULL DEFAULT 0,
  win_rate REAL NOT NULL DEFAULT 0,
  assist_link REAL NOT NULL DEFAULT 0,
  pref_bonus REAL NOT NULL DEFAULT 0,
  chem_score REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  UNIQUE(club_id, player_id, partner_id)
);
CREATE INDEX idx_chemistry_club ON player_chemistry_cache(club_id);
```

프리셋 태그 목록 (API 하드코딩, DB 불필요):
- 공격: 골결정력, 스피드스터, 프리킥장인, 양발
- 미드: 플레이메이커, 연계왕, 다재다능
- 수비: 수비벽, 탱커, 인터셉터
- 기타: 체력괴물, 캡틴, 분위기메이커
- 커스텀 직접 입력 가능 (최대 10자)
- 악용 방지: 관리자가 `DELETE /players/:playerId/tags/:tag` 로 특정 태그 삭제 가능

#### MVP 투표: 기존 테이블 활용

`session_mvp_votes` 테이블(0005_mvp_voting.sql)이 이미 존재하므로 새 테이블을 만들지 않는다.
- 투표: `session_mvp_votes` (session_id, voter_user_id, voted_player_id)
- 결과: `session_mvp_results` (session_id, player_id, vote_count, decided_at)

변경점: MVP 최종 점수 산출 시 STAT 점수 + 투표 가산점 로직만 추가.

#### R2 버킷 (사진 업로드)

```toml
# wrangler.toml 추가
[[r2_buckets]]
binding = "PHOTOS"
bucket_name = "cornerkicks-photos"
```

```typescript
// Env 타입 추가
PHOTOS: R2Bucket
```

---

## API 설계

### PRO 게이팅 응답 규약

모든 PRO 전용 엔드포인트는 FREE 유저 접근 시 통일된 응답:

```json
// HTTP 403
{ "locked": true, "reason": "PRO 전용 기능입니다." }
```

프론트에서 `locked: true`를 감지하면 업그레이드 팝업을 표시한다.

### 1. 팀 편성 변경: `POST /sessions/:id/teams`

요청 body에 `useAI: boolean` 추가. 기본값 `false` (기존 클라이언트 하위 호환).

기존 `randomBalanceTeams()`는 삭제(dead code 방지). FREE에서도 `balanceTeams()` 제공.

| 조건 | 동작 |
|------|------|
| useAI 미전송 또는 false | `balanceTeams()` 실행 (FREE/PRO 공통) |
| PRO + useAI=true + ai_team_count < 3 | Gemini AI 편성 실행, ai_team_count++ |
| PRO + useAI=true + ai_team_count >= 3 | `{ limitReached: true, message: "AI 편성 횟수(3회)를 초과했습니다. 스탯 기반으로 편성할까요?" }` 반환. 프론트에서 확인 후 useAI=false로 재요청. |
| FREE + useAI=true | 403 locked 응답 |

팀 삭제 후 재편성 시: `ai_team_count`는 리셋하지 않는다. 세션 전체에서 3회 제한.

#### AI 팀 편성 Gemini 프롬프트 구성

기존 `balanceTeams()` 대비 추가 데이터:
- 선수별 태그 (투표 상위 3개)
- 선수 간 케미 점수 (동반 승률 × 0.4 + 어시스트 연계 × 0.4 + 선호 보너스 × 0.2)
- 선호 선수 관계 (기존 `player_preferences` 테이블 활용)
- 케미 데이터는 `player_chemistry_cache` 테이블에서 읽음 (실시간 계산 아님)

### 2. AI 분석 변경: `POST /sessions/:id/ai-analysis`

| 조건 | 동작 |
|------|------|
| FREE | 403 `{ locked: true, reason: 'PRO 전용 기능입니다.' }` |
| PRO + ai_analysis_count < 3 | 기존 Gemini 분석 실행, ai_analysis_count++ |
| PRO + ai_analysis_count >= 3 | 400 `{ error: '이 세션의 AI 분석 횟수(3회)를 초과했습니다.' }` |

### 3. 태그 투표: `POST /players/:id/tags`

```
요청: { tags: ["골결정력", "캡틴"] }
동작: voter_user_id 기준으로 해당 선수에 대한 기존 투표 전부 삭제 후 새 투표 삽입 (D1 batch로 원자적 처리)
응답: { tags: [{ tag: "골결정력", votes: 5 }, ...] }  // 전체 투표 현황
```

- 조회: `GET /players/:id` 응답에 `tags` 필드 추가 — 투표 수 상위 3개만 반환.
- 관리자 삭제: `DELETE /players/:playerId/tags/:tag` — 해당 태그의 모든 투표 삭제 (악용 방지). 관리자 권한 검증 시 해당 선수가 관리자의 `clubId` 소속인지 반드시 확인.

### 4. 케미: `GET /players/:id/chemistry` (PRO 전용)

```json
{
  "bestPartners": [
    { "playerId": 3, "name": "김민수", "gamesTogether": 12, "winRate": 75, "assistLink": 3, "chemScore": 87 }
  ],
  "rivals": [
    { "playerId": 7, "name": "박준호", "gamesAgainst": 10, "winRate": 30 }
  ]
}
```

케미 점수 산출 (사전 계산, `player_chemistry_cache` 테이블에서 조회):
```
chemScore = (동반 승률 × 0.4) + (어시스트 연계 빈도 × 0.4) + (선호 보너스 × 0.2)
```
- 동반 승률: 같은 팀 승률 (0~100). `team_members` 조인으로 계산.
- 어시스트 연계: `match_events` 테이블의 GOAL 이벤트에서 `assister_id`로 A↔B 간 어시스트 횟수 / 동반 경기 수 × 100 (별도 ASSIST 이벤트 타입이 아님)
- 선호 보너스: 상호 선호 100, 편측 선호 50, 없음 0 (기존 `player_preferences` 테이블 활용)
- 최소 5회 동반 경기 필터
- **캐싱 전략**: `POST /rankings/refresh` 호출 시 해당 클럽의 모든 선수 쌍 케미를 재계산하여 `player_chemistry_cache`에 upsert. `GET /players/:id/chemistry`는 캐시 테이블만 조회하므로 Workers CPU 제한에 걸리지 않음.

FREE 접근 시: 403 locked 응답.

### 5. 연속 기록: `GET /players/:id/streaks` (PRO 전용)

```json
{
  "current": { "type": "win", "count": 3 },
  "best": { "type": "win", "count": 7, "period": "2025-09 ~ 2025-11" },
  "attendance": { "current": 8, "best": 15 },
  "scoring": { "current": 2, "best": 5 }
}
```

- 쿼리 범위: 현재 시즌으로 제한 (Workers CPU 시간 제약 고려)
- `sessions` + `teams` + `match_events` 조인으로 계산

FREE 접근 시: 403 locked 응답.

### 6. 풋살 DNA

`GET /players/:id` 응답에 `futsalDna: { type: string, emoji: string }` 포함.

```typescript
function getFutsalDNA(player): { type: string, emoji: string } | null {
  // 스탯이 모두 기본값(5)이면 null 반환 (미표시)
  const stats = [shooting, offball_run, ball_keeping, passing, linkup, intercept, marking, stamina, speed, physical]
  if (stats.every(s => s === 5)) return null

  const attack = (shooting * 1.5 + offball_run + ball_keeping) / 3.5
  const playmaking = (passing * 1.5 + linkup * 1.5) / 3
  const defense = (intercept * 1.5 + marking * 1.5 + physical) / 4
  const engine = (stamina * 1.5 + speed * 1.5) / 3

  const values = [attack, playmaking, defense, engine]
  const max = Math.max(...values)
  const range = max - Math.min(...values)

  // 편차 10% 이내면 올라운더
  if (range < max * 0.1) return { type: '올라운더', emoji: '⚡' }

  // 동점 시 우선순위: 공격 > 플레이메이킹 > 수비 > 엔진
  if (max === attack)     return { type: '스트라이커', emoji: '🎯' }
  if (max === playmaking) return { type: '플레이메이커', emoji: '🎩' }
  if (max === defense)    return { type: '수비수', emoji: '🛡️' }
  if (max === engine)     return { type: '엔진', emoji: '🏃' }
  return { type: '올라운더', emoji: '⚡' }
}
```

동점 시 우선순위는 공격 > 플레이메이킹 > 수비 > 엔진. 풋살 특성상 공격적 플레이 빈도가 높으므로 의도된 순서.

### 7. MVP 투표 가산점

기존 `session_mvp_votes` / `session_mvp_results` 테이블을 그대로 활용.

투표 API (기존과 동일):
- `POST /sessions/:id/mvp-vote` — `{ votedPlayerId: 5 }`, 본인 투표 불가
- `GET /sessions/:id/mvp-vote` — 내 투표 + 현재 집계

변경점 — MVP 최종 점수 산출:
```
최종 MVP 점수 = STAT 점수 + (받은 투표 수 / 전체 참가자 수) × 3.0
```
> STAT 점수: `rankings.ts`의 `buildAndCacheRankings()`에서 계산하는 기존 MVP 점수 (`mvpScore` = 골 × 3 + 도움 × 2 + 세이브 × 2 + 키패스 + 출석점 등)를 기반으로 해당 세션의 경기 이벤트에서 산출.

투표 마감: cron에서 `status IN ('ended', 'completed')` 세션 중 `updated_at`이 24시간 이상 지난 세션의 투표를 확정. 결과를 `session_mvp_results`에 저장.
> `ended` 이후 수동 정산으로 `completed`로 넘어갈 수 있으므로 두 상태 모두 포함.

클럽 설정: `PUT /clubs/me/settings` — `{ mvpVoteEnabled: true/false }`. `clubs.mvp_vote_enabled`로 on/off. 기본 off.

### 8. 사진 업로드: `POST /players/:id/photo`

- multipart/form-data, 프론트에서 300×300 webp 리사이즈 후 전송
- 최대 1MB
- 권한: 본인 또는 관리자(admin/owner)만 업로드 가능
- R2 저장 경로: `players/{clubId}/{playerId}.webp`
- `players.photo_url` 업데이트

사진 접근: Workers 프록시 엔드포인트 `GET /photos/players/:clubId/:playerId.webp` 제공.
R2에서 읽어 응답. Cache-Control 헤더로 CDN 캐싱 활용.
라우트 파일: `api/src/routes/photos.ts` 신규 생성, `index.ts`에 `app.route('/photos', photosRoutes)` 마운트.

- `DELETE /players/:id/photo` — R2 삭제 + photo_url null (본인 또는 관리자)

### 9. 데이터 내보내기: `GET /clubs/me/export/:type` (PRO 전용)

type: `rankings` | `sessions` | `payments`

- 시즌 랭킹: 선수별 골/도움/출석/승률/MVP 등 주요 통계
- 세션 기록: 참가자, 팀 편성, 경기 결과, 이벤트 기록
- 정산 내역: 세션별 납부 현황

Workers에서 CSV 생성하여 반환. Content-Type: `text/csv; charset=utf-8`.
Content-Disposition: `attachment; filename="cornerkicks-rankings-2026.csv"`
세부 항목은 구현 시 기존 데이터 구조에 맞춰 확정.

쿼리 파라미터 `season` (기본값: 현재 시즌)으로 범위 제한. 대량 데이터 클럽의 Workers CPU/메모리 제한 방지.

FREE 접근 시: 403 locked 응답.

---

## 프론트엔드 변경

### Flutter + Web 공통

| 화면 | 변경 사항 |
|------|----------|
| 팀 편성 | FREE: 버튼 텍스트 "팀 편성" (balanceTeams). PRO: "AI 팀 편성 ⚡" + "팀 편성" 2버튼. 잔여 횟수 표시. 횟수 초과 시 확인 팝업. |
| AI 분석 | FREE: 🔒 잠금 버튼 + 업그레이드 바텀시트/모달 (PRO 혜택 리스트 포함). PRO: 기존 + 잔여 횟수. |
| 선수 프로필 | 풋살 DNA 뱃지, 태그 칩(상위 3개), 사진 표시/업로드 |
| 태그 투표 | 선수 프로필에서 태그 투표 UI (프리셋 그리드 + 커스텀 입력) |
| 개인 통계 | 파트너 TOP 3, 천적 TOP 3, 연속 기록 추가. FREE에서 블러 + PRO 유도. |
| 세션 상세 | MVP 투표 UI (클럽 설정 on일 때). 투표 현황 표시. |
| 클럽 설정 | MVP 투표 토글 추가 |
| 업그레이드 팝업 | PRO 혜택 리스트 최신화: AI 편성, AI 분석, 상세 통계, 내보내기, 광고 제거 |
| 내보내기 | 관련 페이지에 📥 버튼. FREE: 업그레이드 팝업. PRO: CSV 다운로드. |

### Flutter 전용

- 사진 업로드: `image_picker` 패키지로 카메라/갤러리 선택 → 리사이즈 → 업로드
- 능력치 평가: 현재 Web에만 있으나 Flutter에도 추가 (경기 직후 모바일에서 평가하는 시나리오)

---

## 인프라 변경

- Cloudflare R2 버킷 생성: `cornerkicks-photos`
- `wrangler.toml`에 R2 바인딩 추가
- `Env` 타입에 `PHOTOS: R2Bucket` 추가 (`@cloudflare/workers-types` devDependency 확인 필요)
- 기존 cron에 MVP 투표 마감 처리 추가
- CLAUDE.md 마이그레이션 목록 업데이트 (0013 추가)

## 비용 분석

Gemini Flash 기준 (모델명은 배포 시점의 최신 Flash 모델 확인):
- Input: $0.50/1M 토큰, Output: $3.00/1M 토큰
- AI 팀편성 1회: ~₩8, AI 분석 1회: ~₩6
- 세션당 최대(3+3회): ~₩42
- 월 5세션 최대: ~₩210 (구독료 ₩4,900의 4%)
