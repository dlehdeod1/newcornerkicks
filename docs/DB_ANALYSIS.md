# 코너킥스 데이터베이스 분석 보고서

## 1. 개요

- **데이터베이스**: Cloudflare D1 (SQLite 기반)
- **DB명**: `conerkicks-db`
- **총 테이블 수**: 25개 (시스템 테이블 2개 포함)

---

## 2. 테이블별 데이터 현황

| 테이블명 | 레코드 수 | 상태 | 비고 |
|---------|----------|------|------|
| users | 33 | ✅ 활성 | 가입 유저 |
| profiles | 33 | ✅ 활성 | 유저 프로필 (1:1 관계) |
| players | 65 | ✅ 활성 | 선수 정보 (정회원 + 용병) |
| sessions | 6 | ✅ 활성 | 풋살 세션 |
| matches | 54 | ✅ 활성 | 개별 경기 |
| teams | 18 | ✅ 활성 | 세션별 팀 |
| team_members | 109 | ✅ 활성 | 팀-선수 매핑 |
| attendance | 109 | ✅ 활성 | 출석 기록 |
| match_events | 606 | ✅ 활성 | 골/수비 이벤트 |
| player_match_stats | 385 | ✅ 활성 | 경기별 선수 스탯 |
| player_ratings | 144 | ✅ 활성 | 선수 평가 |
| badges | 9 | ✅ 활성 | 배지 정의 |
| player_badges | 72 | ✅ 활성 | 획득한 배지 |
| abilities | 32 | ✅ 활성 | 유저 특성(공격/플메/승부욕/성실) |
| ability_logs | 92 | ✅ 활성 | 특성 변경 로그 |
| stat_changes | 124 | ✅ 활성 | 선수 스탯 변경 로그 |
| player_preferences | 6 | ✅ 활성 | 선호 팀원 설정 |
| rankings_cache | 2 | ✅ 활성 | 연도별 랭킹 캐시 (JSON) |
| chemistry_edges | 0 | ⚠️ 미사용 | 케미스트리 (구현 예정?) |
| invites | 0 | ⚠️ 미사용 | 초대 시스템 (구현 예정?) |
| notices | 0 | ⚠️ 미사용 | 공지사항 (구현 예정?) |
| session_mvp | 0 | ⚠️ 미사용 | MVP 기록 (구현 예정?) |
| rating_change_log | 0 | ⚠️ 미사용 | 레이팅 변경 로그 |
| _cf_KV | - | 시스템 | Cloudflare 내부용 |
| sqlite_sequence | - | 시스템 | AUTO_INCREMENT 관리 |

---

## 3. 테이블 스키마 상세

### 3.1 사용자/인증 도메인

#### `users` - 가입 유저
```sql
id          TEXT PK      -- UUID
email       TEXT         -- 이메일 (일부는 @noemail.conerkicks.com)
username    TEXT         -- 유저명
password    TEXT         -- 비밀번호 (해시)
role        TEXT NOT NULL DEFAULT 'member'  -- ADMIN / member
created_at  INTEGER NOT NULL DEFAULT unixepoch()
updated_at  INTEGER NOT NULL DEFAULT unixepoch()
```

#### `profiles` - 유저 프로필
```sql
user_id     TEXT PK      -- FK → users.id
alias       TEXT         -- 별칭
phone       TEXT         -- 전화번호
birth_date  TEXT         -- 생년월일
height_cm   INTEGER      -- 키
weight_kg   INTEGER      -- 몸무게
photo_url   TEXT         -- 프로필 사진
created_at  INTEGER NOT NULL DEFAULT unixepoch()
updated_at  INTEGER NOT NULL DEFAULT unixepoch()
```

