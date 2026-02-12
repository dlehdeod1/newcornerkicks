# 코너킥스 FC - Product Requirements Document (PRD)

## 문서 정보
- **버전**: 1.0
- **작성일**: 2026-02-08
- **상태**: Draft

---

## 1. 프로젝트 개요

### 1.1 프로젝트명
**코너킥스 FC (CornerKicks FC)** - 풋살 동호회 운영 플랫폼

### 1.2 목적
매주 수요일 진행되는 풋살 동호회의 일정 관리, 실시간 경기 기록, 선수 통계, 랭킹 시스템을 제공하여 팀원들이 함께 성장하고 경쟁할 수 있는 플랫폼 구축

### 1.3 핵심 가치
1. **정확한 기록**: 실시간 경기 기록을 통한 신뢰할 수 있는 통계
2. **공정한 경쟁**: AI 기반 밸런스 팀 편성
3. **동기 부여**: 랭킹, 배지, 명예의 전당을 통한 성취감
4. **편리한 운영**: 카카오톡 투표 파싱, 자동화된 통계 집계

### 1.4 대상 사용자
- **정회원**: 코너킥스 FC 소속 선수 (약 30명)
- **용병**: 임시 참가자
- **관리자**: 동호회 운영진

---

## 2. 기술 스택

### 2.1 권장 스택

#### Frontend
| 기술 | 선택 이유 |
|------|-----------|
| **Next.js 14+** | App Router, Server Components, 빠른 개발 |
| **TypeScript** | 타입 안정성, 코드 품질 |
| **Tailwind CSS** | 빠른 스타일링, 반응형 |
| **shadcn/ui** | 재사용 가능한 컴포넌트 |
| **Zustand** | 가벼운 상태 관리 (타이머 등) |
| **React Query** | 서버 상태 관리, 캐싱 |

#### Backend
| 기술 | 선택 이유 |
|------|-----------|
| **Cloudflare Workers** | 기존 D1 DB 연동, Edge 성능 |
| **Hono** | 경량 프레임워크, Workers 최적화 |
| **Drizzle ORM** | 타입 안전 쿼리, D1 지원 |

#### Database
| 기술 | 현재 상태 |
|------|-----------|
| **Cloudflare D1** | 기존 데이터 유지 |

#### Deployment
| 기술 | 용도 |
|------|------|
| **Vercel** | Frontend 배포 |
| **Cloudflare** | Workers + D1 |

#### AI
| 기술 | 용도 |
|------|------|
| **Claude API** | 팀 편성 AI, 전략 분석 |

### 2.2 대안 스택 (풀스택 단일 플랫폼)
```
Next.js + Cloudflare Workers (Binding) + D1
→ 모노레포로 단일 배포
```

---

## 3. 시스템 아키텍처

### 3.1 전체 구조
```
┌─────────────────────────────────────────────────────────────┐
│                        Client                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Next.js App (Vercel)                    │    │
│  │  - Pages/Components                                  │    │
│  │  - React Query (Server State)                        │    │
│  │  - Zustand (Client State: Timer, UI)                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ API Calls
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Cloudflare Workers                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  Hono API Server                     │    │
│  │  - REST Endpoints                                    │    │
│  │  - Auth Middleware (JWT)                             │    │
│  │  - Drizzle ORM                                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Cloudflare D1 (SQLite)                  │    │
│  │  - conerkicks-db                                     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ (Optional)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
│  - Claude API (팀 편성 AI)                                   │
│  - Cloudflare R2 (이미지 저장, 선택)                         │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 데이터 흐름 (경기 기록)
```
1. 관리자가 세션 생성 (카카오톡 파싱)
   → sessions, attendance, players(신규) 생성

2. AI 팀 편성
   → teams, team_members 생성
   → matches 생성 (경기 스케줄)

3. 실시간 경기 기록
   → match_events 생성 (골/수비)
   → player_match_stats 자동 집계
   → matches 스코어 업데이트

4. 세션 종료
   → teams 순위/승점 확정
   → rankings_cache 갱신 (관리자 수동)
   → player_badges 자동 부여
```

---

## 4. API 설계

### 4.1 인증
```
POST   /api/auth/login          로그인
POST   /api/auth/register       회원가입
POST   /api/auth/logout         로그아웃
GET    /api/auth/me             현재 유저 정보
```

### 4.2 세션
```
GET    /api/sessions            세션 목록
POST   /api/sessions            세션 생성 (관리자)
GET    /api/sessions/:id        세션 상세
PUT    /api/sessions/:id        세션 수정 (관리자)
DELETE /api/sessions/:id        세션 삭제 (관리자)

