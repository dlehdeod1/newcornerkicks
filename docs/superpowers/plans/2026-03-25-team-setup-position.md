# 수동 팀 편성 + 포지션 분류 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 선수를 직접 팀에 배치하는 수동 편성 기능 추가 + futsalDna 기반 포지션 태그를 선수 리스트/팀 편성에 표시

**Architecture:** API의 기존 `POST /sessions/:id/teams/manual` + `futsalDna.ts` 재활용. GET /players 응답에 futsalDna 추가. Flutter 앱에 수동 편성 UI + 포지션 태그 표시.

**Tech Stack:** Hono API (TypeScript), Flutter (Dart), D1 SQLite

**Spec:** `docs/superpowers/specs/2026-03-25-team-setup-position-design.md`

---

### Task 1: API — GET /players 응답에 futsalDna 추가

**Files:**
- Modify: `api/src/routes/players.ts` (GET / 핸들러, ~라인 66-72)

- [ ] **Step 1: players.ts GET / 수정 — futsalDna 포함**

`playersWithRatingStatus` 매핑에 `getFutsalDNA` 호출 추가. 이미 import 되어 있음.

```typescript
// 기존 코드 (라인 66-72):
const playersWithRatingStatus = players.results.map((player: any) => ({
  ...player,
  has_my_rating: myRatingsMap.has(player.id),
  my_rating: myRatingsMap.get(player.id) || null,
}))

// 변경 후:
const playersWithRatingStatus = players.results.map((player: any) => ({
  ...player,
  has_my_rating: myRatingsMap.has(player.id),
  my_rating: myRatingsMap.get(player.id) || null,
  futsal_dna: getFutsalDNA(player),
}))
```

- [ ] **Step 2: 배포 + 확인**

```bash
npx wrangler deploy
# GET /players 응답에 futsal_dna 필드 포함 확인
```

- [ ] **Step 3: 커밋**

```bash
git add api/src/routes/players.ts
git commit -m "feat: GET /players 응답에 futsal_dna 추가"
```

---

### Task 2: Flutter — api_service에 수동 팀 생성 메서드 추가

**Files:**
- Modify: `app/lib/services/api_service.dart`

- [ ] **Step 1: createTeamsManual 메서드 추가**

기존 `createTeams` 메서드 아래에 추가:

```dart
Future<dynamic> createTeamsManual(int sessionId, List<Map<String, dynamic>> teams, String token) =>
    request('/sessions/$sessionId/teams/manual', method: 'POST', body: {'teams': teams}, token: token);
```

- [ ] **Step 2: flutter analyze 확인**

```bash
flutter analyze --no-fatal-infos
```

- [ ] **Step 3: 커밋**

```bash
git add app/lib/services/api_service.dart
git commit -m "feat: createTeamsManual API 메서드 추가"
```

---

### Task 3: Flutter — 포지션 유틸 + 태그 위젯

**Files:**
- Create: `app/lib/utils/futsal_dna.dart`

- [ ] **Step 1: futsalDna Dart 유틸 생성**

API에서 `futsal_dna`가 오면 그대로 사용하되, 로컬 폴백용으로도 계산 가능하게.