#### `abilities` - 유저 특성 (게임화 요소)
```sql
user_id              TEXT PK      -- FK → users.id
base_attack          INTEGER DEFAULT 20   -- 기본 공격성
base_playmaker       INTEGER DEFAULT 20   -- 기본 플레이메이커
base_competitiveness INTEGER DEFAULT 20   -- 기본 승부욕
base_diligence       INTEGER DEFAULT 20   -- 기본 성실함
curr_attack          INTEGER DEFAULT 20   -- 현재 공격성
curr_playmaker       INTEGER DEFAULT 20   -- 현재 플레이메이커
curr_competitiveness INTEGER DEFAULT 20   -- 현재 승부욕
curr_diligence       INTEGER DEFAULT 20   -- 현재 성실함
updated_at           INTEGER DEFAULT unixepoch()
```

---

### 3.2 선수 도메인

#### `players` - 선수 정보
```sql
id           INTEGER PK AUTO  -- 선수 ID
user_id      TEXT             -- FK → users.id (연동된 경우)
name         TEXT NOT NULL    -- 이름
nickname     TEXT             -- 닉네임
aliases_json TEXT DEFAULT '[]' -- 별칭 배열 (JSON)
join_date    TEXT             -- 가입일
birth_year   INTEGER          -- 출생년도
age          INTEGER          -- 나이 (deprecated?)
height_cm    INTEGER          -- 키
weight_kg    INTEGER          -- 몸무게
photo_url    TEXT             -- 사진

-- 능력치 (1-10 스케일로 보임)
shooting     INTEGER DEFAULT 5  -- 슈팅
offball_run  INTEGER DEFAULT 5  -- 침투(오프더볼)
ball_keeping INTEGER DEFAULT 5  -- 킵(볼키핑)
passing      INTEGER DEFAULT 5  -- 패스
linkup       INTEGER DEFAULT 5  -- 연계
intercept    INTEGER DEFAULT 5  -- 차단
marking      INTEGER DEFAULT 5  -- 마킹
stamina      INTEGER DEFAULT 5  -- 체력
speed        INTEGER DEFAULT 5  -- 스피드
physical     INTEGER DEFAULT 5  -- 피지컬

-- 상태
player_code  TEXT             -- 연동 코드
link_status  TEXT DEFAULT 'UNLINKED'  -- UNLINKED/PENDING/ACTIVE
pay_exempt   INTEGER DEFAULT 0  -- 회비 면제
stats_locked INTEGER DEFAULT 0  -- 스탯 잠금
is_guest     INTEGER DEFAULT 0  -- 용병 여부
notes        TEXT             -- 메모

created_at   INTEGER NOT NULL DEFAULT unixepoch()
updated_at   INTEGER NOT NULL DEFAULT unixepoch()
```

#### `player_preferences` - 선호 팀원
```sql
id               INTEGER PK AUTO
player_id        INTEGER NOT NULL  -- FK → players.id
target_player_id INTEGER NOT NULL  -- FK → players.id
rank             INTEGER DEFAULT 1 -- 선호 순위 (1, 2, 3...)
created_at       INTEGER DEFAULT unixepoch()
```

---

### 3.3 세션/경기 도메인

#### `sessions` - 풋살 세션
```sql
id           INTEGER PK AUTO
session_date TEXT NOT NULL    -- 날짜 (YYYY-MM-DD)
title        TEXT             -- 제목 (예: "코너킥스 정기 풋살")
pot_total    INTEGER DEFAULT 120000  -- 총 상금
base_fee     INTEGER DEFAULT 6000    -- 기본 참가비
status       TEXT DEFAULT 'recruiting'  -- recruiting/closed
notes        TEXT             -- 메모
created_at   INTEGER NOT NULL DEFAULT unixepoch()
```

#### `teams` - 세션 내 팀
```sql
id              INTEGER PK AUTO
session_id      INTEGER NOT NULL  -- FK → sessions.id
name            TEXT NOT NULL     -- 팀명 (예: "상상팀", "훈락팀")
rank            INTEGER           -- 최종 순위
vest_color      TEXT DEFAULT NULL -- 조끼 색상
type            TEXT DEFAULT '밸런스형'  -- 팀 유형
emoji           TEXT DEFAULT '⚽'
strategy        TEXT              -- 전략 설명
key_player      TEXT              -- 키플레이어 이름
key_player_reason TEXT            -- 키플레이어 선정 이유
score_stats     TEXT              -- AI 분석 결과 (JSON)
```

