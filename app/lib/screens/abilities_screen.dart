import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_colors.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../utils/futsal_dna.dart';
import '../widgets/radar_chart.dart';
import 'player_detail_screen.dart';

class AbilitiesScreen extends StatefulWidget {
  const AbilitiesScreen({super.key});

  @override
  State<AbilitiesScreen> createState() => _AbilitiesScreenState();
}

enum _Sort { overall, shooting, passing, speed, physical, stamina, name }

class _AbilitiesScreenState extends State<AbilitiesScreen> {
  final ApiService _api = ApiService();
  bool _loading = true;
  List<dynamic> _players = [];
  _Sort _sort = _Sort.overall;
  int? _expandedId;

  static const _statKeys = [
    'shooting', 'offball_run', 'ball_keeping', 'passing', 'linkup',
    'intercept', 'marking', 'stamina', 'speed', 'physical',
  ];
  static const _statLabels = {
    'shooting': '슈팅', 'offball_run': '오프더볼', 'ball_keeping': '볼키핑',
    'passing': '패스', 'linkup': '연계', 'intercept': '인터셉트',
    'marking': '마킹', 'stamina': '스태미나', 'speed': '스피드', 'physical': '피지컬',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final token = context.read<AuthService>().token;
    if (token == null) return;
    try {
      final data = await _api.getPlayers(token: token);
      _players = ((data['players'] as List?) ?? [])
          .where((p) => p['is_guest'] != 1)
          .toList();
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  double _overall(dynamic p) {
    double sum = 0;
    for (final k in _statKeys) {
      sum += ((p[k] ?? 75) as num).toDouble();
    }
    return sum / _statKeys.length;
  }

  List<dynamic> get _sorted {
    final list = List.from(_players);
    switch (_sort) {
      case _Sort.overall:
        list.sort((a, b) => _overall(b).compareTo(_overall(a)));
        break;
      case _Sort.name:
        list.sort((a, b) => (a['name'] ?? '').toString().compareTo((b['name'] ?? '').toString()));
        break;
      default:
        final key = _sort.name;
        list.sort((a, b) => ((b[key] ?? 75) as num).compareTo((a[key] ?? 75) as num));
    }
    return list;
  }

  Map<String, double> _statsMap(dynamic p) {
    return {
      for (final k in _statKeys)
        _statLabels[k]!: ((p[k] ?? 75) as num).toDouble(),
    };
  }

  Color _overallColor(double v) {
    if (v >= 85) return AppColors.primary;
    if (v >= 70) return AppColors.blue;
    if (v >= 55) return AppColors.amber;
    return AppColors.slate;
  }

  @override
  Widget build(BuildContext context) {
    final sorted = _sorted;

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('능력치', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        actions: [
          PopupMenuButton<_Sort>(
            icon: const Icon(Icons.sort, size: 20),
            color: AppColors.bgCard,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            onSelected: (s) => setState(() => _sort = s),
            itemBuilder: (_) => [
              _sortItem(_Sort.overall, '종합'),
              _sortItem(_Sort.shooting, '슈팅'),
              _sortItem(_Sort.passing, '패스'),
              _sortItem(_Sort.speed, '스피드'),
              _sortItem(_Sort.physical, '피지컬'),
              _sortItem(_Sort.stamina, '스태미나'),
              _sortItem(_Sort.name, '이름'),
            ],
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : RefreshIndicator(
              color: AppColors.primary,
              onRefresh: () async {
                setState(() => _loading = true);
                await _load();
              },
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: sorted.length,
                itemBuilder: (_, i) => _playerCard(sorted[i], i + 1),
              ),
            ),
    );
  }

  PopupMenuItem<_Sort> _sortItem(_Sort s, String label) {
    return PopupMenuItem(
      value: s,
      child: Row(
        children: [
          if (_sort == s) const Icon(Icons.check, size: 16, color: AppColors.primary) else const SizedBox(width: 16),
          const SizedBox(width: 8),
          Text(label, style: const TextStyle(color: Colors.white, fontSize: 13)),
        ],
      ),
    );
  }

  Widget _playerCard(dynamic p, int rank) {
    final ovr = _overall(p);
    final color = _overallColor(ovr);
    final name = p['name'] ?? '?';
    final ratingCount = p['rating_count'] ?? 0;
    final isExpanded = _expandedId == p['id'];
    final dna = FutsalDna.fromPlayer(p is Map<String, dynamic> ? p : Map<String, dynamic>.from(p as Map));

    return GestureDetector(
      onTap: () => setState(() => _expandedId = isExpanded ? null : p['id']),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.bgCard,
          borderRadius: BorderRadius.circular(16),
          border: isExpanded ? Border.all(color: color.withAlpha(60)) : null,
        ),
        child: Column(
          children: [
            Row(
              children: [
                // Rank
                SizedBox(
                  width: 28,
                  child: Text(
                    '$rank',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: rank <= 3 ? [AppColors.gold, AppColors.silver, AppColors.bronze][rank - 1] : Colors.white.withAlpha(77),
                    ),
                  ),
                ),
                // Overall badge
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    color: color.withAlpha(20),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: Text(
                      ovr.toStringAsFixed(0),
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                // Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(child: Text(name.toString(), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white), overflow: TextOverflow.ellipsis)),
                          if (dna != null) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: color.withAlpha(15),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text('${dna.emoji} ${dna.type}', style: TextStyle(fontSize: 10, color: color)),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          _miniStat('슈팅', p['shooting']),
                          _miniStat('패스', p['passing']),
                          _miniStat('스피드', p['speed']),
                          _miniStat('피지컬', p['physical']),
                          Text(
                            '평가 ${ratingCount}건',
                            style: TextStyle(fontSize: 10, color: Colors.white.withAlpha(51)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                // Expand indicator
                Icon(
                  isExpanded ? Icons.expand_less : Icons.expand_more,
                  size: 20,
                  color: Colors.white.withAlpha(51),
                ),
              ],
            ),
            // Expanded detail
            if (isExpanded) ...[
              const SizedBox(height: 16),
              Center(child: RadarChart(stats: _statsMap(p), size: 220, color: color)),
              const SizedBox(height: 12),
              // Stat bars
              ..._statKeys.map((k) {
                final v = ((p[k] ?? 75) as num).toDouble();
                return Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      SizedBox(width: 60, child: Text(_statLabels[k]!, style: TextStyle(fontSize: 11, color: Colors.white.withAlpha(128)))),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(3),
                          child: LinearProgressIndicator(
                            value: v / 100,
                            backgroundColor: Colors.white.withAlpha(13),
                            color: _overallColor(v),
                            minHeight: 6,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(width: 24, child: Text(v.toStringAsFixed(0), style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: _overallColor(v)), textAlign: TextAlign.right)),
                    ],
                  ),
                );
              }),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => PlayerDetailScreen(playerId: p['id']))),
                  child: const Text('상세 보기 >', style: TextStyle(color: AppColors.primary, fontSize: 12)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _miniStat(String label, dynamic value) {
    final v = ((value ?? 75) as num).toInt();
    return Padding(
      padding: const EdgeInsets.only(right: 10),
      child: Text(
        '$label $v',
        style: TextStyle(fontSize: 10, color: Colors.white.withAlpha(102)),
      ),
    );
  }
}
