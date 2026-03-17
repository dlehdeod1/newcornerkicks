# BM 재설계 구현 계획

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FREE/PRO 기능 재배치 + 신규 기능 9개(태그, 케미, DNA, MVP, 사진, 내보내기, 스트릭, AI 횟수제, PRO 게이팅) 구현

**Architecture:** API-first. DB 마이그레이션 → 유틸리티 함수 → API 엔드포인트 → 프론트엔드 순서. 모든 PRO 전용 기능은 통일된 403 `{ locked: true }` 응답. AI 사용량은 세션 단위 카운터(`ai_team_count`, `ai_analysis_count`)로 추적.

**Tech Stack:** Hono (Cloudflare Workers) + D1 SQLite + R2 Storage, Next.js (Web), Flutter (App)

**Spec:** `docs/superpowers/specs/2026-03-17-bm-redesign-design.md`

---

## 파일 구조

### 생성 파일

| 파일 | 역할 |
|------|------|
| `api/migrations/0013_bm_redesign.sql` | DB 스키마 변경 (clubs, sessions 컬럼 추가 + 신규 테이블 3개) |
| `api/src/utils/futsalDna.ts` | `getFutsalDNA()` 순수 함수 |
| `api/src/utils/chemistry.ts` | `computeChemistry()` 케미 계산 + 캐시 갱신 |
| `api/src/utils/streaks.ts` | `computeStreaks()` 연속 기록 계산 |
| `api/src/utils/csvExport.ts` | CSV 생성 유틸 |
| `api/src/routes/photos.ts` | 사진 업로드/조회/삭제 라우트 |
| `api/src/routes/export.ts` | CSV 내보내기 라우트 |

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `api/wrangler.toml` | R2 버킷 바인딩 추가 |
| `api/src/index.ts` | Env에 `PHOTOS: R2Bucket` 추가, photos/export 라우트 마운트, cron에 MVP 마감 추가 |
| `api/src/routes/sessions.ts` | `randomBalanceTeams()` 삭제, `useAI` 파라미터 처리, AI 횟수 카운터, AI 분석 횟수 카운터 |
| `api/src/routes/players.ts` | GET /:id에 tags/futsalDna 추가, POST /:id/tags, DELETE /:id/tags/:tag, GET /:id/chemistry, GET /:id/streaks |
| `api/src/routes/rankings.ts` | `buildAndCacheRankings()`에 케미 캐시 갱신 연동 |
| `api/src/routes/clubs.ts` | PUT /me/settings에 mvpVoteEnabled 추가 |
| `api/src/utils/planUtils.ts` | PRO locked 응답 헬퍼 추가 |
| `web/src/lib/api.ts` | 신규 API 호출 함수 추가 |
| `web/src/app/(main)/players/[id]/page.tsx` | DNA 뱃지, 태그, 사진, 케미, 스트릭 UI |
| `web/src/app/(main)/upgrade/page.tsx` | PRO 혜택 리스트 최신화 |
| `web/src/app/(main)/admin/sessions/[id]/page.tsx` | AI 팀편성 버튼 분리, 잔여 횟수 |
| `CLAUDE.md` | 마이그레이션 목록 업데이트 |

---

## Phase 1: Foundation (DB + 인프라 + 유틸)

### Task 1: DB 마이그레이션 작성

**Files:**
- Create: `api/migrations/0013_bm_redesign.sql`
- Modify: `CLAUDE.md`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 0013_bm_redesign.sql

-- clubs: MVP 투표 on/off
ALTER TABLE clubs ADD COLUMN mvp_vote_enabled INTEGER NOT NULL DEFAULT 0;

-- sessions: AI 사용 횟수 추적
ALTER TABLE sessions ADD COLUMN ai_team_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN ai_analysis_count INTEGER NOT NULL DEFAULT 0;

-- player_preferences (코드에 존재하나 마이그레이션 누락 보완)
-- 기존 코드에서 target_player_id 컬럼명 사용 중 (schema.ts, players.ts)
CREATE TABLE IF NOT EXISTS player_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  target_player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  UNIQUE(player_id, target_player_id)
);

-- session_mvp_results에 vote_bonus 컬럼 추가
ALTER TABLE session_mvp_results ADD COLUMN vote_bonus REAL DEFAULT 0;

