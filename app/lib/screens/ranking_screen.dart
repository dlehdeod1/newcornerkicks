import 'package:flutter/material.dart';
import '../services/api_service.dart';

class RankingScreen extends StatefulWidget {
  const RankingScreen({super.key});

  @override
  State<RankingScreen> createState() => _RankingScreenState();
}

class _RankingScreenState extends State<RankingScreen> {
  final ApiService _api = ApiService();
  List<dynamic> _rankings = [];
  bool _loading = true;
  String _sortBy = 'mvpCount';

  final List<Map<String, dynamic>> _categories = [
    {'key': 'mvpCount', 'label': 'MVP', 'icon': '⭐', 'color': const Color(0xFF34d399)},
    {'key': 'goals', 'label': '득점', 'icon': '⚽', 'color': const Color(0xFFf59e0b)},
    {'key': 'assists', 'label': '도움', 'icon': '⚡', 'color': const Color(0xFF3b82f6)},
    {'key': 'defenses', 'label': '수비', 'icon': '🛡️', 'color': const Color(0xFF8b5cf6)},
    {'key': 'games', 'label': '경기', 'icon': '🎮', 'color': const Color(0xFF64748b)},
  ];

  @override
  void initState() {
    super.initState();
    _loadRankings();
  }

  Future<void> _loadRankings() async {
    try {
      final res = await _api.getRankings(year: DateTime.now().year);
      if (mounted) {
        setState(() {
          _rankings = (res['data']?['rankings'] as List?) ?? [];
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<dynamic> get _sorted {
    final list = List.from(_rankings);
    list.sort((a, b) {
      final aVal = (a[_sortBy] ?? 0) as num;
      final bVal = (b[_sortBy] ?? 0) as num;
      return bVal.compareTo(aVal);
    });
    return list;
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async {
        setState(() => _loading = true);
        await _loadRankings();
      },
      child: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF34d399)))
          : _rankings.isEmpty
              ? _buildEmpty()
              : CustomScrollView(
                  slivers: [
                    SliverToBoxAdapter(child: _buildCategoryChips()),
                    if (_sorted.length >= 3) SliverToBoxAdapter(child: _buildPodium()),
                    SliverToBoxAdapter(child: const SizedBox(height: 8)),
                    SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (ctx, i) => _buildPlayerRow(_sorted[i], i + 1),
                        childCount: _sorted.length,
                      ),
                    ),
                    const SliverToBoxAdapter(child: SizedBox(height: 24)),
                  ],
                ),
    );
  }

  Widget _buildEmpty() {
    return ListView(
      children: [
        SizedBox(
          height: MediaQuery.of(context).size.height * 0.6,
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.emoji_events_outlined, size: 48, color: Colors.white.withAlpha(51)),
                const SizedBox(height: 16),
                Text('랭킹 데이터가 없습니다', style: TextStyle(color: Colors.white.withAlpha(102), fontSize: 16)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCategoryChips() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: _categories.map((cat) {
            final isActive = _sortBy == cat['key'];
            final color = cat['color'] as Color;
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: GestureDetector(
                onTap: () => setState(() => _sortBy = cat['key']),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: isActive ? color.withAlpha(26) : Colors.white.withAlpha(8),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: isActive ? color.withAlpha(102) : Colors.white.withAlpha(20)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(cat['icon'], style: const TextStyle(fontSize: 14)),
                      const SizedBox(width: 6),
                      Text(
                        cat['label'],
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
                          color: isActive ? color : Colors.white.withAlpha(153),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildPodium() {
    final top3 = _sorted.take(3).toList();
    final positions = [
      {'idx': 1, 'medal': '🥈', 'height': 80.0},
      {'idx': 0, 'medal': '🥇', 'height': 110.0},
      {'idx': 2, 'medal': '🥉', 'height': 60.0},
    ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: positions.map((pos) {
          final player = top3[pos['idx'] as int];
          final name = player['name'] ?? '?';
          final val = player[_sortBy] ?? 0;
          final medal = pos['medal'] as String;
          final height = pos['height'] as double;
          final isFirst = pos['idx'] == 0;

          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Column(
                children: [
                  // 프로필
                  Container(
                    width: isFirst ? 64 : 52,
                    height: isFirst ? 64 : 52,
                    decoration: BoxDecoration(
                      color: Colors.white.withAlpha(13),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: isFirst ? const Color(0xFFf59e0b).withAlpha(128) : Colors.white.withAlpha(26),
                        width: isFirst ? 2 : 1,
                      ),
                    ),
                    child: Center(
                      child: Text(
                        name.toString().isNotEmpty ? name.toString()[0] : '?',
                        style: TextStyle(
                          fontSize: isFirst ? 24 : 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.white.withAlpha(204),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(medal, style: const TextStyle(fontSize: 18)),
                  Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white)),
                  Text('$val', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF34d399))),
                  const SizedBox(height: 6),
                  // 포디움 바
                  Container(
                    height: height,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: isFirst
                            ? [const Color(0xFFf59e0b), const Color(0xFFd97706)]
                            : pos['idx'] == 1
                                ? [const Color(0xFF94a3b8), const Color(0xFF64748b)]
                                : [const Color(0xFFd97706), const Color(0xFF92400e)],
                      ),
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(12),
                        topRight: Radius.circular(12),
                      ),
                    ),
                    child: Center(
                      child: Text(
                        '${(pos['idx'] as int) + 1}',
                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white70),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildPlayerRow(dynamic player, int rank) {
    final name = player['name'] ?? '?';
    final val = player[_sortBy] ?? 0;
    final currentCat = _categories.firstWhere((c) => c['key'] == _sortBy);
    final color = currentCat['color'] as Color;

    String rankDisplay;
    if (rank == 1) {
      rankDisplay = '🥇';
    } else if (rank == 2) {
      rankDisplay = '🥈';
    } else if (rank == 3) {
      rankDisplay = '🥉';
    } else {
      rankDisplay = '$rank';
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 3),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: rank <= 3 ? const Color(0xFFf59e0b).withAlpha(8) : Colors.white.withAlpha(5),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withAlpha(13)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 30,
            child: Center(
              child: rank <= 3
                  ? Text(rankDisplay, style: const TextStyle(fontSize: 16))
                  : Text(rankDisplay, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white.withAlpha(102))),
            ),
          ),
          const SizedBox(width: 10),
          // 아바타
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(10),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.white.withAlpha(20)),
            ),
            child: Center(
              child: Text(
                name.toString().isNotEmpty ? name.toString()[0] : '?',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white.withAlpha(179)),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white))),
          // 값
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: color.withAlpha(20),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '$val',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: color),
            ),
          ),
        ],
      ),
    );
  }
}
