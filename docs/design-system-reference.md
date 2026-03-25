# 디자인 시스템 레퍼런스

> **이 문서는 앱/웹 간 토큰 매핑의 기준 문서입니다.**
> 새 세션에서 UI 작업 시 반드시 이 문서를 먼저 읽으세요.
> 새 토큰을 추가하면 이 문서도 업데이트하세요.

---

## 1. 컬러 토큰

### 1.1 코어 컬러

| 역할 | Flutter (`AppColors`) | Web CSS var | Web Tailwind | 값 (다크) | 값 (라이트) |
|------|----------------------|-------------|-------------|----------|-----------|
| **Primary** | `.primary` | `--primary` | `text-primary`, `bg-primary` | `#2ECC71` | `#16A34A` |
| **Primary Hover** | `.primaryDark` | `--primary-hover` | `bg-primary-hover` | darker | darker |
| **Primary Foreground** | `Colors.white` / dark text | `--primary-foreground` | `text-primary-foreground` | `#0F172A` | `#FFFFFF` |

### 1.2 배경/표면

| 역할 | Flutter | Web CSS var | Web Tailwind | 값 (다크) | 값 (라이트) |
|------|---------|-------------|-------------|----------|-----------|
| **Background** | `.bgBase` `#0F172A` | `--background` | `bg-background` | `#0F172A` | `#FFFFFF` |
| **Card** | `.bgCard` `#1E293B` | `--card` | `bg-card` | `#1E293B` | `#FFFFFF` |
| **Card Deep** | `.bgDeep` `#0D1B2A` | — | — | `#0D1B2A` | — |
| **Border** | `.bgBorder` `#334155` | `--border` | `border-border` | `#334155` | `#E2E8F0` |

### 1.3 텍스트

| 역할 | Flutter | Web CSS var / Tailwind | 값 (다크) |
|------|---------|----------------------|----------|
| **기본 텍스트** | `Colors.white` | `--foreground` / `text-foreground` | `#F8FAFC` |
| **보조 텍스트** | `AppColors.textSecondary` *(추가 예정)* `rgba(255,255,255,0.65)` | `--muted-foreground` / `text-muted-foreground` | `~65% white` |
| **힌트 텍스트** | `AppColors.textHint` *(추가 예정)* `rgba(255,255,255,0.50)` | `text-slate-500` | `~50% white` |
| **비활성** | `AppColors.iconInactive` *(추가 예정)* `rgba(255,255,255,0.30)` | `text-slate-600` | `~30% white` |

> **⚠️ 마이그레이션 노트**: 기존 `Colors.white.withAlpha(102)` (~40%) → `AppColors.textSecondary` (65%)로 교체 진행 중

### 1.4 시맨틱 컬러

| 역할 | Flutter | Web CSS var | Web Tailwind | 값 (다크) |
|------|---------|-------------|-------------|----------|
| **Error** | `.red` `#EF4444` | `--destructive` *(추가 예정)* | `text-destructive` | `#F87171` |
| **Success** | `.primary` `#2ECC71` | `--success` *(추가 예정)* | `text-success` | `#2ECC71` |
| **Warning** | `.amber` `#F59E0B` | `--warning` *(추가 예정)* | `text-warning` | `#FBBF24` |
| **Info** | `.blue` `#3B82F6` | — | `text-blue-500` | `#3B82F6` |

### 1.5 액센트 컬러

| 이름 | Flutter | Hex | 용도 |
|------|---------|-----|------|
| Blue | `.blue` | `#3B82F6` | 마감(closed) 배지, 도움 관련 |
| Teal | `.teal` | `#14B8A6` | 정산완료(completed) 배지 |
| Purple | `.purple` | `#8B5CF6` | 수비왕 하이라이트 |
| Amber | `.amber` | `#F59E0B` | MVP, 금메달 |
| Orange | `.orange` | `#F97316` | 경기완료(ended) 배지 |
| Red | `.red` | `#EF4444` | 에러, 경고 |

### 1.6 조끼 색상 (vest_color)

| DB값 | Flutter `AppColors.vestColors` | Hex |
|------|------------------------------|-----|
| `'yellow'` | `Color(0xFFEAB308)` | `#EAB308` |
| `'orange'` | `Color(0xFFF97316)` | `#F97316` |
| `'white'` | `Color(0xFF94A3B8)` | `#94A3B8` |
| `'red'` | `Color(0xFFEF4444)` | `#EF4444` |
| `'blue'` | `Color(0xFF3B82F6)` | `#3B82F6` |
| `'green'` | `Color(0xFF10B981)` | `#10B981` |
| `'purple'` | `Color(0xFFA855F7)` | `#A855F7` |
| `'pink'` | `Color(0xFFEC4899)` | `#EC4899` |

---

## 2. 타이포그래피

### Flutter (`AppTheme` — 추가 예정)

| 이름 | Size | Weight | 용도 |
|------|------|--------|------|
| `headingLg` | 22 | w700 | 페이지 타이틀 |
| `headingMd` | 18 | w600 | 섹션 타이틀 |
| `headingSm` | 15 | w600 | 카드 타이틀, 섹션 소제목 |
| `bodyLg` | 16 | w400 | 강조 본문 |
| `body` | 14 | w400 | 기본 본문 |
| `bodySm` | 12 | w400 | 작은 본문, 배지 텍스트 |
| `caption` | 11 | w400 | 캡션, 타임스탬프 |

