# Phase 1: Design Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 앱/웹 디자인 토큰 통합, 스켈레톤 로딩, Empty State, 에러 피드백, 터치 피드백, 상태 배지, ARIA 접근성, 점수판 팀 분리를 구현하여 체감 품질을 향상시킨다.

**Architecture:** 토큰/상수를 먼저 정의(Session A) → emerald 대량 치환(Session B) → 공용 위젯+컴포넌트(Session C~D) → 통합 마무리(Session E). 각 세션은 독립적으로 커밋+푸시 가능.

**Tech Stack:** Flutter (Dart), Next.js 14 (App Router), Tailwind CSS, Zustand, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-26-phase1-design-quality.md`
**Token Reference:** `docs/design-system-reference.md`

---

## File Structure

### 신규 파일
| 파일 | 역할 |
|------|------|
| `app/lib/theme/app_theme.dart` | Flutter TextStyle/Spacing/Radius 상수 |
| `app/lib/widgets/skeleton.dart` | Flutter SkeletonBox shimmer 위젯 |
| `app/lib/widgets/empty_state.dart` | Flutter EmptyState 공용 위젯 |
| `app/lib/utils/snackbar_helper.dart` | Flutter showSuccess/showError/showInfo 헬퍼 |
| `web/src/components/ui/skeleton.tsx` | Web SkeletonBox/SkeletonCard/SkeletonRow |

### 수정 파일
| 파일 | 변경 내용 |
|------|-----------|
| `app/lib/theme/app_colors.dart` | textSecondary, textHint, iconInactive + adaptive* 헬퍼 |
| `web/src/app/globals.css` | --destructive, --success, --warning 변수 추가 |
| `web/tailwind.config.ts` | destructive, success, warning 색상 등록 |
| `web/src/**/*.tsx` (64파일) | emerald-* → primary 시맨틱 클래스 마이그레이션 |
| `app/lib/screens/*.dart` (33파일) | Colors.white.withAlpha → AppColors 상수 치환 |
| `app/lib/screens/*.dart` (29파일) | GestureDetector(onTap only) → InkWell 전환 |
| `app/lib/screens/*.dart` (19파일) | SnackBar 직접 호출 → snackbar_helper 사용 |
| `app/lib/screens/home_screen.dart` | 스켈레톤 + EmptyState |
| `app/lib/screens/ranking_screen.dart` | 스켈레톤 + EmptyState |
| `app/lib/screens/sessions_screen.dart` | 스켈레톤 + EmptyState |
| `app/lib/screens/players_screen.dart` | 스켈레톤 + EmptyState |
| `app/lib/screens/board_screen.dart` | 스켈레톤 + EmptyState |
| `app/lib/screens/session_detail_screen.dart` | 점수판 팀별 분리 + 이벤트로그 버그 수정 |
| `web/src/components/ui/button.tsx` | aria-label (아이콘 전용) |
| `web/src/components/layout/header.tsx` | nav role, aria-label |
| `web/src/components/ui/input.tsx` | aria-invalid, aria-describedby |
| `web/src/components/ui/status-badge.tsx` | 앱과 색상 통일 확인 |

### 변경하지 않는 파일
| 파일 | 이유 |
|------|------|
| `app/lib/main.dart` | ThemeMode.system 설정 유지 — 라이트모드 전체 리팩은 Phase 5 |
| 웹 드롭다운/탭/랜드마크 | ARIA Phase 1.5로 별도 처리 |

---

## Session A: 토큰 기반 (Task 1~3)

### Task 1: Flutter AppTheme 상수 정의

**Files:**
- Create: `app/lib/theme/app_theme.dart`

- [ ] **Step 1: AppTheme 클래스 생성**

`app/lib/theme/app_theme.dart`:
```dart
import 'package:flutter/material.dart';

/// 코너킥스 디자인 토큰 — TextStyle, Spacing, BorderRadius
/// 웹 Tailwind 대응: docs/design-system-reference.md 참조
class AppTheme {
  AppTheme._();

  // ─── TextStyle (color 미지정 — 사용처에서 테마 따라 결정) ──────
  static const headingLg = TextStyle(fontSize: 22, fontWeight: FontWeight.w700);
  static const headingMd = TextStyle(fontSize: 18, fontWeight: FontWeight.w600);
  static const headingSm = TextStyle(fontSize: 15, fontWeight: FontWeight.w600);
  static const bodyLg    = TextStyle(fontSize: 16, fontWeight: FontWeight.w400);
  static const body      = TextStyle(fontSize: 14, fontWeight: FontWeight.w400);
  static const bodySm    = TextStyle(fontSize: 12, fontWeight: FontWeight.w400);
  static const caption   = TextStyle(fontSize: 11, fontWeight: FontWeight.w400);

  // ─── Spacing (4px grid) ──────
  static const space4  = 4.0;
  static const space8  = 8.0;
  static const space12 = 12.0;
  static const space16 = 16.0;
  static const space24 = 24.0;
  static const space32 = 32.0;
  static const space48 = 48.0;

  // ─── Border Radius ──────
  static const radiusSm = 8.0;
  static const radiusMd = 12.0;
  static const radiusLg = 16.0;
  static const radiusXl = 20.0;
}
```

**Verification:** `cd app && flutter analyze --no-fatal-infos` — 에러 0

---

### Task 2: AppColors 시맨틱 텍스트 상수 + adaptive 헬퍼

**Files:**
- Modify: `app/lib/theme/app_colors.dart`

- [ ] **Step 1: 시맨틱 텍스트 상수 추가**

`app/lib/theme/app_colors.dart` — `vestColors` 위에 추가:
```dart
// ─── 시맨틱 텍스트 (다크 모드 기본) ──────
static const textSecondary = Color.fromRGBO(255, 255, 255, 0.65);
static const textHint      = Color.fromRGBO(255, 255, 255, 0.50);
static const iconInactive  = Color.fromRGBO(255, 255, 255, 0.30);

// ─── 테마 인식 헬퍼 (Phase 5 라이트모드 대비) ──────
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

- [ ] **Step 2: Colors.white.withAlpha 치환 (627곳 / 33파일)**

치환 규칙:
| 기존 패턴 | 변환 대상 | 의미 |
|---|---|---|
| `Colors.white.withAlpha(166)` ~65% | `AppColors.textSecondary` | 보조 텍스트 |
| `Colors.white.withAlpha(128)` ~50% | `AppColors.textHint` | 힌트 텍스트 |
| `Colors.white.withAlpha(102)` ~40% | `AppColors.textSecondary` | 보조 텍스트 |
| `Colors.white.withAlpha(77)` ~30% | `AppColors.textHint` | 힌트 |
| `Colors.white.withAlpha(51)` ~20% | `AppColors.iconInactive` | 비활성 |

> **주의**: 각 파일 상단에 `import 'package:corner_kicks/theme/app_colors.dart';` 필요.
> 이미 import 있으면 추가 불필요. 파일별로 확인할 것.

**Verification:** `cd app && flutter analyze --no-fatal-infos`

---

### Task 3: Web 시맨틱 CSS 변수 + Tailwind 등록

**Files:**
- Modify: `web/src/app/globals.css`
- Modify: `web/tailwind.config.ts`

- [ ] **Step 1: globals.css에 시맨틱 변수 추가**

`:root` 블록에 추가:
```css
--destructive: 0 72% 51%;
--success: 142 76% 36%;
--warning: 45 93% 47%;
```

`.dark` 블록에 추가:
```css
--destructive: 0 91% 71%;
--success: 145 63% 49%;
--warning: 45 93% 58%;
```

- [ ] **Step 2: tailwind.config.ts에 색상 등록**

`colors` 안에 추가:
```ts
destructive: 'hsl(var(--destructive))',
success: 'hsl(var(--success))',
warning: 'hsl(var(--warning))',
```

- [ ] **Step 3: design-system-reference.md 업데이트**

시맨틱 컬러 섹션의 "추가 예정" 마크 제거. 실제 값으로 업데이트.

**Verification:** `cd web && npm run build` — 빌드 성공

---

## Session B: emerald 마이그레이션 (Task 4)

### Task 4: emerald-* → 시맨틱 클래스 마이그레이션 (505곳 / 64파일)

**Files:**
- Modify: `web/src/**/*.tsx` (64파일)

> **이 태스크는 독립 세션. 기계적 치환이지만 패턴별 주의점이 있음.**

- [ ] **Step 1: 치환 규칙 확인 + 파일별 순차 처리**

| emerald 패턴 | 변환 | 비고 |
|---|---|---|
| `text-emerald-600` | `text-primary` | 라이트모드 텍스트 |
| `text-emerald-500` | `text-primary` | |
| `text-emerald-400` | `text-primary` | 다크모드 텍스트 |
| `dark:text-emerald-400` | **삭제** | `text-primary`가 모드별 자동 대응 |
| `dark:text-emerald-500` | **삭제** | |
| `bg-emerald-600` | `bg-primary` | 솔리드 배경 |
| `bg-emerald-500` | `bg-primary` | |
| `bg-emerald-100` | `bg-primary/10` | 라이트 tint 배경 |
| `bg-emerald-50` | `bg-primary/5` | 매우 연한 배경 |
| `dark:bg-emerald-500/10` | **삭제** (bg-primary/10으로 통합) | |
| `dark:bg-emerald-500/20` | **삭제** (bg-primary/10으로 통합) | |
| `dark:bg-emerald-600` | **삭제** | |
| `border-emerald-500` | `border-primary` | |
| `border-emerald-600` | `border-primary` | |
| `dark:border-emerald-500` | **삭제** | |
| `ring-emerald-500` | `ring-primary` | |
| `hover:bg-emerald-700` | `hover:bg-primary-hover` | |
| `hover:bg-emerald-600` | `hover:bg-primary-hover` | |
| `hover:text-emerald-*` | `hover:text-primary` | |
| `focus:ring-emerald-*` | `focus:ring-primary` | |
| `from-emerald-*` | `from-primary` | gradient |
| `to-emerald-*` | `to-primary` | gradient |
| `via-emerald-*` | `via-primary` | gradient |

- [ ] **Step 2: dark: 접두사 정리**

`text-primary`/`bg-primary`가 CSS 변수 기반이라 다크/라이트 자동 전환.
따라서 `dark:*-emerald-*` 패턴은 대체하지 않고 **제거**해야 함.

예시 before/after:
```
// Before
className="text-emerald-600 dark:text-emerald-400"
// After
className="text-primary"