```dart
// app/lib/utils/futsal_dna.dart

class FutsalDna {
  final String type;
  final String emoji;
  const FutsalDna(this.type, this.emoji);

  /// API 응답의 futsal_dna 맵에서 생성
  static FutsalDna? fromMap(dynamic map) {
    if (map == null) return null;
    final type = map['type'];
    final emoji = map['emoji'];
    if (type == null) return null;
    return FutsalDna(type.toString(), emoji?.toString() ?? '');
  }

  /// 능력치에서 직접 계산 (API futsal_dna 없을 때 폴백)
  static FutsalDna? fromStats(Map<String, dynamic> player) {
    double s(String key) => ((player[key] ?? 75) as num).toDouble();

    // 기본값(75) 전부면 미분류
    final stats = ['shooting','offball_run','ball_keeping','passing','linkup','intercept','marking','stamina','speed','physical'];
    if (stats.every((k) => s(k) == 75)) return null;

    final attack = (s('shooting') * 1.5 + s('offball_run') + s('ball_keeping')) / 3.5;
    final playmaking = (s('passing') * 1.5 + s('linkup') * 1.5) / 3;
    final defense = (s('intercept') * 1.5 + s('marking') * 1.5 + s('physical')) / 4;
    final engine = (s('stamina') * 1.5 + s('speed') * 1.5) / 3;

    final values = [attack, playmaking, defense, engine];
    final max = values.reduce((a, b) => a > b ? a : b);
    final min = values.reduce((a, b) => a < b ? a : b);

    if (max - min < max * 0.1) return const FutsalDna('올라운더', '⚡');
    if (max == attack) return const FutsalDna('스트라이커', '🎯');
    if (max == playmaking) return const FutsalDna('플레이메이커', '🎩');
    if (max == defense) return const FutsalDna('수비수', '🛡️');
    if (max == engine) return const FutsalDna('엔진', '🏃');
    return const FutsalDna('올라운더', '⚡');
  }

  /// API 응답 우선, 없으면 로컬 계산
  static FutsalDna? fromPlayer(Map<String, dynamic> player) {
    return fromMap(player['futsal_dna']) ?? fromStats(player);
  }
}
```

- [ ] **Step 2: flutter analyze**
- [ ] **Step 3: 커밋**

---

### Task 4: Flutter — abilities_screen에 포지션 태그 표시

**Files:**
- Modify: `app/lib/screens/abilities_screen.dart`

- [ ] **Step 1: import 추가 + _playerCard에 포지션 태그**

```dart
import '../utils/futsal_dna.dart';
```

`_playerCard` 메서드의 `name` 텍스트 뒤에 포지션 태그 추가:

```dart
// 기존: Text(name.toString(), style: ...)
// 변경 (Row로 감싸서 태그 추가):
Row(
  children: [
    Text(name.toString(), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
    if (dna != null) ...[
      const SizedBox(width: 6),
      Text('${dna.emoji} ${dna.type}', style: TextStyle(fontSize: 11, color: color.withAlpha(179))),
    ],
  ],
)
```

`dna`는 카드 빌드 시 `FutsalDna.fromPlayer(p)`로 계산.

- [ ] **Step 2: flutter analyze**
- [ ] **Step 3: 커밋**

---

### Task 5: Flutter — 수동 팀 편성 UI

**Files:**
- Modify: `app/lib/screens/admin_team_setup_screen.dart`

이 태스크가 가장 크다. `admin_team_setup_screen.dart`에 수동 편성 모드를 추가한다. 파일에 `${}`가 포함되어 있으므로 **Write 도구로 전체 재작성** 필요.

- [ ] **Step 1: 상태 변수 추가**

기존 상태에 수동 편성용 변수 추가:

```dart
bool _manualMode = false;              // 수동 편성 모드 진입 여부
int _teamCount = 2;                     // 팀 수 (2 또는 3)
List<String> _teamColors = ['yellow', 'orange', 'white'];  // 조끼색
List<String> _teamNames = ['A팀', 'B팀', 'C팀'];
// 팀 배정: 인덱스 = 팀 번호, 값 = 선수 ID 또는 용병 이름(g_prefix)
List<Set<String>> _teamAssignments = [{}, {}, {}];
```

- [ ] **Step 2: _buildBottomBar에 수동 편성 버튼 추가**

기존 하단 바에 "자동 편성" 옆에 "수동 편성" 버튼:

```dart
// 버튼 영역 (Row)
Row(
  children: [
    Expanded(
      child: ElevatedButton(
        onPressed: () => _assignTeams(),
        child: Text('자동 편성'),
      ),
    ),
    const SizedBox(width: 8),
    Expanded(
      child: OutlinedButton(
        onPressed: _totalCount >= 4 ? _enterManualMode : null,
        child: Text('수동 편성'),
      ),
    ),
  ],
)
```

- [ ] **Step 3: _enterManualMode 메서드**

```dart
void _enterManualMode() {
  setState(() {
    _manualMode = true;
    _teamAssignments = List.generate(_teamCount, (_) => <String>{});
  });
}
```

- [ ] **Step 4: _buildManualMode 위젯 구현**