-- 태그 투표
CREATE TABLE IF NOT EXISTS player_tag_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  voter_user_id TEXT NOT NULL REFERENCES users(id),
  tag TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(player_id, voter_user_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_tag_votes_player ON player_tag_votes(player_id);

-- 케미 캐시
CREATE TABLE IF NOT EXISTS player_chemistry_cache (
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
CREATE INDEX IF NOT EXISTS idx_chemistry_club ON player_chemistry_cache(club_id);
```

- [ ] **Step 2: CLAUDE.md 마이그레이션 목록 업데이트**

`CLAUDE.md`의 마이그레이션 섹션에 추가:
```
0013_bm_redesign.sql         ← tags, chemistry_cache, sessions AI 카운터, clubs MVP 설정
```

- [ ] **Step 3: 원격 DB에 마이그레이션 적용**

```bash
cd api
npx wrangler d1 execute conerkicks-db --file=migrations/0013_bm_redesign.sql --remote
```

- [ ] **Step 4: 커밋**

```bash
git add api/migrations/0013_bm_redesign.sql CLAUDE.md
git commit -m "feat: 0013_bm_redesign 마이그레이션 추가 (태그, 케미캐시, AI카운터)"
```

---

### Task 2: 인프라 설정 (R2 + Env 타입)

**Files:**
- Modify: `api/wrangler.toml`
- Modify: `api/src/index.ts`

- [ ] **Step 1: wrangler.toml에 R2 바인딩 추가**

`api/wrangler.toml` 파일 끝에 추가:
```toml
[[r2_buckets]]
binding = "PHOTOS"
bucket_name = "cornerkicks-photos"
```

- [ ] **Step 2: Env 타입에 PHOTOS 추가**

`api/src/index.ts`의 `Env` 타입에 추가:
```typescript
PHOTOS: R2Bucket
```

- [ ] **Step 3: Cloudflare 대시보드에서 R2 버킷 생성**

Cloudflare 대시보드 → R2 → Create bucket → `cornerkicks-photos`

> `@cloudflare/workers-types`가 devDependencies에 있는지 확인. 없으면 `npm i -D @cloudflare/workers-types` 실행.

- [ ] **Step 4: 로컬 dev 서버 구동 확인**

```bash
cd api && npx wrangler dev
```
R2 바인딩 에러 없이 시작되는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add api/wrangler.toml api/src/index.ts
git commit -m "feat: R2 버킷 바인딩 + Env 타입 업데이트"
```

---

### Task 3: PRO 게이팅 유틸 함수

**Files:**
- Modify: `api/src/utils/planUtils.ts`

- [ ] **Step 1: locked 응답 헬퍼 추가**

`api/src/utils/planUtils.ts`에 추가:

```typescript
import type { Context } from 'hono'

export function proLockedResponse(c: Context, reason = 'PRO 전용 기능입니다.') {
  return c.json({ locked: true, reason }, 403)
}
```

- [ ] **Step 2: 커밋**

```bash
git add api/src/utils/planUtils.ts
git commit -m "feat: proLockedResponse 헬퍼 추가"
```

---

### Task 4: 풋살 DNA 유틸 함수

**Files:**
- Create: `api/src/utils/futsalDna.ts`

- [ ] **Step 1: getFutsalDNA 함수 작성**

```typescript
// api/src/utils/futsalDna.ts

export interface FutsalDNA {
  type: string
  emoji: string
}

export function getFutsalDNA(player: {
  shooting?: number; offball_run?: number; ball_keeping?: number
  passing?: number; linkup?: number
  intercept?: number; marking?: number; physical?: number
  stamina?: number; speed?: number
}): FutsalDNA | null {
  const s = (v?: number) => v ?? 5
  const stats = [
    s(player.shooting), s(player.offball_run), s(player.ball_keeping),
    s(player.passing), s(player.linkup),
    s(player.intercept), s(player.marking),
    s(player.stamina), s(player.speed), s(player.physical),
  ]
  if (stats.every(v => v === 5)) return null

  const attack = (s(player.shooting) * 1.5 + s(player.offball_run) + s(player.ball_keeping)) / 3.5
  const playmaking = (s(player.passing) * 1.5 + s(player.linkup) * 1.5) / 3
  const defense = (s(player.intercept) * 1.5 + s(player.marking) * 1.5 + s(player.physical)) / 4
  const engine = (s(player.stamina) * 1.5 + s(player.speed) * 1.5) / 3

  const values = [attack, playmaking, defense, engine]
  const max = Math.max(...values)
  const range = max - Math.min(...values)

  if (range < max * 0.1) return { type: '올라운더', emoji: '⚡' }
  if (max === attack) return { type: '스트라이커', emoji: '🎯' }
  if (max === playmaking) return { type: '플레이메이커', emoji: '🎩' }
  if (max === defense) return { type: '수비수', emoji: '🛡️' }
  if (max === engine) return { type: '엔진', emoji: '🏃' }
  return { type: '올라운더', emoji: '⚡' }
}
```

- [ ] **Step 2: 수동 검증**

Node.js에서 간단 테스트:
```bash
node -e "
const { getFutsalDNA } = require('./dist/utils/futsalDna.js');
// 기본값 → null
console.assert(getFutsalDNA({}) === null);
// 공격형
console.assert(getFutsalDNA({shooting:9,offball_run:8,ball_keeping:8,passing:4,linkup:4,intercept:3,marking:3,physical:3,stamina:4,speed:5}).type === '스트라이커');
console.log('OK');
"
```

- [ ] **Step 3: 커밋**

```bash
git add api/src/utils/futsalDna.ts
git commit -m "feat: getFutsalDNA() 풋살 DNA 계산 함수"
```

---

## Phase 2: API 엔드포인트 — 독립 기능

### Task 5: 태그 투표 API

**Files:**
- Modify: `api/src/routes/players.ts`

태그 프리셋 목록은 API에 하드코딩. 3개 엔드포인트 추가.

- [ ] **Step 1: 프리셋 태그 상수 + POST /players/:id/tags 추가**

`api/src/routes/players.ts` 파일 상단(import 아래)에 추가:

```typescript
const PRESET_TAGS = [
  '골결정력', '스피드스터', '프리킥장인', '양발',
  '플레이메이커', '연계왕', '다재다능',
  '수비벽', '탱커', '인터셉터',
  '체력괴물', '캡틴', '분위기메이커',
]
```

POST 엔드포인트 추가 (기존 라우트 뒤):

```typescript
// 태그 투표
playersRoutes.post('/:id/tags', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId
  const playerId = Number(c.req.param('id'))

  if (!clubId) return c.json({ error: '클럽이 없습니다.' }, 400)

  // 선수가 해당 클럽 소속인지 확인
  const player = await c.env.DB.prepare(
    'SELECT id FROM players WHERE id = ? AND club_id = ?'
  ).bind(playerId, clubId).first()
  if (!player) return c.json({ error: '선수를 찾을 수 없습니다.' }, 404)

  const { tags } = await c.req.json<{ tags: string[] }>()
  if (!tags || !Array.isArray(tags) || tags.length === 0 || tags.length > 3) {
    return c.json({ error: '태그는 1~3개까지 선택할 수 있습니다.' }, 400)
  }

  // 태그 유효성: 프리셋이거나 10자 이내 커스텀
  for (const tag of tags) {
    if (!PRESET_TAGS.includes(tag) && tag.length > 10) {
      return c.json({ error: `태그는 최대 10자입니다: ${tag}` }, 400)
    }
  }

  const now = Math.floor(Date.now() / 1000)

  // D1 batch로 원자적 처리: 기존 투표 삭제 → 새 투표 삽입
  const stmts = [
    c.env.DB.prepare(
      'DELETE FROM player_tag_votes WHERE player_id = ? AND voter_user_id = ?'
    ).bind(playerId, userId),
    ...tags.map(tag =>
      c.env.DB.prepare(
        'INSERT INTO player_tag_votes (player_id, voter_user_id, tag, created_at) VALUES (?, ?, ?, ?)'
      ).bind(playerId, userId, tag, now)
    ),
  ]
  await c.env.DB.batch(stmts)

  // 전체 투표 현황 반환
  const allTags = await c.env.DB.prepare(
    'SELECT tag, COUNT(*) as votes FROM player_tag_votes WHERE player_id = ? GROUP BY tag ORDER BY votes DESC'
  ).bind(playerId).all()

  return c.json({ tags: allTags.results })
})
```

- [ ] **Step 2: DELETE /players/:playerId/tags/:tag (관리자 전용) 추가**

```typescript
// 관리자 태그 삭제 (악용 방지)
playersRoutes.delete('/:id/tags/:tag', authMiddleware('ADMIN'), async (c) => {
  const clubId = (c as any).clubId
  const playerId = Number(c.req.param('id'))
  const tag = decodeURIComponent(c.req.param('tag'))

  if (!clubId) return c.json({ error: '클럽이 없습니다.' }, 400)

  // 선수가 해당 클럽 소속인지 확인
  const player = await c.env.DB.prepare(
    'SELECT id FROM players WHERE id = ? AND club_id = ?'
  ).bind(playerId, clubId).first()
  if (!player) return c.json({ error: '선수를 찾을 수 없습니다.' }, 404)

  await c.env.DB.prepare(
    'DELETE FROM player_tag_votes WHERE player_id = ? AND tag = ?'
  ).bind(playerId, tag).run()

  return c.json({ ok: true })
})
```

- [ ] **Step 3: GET /players/:id 응답에 tags 필드 추가**

`GET /:id` 핸들러(기존 약 line 66-128)에서 `return c.json(...)` 직전에 태그 쿼리 추가:

```typescript
// 태그 (상위 3개)
const topTags = await c.env.DB.prepare(
  'SELECT tag, COUNT(*) as votes FROM player_tag_votes WHERE player_id = ? GROUP BY tag ORDER BY votes DESC LIMIT 3'
).bind(id).all()
```

응답 객체에 추가:
```typescript
return c.json({
  player: { ...playerData, futsalDna: getFutsalDNA(playerData) },
  stats,
  recentMatches: recentMatches.results,
  badges: badges.results,
  ratings: ratings.results,
  tags: topTags.results,
})
```

> `import { getFutsalDNA } from '../utils/futsalDna'` 추가 필요.

- [ ] **Step 3.5: 선수 삭제 batch에 신규 테이블 cleanup 추가**

기존 `DELETE /:id` 핸들러(약 line 585-603)의 batch 배열에 추가:
```typescript
c.env.DB.prepare('DELETE FROM player_tag_votes WHERE player_id = ?').bind(id),
c.env.DB.prepare('DELETE FROM player_chemistry_cache WHERE player_id = ? OR partner_id = ?').bind(id, id),
```

- [ ] **Step 4: wrangler dev로 수동 테스트**

```bash
# 태그 투표
curl -X POST http://localhost:8787/players/1/tags \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Club-Id: 1" \
  -H "Content-Type: application/json" \
  -d '{"tags":["골결정력","캡틴"]}'

# 선수 조회 — tags 필드 확인
curl http://localhost:8787/players/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Club-Id: 1"
```

- [ ] **Step 5: 커밋**

```bash
git add api/src/routes/players.ts
git commit -m "feat: 태그 투표 API (POST/DELETE tags, GET 응답에 tags 포함)"
```

---

### Task 6: 케미 계산 유틸 + rankings 연동

**Files:**
- Create: `api/src/utils/chemistry.ts`
- Modify: `api/src/routes/rankings.ts`

- [ ] **Step 1: chemistry.ts 작성**

```typescript
// api/src/utils/chemistry.ts

export async function refreshChemistryCache(db: D1Database, clubId: number) {
  const now = Math.floor(Date.now() / 1000)

  // 1. 클럽의 모든 선수 가져오기
  const players = await db.prepare(
    'SELECT id FROM players WHERE club_id = ? AND is_guest = 0'
  ).bind(clubId).all()
  const playerIds = (players.results as any[]).map(p => p.id)
  if (playerIds.length < 2) return

  // 2. 선호 선수 관계 로드
  const prefs = await db.prepare(
    `SELECT player_id, target_player_id FROM player_preferences
     WHERE player_id IN (SELECT id FROM players WHERE club_id = ?)`
  ).bind(clubId).all()
  const prefMap = new Map<string, boolean>()
  for (const p of prefs.results as any[]) {
    prefMap.set(`${p.player_id}-${p.target_player_id}`, true)
  }

  // 3. completed/closed 세션의 팀 멤버십 + 경기 결과 로드
  const teamData = await db.prepare(`
    SELECT
      tm.player_id,
      t.id as team_id,
      t.session_id,
      m.id as match_id,
      m.team1_id, m.team2_id,
      m.team1_score, m.team2_score
    FROM team_members tm
    JOIN teams t ON tm.team_id = t.id
    JOIN sessions s ON t.session_id = s.id
    LEFT JOIN matches m ON m.session_id = s.id
      AND (m.team1_id = t.id OR m.team2_id = t.id)
    WHERE s.club_id = ? AND s.status IN ('completed', 'closed')
      AND m.status = 'completed'
  `).bind(clubId).all()

  // 4. 어시스트 데이터 로드
  const assists = await db.prepare(`
    SELECT me.player_id as scorer, me.assister_id
    FROM match_events me
    JOIN matches m ON me.match_id = m.id
    JOIN sessions s ON m.session_id = s.id
    WHERE s.club_id = ? AND me.event_type = 'GOAL' AND me.assister_id IS NOT NULL
  `).bind(clubId).all()

  // 5. 선수별 팀-경기 맵 구성
  type MatchRecord = { teamId: number; matchId: number; won: boolean }
  const playerMatches = new Map<number, MatchRecord[]>()
  for (const row of teamData.results as any[]) {
    if (!row.match_id) continue
    const won = (row.team1_id === row.team_id && row.team1_score > row.team2_score)
      || (row.team2_id === row.team_id && row.team2_score > row.team1_score)
    const records = playerMatches.get(row.player_id) || []
    records.push({ teamId: row.team_id, matchId: row.match_id, won })
    playerMatches.set(row.player_id, records)
  }

  // 6. 어시스트 쌍 카운트
  const assistPairs = new Map<string, number>()
  for (const a of assists.results as any[]) {
    const key1 = `${a.scorer}-${a.assister_id}`
    const key2 = `${a.assister_id}-${a.scorer}`
    assistPairs.set(key1, (assistPairs.get(key1) || 0) + 1)
    assistPairs.set(key2, (assistPairs.get(key2) || 0) + 1)
  }

  // 7. 모든 선수 쌍에 대해 케미 계산
  const stmts: any[] = []

  // 기존 캐시 삭제
  stmts.push(
    db.prepare('DELETE FROM player_chemistry_cache WHERE club_id = ?').bind(clubId)
  )

  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const pA = playerIds[i]
      const pB = playerIds[j]

      const matchesA = playerMatches.get(pA) || []
      const matchesB = playerMatches.get(pB) || []

      // 같은 팀이었던 경기 찾기
      const coGames: { matchId: number; won: boolean }[] = []
      const matchMapB = new Map<number, MatchRecord>()
      for (const m of matchesB) matchMapB.set(m.matchId, m)

      for (const mA of matchesA) {
        const mB = matchMapB.get(mA.matchId)
        if (mB && mA.teamId === mB.teamId) {
          coGames.push({ matchId: mA.matchId, won: mA.won })
        }
      }

      if (coGames.length < 5) continue

      const winRate = (coGames.filter(g => g.won).length / coGames.length) * 100
      const assistCount = (assistPairs.get(`${pA}-${pB}`) || 0)
      const assistLink = (assistCount / coGames.length) * 100

      const mutualPref = prefMap.has(`${pA}-${pB}`) && prefMap.has(`${pB}-${pA}`)
      const oneSidePref = prefMap.has(`${pA}-${pB}`) || prefMap.has(`${pB}-${pA}`)
      const prefBonus = mutualPref ? 100 : oneSidePref ? 50 : 0

      const chemScore = winRate * 0.4 + assistLink * 0.4 + prefBonus * 0.2

      // A→B, B→A 양방향 저장
      for (const [p1, p2] of [[pA, pB], [pB, pA]]) {
        stmts.push(
          db.prepare(`
            INSERT INTO player_chemistry_cache
              (club_id, player_id, partner_id, games_together, win_rate, assist_link, pref_bonus, chem_score, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(clubId, p1, p2, coGames.length, winRate, assistLink, prefBonus, chemScore, now)
        )
      }
    }
  }

  // D1 batch (최대 100개씩)
  for (let i = 0; i < stmts.length; i += 100) {
    await db.batch(stmts.slice(i, i + 100))
  }
}
```

- [ ] **Step 2: rankings.ts에서 랭킹 리프레시 시 케미 캐시 갱신 연동**

`api/src/routes/rankings.ts`의 `POST /refresh` 핸들러(약 line 118) 끝에 추가:

```typescript
import { refreshChemistryCache } from '../utils/chemistry'

