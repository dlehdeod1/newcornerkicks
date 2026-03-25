# Phase 1: 디자인 품질 개선 스펙

> **목표**: 앱/웹 디자인 일관성 확보 + 체감 품질 향상 + 접근성 기초
> **범위**: Flutter 앱 + Next.js 웹 (기능별로 양쪽 동시 처리)
> **참조**: `docs/design-system-reference.md` (토큰 매핑 기준 문서)

---

## 작업 1: 디자인 토큰 통합 + 레퍼런스 문서

### 1A. Flutter — `app/lib/theme/app_theme.dart` (신규)

TextStyle 프리셋, 스페이싱, 보더 레이디어스 상수 정의.

```dart
class AppTheme {
  AppTheme._();

  // TextStyle 프리셋 (color 미지정 — 사용처에서 테마 따라 결정)
  static const headingLg = TextStyle(fontSize: 22, fontWeight: FontWeight.w700);
  static const headingMd = TextStyle(fontSize: 18, fontWeight: FontWeight.w600);
  static const headingSm = TextStyle(fontSize: 15, fontWeight: FontWeight.w600);
  static const bodyLg    = TextStyle(fontSize: 16, fontWeight: FontWeight.w400);
  static const body      = TextStyle(fontSize: 14, fontWeight: FontWeight.w400);
  static const bodySm    = TextStyle(fontSize: 12, fontWeight: FontWeight.w400);
  static const caption   = TextStyle(fontSize: 11, fontWeight: FontWeight.w400);

  // Spacing (4px grid)
  static const space4  = 4.0;
  static const space8  = 8.0;
  static const space12 = 12.0;
  static const space16 = 16.0;
  static const space24 = 24.0;
  static const space32 = 32.0;
  static const space48 = 48.0;

  // Border Radius
  static const radiusSm = 8.0;
  static const radiusMd = 12.0;
  static const radiusLg = 16.0;
  static const radiusXl = 20.0;
}
```

### 1B. Flutter — AppColors 대비 수정 + 라이트모드 대응

현재 앱은 다크모드 하드코딩이지만 `ThemeMode.system` 설정. Phase 1에서는 **라이트모드 전체 리팩은 하지 않되**, 새로 추가하는 시맨틱 상수는 라이트/다크 양쪽을 지원하는 헬퍼 함수로 제공.

```dart
// AppColors에 추가
// ─── 시맨틱 텍스트 (다크 모드용 — 기존 화면 호환) ──────
static const textSecondary = Color.fromRGBO(255, 255, 255, 0.65);
static const textHint      = Color.fromRGBO(255, 255, 255, 0.50);
static const iconInactive  = Color.fromRGBO(255, 255, 255, 0.30);

// ─── 테마 인식 헬퍼 (새 코드에서 사용) ──────
static Color adaptiveTextSecondary(BuildContext context) =>
    Theme.of(context).brightness == Brightness.dark
        ? textSecondary
        : const Color.fromRGBO(0, 0, 0, 0.60);

static Color adaptiveTextHint(BuildContext context) =>
    Theme.of(context).brightness == Brightness.dark
        ? textHint
        : const Color.fromRGBO(0, 0, 0, 0.45);

static Color adaptiveIconInactive(BuildContext context) =>
    Theme.of(context).brightness == Brightness.dark
        ? iconInactive
        : const Color.fromRGBO(0, 0, 0, 0.25);
```

기존 `Colors.white.withAlpha(102)` → `AppColors.textSecondary`로 치환 (약 120곳).
기존 `Colors.white.withAlpha(77)` → `AppColors.textHint`로 치환.
기존 `Colors.white.withAlpha(51)` → `AppColors.iconInactive`로 치환.

> **라이트모드 전체 리팩은 Phase 5 (PRD)에서 별도 진행. Phase 1에서는 토큰만 준비.**

### 1C. Web — `globals.css` + `tailwind.config.ts` 시맨틱 변수 추가

**globals.css에 추가:**
```css
:root {
  --destructive: 0 72% 51%;        /* red-600 */
  --success: 142 76% 36%;          /* green-600 */
  --warning: 45 93% 47%;           /* amber-500 */
}
.dark {
  --destructive: 0 91% 71%;        /* red-400 */
  --success: 145 63% 49%;          /* brand green */
  --warning: 45 93% 58%;           /* amber-400 */
}
```

**tailwind.config.ts에 등록 (필수 — 없으면 Tailwind 클래스로 사용 불가):**
```ts
// colors 안에 추가
destructive: 'hsl(var(--destructive))',
success: 'hsl(var(--success))',
warning: 'hsl(var(--warning))',
```

### 1D. Web — `emerald-*` → 시맨틱 클래스 마이그레이션

**규모**: 약 500곳 / 64파일. 단순 치환이 아닌 전략적 마이그레이션 필요.

**마이그레이션 규칙:**

