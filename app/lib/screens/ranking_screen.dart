import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import 'player_detail_screen.dart';
import 'hall_of_fame_screen.dart';

class RankingScreen extends StatefulWidget {
  const RankingScreen({super.key});

  @override
  State<RankingScreen> createState() => _RankingScreenState();
}

class _RankingScreenState extends State<RankingScreen> {
  final ApiService _api = ApiService();
  List<dynamic> _rankings = [];
  Map<String, dynamic>? _stats;
  bool _loading = true;
  bool _refreshing = false;
  String _sortBy = 'mvpCount';
  int _selectedYear = DateTime.now().year;
  String? _lastLoadedToken;

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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthService>();
      if (!auth.isLoading) {
        _loadRankings();
      }
      // AuthService가 아직 로딩 중이면 didChangeDependencies에서 처리
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final auth = context.watch<AuthService>();
    // token이 준비되거나 변경됐을 때 자동 재로드
    if (!auth.isLoading && auth.token != _lastLoadedToken) {
      _lastLoadedToken = auth.token;
      _loadRankings();
    }
  }

  Future<void> _loadRankings() async {
    final token = context.read<AuthService>().token;
    try {
      final res = await _api.getRankings(year: _selectedYear, token: token);
      if (mounted) {
        setState(() {
          _rankings = (res['data']?['rankings'] as List?) ?? [];
          _stats = res['data']?['stats'];
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<dynamic> get _sorted {
    final list = List.from(_rankings.where((p) => (p[_sortBy] ?? 0) > 0));
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
      color: const Color(0xFF34d399),
      child: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF34d399)))
          : CustomScrollView(
              slivers: [
                SliverToBoxAdapter(child: _buildHeader()),
                SliverToBoxAdapter(child: _buildStats()),
                SliverToBoxAdapter(child: _buildCategoryChips()),
                if (_sorted.length >= 3)
                  SliverToBoxAdapter(child: _buildPodium()),
                if (_sorted.isEmpty)
                  SliverToBoxAdapter(child: _buildEmpty())
                else
                  SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (ctx, i) => _buildPlayerRow(_sorted[i], i + 1),
                      childCount: _sorted.length,
                    ),
                  ),
                const SliverToBoxAdapter(child: SizedBox(height: 32)),
              ],
            ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(
        children: [
          // 연도 선택
          GestureDetector(
            onTap: () => _showYearPicker(),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(10),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white.withAlpha(20)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '$_selectedYear시즌',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  const SizedBox(width: 6),
                  Icon(Icons.expand_more, color: Colors.white.withAlpha(128), size: 18),
                ],
              ),
            ),
          ),
          const Spacer(),
          // 어드민: 랭킹 갱신
          if (context.read<AuthService>().isAdmin) ...[
            GestureDetector(
              onTap: _refreshing ? null : () async {
                setState(() => _refreshing = true);
                try {
                  await _api.refreshRankings(_selectedYear, context.read<AuthService>().token!);
                  await _loadRankings();
                } catch (_) {} finally {
                  if (mounted) setState(() => _refreshing = false);
                }
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                margin: const EdgeInsets.only(right: 8),
                decoration: BoxDecoration(
                  color: Colors.white.withAlpha(10),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withAlpha(20)),
                ),
                child: _refreshing
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Color(0xFF34d399), strokeWidth: 2))
                    : const Icon(Icons.refresh, size: 16, color: Colors.white54),
              ),
            ),
          ],
          // 명예의전당
          GestureDetector(
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const HallOfFameScreen())),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFf59e0b).withAlpha(20),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFf59e0b).withAlpha(51)),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('🏆', style: TextStyle(fontSize: 14)),
                  SizedBox(width: 6),
                  Text('명예의전당', style: TextStyle(fontSize: 12, color: Color(0xFFf59e0b), fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStats() {
    if (_stats == null) return const SizedBox.shrink();

    final items = [
      {'label': '총 세션', 'value': '${_stats!['totalSessions'] ?? 0}'},
      {'label': '총 경기', 'value': '${_stats!['totalMatches'] ?? 0}'},
      {'label': '총 득점', 'value': '${_stats!['totalGoals'] ?? 0}'},
      {'label': '참여 선수', 'value': '${_stats!['totalPlayers'] ?? 0}'},
    ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Row(
        children: items.map((item) => Expanded(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 3),
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(8),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                Text(item['value']!, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF34d399))),
                const SizedBox(height: 2),
                Text(item['label']!, style: TextStyle(fontSize: 10, color: Colors.white.withAlpha(102))),
              ],
            ),
          ),
        )).toList(),
      ),
    );
  }

  Widget _buildCategoryChips() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
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
                      Text(cat['icon'], style: const TextStyle(fontSize: 13)),
                      const SizedBox(width: 5),
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
      {'idx': 1, 'medal': '🥈', 'height': 80.0, 'rank': 2},
      {'idx': 0, 'medal': '🥇', 'height': 110.0, 'rank': 1},
      {'idx': 2, 'medal': '🥉', 'height': 60.0, 'rank': 3},
    ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: positions.map((pos) {
          final idx = pos['idx'] as int;
          if (idx >= top3.length) return const Expanded(child: SizedBox());
          final player = top3[idx];
          final name = player['name'] ?? '?';
          final val = player[_sortBy] ?? 0;
          final medal = pos['medal'] as String;
          final height = pos['height'] as double;
          final isFirst = idx == 0;
          final color = isFirst
              ? const Color(0xFFf59e0b)
              : idx == 1
                  ? const Color(0xFF94a3b8)
                  : const Color(0xFFd97706);

          return Expanded(
            child: GestureDetector(
              onTap: () => Navigator.push(context, MaterialPageRoute(
                builder: (_) => PlayerDetailScreen(playerId: player['id']),
              )),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Column(
                  children: [
                    Container(
                      width: isFirst ? 60 : 48,
                      height: isFirst ? 60 : 48,
                      decoration: BoxDecoration(
                        color: color.withAlpha(20),
                        borderRadius: BorderRadius.circular(isFirst ? 18 : 14),
                        border: Border.all(color: color.withAlpha(102), width: isFirst ? 2 : 1),
                      ),
                      child: Center(
                        child: Text(
                          name.toString().isNotEmpty ? name.toString()[0] : '?',
                          style: TextStyle(
                            fontSize: isFirst ? 22 : 18,
                            fontWeight: FontWeight.bold,
                            color: color,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(medal, style: TextStyle(fontSize: isFirst ? 20 : 16)),
                    Text(
                      name.toString().length > 4 ? '${name.toString().substring(0, 4)}…' : name.toString(),
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    Text(
                      '$val',
                      style: TextStyle(fontSize: isFirst ? 18 : 15, fontWeight: FontWeight.bold, color: color),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      height: height,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [color, color.withAlpha(153)],
                        ),
                        borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(10),
                          topRight: Radius.circular(10),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildEmpty() {
    return SizedBox(
      height: 300,
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.emoji_events_outlined, size: 48, color: Colors.white.withAlpha(51)),
            const SizedBox(height: 16),
            Text('이 카테고리의 기록이 없습니다', style: TextStyle(color: Colors.white.withAlpha(102), fontSize: 14)),
          ],
        ),
      ),
    );
  }

  Widget _buildPlayerRow(dynamic player, int rank) {
    final name = player['name'] ?? '?';
    final val = player[_sortBy] ?? 0;
    final currentCat = _categories.firstWhere((c) => c['key'] == _sortBy);
    final color = currentCat['color'] as Color;

    String rankDisplay;
    if (rank == 1) { rankDisplay = '🥇'; }
    else if (rank == 2) { rankDisplay = '🥈'; }
    else if (rank == 3) { rankDisplay = '🥉'; }
    else { rankDisplay = '$rank'; }

    return GestureDetector(
      onTap: () => Navigator.push(context, MaterialPageRoute(
        builder: (_) => PlayerDetailScreen(playerId: player['id']),
      )),
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 3),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: rank <= 3 ? color.withAlpha(8) : Colors.white.withAlpha(5),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: rank <= 3 ? color.withAlpha(26) : Colors.white.withAlpha(13)),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 32,
              child: Center(
                child: rank <= 3
                    ? Text(rankDisplay, style: const TextStyle(fontSize: 16))
                    : Text(rankDisplay, style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white.withAlpha(102))),
              ),
            ),
            const SizedBox(width: 10),
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withAlpha(15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: rank <= 3 ? color.withAlpha(51) : Colors.white.withAlpha(20)),
              ),
              child: Center(
                child: Text(
                  name.toString().isNotEmpty ? name.toString()[0] : '?',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: rank <= 3 ? color : Colors.white.withAlpha(179)),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
                  if (player['attendance'] != null)
                    Text('${player['attendance']}경기 참여', style: TextStyle(fontSize: 11, color: Colors.white.withAlpha(77))),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: color.withAlpha(20),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$val',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: color),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showYearPicker() {
    final currentYear = DateTime.now().year;
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1e293b),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 16),
          const Text('시즌 선택', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
          const SizedBox(height: 12),
          ...List.generate(3, (i) {
            final year = currentYear - i;
            final isSelected = year == _selectedYear;
            return ListTile(
              title: Text('$year시즌', style: TextStyle(color: isSelected ? const Color(0xFF34d399) : Colors.white)),
              trailing: isSelected ? const Icon(Icons.check, color: Color(0xFF34d399)) : null,
              onTap: () {
                Navigator.pop(context);
                setState(() { _selectedYear = year; _loading = true; });
                _loadRankings();
              },
            );
          }),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}