// buildAndCacheRankings() 호출 후:
await refreshChemistryCache(c.env.DB, clubId)
```

- [ ] **Step 3: 커밋**

```bash
git add api/src/utils/chemistry.ts api/src/routes/rankings.ts
git commit -m "feat: 케미 계산 유틸 + 랭킹 리프레시 시 케미 캐시 갱신"
```

---

### Task 7: 케미/스트릭 API 엔드포인트

**Files:**
- Create: `api/src/utils/streaks.ts`
- Modify: `api/src/routes/players.ts`

- [ ] **Step 1: streaks.ts 작성**

```typescript
// api/src/utils/streaks.ts
import { getSeasonDateRange, getClubSeasonStartMonth } from './season'

export interface StreakResult {
  current: { type: string; count: number }
  best: { type: string; count: number; period: string }
  attendance: { current: number; best: number }
  scoring: { current: number; best: number }
}

export async function computeStreaks(
  db: D1Database,
  playerId: number,
  clubId: number,
  year: number,
): Promise<StreakResult> {
  const startMonth = await getClubSeasonStartMonth(db, clubId)
  const { yearStart: start, yearEnd: end } = getSeasonDateRange(year, startMonth)

  // 선수의 세션별 경기 결과 (시즌 범위)
  const results = await db.prepare(`
    SELECT s.id as session_id, s.session_date,
      CASE
        WHEN m.team1_id = t.id AND m.team1_score > m.team2_score THEN 'win'
        WHEN m.team2_id = t.id AND m.team2_score > m.team1_score THEN 'win'
        WHEN m.team1_score = m.team2_score THEN 'draw'
        ELSE 'loss'
      END as result,
      (SELECT COUNT(*) FROM match_events me
       WHERE me.match_id = m.id AND me.player_id = ? AND me.event_type = 'GOAL') as goals
    FROM team_members tm
    JOIN teams t ON tm.team_id = t.id
    JOIN sessions s ON t.session_id = s.id
    JOIN matches m ON m.session_id = s.id AND (m.team1_id = t.id OR m.team2_id = t.id)
    WHERE tm.player_id = ? AND s.club_id = ?
      AND s.status IN ('completed', 'closed')
      AND s.session_date >= ? AND s.session_date <= ?
      AND m.status = 'completed'
    ORDER BY s.session_date ASC
  `).bind(playerId, playerId, clubId, start, end).all()

  const rows = results.results as any[]

  // 승리 연속 기록
  let currentWin = 0, bestWin = 0, bestWinStart = '', bestWinEnd = ''
  let tempStart = ''
  for (const r of rows) {
    if (r.result === 'win') {
      if (currentWin === 0) tempStart = r.session_date
      currentWin++
      if (currentWin > bestWin) {
        bestWin = currentWin
        bestWinStart = tempStart
        bestWinEnd = r.session_date
      }
    } else {
      currentWin = 0
    }
  }

  // 출석 연속: 모든 세션 vs 참가 세션 비교로 gap 감지
  const allSessions = await db.prepare(`
    SELECT s.id FROM sessions s
    WHERE s.club_id = ? AND s.status IN ('completed', 'closed')
      AND s.session_date >= ? AND s.session_date <= ?
    ORDER BY s.session_date ASC
  `).bind(clubId, start, end).all()
  const attendedSet = new Set<number>()
  const attended = await db.prepare(`
    SELECT a.session_id FROM attendance a
    JOIN sessions s ON a.session_id = s.id
    WHERE a.player_id = ? AND s.club_id = ?
      AND s.session_date >= ? AND s.session_date <= ?
  `).bind(playerId, clubId, start, end).all()
  for (const a of attended.results as any[]) attendedSet.add(a.session_id)

  let currentAtt = 0, bestAtt = 0, tempAtt = 0
  for (const s of allSessions.results as any[]) {
    if (attendedSet.has(s.id)) {
      tempAtt++
      if (tempAtt > bestAtt) bestAtt = tempAtt
    } else {
      tempAtt = 0
    }
  }
  // 현재 출석 연속 = 마지막부터 끊기지 않은 횟수
  currentAtt = 0
  for (let i = (allSessions.results as any[]).length - 1; i >= 0; i--) {
    if (attendedSet.has((allSessions.results as any[])[i].id)) currentAtt++
    else break
  }

  // 득점 연속
  let currentScoring = 0, bestScoring = 0
  for (const r of rows) {
    if (r.goals > 0) {
      currentScoring++
      if (currentScoring > bestScoring) bestScoring = currentScoring
    } else {
      currentScoring = 0
    }
  }
  // 현재 득점 연속 = 마지막부터
  currentScoring = 0
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].goals > 0) currentScoring++
    else break
  }

  // 현재 승리 연속 = 마지막부터
  let currentWinFromEnd = 0
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].result === 'win') currentWinFromEnd++
    else break
  }

  const period = bestWinStart && bestWinEnd
    ? `${bestWinStart.substring(0, 7)} ~ ${bestWinEnd.substring(0, 7)}`
    : ''

  return {
    current: { type: 'win', count: currentWinFromEnd },
    best: { type: 'win', count: bestWin, period },
    attendance: { current: currentAtt, best: bestAtt },
    scoring: { current: currentScoring, best: bestScoring },
  }
}
```

- [ ] **Step 2: players.ts에 GET /:id/chemistry 엔드포인트 추가**

```typescript
import { isClubPro, proLockedResponse } from '../utils/planUtils'