// Before
className="bg-emerald-100 dark:bg-emerald-500/20"
// After
className="bg-primary/10"
```

- [ ] **Step 3: 파일별 순차 처리 (64파일)**

처리 순서 (의존성 순):
1. `web/src/components/ui/` — 공용 컴포넌트 (7파일)
2. `web/src/components/` — 기능 컴포넌트 (12파일)
3. `web/src/app/(auth)/` — 인증 (3파일)
4. `web/src/app/(main)/` — 메인 페이지 (42파일)

> 각 파일을 Read → 패턴 파악 → Edit 순서로 처리.
> 파일당 emerald 사용이 1~2곳이면 즉시 치환, 10곳+ 이면 Write 전체 재작성.

- [ ] **Step 4: 잔여 emerald 확인**

```bash
cd web && grep -r "emerald" src/ --include="*.tsx" --include="*.ts" -l
```

0건이어야 함. 남은 것 있으면 수정.

**Verification:** `cd web && npm run build` — 빌드 성공 + 주요 페이지 시각 확인

---

## Session C: 스켈레톤 + Empty State (Task 5~6)

### Task 5: Flutter 스켈레톤 로딩

**Files:**
- Create: `app/lib/widgets/skeleton.dart`
- Modify: `app/lib/screens/home_screen.dart`
- Modify: `app/lib/screens/ranking_screen.dart`
- Modify: `app/lib/screens/sessions_screen.dart`
- Modify: `app/lib/screens/players_screen.dart`
- Modify: `app/lib/screens/board_screen.dart`

- [ ] **Step 1: SkeletonBox 위젯 생성**

`app/lib/widgets/skeleton.dart`:
```dart
import 'package:flutter/material.dart';
import 'package:corner_kicks/theme/app_colors.dart';
import 'package:corner_kicks/theme/app_theme.dart';