| emerald 패턴 | 변환 대상 | 비고 |
|---|---|---|
| `text-emerald-600` (라이트) | `text-primary` | `--primary`가 모드별로 다르므로 OK |
| `dark:text-emerald-400` (다크) | **삭제** | `text-primary`만 쓰면 다크도 자동 적용 |
| `text-emerald-500` | `text-primary` | |
| `bg-emerald-100` (라이트 배경) | `bg-primary/10` | |
| `dark:bg-emerald-500/20` | `bg-primary/10` | 다크 prefix 불필요 |
| `bg-emerald-600` (솔리드 배경) | `bg-primary` | |
| `border-emerald-500` | `border-primary` | |
| `ring-emerald-500` | `ring-primary` | |
| `hover:text-emerald-*` | `hover:text-primary-hover` | |

**핵심 주의점:**
- `dark:*-emerald-*` 패턴은 제거해야 함 (`text-primary`가 이미 다크모드 대응)
- `emerald-100` (라이트 배경 tint)은 `bg-primary/10`으로 대체 — opacity 기반
- 이 작업은 독립 세션으로 분리 (규모가 크므로 다른 작업과 묶지 않음)

### 1E. `docs/design-system-reference.md`

이미 생성됨. 작업 1 완료 후 변경된 토큰 반영하여 업데이트.

---

## 작업 2: 스켈레톤 로딩

### 2A. Flutter — 공용 SkeletonBox + 주요 5개 화면

공용 위젯 `app/lib/widgets/skeleton.dart`:
```dart
class SkeletonBox extends StatefulWidget {
  final double width;
  final double height;
  final double borderRadius;
  // AnimationController로 shimmer 효과 (opacity 0.3~0.6 반복)
}
```

적용 대상 (각 화면에 `_buildSkeleton()` 메서드 추가):
1. `home_screen.dart` — 퀵메뉴 + 세션카드 형태
2. `ranking_screen.dart` — 포디엄 + 테이블 행
3. `sessions_screen.dart` — 세션 카드 리스트
4. `players_screen.dart` — 플레이어 카드 그리드
5. `board_screen.dart` — 게시글 행 리스트

> **나머지 25개 화면**: Phase 2에서 마이그레이션. 당장은 `CircularProgressIndicator` 유지.
> Phase 2 시작 전에 `SkeletonBox`를 활용한 공통 `LoadingPlaceholder` 위젯을 만들어,
> 나중에 한꺼번에 교체할 수 있도록 인터페이스를 미리 통일.

### 2B. Web — 공용 스켈레톤 컴포넌트 + 나머지 페이지

현재 ranking, sessions, hall-of-fame에는 **인라인 스켈레톤**이 있음 (별도 컴포넌트 아님, 각 페이지에 `LoadingSkeleton()` 함수로 존재).

공용 컴포넌트 `web/src/components/ui/skeleton.tsx` 생성:
```tsx
export function SkeletonBox({ className }: { className?: string })  // 기본 블록
export function SkeletonCard()  // 카드형 (이미지+텍스트)
export function SkeletonRow()   // 테이블 행
```

기존 인라인 스켈레톤은 유지하되, 새로 추가하는 페이지는 공용 컴포넌트 사용.

---

## 작업 3: Empty State 개선

### 3A. Flutter — 공용 EmptyState 위젯

`app/lib/widgets/empty_state.dart`:
```dart
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;
}
```

적용: 현재 "~없습니다" 텍스트만 있는 모든 화면에 교체.
CTA 버튼은 맥락에 맞게:
- 세션 없음 → "세션 만들기" (관리자만)
- 선수 없음 → "선수 추가"
- 공지 없음 → "첫 공지 작성" (관리자만)
- 기록 없음 → CTA 없이 설명만

### 3B. Web — 소폭 개선

이미 패턴 잡혀 있음. CTA 버튼 누락된 곳만 추가.

---

## 작업 4: 에러/피드백 통일

### 4A. Flutter — 공용 헬퍼 함수

`app/lib/utils/snackbar_helper.dart`:
```dart
void showSuccess(BuildContext context, String msg);  // bg: AppColors.primary
void showError(BuildContext context, String msg);    // bg: AppColors.red
void showInfo(BuildContext context, String msg);     // bg: AppColors.blue
```

기존 약 120곳의 SnackBar 직접 호출을 이 헬퍼로 교체.
`NetworkErrorWidget` 공용 위젯: API 실패 시 "연결 실패 + 재시도" 화면.

### 4B. Web — sonner 도입

현재 웹에는 **토스트/알림 시스템이 전혀 없음**. 액션 성공/실패 피드백이 부재.

```bash
npm install sonner
```

- `layout.tsx`에 `<Toaster />` 추가
- 모든 mutation (세션 생성/삭제, 선수 추가, 설정 변경 등)에 `toast.success()` / `toast.error()` 추가
- 기존 인라인 에러 표시 (`Input` 컴포넌트의 빨간 텍스트)는 유지 — 폼 검증은 인라인이 맞음

---

## 작업 5: 터치 피드백 + 간격 정리

### 5A. Flutter — GestureDetector → InkWell (탭 전용만)

**전환 범위**: `onTap`만 사용하는 GestureDetector (약 60곳 추정).
**제외**: `onLongPress`, `onDoubleTap`, `onPanUpdate` 등 복합 제스처 사용하는 곳은 유지.

