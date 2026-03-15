import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import 'admin_team_setup_screen.dart';
import 'match_result_popup.dart';

class SessionDetailScreen extends StatefulWidget {
  final int sessionId;
  const SessionDetailScreen({super.key, required this.sessionId});

  @override
  State<SessionDetailScreen> createState() => _SessionDetailScreenState();
}

class _SessionDetailScreenState extends State<SessionDetailScreen> with SingleTickerProviderStateMixin {
  final ApiService _api = ApiService();
  late TabController _tabController;
  Map<String, dynamic>? _session;
  List<dynamic> _teams = [];
  List<dynamic> _matches = [];
  List<dynamic> _attendance = [];
  List<dynamic> _rsvp = [];
  bool _loading = true;

  Map<String, dynamic>? _recordingMatch;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _loadSession();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadSession() async {
    try {
      final res = await _api.getSession(widget.sessionId);
      if (mounted) {
        setState(() {
          _session = res['session'];
          _teams = (res['teams'] as List?) ?? [];
          _matches = (res['matches'] as List?) ?? [];
          _attendance = (res['attendance'] as List?) ?? [];
          _rsvp = (res['rsvp'] as List?) ?? [];
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _showStatusSheet(String? current) async {
    final auth = context.read<AuthService>();
    if (auth.token == null) return;
    final statuses = [
      {'value': 'recruiting', 'label': '모집중', 'color': const Color(0xFF34d399)},
      {'value': 'closed', 'label': '마감', 'color': const Color(0xFF3b82f6)},
      {'value': 'ended', 'label': '경기완료', 'color': const Color(0xFFf97316)},
      {'value': 'completed', 'label': '정산완료', 'color': const Color(0xFF64748b)},
    ];
    await showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1e293b),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('세션 상태 변경', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              ...statuses.map((s) {
                final isCurrent = s['value'] == current;
                final color = s['color'] as Color;
                return GestureDetector(
                  onTap: isCurrent ? null : () async {
                    Navigator.pop(ctx);
                    try {
                      await _api.request(
                        '/sessions/${widget.sessionId}',
                        method: 'PUT',
                        body: {'status': s['value']},
                        token: auth.token,
                      );
                      await _loadSession();
                    } catch (e) {
                      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(e.toString()), backgroundColor: const Color(0xFFef4444)),
                      );
                    }
                  },
                  child: Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                    decoration: BoxDecoration(
                      color: isCurrent ? color.withAlpha(26) : Colors.white.withAlpha(8),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: isCurrent ? color.withAlpha(77) : Colors.white.withAlpha(20)),
                    ),
                    child: Row(
                      children: [
                        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                        const SizedBox(width: 12),
                        Text(s['label'] as String, style: TextStyle(color: isCurrent ? color : Colors.white, fontSize: 14, fontWeight: isCurrent ? FontWeight.w600 : FontWeight.normal)),
                        if (isCurrent) ...[
                          const Spacer(),
                          Text('현재', style: TextStyle(color: color, fontSize: 12)),
                        ],
                      ],
                    ),
                  ),
                );
              }),
            ],
          ),
        ),
      ),
    );
  }

  String _dayOfWeek(String dateStr) {
    try {
      final d = DateTime.parse(dateStr);
      return ['일', '월', '화', '수', '목', '금', '토'][d.weekday % 7];
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_recordingMatch != null) {
      return _MatchRecorderPage(
        match: _recordingMatch!,
        teams: _teams,
        onClose: () {
          setState(() => _recordingMatch = null);
          _loadSession();
        },
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0f172a),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('세션 상세', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Colors.white)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF34d399)))
          : _session == null
              ? Center(child: Text('세션을 찾을 수 없습니다', style: TextStyle(color: Colors.white.withAlpha(128))))
              : Column(
                  children: [
                    _buildHeader(),
                    _buildTabs(),
                    Expanded(
                      child: TabBarView(
                        controller: _tabController,
                        children: [
                          _buildOverviewTab(),
                          _buildTeamsTab(),
                          _buildScoreboardTab(),
                          _buildStatsTab(),
                        ],
                      ),
                    ),
                  ],
                ),
    );
  }

  Widget _buildHeader() {
    final s = _session!;
    final date = s['session_date'] ?? '';
    final dow = _dayOfWeek(date);
    final title = s['title'] ?? '코너킥스 정기 풋살';
    final status = s['status'] ?? 'closed';

    Color statusColor;
    String statusLabel;
    switch (status) {
      case 'recruiting':
      case 'open':
        statusColor = const Color(0xFF34d399);
        statusLabel = '모집중';
        break;
      case 'closed':
        statusColor = const Color(0xFF3b82f6);
        statusLabel = '마감';
        break;
      case 'ended':
        statusColor = const Color(0xFFf97316);
        statusLabel = '경기완료';
        break;
      case 'completed':
        statusColor = const Color(0xFF64748b);
        statusLabel = '정산완료';
        break;
      default:
        statusColor = const Color(0xFF3b82f6);
        statusLabel = '마감';
    }

    final auth = context.read<AuthService>();
    // 참석자: attendance 우선, 없으면 RSVP going 리스트
    final goingList = _rsvp.where((r) => r['status'] == 'going').toList();
    final effectiveCount = _attendance.isNotEmpty ? _attendance.length : goingList.length;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withAlpha(26),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: statusColor.withAlpha(64)),
                ),
                child: Text(statusLabel, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: statusColor)),
              ),
              const Spacer(),
              if (auth.isAdmin && status != 'completed')
                GestureDetector(
                  onTap: () => _showStatusSheet(status),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withAlpha(10),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.white.withAlpha(26)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.edit_outlined, size: 12, color: Colors.white.withAlpha(153)),
                        const SizedBox(width: 4),
                        Text('상태 변경', style: TextStyle(fontSize: 11, color: Colors.white.withAlpha(153))),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white), overflow: TextOverflow.ellipsis),
          const SizedBox(height: 8),
          Wrap(
            spacing: 16,
            runSpacing: 8,
            children: [
              _infoChip(Icons.calendar_today, '$date ($dow)'),
              if (s['start_time'] != null)
                _infoChip(Icons.access_time, s['start_time']),
              if (s['location'] != null)
                _infoChip(Icons.location_on_outlined, s['location']),
              _infoChip(Icons.people_outline, '$effectiveCount명 참석'),
            ],
          ),
          if (auth.isAdmin && status != 'completed' && status != 'ended') ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () async {
                  final result = await Navigator.push<bool>(
                    context,
                    MaterialPageRoute(
                      builder: (_) => AdminTeamSetupScreen(
                        sessionId: widget.sessionId,
                        sessionTitle: title,
                      ),
                    ),
                  );
                  if (result == true) _loadSession();
                },
                icon: const Icon(Icons.group_outlined, size: 16),
                label: Text(_teams.isEmpty ? '출석 / 팀 구성' : '팀 재구성'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _teams.isEmpty
                      ? const Color(0xFF34d399)
                      : Colors.white.withAlpha(20),
                  foregroundColor: _teams.isEmpty ? const Color(0xFF0f172a) : Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(vertical: 11),
                  elevation: 0,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildRsvpSection(List<dynamic> goingList, bool isGoing, AuthService auth) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(6),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isGoing ? const Color(0xFF34d399).withAlpha(51) : Colors.white.withAlpha(15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('📋', style: TextStyle(fontSize: 16)),
              const SizedBox(width: 8),
              Text('참석 투표 (${goingList.length}명)', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
              const Spacer(),
              if (auth.player != null)
                GestureDetector(
                  onTap: () async {
                    final token = auth.token;
                    if (token == null) return;
                    final newStatus = isGoing ? 'not_going' : 'going';
                    try {
                      await ApiService().rsvpSession(widget.sessionId, newStatus, token);
                      await _loadSession();
                    } catch (_) {}
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      color: isGoing ? const Color(0xFF34d399).withAlpha(26) : const Color(0xFF34d399),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      isGoing ? '✓ 참석 취소' : '+ 참석하기',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: isGoing ? const Color(0xFF34d399) : const Color(0xFF0f172a),
                      ),
                    ),
                  ),
                ),
            ],
          ),
          if (goingList.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: goingList.map((r) {
                final name = r['display_name'] ?? r['username'] ?? '?';
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFF34d399).withAlpha(15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFF34d399).withAlpha(38)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('✓ ', style: TextStyle(fontSize: 10, color: Color(0xFF34d399))),
                      Text(name.toString(), style: const TextStyle(fontSize: 12, color: Colors.white)),
                    ],
                  ),
                );
              }).toList(),
            ),
          ] else ...[
            const SizedBox(height: 8),
            Text('아직 참석 투표가 없습니다', style: TextStyle(fontSize: 12, color: Colors.white.withAlpha(77))),
          ],
        ],
      ),
    );
  }

  Widget _infoChip(IconData icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: Colors.white.withAlpha(128)),
        const SizedBox(width: 4),
        Text(text, style: TextStyle(fontSize: 13, color: Colors.white.withAlpha(153))),
      ],
    );
  }

  Widget _buildTabs() {
    final hasTeams = _teams.isNotEmpty;
    return Container(
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: Colors.white.withAlpha(26)))),
      child: TabBar(
        controller: _tabController,
        isScrollable: true,
        indicatorColor: const Color(0xFF34d399),
        labelColor: const Color(0xFF34d399),
        unselectedLabelColor: Colors.white38,
        labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
        tabAlignment: TabAlignment.start,
        tabs: [
          const Tab(text: '개요/참석'),
          Tab(child: Text('팀 구성', style: TextStyle(color: hasTeams ? null : Colors.white.withAlpha(51)))),
          Tab(child: Text('점수판', style: TextStyle(color: hasTeams ? null : Colors.white.withAlpha(51)))),
          Tab(child: Text('선수 스탯', style: TextStyle(color: hasTeams ? null : Colors.white.withAlpha(51)))),
        ],
      ),
    );
  }

  // ─── 개요 탭 ───
  Widget _buildOverviewTab() {
    final status = _session?['status'] as String?;
    final goingList = _rsvp.where((r) => r['status'] == 'going').toList();
    final auth = context.read<AuthService>();
    final myUserId = auth.user?['id'];
    final myRsvp = myUserId != null ? _rsvp.firstWhere((r) => r['user_id'] == myUserId, orElse: () => null) : null;
    final isGoing = myRsvp?['status'] == 'going';

    // attendance 우선, 없으면 RSVP going 리스트로 표시
    final displayAttendees = _attendance.isNotEmpty ? _attendance : goingList;
    final isRsvpFallback = _attendance.isEmpty && goingList.isNotEmpty;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // RSVP 섹션 (모집중 세션)
          if (status == 'recruiting' || status == 'open') ...[
            _buildRsvpSection(goingList, isGoing, auth),
            const SizedBox(height: 24),
          ],
          Row(
            children: [
              Text(
                isRsvpFallback ? '참석 예정 (${displayAttendees.length}명)' : '참석자 (${displayAttendees.length}명)',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white),
              ),
              if (isRsvpFallback) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFF3b82f6).withAlpha(26),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text('RSVP', style: TextStyle(fontSize: 10, color: Color(0xFF3b82f6))),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          displayAttendees.isEmpty
              ? Text('참석자가 없습니다', style: TextStyle(color: Colors.white.withAlpha(77), fontSize: 14))
              : Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: displayAttendees.map((a) {
                    // attendance 레코드: name, guest_name, player_id
                    // rsvp 레코드: display_name, username, user_id
                    final name = a['name'] ?? a['display_name'] ?? a['username'] ?? a['guest_name'] ?? '?';
                    final isGuest = isRsvpFallback ? false : (a['guest_name'] != null && a['player_id'] == null);
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: isGuest ? const Color(0xFFf59e0b).withAlpha(20) : Colors.white.withAlpha(10),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isGuest ? const Color(0xFFf59e0b).withAlpha(51) : Colors.white.withAlpha(20),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 28, height: 28,
                            decoration: BoxDecoration(
                              color: const Color(0xFF34d399).withAlpha(26),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Center(
                              child: Text(
                                name.toString().isNotEmpty ? name.toString()[0] : '?',
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF34d399)),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(name.toString(), style: const TextStyle(fontSize: 13, color: Colors.white)),
                          if (isGuest) ...[
                            const SizedBox(width: 4),
                            Text('게스트', style: TextStyle(fontSize: 10, color: const Color(0xFFf59e0b).withAlpha(179))),
                          ],
                        ],
                      ),
                    );
                  }).toList(),
                ),
        ],
      ),
    );
  }

  // ─── 팀 구성 탭 ───
  Widget _buildTeamsTab() {
    if (_teams.isEmpty) {
      return Center(child: Text('팀 편성이 아직 없습니다', style: TextStyle(color: Colors.white.withAlpha(102))));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _teams.length,
      itemBuilder: (ctx, i) {
        final team = _teams[i];
        final name = team['name'] ?? 'Team ${i + 1}';
        final emoji = team['emoji'] ?? '⚽';
        final members = (team['members'] as List?) ?? [];
        final avgOverall = team['avg_overall'];

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white.withAlpha(8),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withAlpha(20)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(emoji, style: const TextStyle(fontSize: 20)),
                  const SizedBox(width: 8),
                  Text(name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                  const Spacer(),
                  if (avgOverall != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFF34d399).withAlpha(26),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '평균 ${(avgOverall as num).toStringAsFixed(1)}',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF34d399)),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 6, runSpacing: 6,
                children: members.map((m) {
                  final playerName = m['name'] ?? m['guest_name'] ?? '?';
                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white.withAlpha(8),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.white.withAlpha(13)),
                    ),
                    child: Text(playerName.toString(), style: const TextStyle(fontSize: 13, color: Colors.white)),
                  );
                }).toList(),
              ),
            ],
          ),
        );
      },
    );
  }

  // ─── 점수판 탭 ───
  Widget _buildScoreboardTab() {
    if (_matches.isEmpty) {
      return Center(child: Text('경기 기록이 없습니다', style: TextStyle(color: Colors.white.withAlpha(102))));
    }

    final auth = context.read<AuthService>();
    final completedMatches = _matches.where((m) => m['status'] == 'completed').toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 결과 공유 버튼 (완료된 경기 있을 때)
          if (completedMatches.isNotEmpty) ...[
            GestureDetector(
              onTap: () => MatchResultPopup.show(context, session: _session!, teams: _teams, matches: _matches, sessionId: widget.sessionId),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: [const Color(0xFF34d399).withAlpha(30), const Color(0xFF14b8a6).withAlpha(20)]),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF34d399).withAlpha(77)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.share_rounded, color: Color(0xFF34d399), size: 18),
                    const SizedBox(width: 8),
                    const Text('경기 결과 공유하기', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF34d399))),
                    const SizedBox(width: 8),
                    Text('카톡 · 이미지', style: TextStyle(fontSize: 11, color: const Color(0xFF34d399).withAlpha(153))),
                  ],
                ),
              ),
            ),
          ],
          // 리그 현황판 (완료된 경기 있을 때)
          if (completedMatches.isNotEmpty && _teams.length >= 2) ...[
            _buildLeagueStandings(completedMatches),
            const SizedBox(height: 16),
            Divider(color: Colors.white.withAlpha(15)),
            const SizedBox(height: 8),
            Text('경기 기록', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white.withAlpha(153))),
            const SizedBox(height: 10),
          ],
          // 경기 카드
          ...List.generate(_matches.length, (i) => _buildMatchCard(_matches[i], i, auth)),
        ],
      ),
    );
  }

  Widget _buildLeagueStandings(List<dynamic> completedMatches) {
    final standings = <int, Map<String, dynamic>>{};
    for (final team in _teams) {
      final tid = team['id'] as int;
      standings[tid] = {
        'name': team['name'] ?? 'Team',
        'emoji': team['emoji'] ?? '⚽',
        'played': 0, 'won': 0, 'drawn': 0, 'lost': 0,
        'gf': 0, 'ga': 0, 'points': 0,
      };
    }

    for (final match in completedMatches) {
      final t1id = match['team1_id'] as int?;
      final t2id = match['team2_id'] as int?;
      if (t1id == null || t2id == null) continue;
      final events = (match['events'] as List?) ?? [];
      final s1 = events.where((e) => e['event_type'] == 'GOAL' && e['team_id'] == t1id).length;
      final s2 = events.where((e) => e['event_type'] == 'GOAL' && e['team_id'] == t2id).length;
      final t1 = standings[t1id];
      final t2 = standings[t2id];
      if (t1 == null || t2 == null) continue;

      t1['played'] = t1['played'] + 1; t2['played'] = t2['played'] + 1;
      t1['gf'] = t1['gf'] + s1; t1['ga'] = t1['ga'] + s2;
      t2['gf'] = t2['gf'] + s2; t2['ga'] = t2['ga'] + s1;

      if (s1 > s2) {
        t1['won'] = t1['won'] + 1; t2['lost'] = t2['lost'] + 1;
        t1['points'] = t1['points'] + 3;
      } else if (s2 > s1) {
        t2['won'] = t2['won'] + 1; t1['lost'] = t1['lost'] + 1;
        t2['points'] = t2['points'] + 3;
      } else {
        t1['drawn'] = t1['drawn'] + 1; t2['drawn'] = t2['drawn'] + 1;
        t1['points'] = t1['points'] + 1; t2['points'] = t2['points'] + 1;
      }
    }

    // 정렬: 승점 → 골득실 → 다득점 → 맞대결 홈팀 우선
    final sorted = standings.entries.toList()..sort((a, b) {
      final av = a.value, bv = b.value;
      final pDiff = (bv['points'] as int) - (av['points'] as int);
      if (pDiff != 0) return pDiff;
      final gdA = (av['gf'] as int) - (av['ga'] as int);
      final gdB = (bv['gf'] as int) - (bv['ga'] as int);
      if (gdB != gdA) return gdB - gdA;
      final gfDiff = (bv['gf'] as int) - (av['gf'] as int);
      if (gfDiff != 0) return gfDiff;
      // 맞대결 홈팀(team1) 우선
      for (final m in completedMatches) {
        final mt1 = m['team1_id']; final mt2 = m['team2_id'];
        if (mt1 == a.key && mt2 == b.key) return -1;
        if (mt1 == b.key && mt2 == a.key) return 1;
      }
      return 0;
    });

    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(8),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withAlpha(20)),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
            child: Row(
              children: [
                const Icon(Icons.emoji_events_rounded, size: 16, color: Color(0xFFf59e0b)),
                const SizedBox(width: 6),
                const Text('리그 현황판', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white)),
                const Spacer(),
                Text('승3 무1 패0', style: TextStyle(fontSize: 10, color: Colors.white.withAlpha(77))),
              ],
            ),
          ),
          Divider(height: 1, color: Colors.white.withAlpha(15)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
            child: Row(
              children: [
                const SizedBox(width: 20),
                const Expanded(flex: 3, child: Text('팀', style: TextStyle(fontSize: 11, color: Colors.white54, fontWeight: FontWeight.w600))),
                _sCol('경기'), _sCol('승'), _sCol('무'), _sCol('패'), _sCol('득실'), _sCol('승점'),
              ],
            ),
          ),
          ...sorted.asMap().entries.map((entry) {
            final rank = entry.key;
            final t = entry.value.value;
            final gd = (t['gf'] as int) - (t['ga'] as int);
            final gdStr = gd > 0 ? '+$gd' : '$gd';
            final played = t['played'] as int;
            final isTop = rank == 0 && played > 0;
            return Container(
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: Colors.white.withAlpha(10))),
                color: isTop ? const Color(0xFFf59e0b).withAlpha(8) : null,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Row(
                children: [
                  SizedBox(width: 20, child: Text(
                    isTop ? '🥇' : '${rank + 1}',
                    style: TextStyle(fontSize: isTop ? 14 : 12, color: Colors.white.withAlpha(128)),
                  )),
                  Expanded(flex: 3, child: Row(children: [
                    Text(t['emoji'] as String, style: const TextStyle(fontSize: 13)),
                    const SizedBox(width: 5),
                    Expanded(child: Text(
                      t['name'] as String,
                      style: TextStyle(fontSize: 13, fontWeight: isTop ? FontWeight.bold : FontWeight.w500, color: isTop ? const Color(0xFFf59e0b) : Colors.white),
                      overflow: TextOverflow.ellipsis,
                    )),
                  ])),
                  _sVal('${t['played']}', Colors.white54),
                  _sVal('${t['won']}', const Color(0xFF34d399)),
                  _sVal('${t['drawn']}', Colors.white54),
                  _sVal('${t['lost']}', const Color(0xFFef4444)),
                  _sVal(gdStr, gd > 0 ? const Color(0xFF34d399) : gd < 0 ? const Color(0xFFef4444) : Colors.white54),
                  _sVal('${t['points']}', const Color(0xFFf59e0b), bold: true),
                ],
              ),
            );
          }),
          const SizedBox(height: 4),
        ],
      ),
    );
  }

  Widget _sCol(String text) => Expanded(
    child: Center(child: Text(text, style: const TextStyle(fontSize: 11, color: Colors.white54, fontWeight: FontWeight.w600))),
  );

  Widget _sVal(String text, Color color, {bool bold = false}) => Expanded(
    child: Center(child: Text(text, style: TextStyle(fontSize: 13, color: color, fontWeight: bold ? FontWeight.bold : FontWeight.normal))),
  );

  Widget _buildMatchCard(dynamic match, int i, AuthService auth) {
    final matchNo = match['match_no'] ?? (i + 1);
    final team1Name = match['team1_name'] ?? 'A팀';
    final team2Name = match['team2_name'] ?? 'B팀';
    final team1Id = match['team1_id'];
    final team2Id = match['team2_id'];
    final status = match['status'] ?? 'pending';
    final events = (match['events'] as List?) ?? [];

    final team1Score = events.where((e) => e['event_type'] == 'GOAL' && e['team_id'] == team1Id).length;
    final team2Score = events.where((e) => e['event_type'] == 'GOAL' && e['team_id'] == team2Id).length;

    Color statusColor;
    String statusLabel;
    switch (status) {
      case 'playing': statusColor = const Color(0xFF34d399); statusLabel = '진행중'; break;
      case 'completed': statusColor = const Color(0xFF3b82f6); statusLabel = '완료'; break;
      default: statusColor = Colors.white38; statusLabel = '예정';
    }

    return GestureDetector(
      onTap: auth.isAdmin ? () => setState(() => _recordingMatch = match) : null,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white.withAlpha(8),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withAlpha(20)),
        ),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('$matchNo경기', style: TextStyle(fontSize: 12, color: Colors.white.withAlpha(128))),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: statusColor.withAlpha(26), borderRadius: BorderRadius.circular(8)),
                      child: Text(statusLabel, style: TextStyle(fontSize: 10, color: statusColor)),
                    ),
                    if (auth.isAdmin) ...[
                      const SizedBox(width: 6),
                      Icon(Icons.edit_note, size: 16, color: Colors.white.withAlpha(64)),
                    ],
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // 팀1 (홈)
                Expanded(
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Flexible(child: Text(team1Name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white), overflow: TextOverflow.ellipsis)),
                          const SizedBox(width: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                            decoration: BoxDecoration(color: const Color(0xFF34d399).withAlpha(26), borderRadius: BorderRadius.circular(4)),
                            child: const Text('홈', style: TextStyle(fontSize: 9, color: Color(0xFF34d399), fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text('$team1Score', style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: team1Score > team2Score ? const Color(0xFF34d399) : Colors.white)),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text('VS', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white.withAlpha(64))),
                ),
                // 팀2 (원정)
                Expanded(
                  child: Column(
                    children: [
                      Text(team2Name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white), overflow: TextOverflow.ellipsis, textAlign: TextAlign.center),
                      const SizedBox(height: 4),
                      Text('$team2Score', style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: team2Score > team1Score ? const Color(0xFF34d399) : Colors.white)),
                    ],
                  ),
                ),
              ],
            ),
            if (events.isNotEmpty) ...[
              const SizedBox(height: 12),
              Divider(color: Colors.white.withAlpha(20)),
              const SizedBox(height: 8),
              ...events.map((e) {
                final type = e['event_type'] ?? '';
                final playerName = e['player_name'] ?? e['guest_name'] ?? '?';
                final assisterName = e['assister_name'] ?? e['assister_guest_name'];
                final icon = type == 'GOAL' ? '⚽' : type == 'DEFENSE' ? '🛡️' : '📌';
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      Text(icon, style: const TextStyle(fontSize: 14)),
                      const SizedBox(width: 8),
                      Text(playerName, style: const TextStyle(fontSize: 13, color: Colors.white)),
                      if (assisterName != null && assisterName.toString().isNotEmpty) ...[
                        const SizedBox(width: 4),
                        Text('($assisterName)', style: TextStyle(fontSize: 12, color: Colors.white.withAlpha(102))),
                      ],
                    ],
                  ),
                );
              }),
            ],
          ],
        ),
      ),
    );
  }

  // ─── 선수 스탯 탭 ───
  Widget _buildStatsTab() {
    if (_matches.isEmpty) {
      return Center(child: Text('경기 기록이 없습니다', style: TextStyle(color: Colors.white.withAlpha(102))));
    }

    // String 키: 등록 선수는 'p_$id', 용병은 'g_$name'
    final playerStats = <String, Map<String, dynamic>>{};
    final completedMatches = _matches.where((m) => m['status'] == 'completed').toList();

    for (final match in completedMatches) {
      final events = (match['events'] as List?) ?? [];
      for (final event in events) {
        final playerId = event['player_id'];
        final displayName = event['player_name'] ?? event['guest_name'] ?? '?';
        final statsKey = playerId != null ? 'p_$playerId' : 'g_$displayName';

        playerStats.putIfAbsent(statsKey, () => {
          'id': playerId,
          'name': displayName,
          'isGuest': playerId == null,
          'goals': 0,
          'assists': 0,
          'defenses': 0,
          'mvpScore': 0.0,
        });

        final stats = playerStats[statsKey]!;
        if (event['event_type'] == 'GOAL') {
          stats['goals'] = (stats['goals'] as int) + 1;
          stats['mvpScore'] = (stats['mvpScore'] as double) + 2.0;
        } else if (event['event_type'] == 'DEFENSE') {
          stats['defenses'] = (stats['defenses'] as int) + 1;
          stats['mvpScore'] = (stats['mvpScore'] as double) + 0.5;
        }

        final assisterId = event['assister_id'];
        final assisterName = event['assister_name'] ?? event['assister_guest_name'];
        if ((assisterId != null || assisterName != null) && event['event_type'] == 'GOAL') {
          final aKey = assisterId != null ? 'p_$assisterId' : 'g_$assisterName';
          final aDisplayName = assisterName ?? '?';
          playerStats.putIfAbsent(aKey, () => {
            'id': assisterId,
            'name': aDisplayName,
            'isGuest': assisterId == null,
            'goals': 0,
            'assists': 0,
            'defenses': 0,
            'mvpScore': 0.0,
          });
          playerStats[aKey]!['assists'] = (playerStats[aKey]!['assists'] as int) + 1;
          playerStats[aKey]!['mvpScore'] = (playerStats[aKey]!['mvpScore'] as double) + 1.0;
        }
      }
    }

    // 팀 순위 계산 (이벤트 기반 점수)
    final teamStandings = <int, Map<String, dynamic>>{};
    for (final team in _teams) {
      final members = (team['members'] as List?) ?? [];
      teamStandings[team['id']] = {
        'points': 0,
        'goalsFor': 0,
        // 등록 선수 p_$id, 용병 g_$name 형식으로 통일
        'memberKeys': members.map((m) {
          final pid = m['player_id'];
          return pid != null ? 'p_$pid' : 'g_${m['name'] ?? m['guest_name']}';
        }).toSet(),
      };
    }

    for (final match in completedMatches) {
      final t1 = teamStandings[match['team1_id']];
      final t2 = teamStandings[match['team2_id']];
      if (t1 != null && t2 != null) {
        final events = (match['events'] as List?) ?? [];
        final s1 = events.where((e) => e['event_type'] == 'GOAL' && e['team_id'] == match['team1_id']).length;
        final s2 = events.where((e) => e['event_type'] == 'GOAL' && e['team_id'] == match['team2_id']).length;
        t1['goalsFor'] = (t1['goalsFor'] as int) + s1;
        t2['goalsFor'] = (t2['goalsFor'] as int) + s2;
        if (s1 > s2) {
          t1['points'] = (t1['points'] as int) + 3;
        } else if (s2 > s1) {
          t2['points'] = (t2['points'] as int) + 3;
        } else {
          t1['points'] = (t1['points'] as int) + 1;
          t2['points'] = (t2['points'] as int) + 1;
        }
      }
    }

    int? winningTeamId;
    int maxPoints = -1;
    for (final entry in teamStandings.entries) {
      final pts = entry.value['points'] as int;
      if (pts > maxPoints) {
        maxPoints = pts;
        winningTeamId = entry.key;
      }
    }

    if (winningTeamId != null && maxPoints > 0) {
      final winnerKeys = teamStandings[winningTeamId]!['memberKeys'] as Set;
      for (final entry in playerStats.entries) {
        if (winnerKeys.contains(entry.key)) {
          entry.value['mvpScore'] = (entry.value['mvpScore'] as double) + 1.5;
        }
      }
    }

    final sorted = playerStats.values.toList()..sort((a, b) => (b['mvpScore'] as double).compareTo(a['mvpScore'] as double));
    if (sorted.isEmpty) {
      return Center(child: Text('완료된 경기가 없습니다', style: TextStyle(color: Colors.white.withAlpha(102))));
    }

    final maxScore = (sorted.first['mvpScore'] as double);
    for (final s in sorted) {
      s['normalizedScore'] = maxScore > 0 ? ((s['mvpScore'] as double) / maxScore) * 10 : 0.0;
    }

    final mvp = sorted.first;
    final topScorer = List.from(sorted)..sort((a, b) => (b['goals'] as int).compareTo(a['goals'] as int));
    final topAssister = List.from(sorted)..sort((a, b) => (b['assists'] as int).compareTo(a['assists'] as int));
    final topDefender = List.from(sorted)..sort((a, b) => (b['defenses'] as int).compareTo(a['defenses'] as int));

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _highlightCard('⭐', 'MVP', mvp['name'], '${(mvp['normalizedScore'] as double).toStringAsFixed(1)}점', const Color(0xFFf59e0b)),
              const SizedBox(width: 8),
              _highlightCard('⚽', '득점왕', topScorer.first['name'], '${topScorer.first['goals']}골', const Color(0xFF34d399)),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _highlightCard('⚡', '도움왕', topAssister.first['name'], '${topAssister.first['assists']}도움', const Color(0xFF3b82f6)),
              const SizedBox(width: 8),
              _highlightCard('🛡️', '수비왕', topDefender.first['name'], '${topDefender.first['defenses']}수비', const Color(0xFF8b5cf6)),
            ],
          ),
          const SizedBox(height: 20),

          Container(
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(8),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withAlpha(20)),
            ),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Icon(Icons.bar_chart, size: 16, color: Colors.white.withAlpha(153)),
                      const SizedBox(width: 8),
                      const Text('세션 기록', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
                    ],
                  ),
                ),
                Divider(height: 1, color: Colors.white.withAlpha(20)),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  child: Row(
                    children: [
                      const SizedBox(width: 24),
                      const Expanded(flex: 3, child: Text('선수', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white54))),
                      const Expanded(child: Center(child: Text('골', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white54)))),
                      const Expanded(child: Center(child: Text('도움', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white54)))),
                      const Expanded(child: Center(child: Text('수비', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white54)))),
                      const Expanded(child: Center(child: Text('MVP', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white54)))),
                    ],
                  ),
                ),
                ...sorted.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final p = entry.value;
                  String rankIcon;
                  if (idx == 0) {
                    rankIcon = '🥇';
                  } else if (idx == 1) {
                    rankIcon = '🥈';
                  } else if (idx == 2) {
                    rankIcon = '🥉';
                  } else {
                    rankIcon = '${idx + 1}';
                  }

                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      border: Border(top: BorderSide(color: Colors.white.withAlpha(8))),
                      color: idx == 0 ? const Color(0xFFf59e0b).withAlpha(8) : null,
                    ),
                    child: Row(
                      children: [
                        SizedBox(width: 24, child: Center(child: Text(rankIcon, style: TextStyle(fontSize: idx < 3 ? 14 : 12, color: Colors.white.withAlpha(128))))),
                        Expanded(flex: 3, child: Text(p['name'], style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white))),
                        Expanded(child: Center(child: Text('${p['goals']}', style: const TextStyle(fontSize: 13, color: Color(0xFF34d399))))),
                        Expanded(child: Center(child: Text('${p['assists']}', style: const TextStyle(fontSize: 13, color: Color(0xFF3b82f6))))),
                        Expanded(child: Center(child: Text('${p['defenses']}', style: const TextStyle(fontSize: 13, color: Color(0xFF8b5cf6))))),
                        Expanded(child: Center(child: Text(
                          (p['normalizedScore'] as double).toStringAsFixed(1),
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFFf59e0b)),
                        ))),
                      ],
                    ),
                  );
                }),
                const SizedBox(height: 8),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _highlightCard(String icon, String title, String playerName, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withAlpha(15),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withAlpha(40)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(icon, style: const TextStyle(fontSize: 16)),
                const SizedBox(width: 6),
                Text(title, style: TextStyle(fontSize: 12, color: Colors.white.withAlpha(153))),
              ],
            ),
            const SizedBox(height: 8),
            Text(playerName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white)),
            Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════
