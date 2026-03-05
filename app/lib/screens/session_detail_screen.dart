import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

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
  bool _loading = true;

  // 경기 기록 모드
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
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
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
        statusColor = const Color(0xFF34d399);
        statusLabel = '모집중';
        break;
      case 'completed':
        statusColor = const Color(0xFF64748b);
        statusLabel = '완료';
        break;
      default:
        statusColor = const Color(0xFFf59e0b);
        statusLabel = '마감';
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
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
          const SizedBox(height: 10),
          Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 16,
            runSpacing: 8,
            children: [
              _infoChip(Icons.calendar_today, '$date ($dow)'),
              _infoChip(Icons.access_time, '21:00 ~ 23:00'),
              _infoChip(Icons.location_on_outlined, '수성대 풋살장'),
              _infoChip(Icons.people_outline, '${_attendance.length}명 참석'),
            ],
          ),
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
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('참석자 (${_attendance.length}명)', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _attendance.map((a) {
              final name = a['name'] ?? a['guest_name'] ?? '?';
              final isGuest = a['guest_name'] != null && a['player_id'] == null;
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

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _matches.length,
      itemBuilder: (ctx, i) {
        final match = _matches[i];
        final matchNo = match['match_no'] ?? (i + 1);
        final team1Name = match['team1_name'] ?? 'A팀';
        final team2Name = match['team2_name'] ?? 'B팀';
        final team1Score = match['team1_score'] ?? 0;
        final team2Score = match['team2_score'] ?? 0;
        final status = match['status'] ?? 'pending';
        final events = (match['events'] as List?) ?? [];

        Color statusColor;
        String statusLabel;
        switch (status) {
          case 'playing':
            statusColor = const Color(0xFF34d399);
            statusLabel = '진행중';
            break;
          case 'completed':
            statusColor = const Color(0xFF3b82f6);
            statusLabel = '완료';
            break;
          default:
            statusColor = Colors.white38;
            statusLabel = '예정';
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
                // 매치 헤더 + 상태
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('$matchNo경기', style: TextStyle(fontSize: 12, color: Colors.white.withAlpha(128))),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: statusColor.withAlpha(26),
                            borderRadius: BorderRadius.circular(8),
                          ),
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
                // 스코어
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Column(
                        children: [
                          Text(team1Name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
                          const SizedBox(height: 4),
                          Text('$team1Score', style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: team1Score > team2Score ? const Color(0xFF34d399) : Colors.white)),
                        ],
                      ),
                    ),
                    Text('VS', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white.withAlpha(64))),
                    Expanded(
                      child: Column(
                        children: [
                          Text(team2Name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
                          const SizedBox(height: 4),
                          Text('$team2Score', style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: team2Score > team1Score ? const Color(0xFF34d399) : Colors.white)),
                        ],
                      ),
                    ),
                  ],
                ),
                // 이벤트 타임라인
                if (events.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Divider(color: Colors.white.withAlpha(20)),
                  const SizedBox(height: 8),
                  ...events.map((e) {
                    final type = e['event_type'] ?? '';
                    final playerName = e['player_name'] ?? '';
                    final assisterName = e['assister_name'];
                    String icon = type == 'GOAL' ? '⚽' : type == 'DEFENSE' ? '🛡️' : '📌';
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
      },
    );
  }

  // ─── 선수 스탯 탭 ───
  Widget _buildStatsTab() {
    if (_matches.isEmpty) {
      return Center(child: Text('경기 기록이 없습니다', style: TextStyle(color: Colors.white.withAlpha(102))));
    }

    // 선수별 스탯 집계
    final playerStats = <int, Map<String, dynamic>>{};
    final completedMatches = _matches.where((m) => m['status'] == 'completed').toList();

    for (final match in completedMatches) {
      final events = (match['events'] as List?) ?? [];
      for (final event in events) {
        final playerId = event['player_id'];
        if (playerId == null || event['player_is_guest'] == true) continue;

        playerStats.putIfAbsent(playerId, () => {
          'id': playerId,
          'name': event['player_name'] ?? '?',
          'goals': 0,
          'assists': 0,
          'defenses': 0,
          'mvpScore': 0.0,
        });

        final stats = playerStats[playerId]!;
        if (event['event_type'] == 'GOAL') {
          stats['goals'] = (stats['goals'] as int) + 1;
          stats['mvpScore'] = (stats['mvpScore'] as double) + 2.0;
        } else if (event['event_type'] == 'DEFENSE') {
          stats['defenses'] = (stats['defenses'] as int) + 1;
          stats['mvpScore'] = (stats['mvpScore'] as double) + 0.5;
        }

        // 어시스트
        final assisterId = event['assister_id'];
        if (assisterId != null && event['event_type'] == 'GOAL' && event['assister_is_guest'] != true) {
          playerStats.putIfAbsent(assisterId, () => {
            'id': assisterId,
            'name': event['assister_name'] ?? '?',
            'goals': 0,
            'assists': 0,
            'defenses': 0,
            'mvpScore': 0.0,
          });
          playerStats[assisterId]!['assists'] = (playerStats[assisterId]!['assists'] as int) + 1;
          playerStats[assisterId]!['mvpScore'] = (playerStats[assisterId]!['mvpScore'] as double) + 1.0;
        }
      }
    }
    // 팀 순위 계산 → 우승팀 멤버에 1.5점 가점
    final teamStandings = <int, Map<String, dynamic>>{};
    for (final team in _teams) {
      final members = (team['members'] as List?) ?? [];
      teamStandings[team['id']] = {
        'points': 0,
        'goalsFor': 0,
        'memberPlayerIds': members.map((m) => m['player_id']).where((id) => id != null).toSet(),
      };
    }

    for (final match in completedMatches) {
      final t1 = teamStandings[match['team1_id']];
      final t2 = teamStandings[match['team2_id']];
      if (t1 != null && t2 != null) {
        final s1 = (match['team1_score'] ?? 0) as int;
        final s2 = (match['team2_score'] ?? 0) as int;
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

    // 1등 팀 찾기
    int? winningTeamId;
    int maxPoints = -1;
    for (final entry in teamStandings.entries) {
      final pts = entry.value['points'] as int;
      if (pts > maxPoints) {
        maxPoints = pts;
        winningTeamId = entry.key;
      }
    }

    // 우승팀 멤버에 1.5점 가점
    if (winningTeamId != null && maxPoints > 0) {
      final winnerIds = teamStandings[winningTeamId]!['memberPlayerIds'] as Set;
      for (final entry in playerStats.entries) {
        if (winnerIds.contains(entry.key)) {
          entry.value['mvpScore'] = (entry.value['mvpScore'] as double) + 1.5;
        }
      }
    }

    final sorted = playerStats.values.toList()..sort((a, b) => (b['mvpScore'] as double).compareTo(a['mvpScore'] as double));
    if (sorted.isEmpty) {
      return Center(child: Text('완료된 경기가 없습니다', style: TextStyle(color: Colors.white.withAlpha(102))));
    }

    // 최대 점수로 정규화 (10점 만점)
    final maxScore = (sorted.first['mvpScore'] as double);
    for (final s in sorted) {
      s['normalizedScore'] = maxScore > 0 ? ((s['mvpScore'] as double) / maxScore) * 10 : 0.0;
    }

    // 상위권
    final mvp = sorted.first;
    final topScorer = List.from(sorted)..sort((a, b) => (b['goals'] as int).compareTo(a['goals'] as int));
    final topAssister = List.from(sorted)..sort((a, b) => (b['assists'] as int).compareTo(a['assists'] as int));
    final topDefender = List.from(sorted)..sort((a, b) => (b['defenses'] as int).compareTo(a['defenses'] as int));

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 하이라이트 카드
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

          // 전체 스탯 테이블
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
                // 헤더
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
                // 행
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

  @override
  void initState() {
    super.initState();
    _load();
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
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  int _goalCount(int teamId) => _events.where((e) => e['event_type'] == 'GOAL' && e['team_id'] == teamId).length;

  Future<void> _addEvent(String type, int? playerId, String? guestName, int teamId, {int? assisterId}) async {
    final auth = context.read<AuthService>();
    if (auth.token == null || _busy) return;
    setState(() => _busy = true);
    try {
      await _api.addMatchEvent(widget.match['id'], {
        'eventType': type,
        'playerId': playerId,
        'guestName': guestName,
        'teamId': teamId,
        // ignore: use_null_aware_elements
        if (assisterId != null) 'assisterId': assisterId,
        'eventTime': 0,
      }, auth.token!);
      await _load();
    } catch (_) {}
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
                // 스코어보드
                _buildScoreboard(team1, team2, team1Id, team2Id),
                const SizedBox(height: 8),
                // 기록 영역
                Expanded(
                  child: _assistScorerPlayerId != null || _assistScorerGuestName != null
                      ? _buildAssistSelector(team1Id, team2Id)
                      : SingleChildScrollView(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Column(
                            children: [
                              _buildGoalSection(team1, team2, team1Id, team2Id),
                              const SizedBox(height: 12),
                              _buildDefenseSection(team1, team2, team1Id, team2Id),
                              const SizedBox(height: 12),
                              _buildEventLog(),
                              const SizedBox(height: 24),
                            ],
                          ),
                        ),
                ),
              ],
            ),
    );
  }

  Widget _buildScoreboard(dynamic team1, dynamic team2, int team1Id, int team2Id) {
    final status = _matchData?['status'] ?? 'pending';
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
                Text('VS', style: TextStyle(fontSize: 14, color: Colors.white.withAlpha(64))),
                const SizedBox(height: 8),
                // 상태 버튼
                if (status == 'pending')
                  _actionChip('▶ 시작', const Color(0xFF34d399), () => _updateStatus('playing'))
                else if (status == 'playing')
                  _actionChip('✓ 완료', const Color(0xFF3b82f6), () => _updateStatus('completed'))
                else
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF3b82f6).withAlpha(26),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text('완료', style: TextStyle(fontSize: 11, color: Color(0xFF3b82f6))),
                  ),
              ]),
              Expanded(child: Column(children: [
                Text(team2['name'] ?? 'B팀', style: TextStyle(fontSize: 12, color: Colors.white.withAlpha(153))),
                Text('${_goalCount(team2Id)}', style: const TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: Colors.white)),
              ])),
            ],
          ),
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
              // 팀 1
              Expanded(child: _teamGoalButtons(_team1Members, team1Id, const Color(0xFF34d399), team1['name'] ?? 'A팀')),
              const SizedBox(width: 8),
              // 팀 2
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
            // 단독 득점
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
                    _addEvent('GOAL', _assistScorerPlayerId, _assistScorerGuestName, _assistTeamId!, assisterId: m['player_id']);
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

  Widget _buildEventLog() {
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
            ..._events.reversed.take(10).map((e) {
              final type = e['event_type'] ?? '';
              final icon = type == 'GOAL' ? '⚽' : '🛡️';
              final name = e['player_name'] ?? e['guest_name'] ?? '?';
              final assister = e['assister_name'];
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(border: Border(top: BorderSide(color: Colors.white.withAlpha(8)))),
                child: Row(
                  children: [
                    Text(icon, style: const TextStyle(fontSize: 13)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Row(
                        children: [
                          Text(name, style: const TextStyle(fontSize: 13, color: Colors.white)),
                          if (assister != null && assister.toString().isNotEmpty) ...[
                            const SizedBox(width: 4),
                            Text('($assister)', style: TextStyle(fontSize: 11, color: Colors.white.withAlpha(102))),
                          ],
                        ],
                      ),
                    ),
                    GestureDetector(
                      onTap: () => _deleteEvent(e['id']),
                      child: Icon(Icons.close, size: 14, color: Colors.white.withAlpha(51)),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}