class SkeletonBox extends StatefulWidget {
  final double width;
  final double height;
  final double borderRadius;

  const SkeletonBox({
    super.key,
    required this.width,
    required this.height,
    this.borderRadius = AppTheme.radiusSm,
  });

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _opacity = Tween(begin: 0.3, end: 0.6).animate(_controller);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _opacity,
      builder: (_, __) => Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          color: AppColors.bgBorder.withOpacity(_opacity.value),
          borderRadius: BorderRadius.circular(widget.borderRadius),
        ),
      ),
    );
  }
}
```

> **주의**: `AnimatedBuilder` 아닌 `AnimatedBuilder` 사용.
> Flutter 3.x에서는 `AnimatedBuilder`가 `AnimatedWidget`의 서브클래스로 존재. 실제 import 확인 필요.

- [ ] **Step 2: home_screen.dart에 _buildSkeleton 추가**

기존 `CircularProgressIndicator` 위치에 스켈레톤 교체:
- 퀵메뉴 4개 동그라미 (SkeletonBox 56x56 circle)
- 세션카드 2개 (SkeletonBox full-width x 120)
- 랭킹 미니 3행 (SkeletonBox full-width x 48)

- [ ] **Step 3: ranking_screen.dart 스켈레톤**

- 포디엄 3개 (SkeletonBox 80x100, 100x120, 80x100)
- 테이블 행 10개 (SkeletonBox full-width x 40)

- [ ] **Step 4: sessions_screen.dart 스켈레톤**

- 세션 카드 4개 (SkeletonBox full-width x 100)

- [ ] **Step 5: players_screen.dart 스켈레톤**

- 그리드 2열 x 4행 (SkeletonBox half-width x 80)

- [ ] **Step 6: board_screen.dart 스켈레톤**

- 게시글 행 6개 (SkeletonBox full-width x 60)

**Verification:** `cd app && flutter analyze --no-fatal-infos`

---

### Task 6: Flutter EmptyState 위젯 + Web CTA 보완

**Files:**
- Create: `app/lib/widgets/empty_state.dart`
- Modify: 각 화면에서 "~없습니다" 텍스트를 EmptyState로 교체
- Modify: Web — CTA 버튼 누락 곳 추가

- [ ] **Step 1: EmptyState 위젯 생성**

`app/lib/widgets/empty_state.dart`:
```dart
import 'package:flutter/material.dart';
import 'package:corner_kicks/theme/app_colors.dart';
import 'package:corner_kicks/theme/app_theme.dart';

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.space32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: AppColors.iconInactive),
            const SizedBox(height: AppTheme.space16),
            Text(title, style: AppTheme.headingSm.copyWith(
              color: AppColors.textSecondary,
            )),
            if (subtitle != null) ...[
              const SizedBox(height: AppTheme.space8),
              Text(subtitle!, style: AppTheme.body.copyWith(
                color: AppColors.textHint,
              ), textAlign: TextAlign.center),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: AppTheme.space24),
              ElevatedButton(
                onPressed: onAction,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                ),
                child: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: 각 화면 EmptyState 적용**