// 경기 기록 화면 (Match Recorder)
// ═══════════════════════════════════════════════════
class _MatchRecorderPage extends StatefulWidget {
  final Map<String, dynamic> match;
  final List<dynamic> teams;
  final VoidCallback onClose;

  const _MatchRecorderPage({required this.match, required this.teams, required this.onClose});

  @override
  State<_MatchRecorderPage> createState() => _MatchRecorderPageState();
}

class _MatchRecorderPageState extends State<_MatchRecorderPage> {
  final ApiService _api = ApiService();
  List<dynamic> _events = [];
  List<dynamic> _team1Members = [];
  List<dynamic> _team2Members = [];
  Map<String, dynamic>? _matchData;
  bool _loading = true;
  bool _busy = false;

  // 어시스트 입력 모드
  int? _assistScorerPlayerId;
  String? _assistScorerGuestName;
  int? _assistTeamId;

  // 타이머
  Timer? _timer;
  int _elapsedSeconds = 0;
  int _matchDurationMinutes = 15;
  int _alertIntervalMinutes = 5;
  bool _timerRunning = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final res = await _api.getMatch(widget.match['id']);
      if (mounted) {
        setState(() {
          _matchData = res['match'];
          _events = (res['events'] as List?) ?? [];
          _team1Members = (res['team1Members'] as List?) ?? [];
          _team2Members = (res['team2Members'] as List?) ?? [];
          _loading = false;
        });
        // 이미 진행중인 경기라면 타이머 자동 시작
        if (_matchData?['status'] == 'playing' && !_timerRunning) {
          _startTimer();
        }
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _startTimer() {
    _timer?.cancel();
    _timerRunning = true;
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) { t.cancel(); return; }
      setState(() => _elapsedSeconds++);

      // 경기 종료 알림
      if (_elapsedSeconds == _matchDurationMinutes * 60) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$_matchDurationMinutes분 종료! 경기를 마무리하세요.'),
            backgroundColor: const Color(0xFFf97316),
            duration: const Duration(seconds: 5),
          ),
        );
      }
      // 인터벌 알림
      if (_alertIntervalMinutes > 0 &&
          _elapsedSeconds % (_alertIntervalMinutes * 60) == 0 &&
          _elapsedSeconds < _matchDurationMinutes * 60) {
        final remaining = (_matchDurationMinutes * 60 - _elapsedSeconds) ~/ 60;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${_elapsedSeconds ~/ 60}분 경과 (${remaining}분 남음)'),
            backgroundColor: const Color(0xFF3b82f6),
            duration: const Duration(seconds: 3),
          ),
        );
      }
    });
  }

  void _stopTimer() {
    _timer?.cancel();
    _timerRunning = false;
  }

  String _formatTime(int totalSeconds) {
    final m = totalSeconds ~/ 60;
    final s = totalSeconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  Future<void> _showTimerSetupDialog() async {
    int tempDuration = _matchDurationMinutes;
    int tempInterval = _alertIntervalMinutes;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          backgroundColor: const Color(0xFF1e293b),
          title: const Text('경기 시작', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('경기 시간', style: TextStyle(color: Colors.white.withAlpha(153), fontSize: 13)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6, runSpacing: 6,
                children: [5, 7, 10, 12, 15, 20, 25, 30].map((min) => GestureDetector(
                  onTap: () => setS(() => tempDuration = min),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                    decoration: BoxDecoration(
                      color: tempDuration == min ? const Color(0xFF34d399) : Colors.white.withAlpha(15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text('${min}분', style: TextStyle(
                      fontSize: 13,
                      color: tempDuration == min ? const Color(0xFF0f172a) : Colors.white,
                      fontWeight: tempDuration == min ? FontWeight.bold : FontWeight.normal,
                    )),
                  ),
                )).toList(),
              ),
              const SizedBox(height: 16),
              Text('중간 알림 간격', style: TextStyle(color: Colors.white.withAlpha(153), fontSize: 13)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6, runSpacing: 6,
                children: [0, 3, 5, 10].map((min) => GestureDetector(
                  onTap: () => setS(() => tempInterval = min),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                    decoration: BoxDecoration(
                      color: tempInterval == min ? const Color(0xFF3b82f6) : Colors.white.withAlpha(15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(min == 0 ? '없음' : '${min}분마다', style: TextStyle(
                      fontSize: 13,
                      color: tempInterval == min ? Colors.white : Colors.white,
                      fontWeight: tempInterval == min ? FontWeight.bold : FontWeight.normal,
                    )),
                  ),
                )).toList(),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text('취소', style: TextStyle(color: Colors.white.withAlpha(102))),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF34d399),
                foregroundColor: const Color(0xFF0f172a),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text('시작', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
    if (confirmed == true) {
      setState(() {
        _matchDurationMinutes = tempDuration;
        _alertIntervalMinutes = tempInterval;
        _elapsedSeconds = 0;
      });
      await _updateStatus('playing');
      _startTimer();
    }
  }

  int _goalCount(int teamId) => _events.where((e) => e['event_type'] == 'GOAL' && e['team_id'] == teamId).length;

  Future<void> _addEvent(String type, int? playerId, String? guestName, int teamId, {int? assisterId, String? assisterGuestName}) async {
    final auth = context.read<AuthService>();
    if (auth.token == null || _busy) return;

    // 낙관적 업데이트: 이름 찾기
    String? pName = guestName;
    if (playerId != null) {
      final allMembers = [..._team1Members, ..._team2Members];
      final m = allMembers.firstWhere((m) => m['player_id'] == playerId, orElse: () => <String, dynamic>{});
      pName = (m as Map<String, dynamic>)['name'] as String? ?? m['guest_name'] as String? ?? '?';
    }
    String? aName = assisterGuestName;
    if (assisterId != null) {
      final allMembers = [..._team1Members, ..._team2Members];
      final m = allMembers.firstWhere((m) => m['player_id'] == assisterId, orElse: () => <String, dynamic>{});
      aName = (m as Map<String, dynamic>)['name'] as String? ?? assisterGuestName;
    }

    final tempId = -DateTime.now().millisecondsSinceEpoch;
    final tempEvent = <String, dynamic>{
      'id': tempId,
      'event_type': type,
      'player_id': playerId,
      'player_name': pName,
      'guest_name': guestName,
      'team_id': teamId,
      'assister_id': assisterId,
      'assister_name': aName,
      'assister_guest_name': assisterGuestName,
      'event_time': _elapsedSeconds,
    };

    setState(() {
      _events = [..._events, tempEvent];
      _busy = true;
    });

    try {
      await _api.addMatchEvent(widget.match['id'], {
        'eventType': type,
        'playerId': playerId,
        'guestName': guestName,
        'teamId': teamId,
        if (assisterId != null) 'assisterId': assisterId,
        if (assisterGuestName != null) 'assisterGuestName': assisterGuestName,
        'eventTime': _elapsedSeconds,
      }, auth.token!);
      await _load();
    } catch (_) {
      // 실패 시 임시 이벤트 제거
      if (mounted) setState(() => _events = _events.where((e) => e['id'] != tempId).toList());
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _deleteEvent(int eventId) async {
    final auth = context.read<AuthService>();
    if (auth.token == null) return;
    setState(() => _busy = true);
    try {
      await _api.deleteMatchEvent(widget.match['id'], eventId, auth.token!);
      await _load();
    } catch (_) {}
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _updateStatus(String status) async {
    final auth = context.read<AuthService>();
    if (auth.token == null) return;
    setState(() => _busy = true);
    try {
      await _api.updateMatch(widget.match['id'], {'status': status}, auth.token!);
      await _load();
    } catch (_) {}
    if (mounted) setState(() => _busy = false);
  }

  String _shortName(String name) {
    if (name.length <= 2) return name;
    return '${name[0]}${name[2]}';
  }

  @override
  Widget build(BuildContext context) {
    final team1 = widget.teams.firstWhere((t) => t['id'] == widget.match['team1_id'], orElse: () => {'name': 'A팀'});
    final team2 = widget.teams.firstWhere((t) => t['id'] == widget.match['team2_id'], orElse: () => {'name': 'B팀'});
    final matchNo = widget.match['match_no'] ?? 1;
    final team1Id = widget.match['team1_id'] as int;
    final team2Id = widget.match['team2_id'] as int;

    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0f172a),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: widget.onClose,
        ),
        title: Text('$matchNo경기: ${team1['name']} vs ${team2['name']}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF34d399)))
          : Column(
              children: [
                _buildScoreboard(team1, team2, team1Id, team2Id),
                const SizedBox(height: 8),
                Expanded(
                  child: _assistScorerPlayerId != null || _assistScorerGuestName != null
                      ? _buildAssistSelector(team1Id, team2Id)
                      : SingleChildScrollView(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Builder(builder: (ctx) {
                            final enabled = ctx.watch<AuthService>().enabledEvents;
                            return Column(
                              children: [
                                if (enabled.contains('GOAL')) ...[
                                  _buildGoalSection(team1, team2, team1Id, team2Id),
                                  const SizedBox(height: 12),
                                ],
                                if (enabled.contains('DEFENSE')) ...[
                                  _buildDefenseSection(team1, team2, team1Id, team2Id),
                                  const SizedBox(height: 12),
                                ],
                                _buildEventLog(team1Id, team2Id),
                                const SizedBox(height: 24),
                              ],
                            );
                          }),
                        ),
                ),
              ],
            ),
    );
  }

  Widget _buildScoreboard(dynamic team1, dynamic team2, int team1Id, int team2Id) {
    final status = _matchData?['status'] ?? 'pending';
    final isPlaying = status == 'playing';
    final totalSeconds = _matchDurationMinutes * 60;
    final remaining = (totalSeconds - _elapsedSeconds).clamp(0, totalSeconds);
    final progress = isPlaying ? (_elapsedSeconds / totalSeconds).clamp(0.0, 1.0) : 0.0;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [const Color(0xFF1e293b), const Color(0xFF0f172a).withAlpha(200)],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withAlpha(20)),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Expanded(child: Column(children: [
                Text(team1['name'] ?? 'A팀', style: TextStyle(fontSize: 12, color: Colors.white.withAlpha(153))),
                Text('${_goalCount(team1Id)}', style: const TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: Colors.white)),
              ])),
              Column(children: [
                if (isPlaying) ...[
                  Text(_formatTime(_elapsedSeconds), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF34d399))),
                  Text('/ ${_formatTime(totalSeconds)}', style: TextStyle(fontSize: 10, color: Colors.white.withAlpha(77))),
                  const SizedBox(height: 6),
                  _actionChip('✓ 완료', const Color(0xFF3b82f6), () {
                    _stopTimer();
                    _updateStatus('completed');
                  }),
                ] else if (status == 'pending') ...[
                  Text('VS', style: TextStyle(fontSize: 14, color: Colors.white.withAlpha(64))),
                  const SizedBox(height: 8),
                  _actionChip('▶ 시작', const Color(0xFF34d399), _showTimerSetupDialog),
                ] else ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF3b82f6).withAlpha(26),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text('완료', style: TextStyle(fontSize: 11, color: Color(0xFF3b82f6))),
                  ),
                ],
              ]),
              Expanded(child: Column(children: [
                Text(team2['name'] ?? 'B팀', style: TextStyle(fontSize: 12, color: Colors.white.withAlpha(153))),
                Text('${_goalCount(team2Id)}', style: const TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: Colors.white)),
              ])),
            ],
          ),
          if (isPlaying) ...[
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor: Colors.white.withAlpha(20),
                valueColor: AlwaysStoppedAnimation<Color>(
                  remaining <= 60 ? const Color(0xFFef4444) : const Color(0xFF34d399),
                ),
                minHeight: 4,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _actionChip(String label, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: _busy ? null : onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white)),
      ),
    );
  }

  Widget _buildGoalSection(dynamic team1, dynamic team2, int team1Id, int team2Id) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withAlpha(20)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('⚽ 골 기록', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white)),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _teamGoalButtons(_team1Members, team1Id, const Color(0xFF34d399), team1['name'] ?? 'A팀')),
              const SizedBox(width: 8),
              Expanded(child: _teamGoalButtons(_team2Members, team2Id, const Color(0xFFf97316), team2['name'] ?? 'B팀')),
            ],
          ),
        ],
      ),
    );
  }

  Widget _teamGoalButtons(List<dynamic> members, int teamId, Color color, String teamName) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: color.withAlpha(10),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withAlpha(30)),
      ),
      child: Column(
        children: [
          Text(teamName, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: color)),
          const SizedBox(height: 6),
          Wrap(
            spacing: 4, runSpacing: 4,
            children: members.map((m) {
              final name = m['name'] ?? m['guest_name'] ?? '?';
              final goals = _events.where((e) =>
                e['event_type'] == 'GOAL' &&
                (m['player_id'] != null ? e['player_id'] == m['player_id'] : e['guest_name'] == m['guest_name'])
              ).length;
              return GestureDetector(
                onTap: _busy ? null : () {
                  setState(() {
                    _assistScorerPlayerId = m['player_id'];
                    _assistScorerGuestName = m['guest_name'];
                    _assistTeamId = teamId;
                  });
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  decoration: BoxDecoration(
                    color: color.withAlpha(15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: color.withAlpha(40)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_shortName(name), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: color)),
                      if (goals > 0) ...[
                        const SizedBox(width: 3),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                          decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(4)),
                          child: Text('$goals', style: const TextStyle(fontSize: 9, color: Colors.white, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildAssistSelector(int team1Id, int team2Id) {
    final teamMembers = _assistTeamId == team1Id ? _team1Members : _team2Members;
    final candidates = teamMembers.where((m) =>
      m['player_id'] != _assistScorerPlayerId ||
      (m['guest_name'] != null && m['guest_name'] != _assistScorerGuestName)
    ).toList();

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFf59e0b).withAlpha(15),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFf59e0b).withAlpha(50)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('⚽ 어시스트 선택', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFFf59e0b))),
                GestureDetector(
                  onTap: () => setState(() { _assistScorerPlayerId = null; _assistScorerGuestName = null; _assistTeamId = null; }),
                  child: Text('취소', style: TextStyle(fontSize: 13, color: Colors.white.withAlpha(153))),
                ),
              ],
            ),
            const SizedBox(height: 12),
            GestureDetector(
              onTap: () {
                _addEvent('GOAL', _assistScorerPlayerId, _assistScorerGuestName, _assistTeamId!);
                setState(() { _assistScorerPlayerId = null; _assistScorerGuestName = null; _assistTeamId = null; });
              },
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFf59e0b).withAlpha(30),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Center(child: Text('단독 득점', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFFf59e0b)))),
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6, runSpacing: 6,
              children: candidates.map((m) {
                final name = m['name'] ?? m['guest_name'] ?? '?';
                return GestureDetector(
                  onTap: () {
                    _addEvent('GOAL', _assistScorerPlayerId, _assistScorerGuestName, _assistTeamId!, assisterId: m['player_id'], assisterGuestName: m['guest_name'] as String?);
                    setState(() { _assistScorerPlayerId = null; _assistScorerGuestName = null; _assistTeamId = null; });
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white.withAlpha(8),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFf59e0b).withAlpha(40)),
                    ),
                    child: Text(_shortName(name), style: const TextStyle(fontSize: 13, color: Color(0xFFf59e0b))),
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDefenseSection(dynamic team1, dynamic team2, int team1Id, int team2Id) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withAlpha(20)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('🛡️ 수비 기록', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white)),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _teamDefenseButtons(_team1Members, team1Id, const Color(0xFF6366f1), team1['name'] ?? 'A팀')),
              const SizedBox(width: 8),
              Expanded(child: _teamDefenseButtons(_team2Members, team2Id, const Color(0xFF0ea5e9), team2['name'] ?? 'B팀')),
            ],
          ),
        ],
      ),
    );
  }

  Widget _teamDefenseButtons(List<dynamic> members, int teamId, Color color, String teamName) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: color.withAlpha(10),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withAlpha(30)),
      ),
      child: Column(
        children: [
          Text(teamName, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: color)),
          const SizedBox(height: 6),
          Wrap(
            spacing: 4, runSpacing: 4,
            children: members.map((m) {
              final name = m['name'] ?? m['guest_name'] ?? '?';
              final defenses = _events.where((e) =>
                e['event_type'] == 'DEFENSE' &&
                (m['player_id'] != null ? e['player_id'] == m['player_id'] : e['guest_name'] == m['guest_name'])
              ).length;
              return GestureDetector(
                onTap: _busy ? null : () => _addEvent('DEFENSE', m['player_id'], m['guest_name'], teamId),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  decoration: BoxDecoration(
                    color: color.withAlpha(15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: color.withAlpha(40)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_shortName(name), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: color)),
                      if (defenses > 0) ...[
                        const SizedBox(width: 3),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                          decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(4)),
                          child: Text('$defenses', style: const TextStyle(fontSize: 9, color: Colors.white, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildEventLog(int team1Id, int team2Id) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(5),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withAlpha(13)),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                const Text('📋 기록', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white)),
                const SizedBox(width: 6),
                Text('(${_events.length})', style: TextStyle(fontSize: 12, color: Colors.white.withAlpha(102))),
              ],
            ),
          ),
          if (_events.isEmpty)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text('아직 기록이 없습니다', style: TextStyle(fontSize: 13, color: Colors.white.withAlpha(102))),
            )
          else
            ..._events.reversed.take(15).map((e) {
              final type = e['event_type'] ?? '';
              final isGoal = type == 'GOAL';
              final icon = isGoal ? '⚽' : '🛡️';
              final name = e['player_name'] ?? e['guest_name'] ?? '?';
              final assister = e['assister_name'];
              final eventTeamId = e['team_id'];
              final isTeam1 = eventTeamId == team1Id;
              final eventTime = e['event_time'] as int? ?? 0;
              final timeStr = _formatTime(eventTime);
              final isTemp = (e['id'] as int? ?? 0) < 0;

              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(border: Border(top: BorderSide(color: Colors.white.withAlpha(8)))),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // 팀 1 side (left)
                    Expanded(
                      child: isTeam1
                          ? Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(name.toString(), style: TextStyle(
                                  fontSize: 13,
                                  color: isTemp ? Colors.white54 : Colors.white,
                                  fontWeight: FontWeight.w500,
                                )),
                                if (assister != null && assister.toString().isNotEmpty)
                                  Text('↗ $assister', style: TextStyle(fontSize: 10, color: Colors.white.withAlpha(102))),
                              ],
                            )
                          : const SizedBox(),
                    ),
                    // 중앙: 아이콘 + 타임스탬프
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(icon, style: TextStyle(fontSize: 16, color: isTemp ? Colors.white38 : null)),
                        Text(timeStr, style: TextStyle(fontSize: 9, color: Colors.white.withAlpha(77))),
                      ],
                    ),
                    // 팀 2 side (right)
                    Expanded(
                      child: !isTeam1
                          ? Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(name.toString(), style: TextStyle(
                                  fontSize: 13,
                                  color: isTemp ? Colors.white54 : Colors.white,
                                  fontWeight: FontWeight.w500,
                                ), textAlign: TextAlign.right),
                                if (assister != null && assister.toString().isNotEmpty)
                                  Text('$assister ↗', style: TextStyle(fontSize: 10, color: Colors.white.withAlpha(102))),
                              ],
                            )
                          : const SizedBox(),
                    ),
                    // 삭제 버튼
                    const SizedBox(width: 4),
                    if (!isTemp)
                      GestureDetector(
                        onTap: () => _deleteEvent(e['id']),
                        child: Icon(Icons.close, size: 14, color: Colors.white.withAlpha(51)),
                      )
                    else
                      const SizedBox(width: 14),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}
