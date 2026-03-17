# BM(비즈니스 모델) 재설계 — 설계 문서

## 개요

CornerKicks 앱의 구독 비즈니스 모델을 재설계한다. FREE/PRO 티어 기능 재배치, AI 크레딧 폐기 및 세션 단위 과금, 신규 기능(태그, 케미, 풋살 DNA, MVP 투표, 사진 업로드, 데이터 내보내기) 추가.

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
| 데이터 내보내기 (Excel) | 잠금 | 가능 |
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

프리셋 태그 목록 (API 하드코딩, DB 불필요):
- 공격: 골결정력, 스피드스터, 프리킥장인, 양발
- 미드: 플레이메이커, 연계왕, 다재다능
- 수비: 수비벽, 탱커, 인터셉터
- 기타: 체력괴물, 캡틴, 분위기메이커
- 커스텀 직접 입력 가능 (최대 10자)

#### 새 테이블: mvp_votes

세션당 1인 1투표. 본인 투표 불가.

```sql
CREATE TABLE mvp_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  voter_player_id INTEGER NOT NULL REFERENCES players(id),
  voted_player_id INTEGER NOT NULL REFERENCES players(id),
  created_at INTEGER NOT NULL,
  UNIQUE(session_id, voter_player_id)
);
```

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

### 1. 팀 편성 변경: `POST /sessions/:id/teams`

요청 body에 `useAI: boolean` 추가.

| 조건 | 동작 |
|------|------|
| FREE (또는 useAI=false) | `balanceTeams()` 실행 |
| PRO + useAI=true + ai_team_count < 3 | Gemini AI 편성 실행, ai_team_count++ |
| PRO + useAI=true + ai_team_count >= 3 | `{ limitReached: true, message: "AI 편성 횟수(3회)를 초과했습니다. 스탯 기반으로 편성할까요?" }` 반환. 프론트에서 확인 후 useAI=false로 재요청. |

#### AI 팀 편성 Gemini 프롬프트 구성

기존 `balanceTeams()` 대비 추가 데이터:
- 선수별 태그 (상위 3개)
- 선수 간 케미 점수 (동반 승률 × 0.4 + 어시스트 연계 × 0.4 + 선호 보너스 × 0.2)
- 선호 선수 관계 (기존 player_preferences 테이블 활용)

### 2. AI 분석 변경: `POST /sessions/:id/ai-analysis`

| 조건 | 동작 |
|------|------|
| FREE | `{ locked: true, reason: 'PRO 전용 기능입니다.' }` (403 대신) |
| PRO + ai_analysis_count < 3 | 기존 Gemini 분석 실행, ai_analysis_count++ |
| PRO + ai_analysis_count >= 3 | `{ error: '이 세션의 AI 분석 횟수(3회)를 초과했습니다.' }` |

### 3. 태그 투표: `PUT /players/:id/tags`

```
요청: { tags: ["골결정력", "캡틴"] }
동작: voter_user_id 기준으로 기존 투표 전부 삭제 후 새 투표 삽입
응답: { tags: [{ tag: "골결정력", votes: 5 }, ...] }  // 전체 투표 현황
```

조회: `GET /players/:id` 응답에 `tags` 필드 추가 — 투표 수 상위 3개만 반환.

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

케미 점수 산출:
```
chemScore = (동반 승률 × 0.4) + (어시스트 연계 빈도 × 0.4) + (선호 보너스 × 0.2)
```
- 동반 승률: 같은 팀 승률 (0~100)
- 어시스트 연계: A↔B 간 어시스트 횟수 / 동반 경기 수 × 100
- 선호 보너스: 상호 선호 100, 편측 선호 50, 없음 0
- 최소 5회 동반 경기 필터

### 5. 연속 기록: `GET /players/:id/streaks` (PRO 전용)

```json
{
  "current": { "type": "win", "count": 3 },
  "best": { "type": "win", "count": 7, "period": "2025-09 ~ 2025-11" },
  "attendance": { "current": 8, "best": 15 },
  "scoring": { "current": 2, "best": 5 }
}
```

실시간 쿼리 계산 (캐싱 불필요).

### 6. 풋살 DNA

`GET /players/:id` 응답에 `futsalDna: { type: string, emoji: string }` 포함.

```typescript
function getFutsalDNA(player): { type: string, emoji: string } {
  const attack = (shooting * 1.5 + offball_run + ball_keeping) / 3.5
  const playmaking = (passing * 1.5 + linkup * 1.5) / 3
  const defense = (intercept * 1.5 + marking * 1.5 + physical) / 4
  const engine = (stamina * 1.5 + speed * 1.5) / 3

  const max = Math.max(attack, playmaking, defense, engine)
  const values = [attack, playmaking, defense, engine]
  const range = Math.max(...values) - Math.min(...values)

  // 편차 10% 이내면 올라운더
  if (range < max * 0.1) return { type: '올라운더', emoji: '⚡' }

  if (max === attack)     return { type: '스트라이커', emoji: '🎯' }
  if (max === playmaking) return { type: '플레이메이커', emoji: '🎩' }
  if (max === defense)    return { type: '수비수', emoji: '🛡️' }
  if (max === engine)     return { type: '엔진', emoji: '🏃' }
  return { type: '올라운더', emoji: '⚡' }
}
```

스탯이 기본값(5)이거나 기록이 부족한 경우 → 타입 표시 안 함.

### 7. MVP 투표: `POST /sessions/:id/mvp-vote`

```
요청: { votedPlayerId: 5 }
조건: clubs.mvp_vote_enabled = 1, 본인 투표 불가
응답: { ok: true }
```

- `GET /sessions/:id/mvp-vote` — 내 투표 + 현재 집계 반환
- 투표 마감: cron에서 세션 종료 24시간 후 자동 확정

MVP 최종 점수:
```
최종 MVP 점수 = STAT 점수 + (받은 투표 수 / 전체 참가자 수) × 3.0
```

클럽 설정 API: `PUT /clubs/me/settings` — `{ mvpVoteEnabled: true/false }`

### 8. 사진 업로드: `POST /players/:id/photo`

- multipart/form-data, 프론트에서 300×300 webp 리사이즈 후 전송
- 최대 1MB
- R2 저장 경로: `players/{clubId}/{playerId}.webp`
- `players.photo_url` 업데이트
- `DELETE /players/:id/photo` — R2 삭제 + photo_url null

### 9. 데이터 내보내기: `GET /clubs/me/export/:type` (PRO 전용)

type: `rankings` | `sessions` | `payments`

- 시즌 랭킹: 선수별 골/도움/출석/승률/MVP 등 주요 통계
- 세션 기록: 참가자, 팀 편성, 경기 결과, 이벤트 기록
- 정산 내역: 세션별 납부 현황

Workers에서 CSV 생성하여 반환. Content-Type: text/csv.
세부 항목은 구현 시 기존 데이터 구조에 맞춰 확정.

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
- `Env` 타입에 `PHOTOS: R2Bucket` 추가
- 기존 cron에 MVP 투표 마감 처리 추가

## 비용 분석

Gemini 3 Flash 기준:
- Input: $0.50/1M 토큰, Output: $3.00/1M 토큰
- AI 팀편성 1회: ~₩8, AI 분석 1회: ~₩6
- 세션당 최대(3+3회): ~₩42
- 월 5세션 최대: ~₩210 (구독료 ₩4,900의 4%)
