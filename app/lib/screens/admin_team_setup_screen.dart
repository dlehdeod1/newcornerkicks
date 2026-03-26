import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../utils/futsal_dna.dart';

class AdminTeamSetupScreen extends StatefulWidget {
  final int sessionId;
  final String sessionTitle;
  const AdminTeamSetupScreen({super.key, required this.sessionId, required this.sessionTitle});

  @override
  State<AdminTeamSetupScreen> createState() => _AdminTeamSetupScreenState();
}

class _AdminTeamSetupScreenState extends State<AdminTeamSetupScreen>
    with SingleTickerProviderStateMixin {
  final ApiService _api = ApiService();
  late TabController _tab;

  List<dynamic> _allPlayers = [];
  final Set<int> _selected = {};
  final _kakaoCtrl = TextEditingController();
  List<dynamic> _parsed = [];

  // 용병 목록
  final List<String> _guests = [];
  final _guestNameCtrl = TextEditingController();

  bool _loadingPlayers = true;
  bool _assigning = false;

  // 세션 정보 (ai_team_count 용)
  Map<String, dynamic>? _session;

  // 결과
  List<dynamic> _resultTeams = [];
  List<dynamic> _resultMatches = [];
  bool _showResult = false;

  // 수동 편성 모드
  bool _manualMode = false;
  int _manualTeamCount = 2;
  late List<Set<String>> _teamAssignments; // "p_id" or "g_name" keys

  static const _vestColors = ['yellow', 'blue', 'red', 'green', 'orange', 'purple', 'white', 'black'];
  static const _vestLabels = ['노랑', '파랑', '빨강', '초록', '주황', '보라', '흰색', '검정'];
  static const _vestEmojis = ['🟡', '🔵', '🔴', '🟢', '🟠', '🟣', '⚪', '⚫'];

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
    _teamAssignments = List.generate(2, (_) => <String>{});
    _loadPlayers();
    _loadSession();
  }

  @override
  void dispose() {
    _tab.dispose();
    _kakaoCtrl.dispose();
    _guestNameCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadPlayers() async {
    final token = context.read<AuthService>().token;
    try {
      final res = await _api.getPlayers(token: token);
      if (mounted) {
        setState(() {
          _allPlayers = (res['players'] as List?)?.where((p) => p['is_guest'] != 1).toList() ?? [];
          _loadingPlayers = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingPlayers = false);
    }
  }

  Future<void> _loadSession() async {
    final token = context.read<AuthService>().token;
    try {
      final res = await _api.request(
        '/sessions/${widget.sessionId}',
        method: 'GET',
        token: token,
      );
      if (mounted) {
        setState(() {
          _session = res['session'] as Map<String, dynamic>? ?? res as Map<String, dynamic>?;

          // attendance 또는 RSVP going 기반으로 사전 선택
          final attendance = (res['attendance'] as List?) ?? [];
          final rsvp = (res['rsvp'] as List?) ?? [];

          if (attendance.isNotEmpty) {
            for (final a in attendance) {
              final pid = a['player_id'];
              if (pid != null) {
                _selected.add(pid as int);
              } else {
                // 용병 (player_id 없고 guest_name 있는 경우)
                final guestName = a['guest_name'] ?? a['display_name'];
                if (guestName != null && guestName.toString().isNotEmpty && !_guests.contains(guestName.toString())) {
                  _guests.add(guestName.toString());
                }
              }
            }
          } else {
            // attendance 없으면 RSVP going 멤버의 player_id로 선택
            for (final r in rsvp) {
              if (r['status'] == 'going' && r['player_id'] != null) {
                _selected.add(r['player_id'] as int);
              }
            }
          }
        });
      }
    } catch (_) {}
  }

  String _buildTemplate() {
    final club = context.read<AuthService>().club;
    final clubName = club?['name'] ?? '우리팀';
    final sessionDate = _session?['session_date'] as String?;
    String dateStr;
    if (sessionDate != null) {
      try {
        final d = DateTime.parse(sessionDate);
        final days = ['일', '월', '화', '수', '목', '금', '토'];
        dateStr = '${d.month}/${d.day}(${days[d.weekday % 7]})';
      } catch (_) {
        dateStr = sessionDate;
      }
    } else {
      final now = DateTime.now();
      final days = ['일', '월', '화', '수', '목', '금', '토'];
      dateStr = '${now.month}/${now.day}(${days[now.weekday % 7]})';
    }
    final title = _session?['title'] as String? ?? '정기 풋살';
    final location = _session?['location'] as String?;
    final startTime = _session?['start_time'] as String?;

    final buf = StringBuffer();
    buf.writeln('\u26bd [$clubName] $dateStr $title');
    if (location != null || startTime != null) {
      buf.writeln('\ud83d\udccd ${[if (startTime != null) startTime, if (location != null) location].join(' / ')}');
    }
    buf.writeln();
    buf.writeln('참석 투표');
    buf.writeln('1.');
    buf.writeln('2.');
    buf.writeln('3.');
    return buf.toString().trimRight();
  }

  Future<void> _parseKakao() async {
    final text = _kakaoCtrl.text.trim();
    if (text.isEmpty) return;
    final token = context.read<AuthService>().token;
    try {
      final res = await _api.request(
        '/sessions/${widget.sessionId}/parse',
        method: 'POST',
        body: {'text': text},
        token: token,
      );
      final attendees = (res['attendees'] as List?) ?? [];
      setState(() {
        _parsed = attendees;
        for (final a in attendees) {
          final pid = a['playerId'];
          if (pid != null) {
            _selected.add(pid as int);
          } else if (a['isGuest'] == true || (a['name'] as String?)?.contains('용병') == true) {
            final name = a['name'] as String? ?? '용병';
            if (!_guests.contains(name)) _guests.add(name);
          }
        }
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: AppColors.red),
        );
      }
    }
  }

  void _addGuest() {
    final name = _guestNameCtrl.text.trim();
    if (name.isEmpty) return;
    setState(() {
      _guests.add(name);
      _guestNameCtrl.clear();
    });
  }

  int get _totalCount => _selected.length + _guests.length;

  Future<void> _assignTeams({bool useAI = false}) async {
    if (_totalCount < 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('최소 4명 이상 선택해주세요'), backgroundColor: Colors.orange),
      );
      return;
    }
    setState(() => _assigning = true);
    final token = context.read<AuthService>().token;
    try {
      // 등록 선수 + 용병 합쳐서 전송
      final attendees = <Map<String, dynamic>>[
        ..._selected.map((pid) => {'playerId': pid}),
        ..._guests.map((name) => {'guestName': name}),
      ];
      final res = await _api.createTeams(widget.sessionId, attendees, token!, useAI: useAI);

      if (mounted) {
        if (res['limitReached'] == true) {
          setState(() => _assigning = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(res['message'] as String? ?? 'AI 팀 편성 횟수를 모두 사용했습니다.'),
              backgroundColor: Colors.orange,
            ),
          );
          return;
        }
        if (res['locked'] == true) {
          setState(() => _assigning = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(res['message'] as String? ?? 'PRO 플랜으로 업그레이드하면 AI 팀 편성을 이용할 수 있습니다.'),
              backgroundColor: Colors.deepPurple,
            ),
          );
          return;
        }

        setState(() {
          _resultTeams = (res['teams'] as List?) ?? [];
          _resultMatches = (res['matches'] as List?) ?? [];
          _showResult = true;
          _assigning = false;
          if (res['ai_team_count'] != null && _session != null) {
            _session = Map<String, dynamic>.from(_session!)
              ..['ai_team_count'] = res['ai_team_count'];
          }
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

  // ── 수동 편성 helpers ──────────────────────────────
  String _playerKey(int id) => 'p_$id';
  String _guestKey(String name) => 'g_$name';

  int? _playerIdFromKey(String key) => key.startsWith('p_') ? int.tryParse(key.substring(2)) : null;
  String? _guestNameFromKey(String key) => key.startsWith('g_') ? key.substring(2) : null;

  int? _findTeamOf(String key) {
    for (int i = 0; i < _teamAssignments.length; i++) {
      if (_teamAssignments[i].contains(key)) return i;
    }
    return null;
  }

  List<String> get _unassignedKeys {
    final assigned = <String>{};
    for (final t in _teamAssignments) {
      assigned.addAll(t);
    }
    final all = <String>[
      ..._selected.map(_playerKey),
      ..._guests.map(_guestKey),
    ];
    return all.where((k) => !assigned.contains(k)).toList();
  }

  String _nameForKey(String key) {
    final pid = _playerIdFromKey(key);
    if (pid != null) {
      final p = _allPlayers.firstWhere((p) => p['id'] == pid, orElse: () => null);
      return (p?['name'] as String?) ?? '선수#$pid';
    }
    return _guestNameFromKey(key) ?? '?';
  }

  FutsalDna? _dnaForKey(String key) {
    final pid = _playerIdFromKey(key);
    if (pid != null) {
      final p = _allPlayers.firstWhere((p) => p['id'] == pid, orElse: () => null);
      if (p != null) {
        return FutsalDna.fromPlayer(p is Map<String, dynamic> ? p : Map<String, dynamic>.from(p as Map));
      }
    }
    return null;
  }

  double _overallForKey(String key) {
    final pid = _playerIdFromKey(key);
    if (pid != null) {
      final p = _allPlayers.firstWhere((p) => p['id'] == pid, orElse: () => null);
      if (p != null) {
        const statKeys = ['shooting', 'offball_run', 'ball_keeping', 'passing', 'linkup', 'intercept', 'marking', 'stamina', 'speed', 'physical'];
        double sum = 0;
        for (final k in statKeys) {
          sum += ((p[k] ?? 75) as num).toDouble();
        }
        return sum / statKeys.length;
      }
    }
    return 75.0; // 용병 기본
  }

  double _teamAvgOverall(int teamIdx) {
    if (_teamAssignments[teamIdx].isEmpty) return 0;
    double sum = 0;
    for (final key in _teamAssignments[teamIdx]) {
      sum += _overallForKey(key);
    }
    return sum / _teamAssignments[teamIdx].length;
  }

  void _enterManualMode() {
    setState(() {
      _manualMode = true;
      _manualTeamCount = 2;
      _teamAssignments = List.generate(2, (_) => <String>{});
    });
  }

  void _setManualTeamCount(int count) {
    setState(() {
      _manualTeamCount = count;
      // 기존 팀 유지, 줄어들면 초과 팀 멤버를 해제
      if (count < _teamAssignments.length) {
        _teamAssignments = _teamAssignments.sublist(0, count);
      } else {
        while (_teamAssignments.length < count) {
          _teamAssignments.add(<String>{});
        }
      }
    });
  }

  void _showAssignSheet(String key) {
    final currentTeam = _findTeamOf(key);
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgCard,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_nameForKey(key), style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text(
                currentTeam != null ? '현재: ${_vestLabels[currentTeam]}팀' : '미배정',
                style: TextStyle(color: AppColors.textHint, fontSize: 12),
              ),
              const SizedBox(height: 16),
              // 팀 선택 버튼들
              ...List.generate(_manualTeamCount, (i) {
                final isCurrentTeam = currentTeam == i;
                final color = AppColors.fromVestColor(_vestColors[i]);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: isCurrentTeam ? null : () {
                        setState(() {
                          // 현재 팀에서 제거
                          if (currentTeam != null) _teamAssignments[currentTeam].remove(key);
                          // 새 팀에 추가
                          _teamAssignments[i].add(key);
                        });
                        Navigator.pop(ctx);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isCurrentTeam ? color.withAlpha(10) : color.withAlpha(30),
                        foregroundColor: color,
                        disabledBackgroundColor: color.withAlpha(10),
                        disabledForegroundColor: color.withAlpha(100),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        elevation: 0,
                      ),
                      child: Text(
                        '${_vestEmojis[i]} ${_vestLabels[i]}팀${isCurrentTeam ? ' (현재)' : ''}',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                );
              }),
              // 미배정으로 되돌리기
              if (currentTeam != null)
                SizedBox(
                  width: double.infinity,
                  child: TextButton(
                    onPressed: () {
                      setState(() => _teamAssignments[currentTeam].remove(key));
                      Navigator.pop(ctx);
                    },
                    child: Text('미배정으로', style: TextStyle(color: AppColors.textHint, fontSize: 13)),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submitManualTeams() async {
    // 검증: 모든 팀에 최소 1명
    for (int i = 0; i < _manualTeamCount; i++) {
      if (_teamAssignments[i].isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${_vestLabels[i]}팀에 최소 1명을 배정해주세요'), backgroundColor: Colors.orange),
        );
        return;
      }
    }

    setState(() => _assigning = true);
    final token = context.read<AuthService>().token;

    try {
      final teams = List.generate(_manualTeamCount, (i) {
        final members = _teamAssignments[i].map((key) {
          final pid = _playerIdFromKey(key);
          if (pid != null) return {'playerId': pid};
          return {'name': _guestNameFromKey(key) ?? '용병'};
        }).toList();

        return {
          'name': '${_vestLabels[i]}팀',
          'color': _vestColors[i],
          'members': members,
        };
      });

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: AppColors.bgBase,
        foregroundColor: Colors.white,
        elevation: 0,
        title: Text(
          _showResult ? '팀 배정 결과' : _manualMode ? '수동 팀 편성' : '출석 / 팀 구성',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        actions: _showResult
            ? [
                TextButton(
                  onPressed: () => setState(() {
                    _showResult = false;
                    _resultTeams = [];
                  }),
                  child: const Text('다시', style: TextStyle(color: Colors.white54, fontSize: 14)),
                ),
              ]
            : _manualMode
                ? [
                    TextButton(
                      onPressed: () => setState(() => _manualMode = false),
                      child: const Text('돌아가기', style: TextStyle(color: Colors.white54, fontSize: 14)),
                    ),
                  ]
                : null,
      ),
      body: _showResult
          ? _buildResultStep()
          : _manualMode
              ? _buildManualStep()
              : _buildSelectStep(),
    );
  }

  // ── 선택 단계 ─────────────────────────────────────
  Widget _buildSelectStep() {
    return Column(
      children: [
        // 탭
        Container(
          margin: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: AppColors.surfaceBorder,
            borderRadius: BorderRadius.circular(12),
          ),
          child: TabBar(
            controller: _tab,
            indicator: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(9)),
            indicatorSize: TabBarIndicatorSize.tab,
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white38,
            labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            dividerColor: Colors.transparent,
            tabs: const [Tab(text: '직접 선택'), Tab(text: '카톡 파싱')],
          ),
        ),
        // 선택 카운트 + 용병 추가
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Text(
                '$_totalCount명 선택 (선수 ${_selected.length} + 용병 ${_guests.length})',
                style: TextStyle(
                  color: _totalCount >= 4 ? AppColors.primary : AppColors.textHint,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              if (_allPlayers.isNotEmpty && _tab.index == 0)
                GestureDetector(
                  onTap: () => setState(() {
                    if (_selected.length == _allPlayers.length) {
                      _selected.clear();
                    } else {
                      _selected.addAll(_allPlayers.map((p) => p['id'] as int));
                    }
                  }),
                  child: Text(
                    _selected.length == _allPlayers.length ? '전체 해제' : '전체 선택',
                    style: TextStyle(color: AppColors.textHint, fontSize: 12),
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _tab,
            children: [_buildDirectSelect(), _buildKakaoParser()],
          ),
        ),
        // 용병 추가 바
        _buildGuestBar(),
        _buildBottomBar(),
      ],
    );
  }

  Widget _buildGuestBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 용병 입력
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 40,
                  child: TextField(
                    controller: _guestNameCtrl,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: '용병 이름 입력',
                      hintStyle: TextStyle(color: AppColors.iconInactive, fontSize: 13),
                      filled: true,
                      fillColor: AppColors.surfaceBorder,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                    ),
                    onSubmitted: (_) => _addGuest(),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 40,
                child: ElevatedButton(
                  onPressed: _addGuest,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.amber.withAlpha(30),
                    foregroundColor: AppColors.amber,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                  ),
                  child: const Text('+ 용병', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ),
          // 용병 목록 칩
          if (_guests.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: _guests.asMap().entries.map((entry) {
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppColors.amber.withAlpha(20),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.amber.withAlpha(51)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(entry.value, style: const TextStyle(fontSize: 12, color: AppColors.amber, fontWeight: FontWeight.w500)),
                      const SizedBox(width: 4),
                      GestureDetector(
                        onTap: () => setState(() => _guests.removeAt(entry.key)),
                        child: Icon(Icons.close, size: 14, color: AppColors.amber.withAlpha(128)),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildDirectSelect() {
    if (_loadingPlayers) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }
    if (_allPlayers.isEmpty) {
      return Center(
        child: Text('등록된 선수가 없습니다', style: TextStyle(color: AppColors.iconInactive)),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      itemCount: _allPlayers.length,
      itemBuilder: (ctx, i) {
        final p = _allPlayers[i];
        final pid = p['id'] as int;
        final checked = _selected.contains(pid);
        final dna = FutsalDna.fromPlayer(p is Map<String, dynamic> ? p : Map<String, dynamic>.from(p as Map));
        return GestureDetector(
          onTap: () => setState(() => checked ? _selected.remove(pid) : _selected.add(pid)),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            margin: const EdgeInsets.only(bottom: 6),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            decoration: BoxDecoration(
              color: checked ? AppColors.primary.withAlpha(20) : AppColors.surfaceBorder,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: checked ? AppColors.primary.withAlpha(77) : AppColors.surfaceTint,
              ),
            ),
            child: Row(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                    color: checked ? AppColors.primary : Colors.transparent,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: checked ? AppColors.primary : Colors.white38),
                  ),
                  child: checked ? const Icon(Icons.check, size: 14, color: Colors.white) : null,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Row(
                    children: [
                      Flexible(
                        child: Text(
                          p['name'] as String? ?? '',
                          style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (dna != null) ...[
                        const SizedBox(width: 6),
                        Text(dna.emoji, style: const TextStyle(fontSize: 12)),
                      ],
                    ],
                  ),
                ),
                if (p['nickname'] != null && p['nickname'] != p['name'])
                  Text(
                    p['nickname'] as String,
                    style: TextStyle(color: AppColors.iconInactive, fontSize: 12),
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildKakaoParser() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 템플릿 복사 버튼
          GestureDetector(
            onTap: () {
              Clipboard.setData(ClipboardData(text: _buildTemplate()));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('투표 템플릿이 복사됐습니다'),
                  backgroundColor: AppColors.primary,
                  duration: Duration(seconds: 2),
                ),
              );
            },
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
              decoration: BoxDecoration(
                color: AppColors.primary.withAlpha(20),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.primary.withAlpha(51)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.copy_outlined, size: 16, color: AppColors.primary),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      '투표 템플릿 복사',
                      style: TextStyle(color: AppColors.primary, fontSize: 13, fontWeight: FontWeight.w600),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text('탭하면 복사', style: TextStyle(color: AppColors.iconInactive, fontSize: 11)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text('투표 결과 붙여넣기', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
          const SizedBox(height: 6),
          Expanded(
            flex: 3,
            child: TextField(
              controller: _kakaoCtrl,
              maxLines: null,
              expands: true,
              textAlignVertical: TextAlignVertical.top,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                hintText: '카톡 채팅 내용을 붙여넣어 주세요',
                hintStyle: TextStyle(color: AppColors.iconInactive, fontSize: 12),
                filled: true,
                fillColor: AppColors.surfaceBorder,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                ),
                contentPadding: const EdgeInsets.all(14),
              ),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: _parseKakao,
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: AppColors.surfaceHighlight),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(vertical: 11),
              ),
              child: const Text('파싱하기', style: TextStyle(color: Colors.white, fontSize: 14)),
            ),
          ),
          if (_parsed.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surfaceBorder,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '매칭: ${_parsed.where((a) => a['playerId'] != null).length}/${_parsed.length}명',
                    style: const TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: _parsed.map((a) {
                      final matched = a['playerId'] != null;
                      final isGuest = a['isGuest'] == true;
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: matched
                              ? AppColors.primary.withAlpha(26)
                              : isGuest
                                  ? AppColors.amber.withAlpha(26)
                                  : Colors.orange.withAlpha(26),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          a['name'] as String? ?? '?',
                          style: TextStyle(
                            fontSize: 11,
                            color: matched ? AppColors.primary : isGuest ? AppColors.amber : Colors.orange,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      );
                    }).toList(),
                  ),
                  if (_parsed.any((a) => a['playerId'] == null && a['isGuest'] != true)) ...[
                    const SizedBox(height: 6),
                    Text(
                      '주황색: 등록되지 않은 이름 (선수 등록 후 재시도)',
                      style: TextStyle(color: Colors.orange.withAlpha(179), fontSize: 10),
                    ),
                  ],
                  if (_parsed.any((a) => a['isGuest'] == true)) ...[
                    const SizedBox(height: 4),
                    Text(
                      '노란색: 용병 (자동 추가됨)',
                      style: TextStyle(color: AppColors.amber.withAlpha(179), fontSize: 10),
                    ),
                  ],
                ],
              ),
            ),
          ],
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  void _showUpgradeDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgCard,
        title: const Text('PRO 플랜 업그레이드', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'PRO 플랜으로 업그레이드하면 다음 기능을 이용할 수 있어요:',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 12),
            _upgradeFeatureRow('\u26a1', 'AI 능력치 기반 팀 균형 편성'),
            _upgradeFeatureRow('\ud83e\udd16', 'AI 세션 분석 리포트'),
            _upgradeFeatureRow('\ud83d\udcf5', '클럽 멤버 광고 제거'),
            const SizedBox(height: 12),
            const Text(
              '현재는 랜덤 팀 편성으로 진행됩니다.',
              style: TextStyle(color: Colors.white38, fontSize: 12),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('닫기', style: TextStyle(color: AppColors.textHint)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              launchUrl(
                Uri.parse('https://cornerkicks.pages.dev/upgrade'),
                mode: LaunchMode.externalApplication,
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.bgBase,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('업그레이드', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  Widget _upgradeFeatureRow(String emoji, String text) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Row(
      children: [
        Text(emoji, style: const TextStyle(fontSize: 14)),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: const TextStyle(color: Colors.white, fontSize: 13))),
      ],
    ),
  );

  Widget _buildBottomBar() {
    final auth = context.watch<AuthService>();
    final isPro = auth.isPro;
    final canAssign = _totalCount >= 4 && !_assigning;
    final aiCount = (_session?['ai_team_count'] as int?) ?? 0;
    final aiRemaining = 3 - aiCount;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!isPro)
              GestureDetector(
                onTap: _showUpgradeDialog,
                child: Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.amber.withAlpha(20),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.amber.withAlpha(51)),
                  ),
                  child: const Row(
                    children: [
                      Text('FREE', style: TextStyle(color: Colors.amber, fontSize: 10, fontWeight: FontWeight.w800)),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'PRO로 업그레이드하면 AI 팀 편성 가능',
                          style: TextStyle(color: Colors.amber, fontSize: 11),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Icon(Icons.arrow_forward_ios, size: 10, color: Colors.amber),
                    ],
                  ),
                ),
              ),
            Row(
              children: [
                // 수동 편성 버튼
                SizedBox(
                  height: 52,
                  child: OutlinedButton(
                    onPressed: canAssign ? _enterManualMode : null,
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(color: canAssign ? AppColors.iconInactive : AppColors.surfaceTint),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                    ),
                    child: const Text('\u270b', style: TextStyle(fontSize: 20)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: SizedBox(
                    height: 52,
                    child: ElevatedButton(
                      onPressed: canAssign ? () => _assignTeams(useAI: false) : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.bgBase,
                        disabledBackgroundColor: AppColors.surfaceTint,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: _assigning
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : Text(
                              _totalCount < 4
                                  ? '$_totalCount명 선택'
                                  : '\ud83c\udfb2 팀 편성  $_totalCount명',
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                              overflow: TextOverflow.ellipsis,
                            ),
                    ),
                  ),
                ),
                if (isPro) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: SizedBox(
                      height: 52,
                      child: ElevatedButton(
                        onPressed: canAssign ? () => _assignTeams(useAI: true) : null,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.deepPurple,
                          foregroundColor: Colors.white,
                          disabledBackgroundColor: AppColors.surfaceTint,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        child: _assigning
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Text(
                                    '\u26a1 AI 팀 편성',
                                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  Text(
                                    '($aiRemaining회 남음)',
                                    style: TextStyle(fontSize: 10, color: AppColors.textSecondary),
                                  ),
                                ],
                              ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ── 수동 편성 단계 ─────────────────────────────────
  Widget _buildManualStep() {
    final unassigned = _unassignedKeys;
    int totalAssigned = 0;
    for (final t in _teamAssignments) {
      totalAssigned += t.length;
    }

    return Column(
      children: [
        // 팀 수 토글
        Container(
          margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: AppColors.surfaceBorder,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: List.generate(3, (i) {
              final count = i + 2;
              final isSelected = _manualTeamCount == count;
              return Expanded(
                child: GestureDetector(
                  onTap: () => _setManualTeamCount(count),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: isSelected ? AppColors.primary : Colors.transparent,
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: Text(
                      '$count팀',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: isSelected ? Colors.white : Colors.white54,
                        fontSize: 13,
                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.normal,
                      ),
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
        // 진행 상태
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Row(
            children: [
              Text(
                '배정: $totalAssigned / $_totalCount명',
                style: TextStyle(
                  color: totalAssigned == _totalCount ? AppColors.primary : AppColors.textHint,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              if (unassigned.isNotEmpty)
                Text(
                  '미배정 ${unassigned.length}명',
                  style: TextStyle(color: Colors.orange.withAlpha(179), fontSize: 12),
                ),
            ],
          ),
        ),
        // 팀 카드들 + 미배정
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            children: [
              // 미배정 영역
              if (unassigned.isNotEmpty) ...[
                Text('미배정', style: TextStyle(color: AppColors.textHint, fontSize: 12, fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: unassigned.map((key) => _buildPlayerChip(key, null)).toList(),
                ),
                const SizedBox(height: 16),
              ],
              // 각 팀
              ...List.generate(_manualTeamCount, (i) => _buildManualTeamCard(i)),
            ],
          ),
        ),
        // 확정 버튼
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            child: SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: (!_assigning && totalAssigned > 0) ? _submitManualTeams : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.bgBase,
                  disabledBackgroundColor: AppColors.surfaceTint,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: _assigning
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : Text(
                        unassigned.isEmpty
                            ? '\u2705 수동 편성 확정'
                            : '\u2705 수동 편성 확정 (미배정 ${unassigned.length}명)',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                        overflow: TextOverflow.ellipsis,
                      ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildManualTeamCard(int teamIdx) {
    final color = AppColors.fromVestColor(_vestColors[teamIdx]);
    final members = _teamAssignments[teamIdx];
    final avg = _teamAvgOverall(teamIdx);

    // 포지션 분포
    final posMap = <String, int>{};
    for (final key in members) {
      final dna = _dnaForKey(key);
      final label = dna?.type ?? '미분류';
      posMap[label] = (posMap[label] ?? 0) + 1;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withAlpha(13),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withAlpha(51)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(_vestEmojis[teamIdx], style: const TextStyle(fontSize: 18)),
              const SizedBox(width: 6),
              Text(
                '${_vestLabels[teamIdx]}팀',
                style: TextStyle(color: color, fontSize: 14, fontWeight: FontWeight.bold),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: color.withAlpha(26),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text('${members.length}명', style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
              ),
              const Spacer(),
              if (members.isNotEmpty)
                Text(
                  'OVR ${avg.toStringAsFixed(1)}',
                  style: TextStyle(color: color.withAlpha(179), fontSize: 12, fontWeight: FontWeight.w600),
                ),
            ],
          ),
          if (posMap.isNotEmpty) ...[
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              children: posMap.entries.map((e) => Text(
                '${e.key} ${e.value}',
                style: TextStyle(color: AppColors.iconInactive, fontSize: 10),
              )).toList(),
            ),
          ],
          const SizedBox(height: 10),
          if (members.isNotEmpty)
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: members.map((key) => _buildPlayerChip(key, teamIdx)).toList(),
            )
          else
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text('탭하여 선수를 배정하세요', style: TextStyle(color: AppColors.surfaceHighlight, fontSize: 12)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildPlayerChip(String key, int? teamIdx) {
    final name = _nameForKey(key);
    final dna = _dnaForKey(key);
    final isGuest = key.startsWith('g_');
    final color = teamIdx != null ? AppColors.fromVestColor(_vestColors[teamIdx]) : Colors.white;

    return GestureDetector(
      onTap: () => _showAssignSheet(key),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isGuest
              ? AppColors.amber.withAlpha(20)
              : teamIdx != null
                  ? color.withAlpha(20)
                  : AppColors.surfaceBorder,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isGuest
                ? AppColors.amber.withAlpha(51)
                : teamIdx != null
                    ? color.withAlpha(40)
                    : AppColors.surfaceHighlight,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (dna != null) ...[
              Text(dna.emoji, style: const TextStyle(fontSize: 11)),
              const SizedBox(width: 3),
            ],
            Text(
              name,
              style: TextStyle(
                fontSize: 12,
                color: isGuest ? AppColors.amber : Colors.white,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── 결과 단계 ─────────────────────────────────────
  Widget _buildResultStep() {
    final teamColors = _resultTeams.map((t) => AppColors.fromVestColor(t['vest_color'] as String?)).toList();
    final hasTwoTeams = _resultTeams.length == 2;

    return Column(
      children: [
        // 통계 바
        Container(
          margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.surfaceBorder,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _statItem('총 인원', '$_totalCount명'),
              Container(width: 1, height: 28, color: AppColors.surfaceHighlight),
              _statItem('팀 수', '${_resultTeams.length}팀'),
              Container(width: 1, height: 28, color: AppColors.surfaceHighlight),
              _statItem('경기 수', '${_resultMatches.length}경기'),
            ],
          ),
        ),
        // 팀 목록
        Expanded(
          child: hasTwoTeams
              ? _buildTwoTeamView(teamColors)
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  itemCount: _resultTeams.length,
                  itemBuilder: (ctx, i) => _buildTeamCard(_resultTeams[i], i, teamColors),
                ),
        ),
        // 확정 버튼
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context, true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.bgBase,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: const Text(
                  '팀 편성 완료',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTwoTeamView(List<Color> teamColors) {
    final team1 = _resultTeams[0];
    final team2 = _resultTeams[1];
    final color1 = teamColors[0];
    final color2 = teamColors[1];
    final members1 = (team1['members'] as List?) ?? [];
    final members2 = (team2['members'] as List?) ?? [];

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        children: [
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: _buildTeamCard(team1, 0, teamColors)),
                const SizedBox(width: 8),
                Expanded(child: _buildTeamCard(team2, 1, teamColors)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.surfaceBorder,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.surfaceTint),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    team1['name'] as String? ?? 'A팀',
                    style: TextStyle(color: color1, fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text('VS', style: TextStyle(color: AppColors.textHint, fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
                  Text(
                    team2['name'] as String? ?? 'B팀',
                    style: TextStyle(color: color2, fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
          ),
          if (members1.isNotEmpty || members2.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surfaceBorder,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('${members1.length}명', style: TextStyle(color: color1, fontSize: 14, fontWeight: FontWeight.bold)),
                  Text(' : ', style: TextStyle(color: AppColors.textHint, fontSize: 14)),
                  Text('${members2.length}명', style: TextStyle(color: color2, fontSize: 14, fontWeight: FontWeight.bold)),
                  const SizedBox(width: 8),
                  Text(
                    members1.length == members2.length ? '균형!' : '인원 차이 있음',
                    style: TextStyle(
                      color: members1.length == members2.length ? AppColors.primary : Colors.orange,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildTeamCard(dynamic team, int i, List<Color> teamColors) {
    final color = teamColors[i % teamColors.length];
    final members = (team['members'] as List?) ?? [];
    final keyPlayer = team['key_player'] ?? team['keyPlayer'];

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withAlpha(13),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withAlpha(51)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(team['emoji'] as String? ?? '\u26bd', style: const TextStyle(fontSize: 18)),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  team['name'] as String? ?? 'Team ${i + 1}',
                  style: TextStyle(color: color, fontSize: 14, fontWeight: FontWeight.bold),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: color.withAlpha(26),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text('${members.isNotEmpty ? members.length : team['playerCount'] ?? 0}명',
                    style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (members.isNotEmpty)
            Wrap(
              spacing: 5,
              runSpacing: 5,
              children: members.map((m) {
                final name = m['name'] as String? ?? m['guest_name'] as String? ?? '?';
                final isGuest = m['isGuest'] == true;
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isGuest ? AppColors.amber.withAlpha(20) : color.withAlpha(20),
                    borderRadius: BorderRadius.circular(8),
                    border: isGuest ? Border.all(color: AppColors.amber.withAlpha(40)) : null,
                  ),
                  child: Text(
                    name,
                    style: TextStyle(color: isGuest ? AppColors.amber : Colors.white, fontSize: 12),
                    overflow: TextOverflow.ellipsis,
                  ),
                );
              }).toList(),
            )
          else
            Text('${team['playerCount'] ?? 0}명', style: TextStyle(color: AppColors.textHint, fontSize: 12)),
          if (keyPlayer != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Text('\ud83d\udd11 ', style: TextStyle(fontSize: 11)),
                Expanded(
                  child: Text(
                    keyPlayer as String,
                    style: TextStyle(color: AppColors.textHint, fontSize: 11),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _statItem(String label, String value) => Column(
        children: [
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: AppColors.textHint, fontSize: 11)),
        ],
      );
}