// 케미 (PRO 전용)
playersRoutes.get('/:id/chemistry', authMiddleware(), async (c) => {
  const clubId = (c as any).clubId
  const playerId = Number(c.req.param('id'))

  if (!clubId) return c.json({ error: '클럽이 없습니다.' }, 400)

  const club = await c.env.DB.prepare(
    'SELECT plan_type FROM clubs WHERE id = ?'
  ).bind(clubId).first<any>()
  if (!isClubPro(club?.plan_type)) return proLockedResponse(c)

  const partners = await c.env.DB.prepare(`
    SELECT cc.partner_id as playerId, p.name, cc.games_together as gamesTogether,
           cc.win_rate as winRate, cc.assist_link as assistLink, cc.chem_score as chemScore
    FROM player_chemistry_cache cc
    JOIN players p ON cc.partner_id = p.id
    WHERE cc.club_id = ? AND cc.player_id = ? AND cc.games_together >= 5
    ORDER BY cc.chem_score DESC
    LIMIT 5
  `).bind(clubId, playerId).all()

  const rivals = await c.env.DB.prepare(`
    SELECT cc.partner_id as playerId, p.name, cc.games_together as gamesAgainst,
           cc.win_rate as winRate
    FROM player_chemistry_cache cc
    JOIN players p ON cc.partner_id = p.id
    WHERE cc.club_id = ? AND cc.player_id = ? AND cc.games_together >= 5
    ORDER BY cc.win_rate ASC
    LIMIT 5
  `).bind(clubId, playerId).all()

  return c.json({
    bestPartners: partners.results,
    rivals: rivals.results,
  })
})
```

- [ ] **Step 3: players.ts에 GET /:id/streaks 엔드포인트 추가**

```typescript
import { computeStreaks } from '../utils/streaks'

// 연속 기록 (PRO 전용)
playersRoutes.get('/:id/streaks', authMiddleware(), async (c) => {
  const clubId = (c as any).clubId
  const playerId = Number(c.req.param('id'))

  if (!clubId) return c.json({ error: '클럽이 없습니다.' }, 400)

  const club = await c.env.DB.prepare(
    'SELECT plan_type FROM clubs WHERE id = ?'
  ).bind(clubId).first<any>()
  if (!isClubPro(club?.plan_type)) return proLockedResponse(c)

  const year = Number(c.req.query('year')) || new Date().getFullYear()
  const streaks = await computeStreaks(c.env.DB, playerId, clubId, year)
  // computeStreaks 내부에서 getClubSeasonStartMonth를 호출하므로 year만 넘기면 됨

  return c.json(streaks)
})
```

- [ ] **Step 4: 커밋**

```bash
git add api/src/utils/streaks.ts api/src/routes/players.ts
git commit -m "feat: 케미/스트릭 API 엔드포인트 (PRO 전용)"
```

---

### Task 8: 사진 업로드 라우트

**Files:**
- Create: `api/src/routes/photos.ts`
- Modify: `api/src/routes/players.ts` (photo 엔드포인트 추가)
- Modify: `api/src/index.ts` (라우트 마운트)

- [ ] **Step 1: photos.ts 생성 (R2 프록시 조회)**

```typescript
// api/src/routes/photos.ts
import { Hono } from 'hono'
import type { Env } from '../index'

const photosRoutes = new Hono<{ Bindings: Env }>()

// GET /photos/players/:clubId/:file — R2 프록시
photosRoutes.get('/players/:clubId/:file', async (c) => {
  const clubId = c.req.param('clubId')
  const file = c.req.param('file')
  const key = `players/${clubId}/${file}`

  const obj = await c.env.PHOTOS.get(key)
  if (!obj) return c.notFound()

  const headers = new Headers()
  headers.set('Content-Type', 'image/webp')
  headers.set('Cache-Control', 'public, max-age=86400')
  obj.writeHttpMetadata(headers)

  return new Response(obj.body, { headers })
})