구조:
```dart
Material(
  color: Colors.transparent,
  child: InkWell(
    borderRadius: BorderRadius.circular(AppTheme.radiusLg),
    onTap: () => ...,
    child: Container(/* 기존 카드 내용 */),
  ),
)
```

주요 대상: 세션 카드, 선수 카드, 공지 행, 게시글 행.

### 5B. Flutter — 터치 타겟 44dp 보장

- 삭제 아이콘 (14px) → `SizedBox(width: 44, height: 44)` + `InkWell` 래핑
- 핀 아이콘, 닫기 버튼 등 소형 아이콘 전부 최소 44dp

### 5C. 버튼/카드 간격 4px 그리드 정리

무작위 간격 (8/10/12/14/16/20/24px) → `AppTheme.space*` 상수 사용으로 통일.
- 카드 내부 패딩: `space16`
- 카드 간 간격: `space12`
- 섹션 간 간격: `space24`
- 버튼 내부: `horizontal: space16, vertical: space12`

---

## 작업 6: 상태 배지

### 6A. Flutter — completed 색상 변경

`sessions_screen.dart`의 `_statusColor`:
- `completed`: `AppColors.slate` → `AppColors.teal` (정산완료 = 긍정적)

### 6B. Web — 앱과 통일 확인

웹 `status-badge.tsx`의 색상이 앱과 일치하는지 확인 + 불일치 시 수정.

---

## 작업 7: 웹 ARIA 접근성 (공용 컴포넌트 우선)

### 우선 처리 (이번 Phase)

| 컴포넌트 | 추가할 것 |
|---------|----------|
| `button.tsx` | `aria-label` (아이콘 전용 버튼) |
| `header.tsx` | `<nav>`, `role="navigation"`, `aria-label="주 메뉴"` |
| 모달/다이얼로그 | `role="dialog"`, `aria-modal="true"`, Escape 키 닫기 |
| `input.tsx` | `aria-invalid`, `aria-describedby` (에러 메시지 연결) |

### 나중 처리 (Phase 1.5 메모)

- 드롭다운 메뉴: `role="menu"`, `role="menuitem"`, 키보드 내비 (Arrow 키)
- 탭 컴포넌트: `role="tablist"`, `aria-selected`
- 페이지 랜드마크: `<main>`, `<aside>`, `<article>`
- 색상 의존 정보에 텍스트 대안
- 전체 페이지 Tab 순서 감사

---

## 작업 8 (추가): 세션 점수판 탭 — 팀별 기록 뷰 개선

### 현재 문제

`session_detail_screen.dart`의 점수판 탭:
- `_buildEventLog` (1784줄): 코드상 좌우 분리가 있으나 (`isTeam1` 분기), 실제로 이벤트가 한쪽으로만 표시되는 버그 가능성. `e['team_id']`가 null이거나 타입 불일치 시 전부 오른쪽(team2)으로 몰림.
- `_buildStatsTab` (850줄): 모든 선수가 MVP 점수순 단일 리스트. 팀 구분 없음.

### 변경

**A. 이벤트 로그 좌우 분리 버그 수정**
- `team_id` null 체크 + 타입 캐스팅 확인 (`int` vs `String` 비교 이슈 가능)
- 디버그: 실제 API 응답에서 `team_id` 값 확인

**B. 선수 스탯 탭 — 팀별 그룹화**
- 상단: 하이라이트 카드 (MVP, 득점왕, 도움왕, 수비왕) — 유지
- 중단: 팀별 통계 비교 바
- 하단: 세션 기록 테이블을 **팀별 섹션으로 분리** (팀 헤더 → 해당 팀 선수들)

**3팀+ 세션 대응:**
- 2팀: 좌우 비교 레이아웃 (웹의 match-timeline 스타일)
- 3팀+: 팀별 세로 섹션 (각 팀 카드가 세로로 나열, 팀 컬러 헤더)
- 비교 바는 2팀일 때만 표시, 3팀+는 각 팀 카드에 통계 포함

---

## 구현 순서 + 세션 분할

### 세션 A: 토큰 기반 (작업 1A~1C + 1E)
- Flutter `AppTheme` + `AppColors` 시맨틱 상수
- Web `globals.css` + `tailwind.config.ts` 시맨틱 변수
- 레퍼런스 문서 업데이트
- 커밋+푸시

### 세션 B: emerald 마이그레이션 (작업 1D)
- 500곳 emerald → primary 전환 (독립 세션, 규모 큼)
- 커밋+푸시

### 세션 C: 스켈레톤 + Empty State (작업 2 + 3)
- Flutter 5개 화면 스켈레톤 + EmptyState 위젯
- Web 스켈레톤 통일 + CTA 추가
- 커밋+푸시

### 세션 D: 피드백 + 터치 (작업 4 + 5)
- Flutter SnackBar 헬퍼 + InkWell 전환 + 간격 정리
- Web sonner 도입
- 커밋+푸시

### 세션 E: 배지 + ARIA + 점수판 (작업 6 + 7 + 8)
- 상태 배지 통일
- 웹 ARIA 공용 컴포넌트
- 세션 스탯 팀별 분리
- 커밋+푸시