### Web (Tailwind 기본값 사용)

| Flutter 대응 | Tailwind |
|-------------|---------|
| `headingLg` | `text-xl font-bold` |
| `headingMd` | `text-lg font-semibold` |
| `headingSm` | `text-sm font-semibold` |
| `bodyLg` | `text-base` |
| `body` | `text-sm` |
| `bodySm` | `text-xs` |
| `caption` | `text-[11px]` |

**폰트**: Pretendard (웹: CDN, 앱: 시스템 기본)

---

## 3. 스페이싱 (4px Grid)

| 이름 | 값 | Flutter (`AppTheme`) | Web (Tailwind) | 용도 |
|------|------|---------------------|----------------|------|
| `space4` | 4px | `AppTheme.space4` | `p-1`, `gap-1` | 아이콘-텍스트 간격 |
| `space8` | 8px | `AppTheme.space8` | `p-2`, `gap-2` | 칩 내부, 좁은 간격 |
| `space12` | 12px | `AppTheme.space12` | `p-3`, `gap-3` | 카드 간 간격 |
| `space16` | 16px | `AppTheme.space16` | `p-4`, `gap-4` | 카드 내부 패딩 |
| `space24` | 24px | `AppTheme.space24` | `p-6`, `gap-6` | 섹션 간 간격 |
| `space32` | 32px | `AppTheme.space32` | `p-8`, `gap-8` | 큰 섹션 간격 |
| `space48` | 48px | `AppTheme.space48` | `p-12` | 페이지 상하 여백 |

---

## 4. Border Radius

| 이름 | 값 | Flutter (`AppTheme`) | Web (Tailwind) | 용도 |
|------|------|---------------------|----------------|------|
| `radiusSm` | 8px | `AppTheme.radiusSm` | `rounded-lg` | 칩, 배지, 인풋 |
| `radiusMd` | 12px | `AppTheme.radiusMd` | `rounded-xl` | 작은 카드 |
| `radiusLg` | 16px | `AppTheme.radiusLg` | `rounded-2xl` | 메인 카드 |
| `radiusXl` | 20px | `AppTheme.radiusXl` | `rounded-[20px]` | 모달, 대형 카드 |

---

## 5. 세션 상태 배지 컬러

| status (DB) | 라벨 | Flutter Color | Web Tailwind | Hex |
|-------------|------|---------------|-------------|-----|
| `recruiting` | 모집중 | `AppColors.primary` | `text-primary` | `#2ECC71` |
| `open` | 모집중 | `AppColors.primary` | `text-primary` | `#2ECC71` |
| `closed` | 마감 | `AppColors.blue` | `text-blue-500` | `#3B82F6` |
| `ended` | 경기완료 | `AppColors.orange` | `text-orange-500` | `#F97316` |
| `completed` | 정산완료 | `AppColors.teal` *(변경 예정, 현재 slate)* | `text-teal-500` | `#14B8A6` |

---

## 6. 이벤트 타입 아이콘/라벨

| event_type (DB) | 앱 이모지 | 웹 아이콘 (lucide) | 한글 라벨 | 웹 색상 |
|-----------------|----------|-------------------|----------|--------|
| `GOAL` | ⚽ | `Goal` | 골 | `text-red-500` |
| `DEFENSE` | 🛡️ | `Shield` | 수비 | `text-green-500` |
| `TACKLE` | 🦵 | `Shield` | 태클 | `text-violet-500` |
| `INTERCEPTION` | 🖐️ | `Shield` | 인터셉트 | `text-cyan-500` |
| `CLEARANCE` | 🧹 | `Shield` | 클리어런스 | `text-amber-500` |
| `SAVE` | 🧤 | `Shield` | 선방 | `text-yellow-500` |
| `KEY_PASS` | 🎯 | `Zap` | 키패스 | `text-pink-500` |
| `DRIBBLE` | 💨 | `Zap` | 돌파 | `text-teal-500` |
| `SHOT_ON` | 🥅 | `Goal` | 유효슈팅 | `text-rose-500` |
| `SHOT_OFF` | 💫 | `Goal` | 무효슈팅 | `text-slate-500` |

---

## 7. 파일 위치 참조

| 역할 | Flutter | Web |
|------|---------|-----|
| **컬러 정의** | `app/lib/theme/app_colors.dart` | `web/src/app/globals.css` |
| **테마 프리셋** | `app/lib/theme/app_theme.dart` *(신규)* | `web/tailwind.config.ts` |
| **공용 위젯** | `app/lib/widgets/` | `web/src/components/ui/` |
| **SnackBar 헬퍼** | `app/lib/utils/snackbar_helper.dart` *(신규)* | sonner `<Toaster />` |
| **스켈레톤** | `app/lib/widgets/skeleton.dart` *(신규)* | `web/src/components/ui/skeleton.tsx` *(신규)* |
| **Empty State** | `app/lib/widgets/empty_state.dart` *(신규)* | 인라인 패턴 (이미 존재) |

---

## 변경 이력

| 날짜 | 변경 |
|------|------|
| 2026-03-26 | 초기 작성 (Phase 1 디자인 품질 개선) |