#### `team_members` - 팀 구성원
```sql
id        INTEGER PK AUTO
team_id   INTEGER NOT NULL  -- FK → teams.id
player_id INTEGER NOT NULL  -- FK → players.id
```

#### `matches` - 개별 경기
```sql
id           INTEGER PK AUTO
session_id   INTEGER NOT NULL  -- FK → sessions.id
match_no     INTEGER           -- 경기 번호
team1_id     INTEGER NOT NULL  -- FK → teams.id
team2_id     INTEGER NOT NULL  -- FK → teams.id
team1_score  INTEGER DEFAULT 0
team2_score  INTEGER DEFAULT 0
duration_min INTEGER DEFAULT 10  -- 경기 시간 (분)
played_at    INTEGER DEFAULT unixepoch()
status       TEXT DEFAULT 'pending'  -- pending/completed
```

#### `match_events` - 경기 이벤트
```sql
id          INTEGER PK AUTO
match_id    INTEGER NOT NULL  -- FK → matches.id
player_id   INTEGER NOT NULL  -- FK → players.id
team_id     INTEGER NOT NULL  -- FK → teams.id
event_type  TEXT NOT NULL     -- GOAL / DEFENSE
assister_id INTEGER           -- FK → players.id (어시스트)
event_time  INTEGER           -- 이벤트 시간 (초)
created_at  INTEGER NOT NULL DEFAULT unixepoch()
```

#### `player_match_stats` - 경기별 선수 스탯
```sql
id         INTEGER PK AUTO
match_id   INTEGER NOT NULL  -- FK → matches.id
player_id  INTEGER NOT NULL  -- FK → players.id
goals      INTEGER DEFAULT 0
assists    INTEGER DEFAULT 0
saves      INTEGER DEFAULT 0  -- 세이브 (미사용?)
blocks     INTEGER DEFAULT 0  -- 블로킹
key_passes INTEGER DEFAULT 0  -- 키패스
clearances INTEGER DEFAULT 0  -- 클리어런스
notes      TEXT
```

---

### 3.4 평가/레이팅 도메인

#### `player_ratings` - 선수 평가
```sql
id            INTEGER PK AUTO
player_id     INTEGER NOT NULL  -- FK → players.id
rater_user_id INTEGER NOT NULL  -- FK → users.id (평가자)
session_id    INTEGER           -- FK → sessions.id

-- 평가 항목 (각각 1-10?)
shooting      INTEGER
offball_run   INTEGER
ball_keeping  INTEGER
passing       INTEGER
linkup        INTEGER
intercept     INTEGER
marking       INTEGER
stamina       INTEGER
speed         INTEGER
physical      INTEGER
overall       INTEGER  -- 종합 평점

comment       TEXT
created_at    INTEGER NOT NULL DEFAULT unixepoch()
updated_at    INTEGER NOT NULL DEFAULT unixepoch()
```

#### `stat_changes` - 스탯 변경 로그
```sql
id         INTEGER PK AUTO
player_id  INTEGER NOT NULL  -- FK → players.id
stat       TEXT NOT NULL     -- 변경된 스탯명
delta      REAL NOT NULL     -- 변경량
reason     TEXT              -- 변경 사유
created_at INTEGER NOT NULL DEFAULT unixepoch()
```

#### `rating_change_log` - 레이팅 변경 로그 (미사용)
```sql
id         INTEGER PK AUTO
player_id  INTEGER NOT NULL
session_id INTEGER
diff_json  TEXT NOT NULL     -- 변경 내역 (JSON)
reason     TEXT
created_at INTEGER NOT NULL DEFAULT unixepoch()
```

---

### 3.5 배지/업적 도메인

#### `badges` - 배지 정의
```sql
code           TEXT PK        -- 배지 코드 (예: first_goal, goal_5)
name           TEXT NOT NULL  -- 배지명 (예: "데뷔골", "스트라이커")
description    TEXT           -- 설명
condition_type TEXT           -- GOAL / ASSIST / PLACEMENT / ATTENDANCE
threshold      INTEGER        -- 달성 조건 수치
```