| 화면 | 아이콘 | 타이틀 | CTA |
|------|--------|--------|-----|
| `sessions_screen` | `Icons.sports_soccer` | 등록된 세션이 없습니다 | "세션 만들기" (관리자만) |
| `players_screen` | `Icons.people_outline` | 등록된 선수가 없습니다 | "선수 추가" |
| `ranking_screen` | `Icons.emoji_events_outlined` | 랭킹 데이터가 없습니다 | 없음 |
| `board_screen` | `Icons.article_outlined` | 게시글이 없습니다 | "글쓰기" |
| `announcements_screen` | `Icons.campaign_outlined` | 공지사항이 없습니다 | "공지 작성" (관리자만) |

- [ ] **Step 3: Web — CTA 누락 곳 보강**

Web에서 빈 상태에 CTA 없는 페이지 확인 후 추가 (보드, 공지 등).

**Verification:** `cd app && flutter analyze --no-fatal-infos` + `cd web && npm run build`

---

### Task 7: Web 스켈레톤 통합 컴포넌트

**Files:**
- Create: `web/src/components/ui/skeleton.tsx`

- [ ] **Step 1: 공용 스켈레톤 컴포넌트 생성**

```tsx
import { cn } from '@/lib/cn'

export function SkeletonBox({ className }: { className?: string }) {
  return (
    <div className={cn(
      'animate-pulse rounded-lg bg-muted',
      className
    )} />
  )
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl bg-card border border-border p-4 space-y-3">
      <SkeletonBox className="h-4 w-3/4" />
      <SkeletonBox className="h-3 w-1/2" />
      <SkeletonBox className="h-3 w-full" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2">
      <SkeletonBox className="h-8 w-8 rounded-full" />
      <SkeletonBox className="h-4 flex-1" />
      <SkeletonBox className="h-4 w-16" />
    </div>
  )
}
```

