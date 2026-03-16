import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'dart:math';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

class PlayerDetailScreen extends StatefulWidget {
  final int playerId;
  const PlayerDetailScreen({super.key, required this.playerId});
  @override
  State<PlayerDetailScreen> createState() => _PlayerDetailScreenState();
}

class _PlayerDetailScreenState extends State<PlayerDetailScreen> with SingleTickerProviderStateMixin {
  Map<String, dynamic>? _player;
  Map<String, dynamic>? _logs;
  bool _loading = true;
  late TabController _tabController;
  int _logTab = 0; // 0=goals, 1=assists, 2=defenses, 3=mvp, 4=placements

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final year = DateTime.now().year;
      final results = await Future.wait([
        ApiService().getPlayer(widget.playerId),
        ApiService().getPlayerEventLogs(widget.playerId, year: year),
      ]);
      setState(() {
        _player = results[0];
        _logs = results[1];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: AppColors.bgBase,
        title: Text(_player?['player']?['name'] ?? '선수 정보', style: const TextStyle(color: Colors.white)),
        iconTheme: const IconThemeData(color: Colors.white),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor: Colors.white38,
          tabs: const [Tab(text: '능력치'), Tab(text: '기록 로그')],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : TabBarView(
              controller: _tabController,
              children: [_buildAbilityTab(), _buildLogsTab()],
            ),
      floatingActionButton: _loading || _player?['player'] == null
          ? null
          : FloatingActionButton.extended(
              onPressed: _showRatingDialog,
              backgroundColor: AppColors.primary,
              icon: const Icon(Icons.star, color: AppColors.bgBase),
              label: const Text('평가하기', style: TextStyle(color: AppColors.bgBase, fontWeight: FontWeight.bold)),
            ),
    );
  }

