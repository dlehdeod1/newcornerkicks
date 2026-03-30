# 웹 구조 레퍼런스

새 페이지/기능 추가 시 반드시 이 문서를 참고하여 기존 구조와의 연관성을 확인할 것.
중복 페이지, 중복 API 모듈, 엉뚱한 카테고리 생성 금지.

## 기술 스택

- Next.js 15 (App Router) + React 19 + TypeScript
- Zustand (인증 상태) + React Query (서버 상태)
- Tailwind CSS + next-themes (다크모드, class 기반)
- 폰트: Pretendard (CDN)
- 아이콘: Lucide React
- 토스트: Sonner
- 결제: Toss Payments SDK
- 배포: Cloudflare Pages, API 프록시 `/api/*` → Workers

## 디렉토리 구조

```
src/
├── app/
│   ├── layout.tsx                          # 루트 레이아웃
│   ├── globals.css                         # 글로벌 스타일
│   │
│   ├── (auth)/                             # 인증 라우트 그룹 (최소 레이아웃)
│   │   ├── layout.tsx
│   │   ├── login/page.tsx                  # 로그인 (이메일/비번 + Google)
│   │   ├── register/page.tsx               # 회원가입
│   │   └── find-account/page.tsx           # 선수명으로 계정 찾기
│   │
│   └── (main)/                             # 메인 라우트 그룹 (Header + Toaster)
│       ├── layout.tsx
│       ├── page.tsx                         # 홈 대시보드
│       │
│       ├── admin/                           # 관리자 영역 (사이드바 카테고리 그룹)
│       │   ├── layout.tsx                   # 사이드바 레이아웃 (운영/소통/재정/기록통계/설정)
│       │   ├── page.tsx                     # 관리자 대시보드
│       │   │                                # ── 운영 ──
│       │   ├── sessions/page.tsx            # 세션 관리
│       │   ├── sessions/new/page.tsx        # 세션 생성
│       │   ├── players/page.tsx             # 선수 관리
│       │   ├── players/new/page.tsx         # 선수 등록
│       │   ├── users/page.tsx               # 유저 계정 관리
│       │   │                                # ── 소통 ──
│       │   ├── announcements/page.tsx       # 공지 관리
│       │   ├── notifications/page.tsx       # 알림 관리
│       │   │                                # ── 재정 ──
│       │   ├── fees/page.tsx                # 참가비 설정 (기존 설정>참가비 탭 독립)
│       │   ├── exemptions/page.tsx          # 회비 면제
│       │   │                                # ── 기록/통계 ──
│       │   ├── rankings/page.tsx            # 랭킹 관리/갱신
│       │   ├── records/page.tsx             # 기록 설정 (기록이벤트 + 평점가중치)
│       │   │                                # ── 설정 ──
│       │   └── settings/page.tsx            # 클럽 정보 (로고/초대코드/기본정보)
│       │
│       ├── sessions/
│       │   ├── page.tsx                     # 세션 목록
│       │   └── [id]/page.tsx               # 세션 상세 (매치/정산/팀)
│       │
│       ├── ranking/
│       │   ├── page.tsx                     # 랭킹 (테이블/컴팩트 뷰)
│       │   └── [id]/page.tsx               # 선수 랭킹 상세
│       │
│       ├── abilities/
│       │   ├── page.tsx                     # 능력치 목록
│       │   └── [id]/page.tsx               # 개별 능력치 카드
│       │
│       ├── board/
│       │   ├── page.tsx                     # 클럽 게시판
│       │   ├── [id]/page.tsx               # 게시글 상세
│       │   └── write/page.tsx              # 게시글 작성
│       │
│       ├── community/
│       │   ├── page.tsx                     # 전체 커뮤니티
│       │   ├── [id]/page.tsx               # 커뮤니티 글 상세
│       │   └── write/page.tsx              # 커뮤니티 글 작성
│       │
│       ├── announcements/
│       │   ├── page.tsx                     # 공지 목록
│       │   └── [id]/page.tsx               # 공지 상세
│       │
│       ├── clubs/
│       │   ├── page.tsx                     # 클럽 목록/가입/생성
│       │   └── [slug]/page.tsx             # 퍼블릭 클럽 프로필
│       │
│       ├── players/
│       │   ├── page.tsx                     # 선수 디렉토리
│       │   └── [id]/page.tsx               # 선수 상세
│       │
│       ├── club/page.tsx                    # 단일 클럽 뷰
│       ├── profile/page.tsx                 # 프로필 관리
│       ├── notifications/page.tsx           # 알림 목록
│       ├── settlements/page.tsx             # 정산 내역
│       ├── stats/page.tsx                   # 시즌 통계
│       ├── hall-of-fame/page.tsx            # 명예의 전당
│       ├── upgrade/page.tsx                 # 플랜 업그레이드
│       ├── upgrade/success/page.tsx         # 업그레이드 완료
│       ├── refund/page.tsx                  # 환불
│       ├── privacy/page.tsx                 # 개인정보처리방침
│       └── terms/page.tsx                   # 이용약관
│
├── components/
│   ├── providers.tsx                        # GoogleOAuth + QueryClient + ThemeProvider + AuthSync
│   │
│   ├── layout/
│   │   ├── header.tsx                       # 네비게이션 (클럽전환, 테마, 유저메뉴, 알림)
│   │   └── notification-dropdown.tsx        # 알림 드롭다운
│   │
│   ├── session/
│   │   ├── create-session-modal.tsx         # 세션 생성 (날짜→파싱→미리보기)
│   │   ├── session-edit-modal.tsx           # 세션 수정
│   │   ├── team-parser-modal.tsx            # 카톡 텍스트→팀 파싱
│   │   ├── attendance-editor-modal.tsx      # 출석 관리
│   │   ├── overview-tab.tsx                 # 세션 개요 탭
│   │   ├── teams-tab.tsx                    # 팀 관리 탭
│   │   ├── scoreboard-tab.tsx              # 스코어보드 탭
│   │   ├── stats-tab.tsx                    # 세션 통계 탭
│   │   ├── settlement-tab.tsx              # 정산 탭
│   │   ├── match-recorder.tsx              # 실시간 경기 이벤트 기록
│   │   └── mvp-voting.tsx                  # MVP 투표
│   │
│   ├── match/
│   │   └── match-timeline.tsx              # 경기 이벤트 타임라인
│   │
│   ├── ranking/
│   │   └── compact-player-list.tsx         # 세로 스크롤 선수 리스트
│   │
│   └── ui/
│       ├── button.tsx                       # 버튼 (primary/secondary/ghost/danger/outline)
│       ├── input.tsx                        # 텍스트 입력
│       ├── skeleton.tsx                     # 로딩 스켈레톤
│       ├── status-badge.tsx                # 상태 배지
│       ├── stat-card.tsx                    # 통계 카드
│       ├── sort-chips.tsx                  # 정렬 칩
│       ├── radar-chart.tsx                 # 레이더 차트
│       └── rich-content.tsx                # 리치 텍스트 렌더러
│
├── lib/
│   ├── api.ts                              # API 클라이언트 + 21개 엔드포인트 모듈
│   └── cn.ts                               # clsx + tailwind-merge 유틸
│
└── stores/
    └── auth.ts                             # Zustand 인증 스토어

```