**현재 정의된 배지:**
| code | name | condition | threshold |
|------|------|-----------|-----------|
| first_goal | 데뷔골 | GOAL | 1 |
| goal_5 | 스트라이커 | GOAL | 5 |
| goal_10 | 득점 기계 | GOAL | 10 |
| assist_5 | 특급 도우미 | ASSIST | 5 |
| assist_10 | 마에스트로 | ASSIST | 10 |
| rank_1 | 첫 우승 | PLACEMENT | 1 |
| rank_top3 | 포디움 | PLACEMENT | 3 |
| attendance_5 | 성실맨 | ATTENDANCE | 5 |
| attendance_10 | 개근상 | ATTENDANCE | 10 |

#### `player_badges` - 획득한 배지
```sql
player_id  INTEGER  -- PK, FK → players.id
badge_code TEXT     -- PK, FK → badges.code
earned_at  INTEGER  -- 획득 시간
```

---

### 3.6 출석/참여 도메인

#### `attendance` - 출석 기록
```sql
id         INTEGER PK AUTO
session_id INTEGER NOT NULL  -- FK → sessions.id
player_id  INTEGER NOT NULL  -- FK → players.id
created_at INTEGER NOT NULL DEFAULT unixepoch()
```

#### `session_mvp` - MVP 기록 (미사용)
```sql
id         INTEGER PK AUTO
session_id INTEGER NOT NULL  -- FK → sessions.id
player_id  INTEGER NOT NULL  -- FK → players.id
created_at INTEGER DEFAULT unixepoch()
```

---

### 3.7 기타 도메인

#### `invites` - 초대 시스템 (미사용)
```sql
id         TEXT PK           -- UUID
token      TEXT NOT NULL     -- 초대 토큰
email      TEXT              -- 초대받은 이메일
expires_at INTEGER NOT NULL  -- 만료 시간
used_at    INTEGER           -- 사용 시간
created_at INTEGER NOT NULL DEFAULT unixepoch()
```

#### `notices` - 공지사항 (미사용)
```sql
id         INTEGER PK AUTO
title      TEXT NOT NULL
content    TEXT NOT NULL
is_pinned  INTEGER DEFAULT 0
created_by TEXT              -- FK → users.id
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at DATETIME
```

#### `chemistry_edges` - 케미스트리 (미사용)
```sql
id              INTEGER PK AUTO
player_a_id     INTEGER NOT NULL  -- FK → players.id
player_b_id     INTEGER NOT NULL  -- FK → players.id
chemistry_score INTEGER NOT NULL DEFAULT 0
note            TEXT
```

#### `rankings_cache` - 랭킹 캐시
```sql
id         INTEGER PK DEFAULT 1
data       TEXT NOT NULL     -- JSON 배열 (전체 랭킹 데이터)
updated_at TEXT NOT NULL
updated_by TEXT
year       INTEGER DEFAULT 2025  -- 연도별 분리
```

#### `ability_logs` - 특성 변경 로그
```sql
id         INTEGER PK AUTO
user_id    TEXT              -- FK → users.id
stat_type  TEXT              -- attack/playmaker/competitiveness/diligence
delta      INTEGER           -- 변경량
reason     TEXT              -- 변경 사유
created_at INTEGER DEFAULT unixepoch()
```

---

## 4. 테이블 관계도 (ERD)