> 기존 인라인 스켈레톤 (ranking, sessions, hall-of-fame)은 유지. 새 페이지부터 공용 사용.

**Verification:** `cd web && npm run build`

---

## Session D: 피드백 + 터치 (Task 8~10)

### Task 8: Flutter SnackBar 헬퍼 + 전환 (122곳 / 19파일)

**Files:**
- Create: `app/lib/utils/snackbar_helper.dart`
- Modify: `app/lib/screens/*.dart` (19파일)

- [ ] **Step 1: snackbar_helper.dart 생성**

```dart
import 'package:flutter/material.dart';
import 'package:corner_kicks/theme/app_colors.dart';

void showSuccess(BuildContext context, String msg) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: AppColors.primary,
      behavior: SnackBarBehavior.floating,
      duration: const Duration(seconds: 2),
    ));
}

void showError(BuildContext context, String msg) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: AppColors.red,
      behavior: SnackBarBehavior.floating,
      duration: const Duration(seconds: 3),
    ));
}

void showInfo(BuildContext context, String msg) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: AppColors.blue,
      behavior: SnackBarBehavior.floating,
      duration: const Duration(seconds: 2),
    ));
}
```

- [ ] **Step 2: 기존 SnackBar 직접 호출 122곳 → 헬퍼로 전환**

패턴:
```dart
// Before
ScaffoldMessenger.of(context).showSnackBar(
  SnackBar(content: Text('저장되었습니다'), backgroundColor: Colors.green),
);

// After
showSuccess(context, '저장되었습니다');
```

파일별 순차 처리. import 추가 필요:
```dart
import 'package:corner_kicks/utils/snackbar_helper.dart';
```

**Verification:** `cd app && flutter analyze --no-fatal-infos`

---

### Task 9: GestureDetector → InkWell 전환 (onTap 전용)

**Files:**
- Modify: `app/lib/screens/*.dart` (29파일, ~88곳 중 onTap 전용만)

- [ ] **Step 1: onTap 전용 GestureDetector 식별**

88곳 중 `onTap`만 사용하는 곳을 필터링. `onLongPress`, `onDoubleTap`, `onPanUpdate` 등을 함께 쓰는 곳은 제외.

- [ ] **Step 2: InkWell로 전환**

```dart
// Before
GestureDetector(
  onTap: () => ...,
  child: Container(
    decoration: BoxDecoration(borderRadius: BorderRadius.circular(16)),
    child: ...
  ),
)

// After
Material(
  color: Colors.transparent,
  child: InkWell(
    borderRadius: BorderRadius.circular(AppTheme.radiusLg),
    onTap: () => ...,
    child: Container(
      // decoration에서 borderRadius 유지 가능
      child: ...
    ),
  ),
)
```

주요 대상 (우선순위):
1. 세션 카드 (`sessions_screen`, `home_screen`)
2. 선수 카드 (`players_screen`)
3. 공지/게시글 행 (`board_screen`, `announcements_screen`)
4. 프로필/클럽 카드 등

- [ ] **Step 3: 터치 타겟 44dp 보장**

작은 아이콘 버튼 (삭제, 핀, 닫기 등) → `SizedBox(width: 44, height: 44)` + `InkWell` 래핑.