export { photosRoutes }
```

- [ ] **Step 2: players.ts에 POST /:id/photo, DELETE /:id/photo 추가**

```typescript
// 사진 업로드
playersRoutes.post('/:id/photo', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId
  const playerId = Number(c.req.param('id'))

  if (!clubId) return c.json({ error: '클럽이 없습니다.' }, 400)

  const player = await c.env.DB.prepare(
    'SELECT id, user_id FROM players WHERE id = ? AND club_id = ?'
  ).bind(playerId, clubId).first<any>()
  if (!player) return c.json({ error: '선수를 찾을 수 없습니다.' }, 404)

  // 본인 또는 관리자만 업로드 가능
  const member = await c.env.DB.prepare(
    'SELECT role FROM club_members WHERE user_id = ? AND club_id = ?'
  ).bind(userId, clubId).first<any>()
  const isAdmin = member?.role === 'admin' || member?.role === 'owner'
  if (player.user_id !== userId && !isAdmin) {
    return c.json({ error: '권한이 없습니다.' }, 403)
  }

  const formData = await c.req.formData()
  const file = formData.get('photo') as File | null
  if (!file) return c.json({ error: '사진 파일이 필요합니다.' }, 400)
  if (file.size > 1024 * 1024) return c.json({ error: '최대 1MB까지 업로드 가능합니다.' }, 400)

  const key = `players/${clubId}/${playerId}.webp`
  await c.env.PHOTOS.put(key, file.stream(), {
    httpMetadata: { contentType: 'image/webp' },
  })

  const photoUrl = `/photos/${key}`
  const now = Math.floor(Date.now() / 1000)
  await c.env.DB.prepare(
    'UPDATE players SET photo_url = ?, updated_at = ? WHERE id = ?'
  ).bind(photoUrl, now, playerId).run()

  return c.json({ photoUrl })
})

// 사진 삭제
playersRoutes.delete('/:id/photo', authMiddleware(), async (c) => {
  const userId = (c as any).userId
  const clubId = (c as any).clubId
  const playerId = Number(c.req.param('id'))

  if (!clubId) return c.json({ error: '클럽이 없습니다.' }, 400)

  const player = await c.env.DB.prepare(
    'SELECT id, user_id FROM players WHERE id = ? AND club_id = ?'
  ).bind(playerId, clubId).first<any>()
  if (!player) return c.json({ error: '선수를 찾을 수 없습니다.' }, 404)

  const member = await c.env.DB.prepare(
    'SELECT role FROM club_members WHERE user_id = ? AND club_id = ?'
  ).bind(userId, clubId).first<any>()
  const isAdmin = member?.role === 'admin' || member?.role === 'owner'
  if (player.user_id !== userId && !isAdmin) {
    return c.json({ error: '권한이 없습니다.' }, 403)
  }

  const key = `players/${clubId}/${playerId}.webp`
  await c.env.PHOTOS.delete(key)

  const now = Math.floor(Date.now() / 1000)
  await c.env.DB.prepare(
    'UPDATE players SET photo_url = NULL, updated_at = ? WHERE id = ?'
  ).bind(now, playerId).run()

  return c.json({ ok: true })
})
```

- [ ] **Step 3: index.ts에 photos 라우트 마운트**

```typescript
import { photosRoutes } from './routes/photos'
// ...
app.route('/photos', photosRoutes)
```

- [ ] **Step 4: 커밋**

```bash
git add api/src/routes/photos.ts api/src/routes/players.ts api/src/index.ts
git commit -m "feat: 사진 업로드/조회/삭제 API (R2 프록시)"
```

---

### Task 9: CSV 내보내기 API

**Files:**
- Create: `api/src/utils/csvExport.ts`
- Create: `api/src/routes/export.ts`
- Modify: `api/src/index.ts`

- [ ] **Step 1: csvExport.ts 유틸 작성**

```typescript
// api/src/utils/csvExport.ts

export function toCsv(headers: string[], rows: any[][]): string {
  const escape = (v: any) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const lines = [headers.map(escape).join(',')]
  for (const row of rows) {
    lines.push(row.map(escape).join(','))
  }
  return '\uFEFF' + lines.join('\r\n') // BOM for Excel 한글 지원
}
```

- [ ] **Step 2: export.ts 라우트 작성**

```typescript
// api/src/routes/export.ts
import { Hono } from 'hono'
import type { Env } from '../index'
import { authMiddleware } from '../middleware/auth'
import { isClubPro, proLockedResponse } from '../utils/planUtils'
import { toCsv } from '../utils/csvExport'
import { getSeasonDateRange, getClubSeasonStartMonth } from '../utils/season'

const exportRoutes = new Hono<{ Bindings: Env }>()

exportRoutes.get('/:type', authMiddleware('ADMIN'), async (c) => {
  const clubId = (c as any).clubId
  if (!clubId) return c.json({ error: '클럽이 없습니다.' }, 400)

  const club = await c.env.DB.prepare(
    'SELECT plan_type FROM clubs WHERE id = ?'
  ).bind(clubId).first<any>()
  if (!isClubPro(club?.plan_type)) return proLockedResponse(c)

  const type = c.req.param('type')
  const year = Number(c.req.query('season')) || new Date().getFullYear()
  const startMonth = await getClubSeasonStartMonth(c.env.DB, clubId)
  const { yearStart: start, yearEnd: end } = getSeasonDateRange(year, startMonth)

  let csv = ''
  let filename = ''

  if (type === 'rankings') {
    const rankings = await c.env.DB.prepare(`
      SELECT p.name, r.goals, r.assists, r.defenses, r.attendance,
             r.total_games, r.wins, r.draws, r.losses, r.win_rate, r.mvp_count
      FROM rankings_cache rc
      CROSS JOIN json_each(rc.data) je
      JOIN players p ON json_extract(je.value, '$.playerId') = p.id
      LEFT JOIN (
        SELECT player_id, goals, assists, defenses, attendance,
               total_games, wins, draws, losses, win_rate, mvp_count
        FROM json_each(rc.data)
      ) r ON 1=0
      WHERE rc.club_id = ? AND rc.year = ?
    `).bind(clubId, year).first()

    // rankings_cache에서 직접 JSON 파싱
    const cache = await c.env.DB.prepare(
      'SELECT data FROM rankings_cache WHERE club_id = ? AND year = ?'
    ).bind(clubId, year).first<any>()

    if (cache?.data) {
      const data = JSON.parse(cache.data) as any[]
      const headers = ['이름', '골', '도움', '블록', '출석', '경기수', '승', '무', '패', '승률', 'MVP']
      const rows = data.map((r: any) => [
        r.name, r.goals, r.assists, r.defenses, r.attendance,
        r.totalGames, r.wins, r.draws, r.losses,
        r.winRate ? `${(r.winRate * 100).toFixed(1)}%` : '0%',
        r.mvpCount,
      ])
      csv = toCsv(headers, rows)
    }
    filename = `cornerkicks-rankings-${year}.csv`

  } else if (type === 'sessions') {
    const sessions = await c.env.DB.prepare(`
      SELECT s.id, s.title, s.session_date, s.start_time, s.end_time,
             s.status, s.location,
             (SELECT COUNT(*) FROM session_attendees sa WHERE sa.session_id = s.id) as attendee_count
      FROM sessions s
      WHERE s.club_id = ? AND s.session_date >= ? AND s.session_date <= ?
      ORDER BY s.session_date DESC
    `).bind(clubId, start, end).all()

    const headers = ['날짜', '제목', '장소', '시작', '종료', '상태', '참가자수']
    const rows = (sessions.results as any[]).map(s => [
      s.session_date, s.title || '', s.location || '',
      s.start_time || '', s.end_time || '', s.status, s.attendee_count,
    ])
    csv = toCsv(headers, rows)
    filename = `cornerkicks-sessions-${year}.csv`

  } else if (type === 'payments') {
    const payments = await c.env.DB.prepare(`
      SELECT s.session_date, s.title, p.name as player_name,
             sp.amount, sp.status, sp.payment_method
      FROM session_payments sp
      JOIN sessions s ON sp.session_id = s.id
      JOIN players p ON sp.player_id = p.id
      WHERE s.club_id = ? AND s.session_date >= ? AND s.session_date <= ?
      ORDER BY s.session_date DESC, p.name
    `).bind(clubId, start, end).all()

    const headers = ['날짜', '세션', '선수', '금액', '상태', '결제방법']
    const rows = (payments.results as any[]).map(p => [
      p.session_date, p.title || '', p.player_name,
      p.amount, p.status, p.payment_method || '',
    ])
    csv = toCsv(headers, rows)
    filename = `cornerkicks-payments-${year}.csv`

  } else {
    return c.json({ error: '유효하지 않은 내보내기 타입입니다.' }, 400)
  }

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})