```
                    ┌─────────────┐
                    │   users     │
                    │ (33 records)│
                    └──────┬──────┘
                           │ 1:1
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
       ┌──────────┐  ┌──────────┐  ┌──────────┐
       │ profiles │  │ abilities│  │ability_logs│
       └──────────┘  └──────────┘  └──────────┘

                    ┌─────────────┐
                    │  players    │◄──── user_id로 users와 연결 (선택적)
                    │ (65 records)│
                    └──────┬──────┘
           ┌───────────────┼───────────────┬────────────────┐
           │               │               │                │
           ▼               ▼               ▼                ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │team_members │ │ attendance  │ │player_badges│ │stat_changes │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └─────────────┘
           │               │               │
           │               │               ▼
           │               │        ┌─────────────┐
           │               │        │   badges    │
           │               │        └─────────────┘
           │               │
           ▼               ▼
    ┌─────────────┐ ┌─────────────┐
    │   teams     │ │  sessions   │◄──────────────────────┐
    │(18 records) │ │ (6 records) │                       │
    └──────┬──────┘ └──────┬──────┘                       │
           │               │                              │
           │               ▼                              │
           │        ┌─────────────┐                       │
           └───────►│  matches    │───────────────────────┘
                    │(54 records) │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │                         │
              ▼                         ▼
       ┌─────────────┐          ┌─────────────────┐
       │match_events │          │player_match_stats│
       │(606 records)│          │  (385 records)   │
       └─────────────┘          └─────────────────┘
```

---

## 5. 주요 JOIN 관계

### 5.1 세션 → 팀 → 선수
```sql
sessions
  → teams (session_id)
    → team_members (team_id)
      → players (player_id)
```

### 5.2 경기 → 이벤트 → 선수
```sql
matches
  → match_events (match_id)
    → players (player_id, assister_id)
```

### 5.3 유저 → 선수 연동
```sql
users → players (user_id, link_status = 'ACTIVE')
```

### 5.4 선수 → 배지
```sql
players → player_badges (player_id) → badges (badge_code)
```

---

## 6. 발견된 이슈 및 개선점

### 6.1 미사용 테이블 (검토 필요)
| 테이블 | 상태 | 권장 |
|--------|------|------|
| chemistry_edges | 데이터 0건 | 구현 예정이면 유지, 아니면 삭제 |
| invites | 데이터 0건 | 초대 기능 필요시 유지 |
| notices | 데이터 0건 | 공지 기능 필요시 유지 |
| session_mvp | 데이터 0건 | MVP 별도 관리 필요시 유지 |
| rating_change_log | 데이터 0건 | stat_changes와 중복? 검토 필요 |

### 6.2 스키마 불일치/개선점
1. **player_ratings.rater_user_id**: INTEGER 타입인데 users.id는 TEXT(UUID) → 타입 불일치
2. **notices.created_at**: DATETIME 타입인데 다른 테이블은 INTEGER(unixepoch) → 일관성 필요
3. **players.age vs birth_year**: 둘 다 존재 → 하나로 통일 권장
4. **rankings_cache**: JSON blob으로 전체 랭킹 저장 → 정규화 고려

### 6.3 FK 제약 없음
- SQLite 특성상 FK 제약이 명시적으로 없음
- 애플리케이션 레벨에서 무결성 관리 필요

### 6.4 인덱스 현황
- 추가 인덱스 필요 여부 확인 필요 (조회 성능)

---

## 7. 핵심 비즈니스 로직 추정

### 7.1 세션 운영 플로우
1. 세션 생성 (recruiting)
2. 참가자 등록 (attendance)
3. 팀 편성 (teams + team_members) - AI 분석으로 전략 생성
4. 경기 진행 (matches)
5. 이벤트 기록 (match_events - GOAL/DEFENSE)
6. 스탯 집계 (player_match_stats)
7. 세션 종료 (closed)
8. 랭킹 업데이트 (rankings_cache)

### 7.2 선수 연동 플로우
1. 관리자가 선수(players) 등록 (link_status = UNLINKED)
2. 유저가 회원가입 (users)
3. player_code로 연동 요청 (link_status = PENDING)
4. 관리자 승인 (link_status = ACTIVE, user_id 설정)

### 7.3 레이팅 시스템
- 선수별 10개 능력치 (슈팅~피지컬)
- 다른 유저가 평가 가능 (player_ratings)
- 평가 기반으로 능력치 업데이트 (stat_changes 로그)

### 7.4 배지 시스템
- 자동 배지 부여 (골 수, 어시스트 수, 출석 등 조건 달성 시)
- 9개 배지 정의됨

---

## 8. 다음 단계

1. 기존 기능/페이지 목록 정리 (유저 인터뷰 필요)
2. PRD 작성
3. 기술 스택 확정
4. 신규 프로젝트 구조 설계