POST   /api/sessions/:id/parse  카카오톡 텍스트 파싱
POST   /api/sessions/:id/teams  팀 편성 (AI)
```

### 4.3 경기
```
GET    /api/sessions/:id/matches        경기 목록
GET    /api/matches/:id                 경기 상세
PUT    /api/matches/:id                 경기 수정 (스코어, 상태)

POST   /api/matches/:id/events          이벤트 생성 (골/수비)
DELETE /api/matches/:id/events/:eventId 이벤트 삭제
```

### 4.4 선수
```
GET    /api/players             선수 목록
GET    /api/players/:id         선수 상세
PUT    /api/players/:id         선수 수정
POST   /api/players/:id/link    선수-유저 연동

POST   /api/players/:id/ratings 능력치 평가
GET    /api/players/:id/ratings 평가 조회
```

### 4.5 랭킹
```
GET    /api/rankings            랭킹 조회 (캐시)
POST   /api/rankings/refresh    랭킹 갱신 (관리자)
```

### 4.6 명예의 전당
```
GET    /api/hall-of-fame        명예의 전당 조회
```

### 4.7 마이페이지
```
GET    /api/me                  내 정보
PUT    /api/me                  내 정보 수정
GET    /api/me/stats            내 통계
GET    /api/me/badges           내 배지
PUT    /api/me/preferences      선호 팀원 설정
```

---

## 5. 데이터베이스 스키마 개선안

### 5.1 유지할 테이블
- users, profiles, abilities, ability_logs
- players, player_preferences
- sessions, teams, team_members, matches, match_events
- player_match_stats, player_ratings, stat_changes
- badges, player_badges
- attendance, rankings_cache

### 5.2 삭제 고려 테이블
| 테이블 | 결정 | 이유 |
|--------|------|------|
| chemistry_edges | 유지 | 향후 케미스트리 시스템 |
| invites | 삭제 | 미사용, 불필요 |
| notices | 유지 | 공지 기능 구현 예정 |
| session_mvp | 삭제 | rankings_cache로 대체 |
| rating_change_log | 삭제 | stat_changes로 대체 |

### 5.3 스키마 수정 필요
1. **player_ratings.rater_user_id**: INTEGER → TEXT (UUID 호환)
2. **notices.created_at**: DATETIME → INTEGER (일관성)
3. **players.age**: 삭제 (birth_year로 계산)

### 5.4 새로운 테이블 (선택)
```sql
-- 경기 타이머 상태 (선택적)
CREATE TABLE match_timers (
  match_id INTEGER PRIMARY KEY,
  started_at INTEGER,
  paused_at INTEGER,
  elapsed_seconds INTEGER DEFAULT 0
);
```

---

## 6. 개발 단계

### Phase 1: 기반 구축 (1주)
- [ ] 프로젝트 초기 설정 (Next.js + Hono + D1)
- [ ] 인증 시스템 (로그인/회원가입)
- [ ] 기본 레이아웃 및 라우팅
- [ ] DB 연결 및 Drizzle 스키마 정의

### Phase 2: 핵심 기능 (2주)
- [ ] 세션 CRUD
- [ ] 카카오톡 파싱 로직
- [ ] AI 팀 편성
- [ ] 실시간 경기 기록 (점수판)
- [ ] 타이머 구현

### Phase 3: 조회/통계 (1주)
- [ ] 선수 목록/상세
- [ ] 랭킹 페이지
- [ ] 명예의 전당
- [ ] 대시보드

### Phase 4: 마이페이지 & 평가 (1주)
- [ ] 마이페이지
- [ ] 능력치 평가 시스템
- [ ] 배지 시스템
- [ ] 선호 팀원 설정

### Phase 5: 폴리싱 (1주)
- [ ] UI/UX 개선
- [ ] 반응형 최적화
- [ ] 에러 처리
- [ ] 성능 최적화
- [ ] 테스트

---

## 7. Agent/Skills 구조 (AI 개발 협업)

### 7.1 개발 Agent 역할 분담

#### Claude Opus (메인)
- 아키텍처 설계
- 복잡한 로직 구현
- 코드 리뷰
- 문서화

#### Claude Sonnet/다른 AI
- 반복적 코드 작성
- UI 컴포넌트 구현
- 테스트 코드 작성
- 버그 수정

### 7.2 Skills 정의

```yaml
# .claude/skills.yaml