**Verification:** `cd app && flutter analyze --no-fatal-infos`

---

### Task 10: 간격 4px 그리드 정리 + Web sonner 도입

**Files:**
- Modify: `app/lib/screens/*.dart` — 무작위 간격 → AppTheme.space* 통일
- Modify: `web/package.json` — sonner 추가
- Modify: `web/src/app/(main)/layout.tsx` — Toaster 추가
- Modify: `web/src/**/*.tsx` — mutation에 toast 추가

- [ ] **Step 1: Flutter 간격 통일**

규칙:
| 용도 | 상수 | 값 |
|------|------|---|
| 카드 내부 패딩 | `AppTheme.space16` | 16 |
| 카드 간 간격 | `AppTheme.space12` | 12 |
| 섹션 간 간격 | `AppTheme.space24` | 24 |
| 버튼 내부 | `h: space16, v: space12` | |
| 아이콘-텍스트 | `AppTheme.space8` | 8 |

> 모든 화면을 한번에 하지 말 것. 스켈레톤/EmptyState 적용 5개 화면 + 세션 상세 위주.

- [ ] **Step 2: sonner 설치 + Toaster 추가**

```bash
cd web && npm install sonner
```

`web/src/app/(main)/layout.tsx`:
```tsx
import { Toaster } from 'sonner'
// ... 기존 코드
<Toaster position="top-center" richColors />
```

- [ ] **Step 3: 주요 mutation에 toast 추가**

대상 (에러/성공 피드백이 없는 곳):
- 세션 생성/삭제 → `toast.success('세션이 생성되었습니다')`
- 선수 추가/삭제
- 클럽 설정 변경
- 공지 작성/삭제
- 게시글 작성/삭제

> 기존 인라인 에러 표시 (input 빨간 텍스트)는 유지.

**Verification:** `cd web && npm run build`

---

## Session E: 배지 + ARIA + 점수판 (Task 11~13)

### Task 11: 상태 배지 통일

**Files:**
- Modify: `app/lib/screens/sessions_screen.dart` — completed 색상 변경
- Modify: `web/src/components/ui/status-badge.tsx` — 앱과 일치 확인

- [ ] **Step 1: Flutter completed 배지 색상 변경**

`sessions_screen.dart`의 `_statusColor` (또는 동등 함수):
```dart
case 'completed': return AppColors.teal;  // 기존: AppColors.slate
```

- [ ] **Step 2: Web status-badge 앱과 대조**

`design-system-reference.md` 5번 섹션 기준으로 확인:
| status | 기대 색상 | 웹 현재 |
|--------|----------|---------|
| recruiting/open | primary(green) | 확인 |
| closed | blue | 확인 |
| ended | orange | 확인 |
| completed | teal | 확인 |

불일치 있으면 수정.

**Verification:** 시각 확인

---

### Task 12: 웹 ARIA 접근성 (공용 컴포넌트)

**Files:**
- Modify: `web/src/components/ui/button.tsx`
- Modify: `web/src/components/layout/header.tsx`
- Modify: `web/src/components/ui/input.tsx`

- [ ] **Step 1: button.tsx — 아이콘 전용 버튼 aria-label**

`children`이 텍스트가 아닌 아이콘만일 때 `aria-label` props 지원:
```tsx
interface ButtonProps {
  'aria-label'?: string
  // ...
}
```

- [ ] **Step 2: header.tsx — nav 랜드마크**

```tsx
<nav role="navigation" aria-label="주 메뉴">
  {/* 기존 헤더 내용 */}
</nav>
```

- [ ] **Step 3: input.tsx — 에러 상태 연결**

```tsx
<input
  aria-invalid={!!error}
  aria-describedby={error ? `${id}-error` : undefined}
  // ...
/>
{error && <p id={`${id}-error`} role="alert">{error}</p>}
```

- [ ] **Step 4: 모달 — role + Escape 키 (있으면)**

프로젝트에 공용 모달 컴포넌트 있는지 확인. 있으면:
```tsx
role="dialog" aria-modal="true"
```
+ Escape 키 닫기 이벤트 리스너.