export { exportRoutes }
```

- [ ] **Step 3: index.ts에 export 라우트 마운트**

```typescript
import { exportRoutes } from './routes/export'
// ...
app.route('/export', exportRoutes)
```

- [ ] **Step 4: 커밋**

```bash
git add api/src/utils/csvExport.ts api/src/routes/export.ts api/src/index.ts
git commit -m "feat: CSV 내보내기 API (rankings/sessions/payments, PRO 전용)"
```

---

## Phase 3: 팀 편성 & AI 변경

### Task 10: 팀 편성 로직 변경

**Files:**
- Modify: `api/src/routes/sessions.ts`

이 태스크는 sessions.ts의 핵심 로직을 변경하므로 주의 필요.

- [ ] **Step 1: `randomBalanceTeams()` 함수 삭제**

`api/src/routes/sessions.ts` 약 line 388-397의 `randomBalanceTeams` 함수를 삭제한다.

- [ ] **Step 2: POST /:id/teams 핸들러에 useAI 파라미터 처리 추가**

기존 핸들러(약 line 458)에서:

1. body에서 `useAI` 추출:
```typescript
const { attendees, useAI = false } = body
```

2. isPro 체크 후 분기 로직 변경:

```typescript
// 기존: isPro ? balanceTeams(...) : randomBalanceTeams(...)
// 변경:
if (useAI) {
  if (!isPro) {
    return c.json({ locked: true, reason: 'PRO 전용 기능입니다.' }, 403)
  }

  // AI 횟수 확인
  const session = await c.env.DB.prepare(
    'SELECT ai_team_count FROM sessions WHERE id = ?'
  ).bind(sessionId).first<any>()

  if ((session?.ai_team_count ?? 0) >= 3) {
    return c.json({
      limitReached: true,
      message: 'AI 편성 횟수(3회)를 초과했습니다. 스탯 기반으로 편성할까요?',
    })
  }

  // Gemini AI 편성 (기존 Gemini 호출 로직 활용)
  // ... (AI 편성 로직은 Task 11에서 구현)
  // 성공 시 카운터 증가:
  await c.env.DB.prepare(
    'UPDATE sessions SET ai_team_count = ai_team_count + 1 WHERE id = ?'
  ).bind(sessionId).run()
} else {
  // FREE/PRO 공통: balanceTeams()
  teams = balanceTeams(allPlayers, teamCount)
}
```

3. 기존 `randomBalanceTeams` 호출 부분을 모두 `balanceTeams`로 교체.

- [ ] **Step 3: POST /:id/ai-analysis 횟수 제한 추가**

기존 ai-analysis 엔드포인트(약 line 1167)에서:

```typescript
// isPro 체크 후 추가:
const session = await c.env.DB.prepare(
  'SELECT ai_analysis_count FROM sessions WHERE id = ?'
).bind(sessionId).first<any>()

if ((session?.ai_analysis_count ?? 0) >= 3) {
  return c.json({ error: '이 세션의 AI 분석 횟수(3회)를 초과했습니다.' }, 400)
}

// 분석 성공 후 카운터 증가:
await c.env.DB.prepare(
  'UPDATE sessions SET ai_analysis_count = ai_analysis_count + 1 WHERE id = ?'
).bind(sessionId).run()
```

- [ ] **Step 4: wrangler dev로 팀 편성 수동 테스트**

```bash
# 기본 편성 (balanceTeams)
curl -X POST http://localhost:8787/sessions/1/teams \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Club-Id: 1" \
  -H "Content-Type: application/json" \
  -d '{"attendees":[...]}'

# AI 편성 시도 (FREE → 403)
curl -X POST http://localhost:8787/sessions/1/teams \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Club-Id: 1" \
  -H "Content-Type: application/json" \
  -d '{"attendees":[...],"useAI":true}'
```

- [ ] **Step 5: 커밋**

```bash
git add api/src/routes/sessions.ts
git commit -m "feat: 팀 편성 로직 변경 (randomBalanceTeams 삭제, useAI 파라미터, AI 횟수 제한)"
```

---

### Task 11: AI 팀 편성 Gemini 프롬프트 강화

**Files:**
- Modify: `api/src/routes/sessions.ts`

- [ ] **Step 1: AI 편성 시 추가 데이터 로드**

`useAI=true` 분기에서 Gemini 호출 전에 추가 데이터 로드:

```typescript
// 선수별 태그 (상위 3개)
const tagResults = await c.env.DB.prepare(`
  SELECT ptv.player_id, ptv.tag, COUNT(*) as votes
  FROM player_tag_votes ptv
  WHERE ptv.player_id IN (${allPlayers.map(() => '?').join(',')})
  GROUP BY ptv.player_id, ptv.tag
  ORDER BY votes DESC
`).bind(...allPlayers.map((p: any) => p.id)).all()

// 케미 데이터 (캐시에서)
const chemResults = await c.env.DB.prepare(`
  SELECT player_id, partner_id, chem_score
  FROM player_chemistry_cache
  WHERE club_id = ? AND chem_score > 70
`).bind(clubId).all()
```

프롬프트에 추가:
```typescript
const tagsByPlayer = new Map<number, string[]>()
// ... 태그 그룹핑

