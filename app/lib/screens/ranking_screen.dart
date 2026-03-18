import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
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

class _RankingScreenState extends State<RankingScreen> with SingleTickerProviderStateMixin {
  final ApiService _api = ApiService();
  late TabController _tabController;

  // 랭킹 데이터
  List<dynamic> _rankings = [];
  Map<String, dynamic>? _stats;
  bool _loading = true;
  bool _refreshing = false;
  String _sortBy = 'mvpCount';
  int _selectedYear = DateTime.now().year;
  String? _lastLoadedToken;

  // 통계 데이터
  Map<String, dynamic>? _funStats;
  bool _funStatsLoading = false;

  static int _currentSeasonYear(int startMonth) {
    final now = DateTime.now();
    if (startMonth <= 1) return now.year;
    return now.month >= startMonth ? now.year : now.year - 1;
  }

  final List<Map<String, dynamic>> _categories = [
    {'key': 'mvpCount', 'label': 'MVP', 'icon': '⭐', 'color': AppColors.primary},
    {'key': 'goals', 'label': '득점', 'icon': '⚽', 'color': AppColors.amber},
    {'key': 'assists', 'label': '도움', 'icon': '⚡', 'color': AppColors.blue},
    {'key': 'defenses', 'label': '수비', 'icon': '🛡️', 'color': AppColors.purple},
    {'key': 'games', 'label': '경기', 'icon': '🎮', 'color': AppColors.slate},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(() {
      if (_tabController.index == 1 && _funStats == null && !_funStatsLoading) {
        _loadFunStats();
      }
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthService>();
      _selectedYear = _currentSeasonYear(auth.seasonStartMonth);
      if (!auth.isLoading) {
        _loadRankings();
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final auth = context.watch<AuthService>();
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

  Future<void> _loadFunStats() async {
    setState(() => _funStatsLoading = true);
    try {
      final token = context.read<AuthService>().token;
      final res = await _api.getFunStats(year: _selectedYear, token: token);
      if (mounted) setState(() => _funStats = res);
    } catch (_) {}
    if (mounted) setState(() => _funStatsLoading = false);
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
    return Column(
      children: [
        // 헤더 + 연도 선택
        _buildHeader(),
        // 세그먼트 탭
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.white.withAlpha(8),
            borderRadius: BorderRadius.circular(12),
          ),
          child: TabBar(
            controller: _tabController,
            indicator: BoxDecoration(
              color: AppColors.primary.withAlpha(30),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.primary.withAlpha(80)),
            ),
            indicatorSize: TabBarIndicatorSize.tab,
            dividerColor: Colors.transparent,
            labelColor: AppColors.primary,
            unselectedLabelColor: Colors.white54,
            labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            unselectedLabelStyle: const TextStyle(fontSize: 13),
            tabs: const [
              Tab(text: '랭킹'),
              Tab(text: '통계'),
              Tab(text: '명예의전당'),
            ],
          ),
        ),
        // 탭 컨텐츠
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _buildRankingTab(),
              _buildStatsTab(),
              const HallOfFameScreen(embedded: true),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(
        children: [
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
                  Text('$_selectedYear시즌', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white)),
                  const SizedBox(width: 6),
                  Icon(Icons.expand_more, color: Colors.white.withAlpha(128), size: 18),
                ],
              ),
            ),
          ),
          const Spacer(),
          if (context.read<AuthService>().isAdmin)
            GestureDetector(
              onTap: _refreshing ? null : () async {
                setState(() => _refreshing = true);
                try {
                  await _api.refreshRankings(_selectedYear, context.read<AuthService>().token!);
                  await _loadRankings();
                  _funStats = null; // 통계도 갱신 필요
                } catch (_) {} finally {
                  if (mounted) setState(() => _refreshing = false);
                }
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white.withAlpha(10),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withAlpha(20)),
                ),
                child: _refreshing
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2))
                    : const Icon(Icons.refresh, size: 16, color: Colors.white54),
              ),
            ),
        ],
      ),
    );
  }

  // ─── 랭킹 탭 ───────────────────────────────────

  Widget _buildRankingTab() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    return RefreshIndicator(
      onRefresh: () async {
        setState(() => _loading = true);
        await _loadRankings();
      },
      color: AppColors.primary,
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: _buildRankingStats()),
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

  Widget _buildRankingStats() {
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
                Text(item['value']!, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.primary)),
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
          final color = isFirst ? AppColors.amber : idx == 1 ? AppColors.slateLight : AppColors.bronze;

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
                          style: TextStyle(fontSize: isFirst ? 22 : 18, fontWeight: FontWeight.bold, color: color),
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(medal, style: TextStyle(fontSize: isFirst ? 20 : 16)),
                    Text(
                      name.toString().length > 4 ? '${name.toString().substring(0, 4)}...' : name.toString(),
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    Text('$val', style: TextStyle(fontSize: isFirst ? 18 : 15, fontWeight: FontWeight.bold, color: color)),
                    const SizedBox(height: 6),
                    Container(
                      height: height,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [color, color.withAlpha(153)],
                        ),
                        borderRadius: const BorderRadius.only(topLeft: Radius.circular(10), topRight: Radius.circular(10)),
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
              child: Text('$val', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: color)),
            ),
          ],
        ),
      ),
    );
  }

  // ─── 통계 탭 ───────────────────────────────────

  Widget _buildStatsTab() {
    if (_funStatsLoading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    if (_funStats == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.analytics_outlined, size: 48, color: Colors.white.withAlpha(51)),
            const SizedBox(height: 16),
            Text('통계를 불러오는 중...', style: TextStyle(color: Colors.white.withAlpha(102))),
          ],
        ),
      );
    }

    final goalDuos = (_funStats!['goalDuos'] as List?) ?? [];
    final bestPartners = (_funStats!['bestPartners'] as List?) ?? [];
    final worstPartners = (_funStats!['worstPartners'] as List?) ?? [];
    final rivals = (_funStats!['rivals'] as List?) ?? [];

    return RefreshIndicator(
      onRefresh: () async {
        _funStats = null;
        await _loadFunStats();
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (goalDuos.isNotEmpty)
            _buildDuoSection('⚽ 베스트 득점 듀오', goalDuos, AppColors.amber),
          if (bestPartners.isNotEmpty)
            _buildDuoSection('🤝 베스트 파트너', bestPartners, AppColors.primary),
          if (worstPartners.isNotEmpty)
            _buildDuoSection('💔 워스트 파트너', worstPartners, AppColors.red),
          if (rivals.isNotEmpty)
            _buildDuoSection('⚔️ 라이벌', rivals, AppColors.purple),
          if (goalDuos.isEmpty && bestPartners.isEmpty && worstPartners.isEmpty && rivals.isEmpty)
            SizedBox(
              height: 300,
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.analytics_outlined, size: 48, color: Colors.white.withAlpha(51)),
                    const SizedBox(height: 16),
                    Text('경기를 더 진행하면 통계가 생성됩니다', style: TextStyle(color: Colors.white.withAlpha(102), fontSize: 14)),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildDuoSection(String title, List<dynamic> items, Color color) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(8),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withAlpha(20)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: color)),
          const SizedBox(height: 12),
          ...items.take(5).map((item) {
            final p1 = item['player1Name'] ?? item['playerName'] ?? '?';
            final p2 = item['player2Name'] ?? item['opponentName'] ?? '';
            final value = item['goals'] ?? item['wins'] ?? item['totalGoals'] ?? item['count'] ?? 0;
            final games = item['games'] ?? item['totalGames'] ?? 0;
            final winRate = item['winRate'];

            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  // 아바타 쌍
                  SizedBox(
                    width: 50,
                    child: Stack(
                      children: [
                        Container(
                          width: 32, height: 32,
                          decoration: BoxDecoration(
                            color: color.withAlpha(20),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: color.withAlpha(51)),
                          ),
                          child: Center(child: Text(p1.isNotEmpty ? p1[0] : '?', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: color))),
                        ),
                        if (p2.isNotEmpty)
                          Positioned(
                            left: 18,
                            child: Container(
                              width: 32, height: 32,
                              decoration: BoxDecoration(
                                color: AppColors.bgCard,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: color.withAlpha(51)),
                              ),
                              child: Center(child: Text(p2[0], style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: color))),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          p2.isNotEmpty ? '$p1 & $p2' : p1,
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white),
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          '${games}경기${winRate != null ? ' / 승률 ${(winRate * 100).toInt()}%' : ''}',
                          style: TextStyle(fontSize: 11, color: Colors.white.withAlpha(102)),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: color.withAlpha(20),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text('$value', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: color)),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  void _showYearPicker() {
    final currentYear = _currentSeasonYear(context.read<AuthService>().seasonStartMonth);
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgCard,
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
              title: Text('$year시즌', style: TextStyle(color: isSelected ? AppColors.primary : Colors.white)),
              trailing: isSelected ? const Icon(Icons.check, color: AppColors.primary) : null,
              onTap: () {
                Navigator.pop(context);
                setState(() {
                  _selectedYear = year;
                  _loading = true;
                  _funStats = null;
                });
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