> **Phase 1.5 메모**: 드롭다운 `role="menu"`, 탭 `role="tablist"`, 페이지 랜드마크 `<main>/<aside>`, Tab 순서 감사는 나중에 처리.

**Verification:** `cd web && npm run build` + 크롬 Lighthouse 접근성 점수 확인

---

### Task 13: 세션 점수판 탭 — 팀별 기록 뷰 개선

**Files:**
- Modify: `app/lib/screens/session_detail_screen.dart`

- [ ] **Step 1: _buildEventLog 좌우 분리 버그 수정**

현재 코드 (약 1784줄) 확인 포인트:
- `e['team_id']` null 체크
- `team_id` 타입 비교 이슈 (`int` vs `String` — API 응답이 String일 수 있음)
- `isTeam1` 판정 로직이 올바른지

```dart
// 수정 예시
final eventTeamId = e['team_id'];
final isTeam1 = eventTeamId != null && eventTeamId.toString() == teams[0]['id'].toString();
```

- [ ] **Step 2: 선수 스탯 탭 팀별 그룹화**

_buildStatsTab 변경:
- 상단 하이라이트 카드 (MVP, 득점왕 등) — **유지**
- 팀별 섹션 추가: 팀 컬러 헤더 → 해당 팀 선수 MVP 점수순

2팀일 때: 좌우 비교 레이아웃
3팀+일 때: 세로 팀 카드 나열

```dart
// 팀 그룹화 로직
final teamGroups = <int, List<Map<String, dynamic>>>{};
for (final player in players) {
  final teamId = player['team_id'];
  if (teamId != null) {
    teamGroups.putIfAbsent(teamId as int, () => []).add(player);
  }
}
```

- [ ] **Step 3: 팀별 통계 비교 바 (2팀 전용)**

2팀 세션일 때만 표시:
```
[팀A 골 5] ████████░░░░ [팀B 골 3]
[팀A 수비 12] ██████░░░░░░ [팀B 수비 8]
```

3팀+일 때는 각 팀 카드에 통계 인라인 포함.

**Verification:** `cd app && flutter analyze --no-fatal-infos` + 실제 세션 데이터로 UI 확인

---

## 커밋 전략

| 세션 | 커밋 메시지 | 주요 변경 |
|------|-----------|----------|
| A | `feat: 디자인 토큰 통합 (AppTheme + AppColors 시맨틱 + Web CSS vars)` | 토큰 정의 + withAlpha 치환 |
| B | `refactor: emerald → primary 시맨틱 마이그레이션 (505곳)` | 웹 전체 색상 통합 |
| C | `feat: 스켈레톤 로딩 + EmptyState 위젯 (앱 5화면 + 웹)` | 로딩/빈 상태 UX |
| D | `feat: SnackBar 헬퍼 + InkWell 터치 피드백 + sonner 토스트` | 피드백/터치 |
| E | `feat: 상태 배지 통일 + ARIA 접근성 + 점수판 팀 분리` | 마무리 |

---

## 의존성

```
Session A → Session B (emerald 치환 전에 primary CSS var 필요)
Session A → Session C (SkeletonBox가 AppTheme 상수 사용)
Session A → Session D (SnackBar 헬퍼가 AppColors 사용)
Session C, D → Session E (점수판 작업이 AppTheme/InkWell에 의존)
Session B는 A 완료 후 독립 실행 가능
```

## 위험 요소

| 위험 | 대응 |
|------|------|
| emerald 505곳 기계적 치환 중 누락/오류 | 치환 후 `grep emerald` 0건 확인 + 빌드 |
| Colors.white.withAlpha 627곳 치환 범위 | alpha 값별 매핑 규칙 엄격 적용, analyze 통과 필수 |
| session_detail_screen.dart 2000줄+ 대형 파일 | 이벤트로그/스탯 함수만 타겟팅, 나머지 건드리지 않음 |
| sonner 패키지 호환성 | Next.js 14 + App Router와 호환 확인됨 |
| InkWell 전환 시 ripple가 Container decoration 밖으로 넘침 | Material + borderRadius 지정으로 방지 |