const prompt = `
풋살 팀 편성을 해주세요.
${allPlayers.map((p: any) => {
  const tags = tagsByPlayer.get(p.id)?.slice(0, 3).join(', ') || '없음'
  return `- ${p.name}: 종합 ${p.overall}, 공격 ${p.attack}, 수비 ${p.defense}, 태그: ${tags}`
}).join('\n')}

케미 정보:
${(chemResults.results as any[]).map(c =>
  `${c.player_id}번-${c.partner_id}번: 케미 ${c.chem_score.toFixed(0)}점`
).join('\n')}

${teamCount}팀으로 밸런스 있게 편성해주세요. 케미가 높은 선수는 같은 팀에 배치하면 좋습니다.
JSON 형식으로 응답: [[선수ID,...], [선수ID,...]]
`
```

- [ ] **Step 2: 커밋**

```bash
git add api/src/routes/sessions.ts
git commit -m "feat: AI 팀 편성 프롬프트에 태그/케미 데이터 추가"
```

---

## Phase 4: MVP 투표 + 클럽 설정

### Task 12: MVP 투표 가산점 + cron 마감

**Files:**
- Modify: `api/src/routes/clubs.ts`
- Modify: `api/src/index.ts`

- [ ] **Step 1: clubs.ts PUT /me에 mvpVoteEnabled 추가**

기존 `PUT /me` 핸들러(약 line 180)의 body 파싱에 `mvpVoteEnabled` 추가:

```typescript
const { name, description, enabledEvents, mvpVoteEnabled, ...rest } = await c.req.json()
```

UPDATE 쿼리에 조건부 추가:
```typescript
if (mvpVoteEnabled !== undefined) {
  await c.env.DB.prepare(
    'UPDATE clubs SET mvp_vote_enabled = ?, updated_at = ? WHERE id = ?'
  ).bind(mvpVoteEnabled ? 1 : 0, now, clubId).run()
}
```

- [ ] **Step 2: index.ts에 MVP 투표 마감 cron 함수 추가**

```typescript
async function finalizeMvpVotes(env: Env) {
  const now = Math.floor(Date.now() / 1000)
  const cutoff = now - 86400 // 24시간 전

  // MVP 투표 마감 대상 세션
  const sessions = await env.DB.prepare(`
    SELECT s.id, s.club_id
    FROM sessions s
    JOIN clubs c ON s.club_id = c.id
    WHERE s.status IN ('ended', 'completed')
      AND s.updated_at < ?
      AND c.mvp_vote_enabled = 1
      AND s.id NOT IN (SELECT session_id FROM session_mvp_results)
  `).bind(cutoff).all()

  for (const session of sessions.results as any[]) {
    // 투표 집계
    const votes = await env.DB.prepare(`
      SELECT voted_player_id, COUNT(*) as vote_count
      FROM session_mvp_votes
      WHERE session_id = ?
      GROUP BY voted_player_id
      ORDER BY vote_count DESC
    `).bind(session.id).all()

    if ((votes.results as any[]).length === 0) continue

    // 참가자 수 (attendance 테이블)
    const attendeeCount = await env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM attendance WHERE session_id = ?'
    ).bind(session.id).first<any>()
    const total = attendeeCount?.cnt || 1

    // 최고 득표자만 MVP로 저장 (session_mvp_results는 session_id UNIQUE)
    const winner = (votes.results as any[])[0] // ORDER BY vote_count DESC이므로 첫번째가 1위
    const voteBonus = (winner.vote_count / total) * 3.0
    await env.DB.prepare(`
      INSERT OR REPLACE INTO session_mvp_results
        (session_id, player_id, vote_count, vote_bonus, decided_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(session.id, winner.voted_player_id, winner.vote_count, voteBonus, now).run()
  }
}
```

`scheduled()` 함수에 추가:
```typescript
async scheduled(_event: any, env: Env, _ctx: any) {
  await autoTransitionSessions(env)
  await expireSubscriptions(env)
  await finalizeMvpVotes(env)
},
```

- [ ] **Step 3: 커밋**

```bash
git add api/src/routes/clubs.ts api/src/index.ts
git commit -m "feat: MVP 투표 마감 cron + 클럽 설정 mvpVoteEnabled"
```

---

## Phase 5: Web 프론트엔드

### Task 13: web/src/lib/api.ts 신규 API 함수 추가

**Files:**
- Modify: `web/src/lib/api.ts`

- [ ] **Step 1: playersApi에 신규 함수 추가**

```typescript
// playersApi 객체에 추가:
voteTags: (token: string, playerId: number, tags: string[]) =>
  api(`/players/${playerId}/tags`, { method: 'POST', token, body: { tags } }),

deleteTag: (token: string, playerId: number, tag: string) =>
  api(`/players/${playerId}/tags/${encodeURIComponent(tag)}`, { method: 'DELETE', token }),

chemistry: (token: string, playerId: number) =>
  api(`/players/${playerId}/chemistry`, { token }),

streaks: (token: string, playerId: number, year?: number) =>
  api(`/players/${playerId}/streaks${year ? `?year=${year}` : ''}`, { token }),

uploadPhoto: async (token: string, playerId: number, file: File) => {
  const formData = new FormData()
  formData.append('photo', file)
  const clubId = localStorage.getItem('activeClubId')
  const res = await fetch(`${API_BASE}/players/${playerId}/photo`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...(clubId ? { 'X-Club-Id': clubId } : {}),
    },
    body: formData,
  })
  if (!res.ok) throw await res.json()
  return res.json()
},

deletePhoto: (token: string, playerId: number) =>
  api(`/players/${playerId}/photo`, { method: 'DELETE', token }),
```

- [ ] **Step 2: clubsApi에 settings 함수 추가 (기존 me 활용)**

기존 `clubsApi.me` PUT 호출로 mvpVoteEnabled를 전달하면 되므로 별도 함수 불필요. 필요 시:

```typescript
// clubsApi에 추가:
updateSettings: (token: string, settings: any) =>
  api('/clubs/me', { method: 'PUT', token, body: settings }),
```

- [ ] **Step 3: exportApi 추가**

```typescript
export const exportApi = {
  download: async (token: string, type: string, season?: number) => {
    const clubId = localStorage.getItem('activeClubId')
    const url = `${API_BASE}/export/${type}${season ? `?season=${season}` : ''}`
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        ...(clubId ? { 'X-Club-Id': clubId } : {}),
      },
    })
    if (!res.ok) {
      const err = await res.json()
      if (err.locked) throw err
      throw new Error(err.error || '다운로드 실패')
    }
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = res.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || `export-${type}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  },
}
```

- [ ] **Step 4: 커밋**

```bash
git add web/src/lib/api.ts
git commit -m "feat: Web API 클라이언트 신규 함수 추가 (태그, 케미, 사진, 내보내기)"
```

---

### Task 14: 선수 프로필 페이지 UI 업데이트

**Files:**
- Modify: `web/src/app/(main)/players/[id]/page.tsx`

이 태스크는 기존 선수 상세 페이지에 다음을 추가:
- 풋살 DNA 뱃지
- 태그 칩 (상위 3개) + 투표 UI
- 사진 표시/업로드
- 케미 섹션 (PRO)
- 스트릭 섹션 (PRO)

> 파일이 크므로 먼저 현재 내용을 읽고 수정 지점을 파악할 것.

- [ ] **Step 1: 페이지 파일 읽기 + 구조 파악**

```
Read: web/src/app/(main)/players/[id]/page.tsx
```

- [ ] **Step 2: DNA 뱃지 컴포넌트 추가**

선수 이름 옆에 DNA 뱃지 표시:
```tsx
{player.futsalDna && (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs">
    {player.futsalDna.emoji} {player.futsalDna.type}
  </span>
)}
```

- [ ] **Step 3: 태그 칩 + 투표 UI 추가**

선수 프로필 섹션에 태그 표시:
```tsx
{/* 태그 */}
<div className="flex flex-wrap gap-1.5 mt-2">
  {tags?.map((t: any) => (
    <span key={t.tag} className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs rounded-full">
      {t.tag} ({t.votes})
    </span>
  ))}
</div>
```

태그 투표 모달/바텀시트는 별도 구현 (프리셋 그리드 + 커스텀 입력).

- [ ] **Step 4: 케미 + 스트릭 섹션 (PRO 블러 처리)**

```tsx
{/* 케미 (PRO) */}
<div className={!isPro ? 'blur-sm pointer-events-none relative' : ''}>
  {!isPro && (
    <div className="absolute inset-0 flex items-center justify-center z-10">
      <button onClick={() => router.push('/upgrade')}
        className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium">
        PRO로 업그레이드
      </button>
    </div>
  )}
  {/* 파트너/천적 리스트 */}
