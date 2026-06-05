# Web (Next.js) — CLAUDE.md

## 다크모드
- class 기반 (`darkMode: 'class'`)
- 명도 3단계: `background`(페이지) → `card`(카드) → `card-elevated`(강조)
- 모든 UI 변경 시 다크/라이트 **모두** 확인

## 색상 규칙
- CSS 변수 사용 필수 (`--primary`, `--card`, `--border` 등), hex 하드코딩 금지
- Tailwind: `text-primary`, `bg-card`, `border-border` 등 시맨틱 클래스 사용
- 브랜드 그린: `brand.green` = `#2ECC71` (tailwind.config.ts)
- 예외: 메달(gold/silver/bronze), 에러(red), 상태별 포인트 컬러
- 나머지 장식 아이콘: `text-muted-foreground`

## SSR 안전
- 인증 상태 사용 전 `useAuthHydrated()` 체크 — hydration mismatch 방지
- API 401 응답 → `api.ts`에서 자동 logout + `/login` 리다이렉트 (별도 처리 불필요)

## 컴포넌트 위치
- `ui/` — 범용 재사용 (button, input, stat-card 등)
- `session/`, `match/`, `ranking/` — 도메인별 전용
- `layout/` — 헤더, 네비게이션

## 페이지 추가
- 새 페이지 추가 전 `docs/web-structure.md` **반드시** 확인
- 중복 페이지, 기존과 안 맞는 카테고리 생성 금지
- (auth) 그룹: 로그인/회원가입, (main) 그룹: 인증 후 페이지

## API 클라이언트
- `lib/api.ts`의 네임스페이스 사용 (sessionsApi, rankingsApi 등)
- `X-Club-Id` 헤더 자동 추가됨 — 직접 넣지 말 것

## 검증
```bash
npm run build
```

## 배포
- GitHub push → Cloudflare Pages 자동 배포
- 프로덕션: cornerkicks.pages.dev