수동 편성 화면 구조:
```
[팀 수 토글: 2팀/3팀]
[미배정 선수 Wrap 칩]
[A팀 카드 - 종합/포지션 분포]
[B팀 카드 - 종합/포지션 분포]
[C팀 카드 (3팀일 때만)]
[편성 완료 버튼]
```

핵심 인터랙션:
- **미배정 칩 탭** → showModalBottomSheet로 팀 선택 (A/B/C)
- **배정된 칩 탭** → showModalBottomSheet로 이동(다른 팀) 또는 미배정으로 복귀
- 각 팀 카드에 **종합 능력치 평균** + **포지션 분포** (🎯2 🛡️1 등) 실시간 표시

```dart
Widget _buildManualMode() {
  // 선택된 전체 키: 정규 선수 'p_$id', 용병 'g_$name'
  final allKeys = <String>[
    ..._selected.map((id) => 'p_$id'),
    ..._guests.map((name) => 'g_$name'),
  ];
  final assigned = _teamAssignments.expand((s) => s).toSet();
  final unassigned = allKeys.where((k) => !assigned.contains(k)).toList();

  return Column(children: [
    // 팀 수 토글
    _buildTeamCountToggle(),
    // 미배정 선수
    _buildUnassignedChips(unassigned),
    // 각 팀 카드
    Expanded(child: ListView(children: [
      for (int i = 0; i < _teamCount; i++)
        _buildManualTeamCard(i),
    ])),
    // 완료 버튼
    _buildManualSubmitButton(unassigned.isEmpty),
  ]);
}
```

- [ ] **Step 5: _showAssignSheet — 선수 배치/이동 바텀시트**

```dart
void _showAssignSheet(String playerKey, {int? currentTeam}) {
  showModalBottomSheet(
    context: context,
    backgroundColor: AppColors.bgCard,
    builder: (ctx) => Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (int i = 0; i < _teamCount; i++)
          if (i != currentTeam)
            ListTile(
              leading: Icon(Icons.circle, color: AppColors.fromVestColor(_teamColors[i])),
              title: Text(_teamNames[i]),
              onTap: () {
                setState(() {
                  // 기존 팀에서 제거
                  if (currentTeam != null) _teamAssignments[currentTeam].remove(playerKey);
                  // 새 팀에 추가
                  _teamAssignments[i].add(playerKey);
                });
                Navigator.pop(ctx);
              },
            ),
        if (currentTeam != null)
          ListTile(
            leading: const Icon(Icons.undo, color: Colors.white54),
            title: const Text('미배정으로'),
            onTap: () {
              setState(() => _teamAssignments[currentTeam].remove(playerKey));
              Navigator.pop(ctx);
            },
          ),
      ],
    ),
  );
}
```

- [ ] **Step 6: _buildManualTeamCard — 팀 카드 (포지션 분포 + 종합)**

각 팀 카드에 표시:
- 조끼색 + 팀 이름 + 멤버 수
- 배정된 선수 칩 (탭하면 이동/미배정 시트)
- 종합 능력치 평균
- 포지션 분포 (🎯2 🛡️1 ⚡1)