</div>
```

- [ ] **Step 5: 사진 표시 + 업로드 버튼**

선수 아바타 영역에 사진 표시:
```tsx
{player.photo_url ? (
  <img src={`${API_BASE}${player.photo_url}`} className="w-20 h-20 rounded-full object-cover" />
) : (
  <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-2xl">
    {player.name?.charAt(0)}
  </div>
)}
```

- [ ] **Step 6: 커밋**

```bash
git add web/src/app/(main)/players/[id]/page.tsx
git commit -m "feat: 선수 프로필 UI (DNA 뱃지, 태그, 케미, 스트릭, 사진)"
```

---

### Task 15: 팀 편성 UI 변경 (관리자 세션 상세)

**Files:**
- Modify: `web/src/app/(main)/admin/sessions/[id]/page.tsx`

- [ ] **Step 1: 팀 편성 버튼 분리**

기존 단일 "팀 편성" 버튼 → PRO일 때 2버튼으로 변경:

```tsx
<div className="flex gap-2">
  <button onClick={() => handleCreateTeams(false)}
    className="flex-1 py-2 bg-emerald-500 text-white rounded-lg">
    팀 편성
  </button>
  {isPro && (
    <button onClick={() => handleCreateTeams(true)}
      className="flex-1 py-2 bg-purple-500 text-white rounded-lg flex items-center justify-center gap-1">
      <Zap className="w-4 h-4" /> AI 팀 편성
      <span className="text-xs opacity-70">({3 - (session.ai_team_count || 0)}회)</span>
    </button>
  )}
</div>
```

- [ ] **Step 2: handleCreateTeams에 useAI 파라미터 전달**

```typescript
const handleCreateTeams = async (useAI: boolean) => {
  // ... 기존 로직
  const result = await sessionsApi.createTeams(token, sessionId, {
    attendees: selectedAttendees,
    useAI,
  })
  if (result.limitReached) {
    if (confirm(result.message)) {
      // useAI=false로 재요청
      await sessionsApi.createTeams(token, sessionId, {
        attendees: selectedAttendees,
        useAI: false,
      })
    }
    return
  }
  if (result.locked) {
    router.push('/upgrade')
    return
  }
  // ... 성공 처리
}
```

- [ ] **Step 3: 커밋**

```bash
git add web/src/app/(main)/admin/sessions/[id]/page.tsx
git commit -m "feat: 팀 편성 UI — AI/스탯 2버튼 분리, 잔여 횟수 표시"
```

---

### Task 16: 업그레이드 페이지 혜택 리스트 최신화

**Files:**
- Modify: `web/src/app/(main)/upgrade/page.tsx`

- [ ] **Step 1: PRO_FEATURES 상수 업데이트**

```typescript
const PRO_FEATURES = [
  'AI 능력치 기반 팀 편성 (세션당 3회)',
  'AI 분석 리포트 (세션당 3회)',
  '상세 통계 & 트렌드 분석 (케미, 연속기록)',
  '데이터 내보내기 (CSV)',
  '광고 없음',
]
```

- [ ] **Step 2: 커밋**

```bash
git add web/src/app/(main)/upgrade/page.tsx
git commit -m "feat: 업그레이드 페이지 PRO 혜택 리스트 최신화"
```

---

### Task 17: 내보내기 버튼 추가 (랭킹/정산 페이지)

**Files:**
- Modify: `web/src/app/(main)/ranking/page.tsx`
- Modify: `web/src/app/(main)/settlements/page.tsx` (있다면)

- [ ] **Step 1: 랭킹 페이지에 내보내기 버튼 추가**

페이지 헤더에:
```tsx
{isPro && (
  <button onClick={() => exportApi.download(token, 'rankings')}
    className="text-sm text-emerald-600 hover:text-emerald-700">
    📥 CSV 내보내기
  </button>
)}
```

- [ ] **Step 2: 정산 페이지에도 동일하게 추가**

- [ ] **Step 3: 커밋**

```bash
git add web/src/app/(main)/ranking/page.tsx web/src/app/(main)/settlements/page.tsx
git commit -m "feat: 랭킹/정산 페이지 CSV 내보내기 버튼 (PRO)"
```

---

## Phase 6: Flutter 프론트엔드

### Task 18: Flutter API 서비스 업데이트

**Files:**
- Modify: `app/lib/services/api_service.dart`

- [ ] **Step 1: 신규 API 메서드 추가**

```dart
// 태그 투표
Future<Map<String, dynamic>> voteTags(int playerId, List<String> tags) async {
  return await post('/players/$playerId/tags', body: {'tags': tags});
}

// 케미
Future<Map<String, dynamic>> getChemistry(int playerId) async {
  return await get('/players/$playerId/chemistry');
}

// 스트릭
Future<Map<String, dynamic>> getStreaks(int playerId) async {
  return await get('/players/$playerId/streaks');
}

// 사진 업로드
Future<Map<String, dynamic>> uploadPlayerPhoto(int playerId, File file) async {
  // multipart 업로드 구현
}
```

- [ ] **Step 2: 커밋**

```bash
git add app/lib/services/api_service.dart
git commit -m "feat: Flutter API 서비스 신규 메서드 추가"
```

---

### Task 19: Flutter 선수 프로필 화면 업데이트

**Files:**
- Modify: `app/lib/screens/player_detail_screen.dart` (또는 해당 파일)

- [ ] **Step 1: 현재 파일 구조 파악**

```
Glob: app/lib/screens/*player*
Glob: app/lib/screens/*detail*
```

- [ ] **Step 2: DNA 뱃지 위젯 추가**

선수 이름 옆에 DNA 뱃지 표시.

- [ ] **Step 3: 태그 칩 + 투표 바텀시트 추가**

태그 프리셋 그리드 + 커스텀 입력 바텀시트.

- [ ] **Step 4: 사진 표시/업로드 (image_picker)**

`pubspec.yaml`에 `image_picker` 추가 필요.

- [ ] **Step 5: 케미/스트릭 섹션 추가 (PRO 블러)**

- [ ] **Step 6: 커밋**

```bash
git add app/lib/
git commit -m "feat: Flutter 선수 프로필 (DNA, 태그, 사진, 케미, 스트릭)"
```

---

### Task 20: Flutter 팀 편성 UI 변경

**Files:**
- Modify: 팀 편성 관련 Flutter 화면 파일

- [ ] **Step 1: 현재 파일 파악**

```
Grep: createTeams|팀 편성 in app/lib/
```

- [ ] **Step 2: AI/스탯 2버튼 분리 + 잔여 횟수 표시**

- [ ] **Step 3: 커밋**

```bash
git add app/lib/
git commit -m "feat: Flutter 팀 편성 UI — AI/스탯 2버튼 분리"
```

---

## Phase 7: 마무리

### Task 21: 배포 + 마이그레이션

- [ ] **Step 1: API 빌드 확인**

```bash
cd api && npx wrangler deploy --dry-run
```

- [ ] **Step 2: Web 빌드 확인**

```bash
cd web && npm run build
```

- [ ] **Step 3: Flutter 분석**

```bash
cd app && flutter analyze --no-fatal-infos
```

- [ ] **Step 4: API 배포**

```bash
cd api && npx wrangler deploy
```

- [ ] **Step 5: 원격 DB 마이그레이션**

```bash
cd api && npx wrangler d1 execute conerkicks-db --file=migrations/0013_bm_redesign.sql --remote
```

- [ ] **Step 6: Cloudflare R2 버킷 생성 확인**

대시보드에서 `cornerkicks-photos` 버킷 존재 확인.

- [ ] **Step 7: Web 배포 (GitHub push → Cloudflare Pages)**

```bash
git push origin main
```

- [ ] **Step 8: 최종 커밋**

```bash
git commit -m "chore: BM 재설계 구현 완료"
```