  void _showRatingDialog() {
    final auth = context.read<AuthService>();
    final token = auth.token;
    if (token == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('로그인이 필요합니다')));
      return;
    }

    final p = _player?['player'];
    if (p == null) return;

    // 초기값 50으로 설정
    final Map<String, double> tempStats = {
      'shooting': 50,
      'offball_run': 50,
      'ball_keeping': 50,
      'passing': 50,
      'linkup': 50,
      'intercept': 50,
      'marking': 50,
      'stamina': 50,
      'speed': 50,
      'physical': 50,
    };

    final labels = {'shooting':'슈팅', 'offball_run':'오프더볼', 'ball_keeping':'볼키핑', 'passing':'패스', 'linkup':'연계', 'intercept':'인터셉트', 'marking':'마킹', 'stamina':'체력', 'speed':'스피드', 'physical':'피지컬'};

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          return Container(
            height: MediaQuery.of(context).size.height * 0.85,
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(
              color: AppColors.bgCard,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('${p['name']} 능력치 평가', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.white54),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Expanded(
                  child: ListView(
                    children: tempStats.keys.map((key) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(labels[key]!, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                                Text('${tempStats[key]?.toInt()}', style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
                              ],
                            ),
                            Slider(
                              value: tempStats[key]!,
                              min: 0, max: 100, divisions: 100,
                              activeColor: AppColors.primary,
                              inactiveColor: Colors.white.withAlpha(26),
                              onChanged: (val) => setModalState(() => tempStats[key] = val),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () async {
                      try {
                        await ApiService().submitRating(widget.playerId, tempStats, token);
                        if (ctx.mounted) Navigator.pop(ctx);
                        _load(); // 새로고침
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('평가가 등록되었습니다 ✅'), backgroundColor: AppColors.primary));
                        }
                      } catch (e) {
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.red));
                        }
                      }
                    },
                    child: const Text('제출하기', style: TextStyle(color: AppColors.bgBase, fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildAbilityTab() {
    final p = _player?['player'];
    if (p == null) return const Center(child: Text('데이터 없음', style: TextStyle(color: Colors.white38)));

    final Map<String, double> stats = {
      '슈팅': (p['shooting'] ?? 50).toDouble(),
      '오프더볼': (p['offball_run'] ?? 50).toDouble(),
      '볼키핑': (p['ball_keeping'] ?? 50).toDouble(),
      '패스': (p['passing'] ?? 50).toDouble(),
      '연계': (p['linkup'] ?? 50).toDouble(),
      '인터셉트': (p['intercept'] ?? 50).toDouble(),
      '마킹': (p['marking'] ?? 50).toDouble(),
      '체력': (p['stamina'] ?? 50).toDouble(),
      '스피드': (p['speed'] ?? 50).toDouble(),
      '피지컬': (p['physical'] ?? 50).toDouble(),
    };

    final avgOverall = stats.values.reduce((a, b) => a + b) / stats.length;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // 프로필 카드
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.bgCard,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.white.withAlpha(13)),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 32,
                  backgroundColor: AppColors.bgBorder,
                  child: Text((p['name'] ?? '?')[0], style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(p['name'] ?? '', style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                      if (p['nickname'] != null)
                        Text(p['nickname'], style: const TextStyle(color: Colors.white54, fontSize: 14)),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withAlpha(26),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text('OVR ${avgOverall.toStringAsFixed(0)}',
                            style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // 레이더 차트
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.bgCard,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.white.withAlpha(13)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('능력치', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 16),
                SizedBox(
                  height: 280,
                  child: CustomPaint(
                    size: const Size(280, 280),
                    painter: _RadarChartPainter(stats),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // 스탯 바
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.bgCard,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.white.withAlpha(13)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('상세 능력치', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),
                ...stats.entries.map((e) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    children: [
                      SizedBox(width: 70, child: Text(e.key, style: const TextStyle(color: Colors.white54, fontSize: 13))),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: e.value / 100,
                            backgroundColor: Colors.white.withAlpha(13),
                            color: _getStatColor(e.value),
                            minHeight: 8,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      SizedBox(width: 30, child: Text('${e.value.toInt()}', style: TextStyle(color: _getStatColor(e.value), fontWeight: FontWeight.bold, fontSize: 14), textAlign: TextAlign.right)),
                    ],
                  ),
                )),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Color _getStatColor(double val) {
    if (val >= 80) return AppColors.primary;
    if (val >= 60) return AppColors.blueLight;
    if (val >= 40) return AppColors.amberLight;
    return AppColors.redLight;
  }

  Widget _buildLogsTab() {
    if (_logs == null) return const Center(child: Text('데이터 없음', style: TextStyle(color: Colors.white38)));

    final goals = _logs!['goals'] as List? ?? [];
    final assists = _logs!['assists'] as List? ?? [];
    final defenses = _logs!['defenses'] as List? ?? [];
    final mvps = _logs!['mvpRecords'] as List? ?? [];
    final placements = _logs!['placements'] as List? ?? [];

    final tabs = [
      {'icon': '⚽', 'label': '득점', 'count': goals.length},
      {'icon': '⚡', 'label': '도움', 'count': assists.length},
      {'icon': '🛡️', 'label': '수비', 'count': defenses.length},
      {'icon': '🏆', 'label': 'MVP', 'count': mvps.length},
      {'icon': '🏅', 'label': '순위', 'count': placements.length},
    ];

    List<dynamic> currentList;
    switch (_logTab) {
      case 1: currentList = assists; break;
      case 2: currentList = defenses; break;
      case 3: currentList = mvps; break;
      case 4: currentList = placements; break;
      default: currentList = goals;
    }

    return Column(
      children: [
        // 로그 탭 바
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Row(
            children: List.generate(tabs.length, (i) {
              final t = tabs[i];
              final active = _logTab == i;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: GestureDetector(
                  onTap: () => setState(() => _logTab = i),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: active ? AppColors.primary.withAlpha(26) : AppColors.bgCard,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: active ? AppColors.primary.withAlpha(77) : Colors.white.withAlpha(13)),
                    ),
                    child: Row(
                      children: [
                        Text(t['icon'] as String, style: const TextStyle(fontSize: 14)),
                        const SizedBox(width: 6),
                        Text(t['label'] as String,
                            style: TextStyle(color: active ? AppColors.primary : Colors.white54, fontWeight: FontWeight.w600, fontSize: 13)),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: Colors.white.withAlpha(active ? 26 : 13), borderRadius: BorderRadius.circular(6)),
                          child: Text('${t['count']}', style: TextStyle(color: active ? AppColors.primary : Colors.white38, fontSize: 11, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
        // 로그 리스트
        Expanded(
          child: currentList.isEmpty
              ? Center(child: Text('${tabs[_logTab]['label']} 기록이 없습니다', style: const TextStyle(color: Colors.white38)))
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: currentList.length,
                  itemBuilder: (ctx, i) {
                    final item = currentList[i];
                    return _buildLogRow(item);
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildLogRow(dynamic item) {
    final date = item['session_date'] ?? '';
    final d = DateTime.tryParse(date);
    final dateStr = d != null ? '${d.month}/${d.day}' : '';

    String icon, main, sub;

    if (_logTab == 0) {
      icon = '⚽';
      main = '${item['match_no'] ?? '?'}경기 골';
      sub = item['assister_name'] != null ? '어시: ${item['assister_name']}' : '단독';
    } else if (_logTab == 1) {
      icon = '⚡';
      main = '${item['match_no'] ?? '?'}경기 도움';
      sub = '득점: ${item['scorer_name'] ?? '?'}';
    } else if (_logTab == 2) {
      icon = '🛡️';
      main = '${item['match_no'] ?? '?'}경기 수비';
      sub = '';
    } else if (_logTab == 3) {
      icon = '🏆';
      main = '세션 MVP';
      sub = item['title'] ?? '';
    } else {
      final rank = item['team_rank'] ?? 0;
      icon = rank == 1 ? '🥇' : rank == 2 ? '🥈' : '🥉';
      main = '$rank등 (${item['team_name'] ?? ''})';
      sub = '승점 ${item['points'] ?? 0}';
    }

    final match = _logTab < 3
        ? '${item['team1_name'] ?? ''} ${item['team1_score'] ?? 0}-${item['team2_score'] ?? 0} ${item['team2_name'] ?? ''}'
        : '';

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Text(icon, style: const TextStyle(fontSize: 18)),
          const SizedBox(width: 10),
          Text(dateStr, style: const TextStyle(color: Colors.white38, fontSize: 12, fontFamily: 'monospace')),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(main, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                if (sub.isNotEmpty) Text(sub, style: const TextStyle(color: Colors.white38, fontSize: 11)),
              ],
            ),
          ),
          if (match.isNotEmpty)
            Text(match, style: const TextStyle(color: Colors.white24, fontSize: 11)),
        ],
      ),
    );
  }
}

class _RadarChartPainter extends CustomPainter {
  final Map<String, double> stats;
  _RadarChartPainter(this.stats);

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = min(size.width, size.height) / 2 - 30;
    final labels = stats.keys.toList();
    final values = stats.values.toList();
    final n = labels.length;
    final angle = 2 * pi / n;

    // Grid
    final gridPaint = Paint()..color = Colors.white.withAlpha(26)..style = PaintingStyle.stroke..strokeWidth = 1;
    for (int level = 1; level <= 5; level++) {
      final r = radius * level / 5;
      final path = Path();
      for (int i = 0; i <= n; i++) {
        final a = -pi / 2 + angle * (i % n);
        final pt = Offset(center.dx + r * cos(a), center.dy + r * sin(a));
        i == 0 ? path.moveTo(pt.dx, pt.dy) : path.lineTo(pt.dx, pt.dy);
      }
      canvas.drawPath(path, gridPaint);
    }

    // Lines
    for (int i = 0; i < n; i++) {
      final a = -pi / 2 + angle * i;
      canvas.drawLine(center, Offset(center.dx + radius * cos(a), center.dy + radius * sin(a)), gridPaint);
    }

    // Data polygon
    final dataPath = Path();
    final fillPaint = Paint()..color = AppColors.primary.withAlpha(51)..style = PaintingStyle.fill;
    final strokePaint = Paint()..color = AppColors.primary..style = PaintingStyle.stroke..strokeWidth = 2;

    for (int i = 0; i <= n; i++) {
      final idx = i % n;
      final a = -pi / 2 + angle * idx;
      final r = radius * (values[idx] / 100);
      final pt = Offset(center.dx + r * cos(a), center.dy + r * sin(a));
      i == 0 ? dataPath.moveTo(pt.dx, pt.dy) : dataPath.lineTo(pt.dx, pt.dy);
    }
    canvas.drawPath(dataPath, fillPaint);
    canvas.drawPath(dataPath, strokePaint);

    // Labels
    final tp = TextPainter(textDirection: TextDirection.ltr);
    for (int i = 0; i < n; i++) {
      final a = -pi / 2 + angle * i;
      final labelR = radius + 20;
      final pt = Offset(center.dx + labelR * cos(a), center.dy + labelR * sin(a));
      tp.text = TextSpan(text: labels[i], style: const TextStyle(color: Colors.white54, fontSize: 10));
      tp.layout();
      canvas.save();
      canvas.translate(pt.dx - tp.width / 2, pt.dy - tp.height / 2);
      tp.paint(canvas, Offset.zero);
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