skills:
  - name: create-component
    description: React 컴포넌트 생성
    template: |
      Create a new React component with:
      - TypeScript
      - Tailwind CSS
      - shadcn/ui base

  - name: create-api
    description: API 엔드포인트 생성
    template: |
      Create a new Hono API endpoint with:
      - Input validation (Zod)
      - Error handling
      - Auth middleware if needed

  - name: create-page
    description: Next.js 페이지 생성
    template: |
      Create a new Next.js page with:
      - Server/Client components 적절히
      - React Query hooks
      - Loading/Error states
```

### 7.3 개발 워크플로우

```
1. Phase 시작
   → 메인 AI가 구조 설계
   → 파일/폴더 구조 결정

2. 기능 구현
   → Skills 활용하여 boilerplate 생성
   → 세부 로직 구현

3. 리뷰 & 통합
   → 코드 리뷰
   → 정합성 체크
   → 테스트

4. 다음 Phase
```

---

## 8. 파일 구조

```
conerkicks/
├── apps/
│   ├── web/                      # Next.js Frontend
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── register/
│   │   │   ├── (main)/
│   │   │   │   ├── page.tsx      # 대시보드
│   │   │   │   ├── sessions/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── players/
│   │   │   │   ├── ranking/
│   │   │   │   ├── hall-of-fame/
│   │   │   │   └── me/
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ui/               # shadcn/ui
│   │   │   ├── layout/
│   │   │   ├── session/
│   │   │   ├── player/
│   │   │   └── match/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── stores/               # Zustand
│   │
│   └── api/                      # Cloudflare Workers
│       ├── src/
│       │   ├── index.ts          # Hono entry
│       │   ├── routes/
│       │   │   ├── auth.ts
│       │   │   ├── sessions.ts
│       │   │   ├── matches.ts
│       │   │   ├── players.ts
│       │   │   └── rankings.ts
│       │   ├── middleware/
│       │   ├── services/
│       │   └── db/
│       │       ├── schema.ts     # Drizzle schema
│       │       └── migrations/
│       └── wrangler.toml
│
├── packages/
│   └── shared/                   # 공유 타입, 유틸
│       ├── types/
│       └── utils/
│
├── docs/
│   ├── DB_ANALYSIS.md
│   ├── FEATURE_SPEC.md
│   └── PRD.md
│
└── .claude/
    ├── MEMORY.md
    └── skills.yaml
```

---

## 9. 마일스톤 & 체크포인트

### M1: 프로젝트 부트스트랩 (Day 1-2)
- [ ] 모노레포 설정 (turborepo/pnpm)
- [ ] Next.js 앱 생성
- [ ] Hono Workers 설정
- [ ] D1 연결 확인
- [ ] 기본 인증 구현

### M2: 세션 & 팀 (Day 3-5)
- [ ] 세션 CRUD 완료
- [ ] 카카오톡 파싱 완료
- [ ] AI 팀 편성 완료
- [ ] 점수판 UI 완료

### M3: 경기 기록 (Day 6-8)
- [ ] 실시간 기록 완료
- [ ] 타이머 구현 완료
- [ ] 데이터 정합성 검증

### M4: 통계 & 랭킹 (Day 9-10)
- [ ] 선수 페이지 완료
- [ ] 랭킹 페이지 완료
- [ ] 명예의 전당 완료

### M5: 완성 (Day 11-14)
- [ ] 마이페이지 완료
- [ ] 대시보드 완료
- [ ] 배지 시스템 완료
- [ ] UI 폴리싱
- [ ] 배포

---

## 10. 리스크 & 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| D1 성능 이슈 | 높음 | 캐싱, 쿼리 최적화 |
| 타이머 동기화 | 중간 | 서버 타임스탬프 기준 |
| AI 팀 편성 품질 | 중간 | 프롬프트 튜닝, 수동 조정 옵션 |
| 데이터 마이그레이션 | 낮음 | 기존 DB 그대로 사용 |

---

## 부록 A: 용어 정의

| 용어 | 정의 |
|------|------|
| 세션 | 하루 풋살 모임 (여러 경기 포함) |
| 경기 | 단일 매치 (10분) |
| 정회원 | players 테이블에 등록된 선수 |
| 용병 | 임시 참가자 (is_guest=1) |
| 승점 | EPL 방식 (승3, 무1, 패0) |
| PPM | Points Per Match (승점/경기) |
| 호수비 | 수비 성공 (블로킹, 차단 등 통합) |