## API 모듈 (lib/api.ts)

| 모듈 | 역할 |
|------|------|
| authApi | 로그인, 회원가입, 프로필, 비밀번호, Google 연동, 계정찾기 |
| sessionsApi | 세션 CRUD, 팀 파싱, 출석, AI 분석 |
| playersApi | 선수 CRUD, 평점, 태그, 케미, 스트릭, 사진 |
| matchesApi | 경기 CRUD, 이벤트, 라운드로빈 생성 |
| settlementsApi | 정산 계산, 내역, 요약 |
| rankingsApi | 랭킹, 명예의전당, 재미통계, 갱신 |
| awardsApi | 어워드 데이터 조회 |
| subscriptionsApi | 구독/결제, 체크아웃, 취소 |
| notificationsApi | 알림 목록, 읽음 처리, 삭제 |
| adminApi | 선수 연동 승인, 비번 초기화, 유저 검색 |
| teamsApi | 팀 색상/조끼, 순위 업데이트 |
| meApi | 현재 유저 통계/프로필 요약 |
| preferencesApi | 즐겨찾기 선수 목록 |
| clubsApi | 클럽 CRUD, 멤버, 초대코드, 로고, 면제 |
| paymentsApi | 세션비, 경비, 회비, 납부상태 |
| announcementsApi | 공지 CRUD |
| postsApi | 게시글 CRUD, 댓글, 반응, 투표 |
| communityApi | 커뮤니티 글 CRUD, 댓글 |
| clubProfileApi | 퍼블릭 클럽 프로필, 리뷰 |
| uploadsApi | 이미지 업로드 (FormData) |
| exportApi | CSV 내보내기 |

## Zustand 스토어 (stores/auth.ts)

```
state:
  token         — JWT 토큰
  user          — { id, email, username, role }
  player        — { id, name, nickname }
  club          — { id, slug, name, enabledEvents, myRole, isPro, planType,
                    seasonStartMonth, inviteCode, logoUrl, mvpWeights }
  clubs[]       — 소속 클럽 전체 배열
  isAdmin       — boolean
  isLoggedIn    — boolean

actions:
  login(token, user, clubs)
  logout()
  setPlayer(player)
  setClub(club)
  setActiveClub(club)
```

## 설정 파일

| 파일 | 역할 |
|------|------|
| next.config.mjs | `/api/*` → Workers 프록시 rewrite |
| tailwind.config.ts | 다크모드 class, brand.green, Pretendard, CSS 변수 컬러 |
| tsconfig.json | ES2017, strict, `@/*` → `./src/*` |
| postcss.config.js | Tailwind + Autoprefixer |
| wrangler.toml | Cloudflare Pages 배포 |
| .env.local | API URL, Google Client ID, Toss 결제 키 |

## 핵심 패턴

- **멀티클럽**: `X-Club-Id` 헤더, Header에서 클럽 전환, auth 스토어에 clubs[] 유지
- **인증**: JWT + Google OAuth, 401 → 자동 로그아웃 + `/login?reason=expired`
- **SSR 안전**: `useAuthHydrated()` 훅으로 hydration mismatch 방지
- **모달 중심 UX**: 세션 생성/팀 편성/출석을 모달로 처리 (페이지 이동 없음)
- **React Query**: 60초 stale time, 윈도우 포커스 리패치 비활성
- **라우트 그룹**: `(auth)` 최소 레이아웃, `(main)` Header 포함 레이아웃
