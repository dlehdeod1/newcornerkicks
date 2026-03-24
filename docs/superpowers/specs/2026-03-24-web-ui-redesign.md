# Web UI Redesign Spec

## Overview

웹 앱의 3가지 핵심 영역 개선: 랭킹 페이지 리디자인, admin 사이드바 레이아웃, settings 탭 분리. 공유 컴포넌트 정리 포함.

## 1. 랭킹 페이지 리디자인

### 1.1 기본 뷰: 컴팩트 리스트 + 인라인 확장

현재 19컬럼 테이블을 **컴팩트 리스트**로 대체 (기본 뷰).

**페이지 구조:**
```
[헤더: 타이틀 + 연도 선택 + 검색]
[정렬 칩 바] — 가로 스크롤
[포디움: 상위 3명] — 기존 유지
[컴팩트 리스트]
  ├─ 행: 순위 | 이름 | 정렬기준스탯(강조) | 스탯2 | 스탯3 | 스탯4 | ▶
  ├─ 행 클릭 → 아코디언 확장 (상세 스탯)
  └─ ▶ 클릭 → /ranking/[id] 이동
[하단: "테이블 보기" 토글]
```

**정렬 칩 바:**
- 칩 목록: MVP, 득점, 도움, 공격P, (enabled_events 기반 스탯들), 경기, 승률, 평점
- 활성 칩: brand-green 배경
- 비활성 칩: slate 배경 + border
- 칩 클릭 → 해당 기준으로 정렬 + 리스트 내 첫 번째 스탯 칸이 해당 스탯으로 교체 + 강조

**리스트 행 (접힌 상태):**
- 순위 뱃지 (1/2/3위 금/은/동)
- 선수 이름 + 아바타
- 정렬 기준 스탯 (강조, 초록 배경)
- 고정 스탯 3개: 득점, 도움, 평점 (정렬 기준과 겹치면 다음 스탯으로 대체)
- ▶ 아이콘 (상세 페이지)

**인라인 확장 (아코디언):**
- 4열 그리드
- 표시 항목: 참석 경기수, 승/패/무(승률), PPM, MVP횟수
- enabled_events 기반 상세 스탯 (수비류: 태클/인터셉트/클리어런스/선방, 공격류: 키패스/돌파/유효슈팅/무효슈팅)

### 1.2 테이블 뷰 (토글)

하단 "상세 테이블 보기" 버튼으로 기존 테이블 전환.

**컬럼 자동 조절:**
- 실제 표시 컬럼 12개 미만: 전체 컬럼 표시
- 12개 이상: 핵심 컬럼만 기본 표시 + "전체 컬럼" 토글

**테이블 개선:**
- 컬럼 그룹 헤더: "공격 | 수비 | 기록"

### 1.3 PPM 공식 변경

- 기존: `goals / games`
- 변경: `(goals + assists) / games`

## 2. Admin 사이드바 레이아웃

### 2.1 레이아웃 구조

`app/(main)/admin/layout.tsx`에 사이드바 추가.

```
[기존 헤더]
├─ [사이드바 240px]          [메인 콘텐츠]
│  ├─ 대시보드              각 admin 페이지
│  ├─ 세션 관리
│  ├─ 선수 관리
│  ├─ 랭킹 관리
│  ├─ 공지 관리
│  ├─ 알림 관리
│  ├─ 회비 면제
│  ├─ 클럽 설정
│  └─ ← 홈으로
```

### 2.2 반응형

- 데스크톱 (md 이상): 고정 사이드바 + 메인 영역
- 모바일 (md 미만): 사이드바 숨김 → 햄버거 버튼 → 슬라이드 오버레이

### 2.3 admin/rankings 개선

- public 랭킹의 컴팩트 리스트 컴포넌트 재사용
- 상단에 "랭킹 새로고침" 버튼 + 마지막 갱신 시간만 추가
- 기존 별도 테이블 삭제

### 2.4 admin 대시보드 변경

- "관리 메뉴" 섹션 제거 (사이드바가 대체)
- 퀵 액션 + 통계 + 최근 세션 + 연동 대기 유지

## 3. Settings 탭 분리

### 3.1 탭 구조

```
[탭 바: 기본 정보 | 참가비 | 기록 설정 | 평점 가중치]
```

각 탭 = 별도 컴포넌트 파일:
- **기본 정보**: 클럽명, 설명, 시즌 시작월, 로고, 계좌, 클럽 삭제
- **참가비**: baseAmount, splitEnabled, splitTotal, splitRoundUp, rankDiff
- **기록 설정**: enabledEvents 토글
- **평점 가중치**: mvpWeights 입력

### 3.2 동작

- URL 쿼리에 탭 상태 반영 (`?tab=fees`)
- 탭 전환 시 미저장 변경 있으면 경고
- 각 탭이 자체 state만 관리

## 4. 공유 컴포넌트 추출

| 컴포넌트 | 경로 | 용도 |
|---|---|---|
| StatCard | components/ui/stat-card.tsx | admin, home, rankings 통합 |
| StatusBadge | components/ui/status-badge.tsx | 세션 상태 뱃지 |
| SortChips | components/ui/sort-chips.tsx | 랭킹 정렬 칩 바 |
| CompactPlayerList | components/ranking/compact-player-list.tsx | 랭킹 컴팩트 리스트 (admin에서도 재사용) |

## 변경 파일 목록

### 신규
- `web/src/app/(main)/admin/layout.tsx` — admin 사이드바 레이아웃
- `web/src/components/ui/stat-card.tsx`
- `web/src/components/ui/status-badge.tsx`
- `web/src/components/ui/sort-chips.tsx`
- `web/src/components/ranking/compact-player-list.tsx`
- `web/src/app/(main)/admin/settings/components/` — 탭별 컴포넌트 4개

### 수정
- `web/src/app/(main)/ranking/page.tsx` — 컴팩트 리스트 + 칩 정렬 + 인라인 확장
- `web/src/app/(main)/admin/page.tsx` — 관리 메뉴 섹션 제거
- `web/src/app/(main)/admin/rankings/page.tsx` — 공유 컴포넌트 사용
- `web/src/app/(main)/admin/settings/page.tsx` — 탭 분리
- `web/src/app/(main)/page.tsx` — 공유 StatCard 사용