```dart
Widget _buildManualTeamCard(int teamIdx) {
  final members = _teamAssignments[teamIdx];
  final color = AppColors.fromVestColor(_teamColors[teamIdx]);

  // 종합 능력치 + 포지션 분포 계산
  double totalOverall = 0;
  final dnaCounts = <String, int>{};
  int playerCount = 0;

  for (final key in members) {
    if (key.startsWith('p_')) {
      final pid = int.parse(key.substring(2));
      final p = _allPlayers.firstWhere((x) => x['id'] == pid, orElse: () => {});
      if (p.isNotEmpty) {
        totalOverall += _calcOverall(p);
        final dna = FutsalDna.fromPlayer(p);
        if (dna != null) dnaCounts[dna.emoji] = (dnaCounts[dna.emoji] ?? 0) + 1;
        playerCount++;
      }
    } else {
      // 용병은 기본 75
      totalOverall += 75;
      playerCount++;
    }
  }
  final avgOverall = playerCount > 0 ? totalOverall / playerCount : 0;

  return Container(
    margin: EdgeInsets.fromLTRB(16, 8, 16, 0),
    padding: EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: color.withAlpha(8),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: color.withAlpha(40)),
    ),
    child: Column(children: [
      // 헤더: 조끼색 + 이름 + 멤버 수 + 종합
      Row(children: [
        Icon(Icons.circle, size: 14, color: color),
        SizedBox(width: 8),
        Text('${_teamNames[teamIdx]} (${members.length}명)'),
        Spacer(),
        Text('종합 ${avgOverall.toStringAsFixed(1)}'),
        SizedBox(width: 8),
        // 포지션 분포
        Text(dnaCounts.entries.map((e) => '${e.key}${e.value}').join(' ')),
      ]),
      SizedBox(height: 10),
      // 멤버 칩
      Wrap(spacing: 6, runSpacing: 4, children: members.map((key) {
        final name = _nameForKey(key);
        final isGuest = key.startsWith('g_');
        return GestureDetector(
          onTap: () => _showAssignSheet(key, currentTeam: teamIdx),
          child: Chip(label: Text(name), /* 스타일 */),
        );
      }).toList()),
    ]),
  );
}
```

- [ ] **Step 7: _submitManualTeams — API 호출**

```dart
Future<void> _submitManualTeams() async {
  setState(() => _assigning = true);
  final token = context.read<AuthService>().token;
  try {
    final teams = <Map<String, dynamic>>[];
    for (int i = 0; i < _teamCount; i++) {
      final members = _teamAssignments[i].map((key) {
        if (key.startsWith('p_')) {
          final pid = int.parse(key.substring(2));
          return {'playerId': pid};
        } else {
          return {'name': key.substring(2)};  // g_ 제거
        }
      }).toList();
      teams.add({
        'name': _teamNames[i],
        'color': _teamColors[i],
        'members': members,
      });
    }

    final res = await _api.createTeamsManual(widget.sessionId, teams, token!);
    if (mounted) {
      setState(() {
        _resultTeams = (res['teams'] as List?) ?? [];
        _resultMatches = (res['matches'] as List?) ?? [];
        _showResult = true;
        _manualMode = false;
        _assigning = false;
      });
    }
  } catch (e) {
    if (mounted) {
      setState(() => _assigning = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: AppColors.red),
      );
    }
  }
}
```

- [ ] **Step 8: build 메서드에 manualMode 분기 추가**

```dart
body: _showResult
    ? _buildResultStep()
    : _manualMode
        ? _buildManualMode()
        : _buildSelectStep(),
```

앱바에 수동 모드일 때 "뒤로" 버튼:
```dart
actions: _showResult ? [...] : _manualMode ? [
  TextButton(
    onPressed: () => setState(() => _manualMode = false),
    child: Text('뒤로'),
  ),
] : null,
```

- [ ] **Step 9: 선수 선택 리스트에 포지션 이모지 추가**

`_buildDirectSelect`의 각 선수 행에 포지션 이모지 표시:

```dart
// 이름 옆에:
final dna = FutsalDna.fromPlayer(player);
// 기존 이름 Text 뒤에:
if (dna != null) Text(' ${dna.emoji}', style: TextStyle(fontSize: 14))
```

- [ ] **Step 10: flutter analyze**

```bash
flutter analyze --no-fatal-infos
```

- [ ] **Step 11: 커밋**

```bash
git add app/lib/screens/admin_team_setup_screen.dart
git commit -m "feat: 수동 팀 편성 + 포지션 태그 표시"
```

---

### Task 6: 통합 테스트 + 배포

- [ ] **Step 1: flutter run으로 전체 플로우 확인**

1. 클럽 탭 → 능력치 → 포지션 태그 표시 확인
2. 세션 → 팀 편성 → 선수 선택 → "수동 편성" 탭
3. 미배정 칩 → 팀 배치 → 팀 간 이동 → 편성 완료
4. 결과 화면 정상 표시

- [ ] **Step 2: 최종 커밋 + 푸시**

```bash
git add -A
git commit -m "feat: 수동 팀 편성 + futsalDna 포지션 분류"
git push
```
