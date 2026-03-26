# 수동 팀 편성 + 포지션 분류 설계

## 배경

현재 Flutter 앱의 팀 편성은 **자동 밸런싱만** 지원. 관리자가 원하는 대로 선수를 팀에 배치하는 수동 편성 기능이 없다. 웹에는 카톡 파싱 + 수동 편성(`POST /sessions/:id/teams/manual`)이 있지만 앱에서 연결 안 됨. 또한 `futsalDna.ts`에 포지션 분류 로직이 있지만 선수 상세에서만 사용되고, 팀 편성이나 선수 리스트에는 표시 안 됨.

## 범위

1. **수동 팀 편성** — 관리자가 선수를 직접 팀에 배치
2. **포지션 태그** — futsalDna 기반 포지션을 선수 카드/리스트/팀 편성에 표시
3. **카톡 파싱은 다음 사이클로 미룸**

## 기존 API (수정 불필요)

| 엔드포인트 | 용도 |
|---|---|
| `POST /sessions/:id/teams` | 자동 밸런싱 (기존) |
| `POST /sessions/:id/teams/manual` | 수동 팀 생성 (웹용, 앱에서 미사용) |
| `GET /players/:id` → `futsalDna` | 포지션 분류 (개별 선수) |
| `GET /players` | 선수 목록 (futsalDna 미포함) |

## 변경 사항

### A. API 변경 (1개)

**`GET /players` 응답에 futsalDna 추가**

현재 선수 목록에는 futsalDna가 없어서 각 선수마다 상세 API를 호출해야 함. 목록 API에서 바로 계산해서 내려주면 N+1 호출 제거.

```typescript
// players.ts GET /
const playersWithDna = players.results.map((p: any) => ({
  ...p,
  futsalDna: getFutsalDNA(p),  // { type: '스트라이커', emoji: '🎯' } | null
}))
```

### B. Flutter 앱 변경 (2개 파일)

#### B1. admin_team_setup_screen.dart — 수동 편성 모드 추가

현재: `자동 편성` 버튼 1개 → 결과 확인

변경 후: **3개 모드**
1. **자동 편성** (기존) — API가 밸런싱
2. **수동 편성** (신규) — 관리자가 직접 배치
3. **AI 편성** (기존, PRO) — Gemini AI

**수동 편성 UI 플로우:**
```
선수 선택 (기존과 동일)
    ↓
"수동 편성" 버튼 탭
    ↓
팀 수 선택 (2팀/3팀) + 조끼색 선택
    ↓
수동 배치 화면:
┌─────────────────────────────┐
│ 미배정 선수 (스크롤 칩)      │
│ [홍길동 🎯] [김수비 🛡️] ... │
├─────────────────────────────┤
│ 🟡 A팀 (3/5)               │
│ [선수1] [선수2] [선수3]     │
│ 종합: 78.2  공:2 수:1       │
├─────────────────────────────┤
│ 🟠 B팀 (2/5)               │
│ [선수4] [선수5]             │
│ 종합: 75.8  공:1 수:1       │
└─────────────────────────────┘
│          [편성 완료]         │
```

**핵심 인터랙션:**
- 미배정 칩 탭 → 팀 선택 바텀시트 (A팀/B팀/C팀)
- 배정된 선수 롱프레스 → 다른 팀으로 이동 or 미배정으로 복귀
- 각 팀 카드에 실시간 종합 능력치 평균 + 포지션 분포 표시
- 미배정 선수가 0명이면 "편성 완료" 버튼 활성화

**API 호출:**
```dart
// POST /sessions/:id/teams/manual
{
  "teams": [
    {
      "name": "A팀",
      "color": "yellow",
      "members": [
        {"playerId": 1},
        {"playerId": 2},
        {"name": "용병1"}  // 게스트
      ]
    },
    {
      "name": "B팀",
      "color": "orange",
      "members": [...]
    }
  ]
}
```

#### B2. 포지션 태그 표시

**표시 위치 (3곳):**

1. **abilities_screen.dart** — 선수 카드에 이름 옆 포지션 태그
   ```
   #1  [78] 홍길동 🎯 스트라이커
   ```

2. **admin_team_setup_screen.dart** — 선수 선택 리스트 + 수동 배치 칩에 포지션 이모지
   ```
   ☑ 홍길동 🎯  ☑ 김수비 🛡️  ☑ 이엔진 🏃
   ```

3. **수동 편성 팀 카드** — 포지션 분포 요약
   ```
   🟡 A팀 | 종합 78.2 | 🎯2 🛡️1 🎩1 🏃1
   ```

### C. 포지션 분류 로직 (기존 futsalDna.ts 그대로)

| 타입 | 이모지 | 조건 |
|------|--------|------|
| 스트라이커 | 🎯 | Attack 영역 최고 |
| 플레이메이커 | 🎩 | Playmaking 영역 최고 |
| 수비수 | 🛡️ | Defense 영역 최고 |
| 엔진 | 🏃 | Engine 영역 최고 |
| 올라운더 | ⚡ | 4영역 편차 10% 이내 |

기본 능력치(75) 선수 = `null` (포지션 미분류) → UI에서 태그 안 보임.

## 수정 파일 목록

| 파일 | 변경 |
|------|------|
| `api/src/routes/players.ts` | GET / 응답에 futsalDna 추가 |
| `app/lib/services/api_service.dart` | createTeamsManual() 메서드 추가 |
| `app/lib/screens/admin_team_setup_screen.dart` | 수동 편성 모드 + 포지션 칩 |
| `app/lib/screens/abilities_screen.dart` | 포지션 태그 표시 |

## 미포함 (다음 사이클)

- 카톡 파싱 (앱 복구)
- 팀 편성 템플릿 저장/불러오기
- 드래그앤드롭 (탭으로 대체, 모바일에서 드래그는 UX 나쁨)
