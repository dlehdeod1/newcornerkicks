import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import 'player_detail_screen.dart';
import 'hall_of_fame_screen.dart';
import '../widgets/skeleton.dart';
import '../widgets/empty_state.dart';
import '../widgets/tip_banner.dart';

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
  String _sortBy = 'mvpScore';
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

  List<Map<String, dynamic>> get _categories {
    final events = context.read<AuthService>().enabledEvents;
    final cats = <Map<String, dynamic>>[
      {'key': 'mvpScore', 'label': '평점합계', 'icon': '⭐', 'color': AppColors.primary},
      {'key': 'mvpCount', 'label': 'MVP', 'icon': '🏅', 'color': AppColors.amber},
      {'key': 'goals', 'label': '득점', 'icon': '⚽', 'color': AppColors.amber},
      {'key': 'assists', 'label': '도움', 'icon': '⚡', 'color': AppColors.blue},
      {'key': 'sessionWins', 'label': '승리', 'icon': '🏆', 'color': AppColors.primary},
      {'key': 'sessionLosses', 'label': '패배', 'icon': '💀', 'color': AppColors.red},
    ];
    if (events.contains('DEFENSE')) {
      cats.add({'key': 'defenses', 'label': '수비', 'icon': '🛡️', 'color': AppColors.purple});
    }
    if (events.contains('TACKLE')) {
      cats.add({'key': 'tackles', 'label': '태클', 'icon': '🦶', 'color': AppColors.purple});
    }
    if (events.contains('INTERCEPTION')) {
      cats.add({'key': 'interceptions', 'label': '인터셉트', 'icon': '✋', 'color': AppColors.indigo});
    }
    if (events.contains('CLEARANCE')) {
      cats.add({'key': 'clearances', 'label': '클리어런스', 'icon': '🧹', 'color': AppColors.teal});
    }
    if (events.contains('SAVE')) {
      cats.add({'key': 'saves', 'label': '선방', 'icon': '🧤', 'color': AppColors.blueSky});
    }
    if (events.contains('KEY_PASS')) {
      cats.add({'key': 'keyPasses', 'label': '키패스', 'icon': '🎯', 'color': AppColors.cyan});
    }
    if (events.contains('DRIBBLE')) {
      cats.add({'key': 'dribbles', 'label': '돌파', 'icon': '💨', 'color': AppColors.orange});
    }
    if (events.contains('SHOT_ON')) {
      cats.add({'key': 'shotsOn', 'label': '유효슈팅', 'icon': '🎯', 'color': AppColors.rose});
    }
    if (events.contains('SHOT_OFF')) {
      cats.add({'key': 'shotsOff', 'label': '무효슈팅', 'icon': '💫', 'color': AppColors.slate});
    }
    cats.add({'key': 'games', 'label': '경기', 'icon': '🎮', 'color': AppColors.slate});
    return cats;
  }

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
          _stats = res['data'];
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

  /// 특정 키 기준 Top N 정렬
  List<dynamic> _topN(String key, int n) {
    final list = List.from(_rankings.where((p) => (p[key] ?? 0) > 0));
    list.sort((a, b) => ((b[key] ?? 0) as num).compareTo((a[key] ?? 0) as num));
    return list.take(n).toList();
  }

  /// 현재 유저의 랭킹 데이터 찾기
  Map<String, dynamic>? get _myRanking {
    final myId = context.read<AuthService>().player?['id'];
    if (myId == null) return null;
    try {
      return _rankings.firstWhere((p) => p['id'] == myId) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  /// 특정 키 기준 내 순위
  int _myRankFor(String key) {
    final myId = context.read<AuthService>().player?['id'];
    if (myId == null) return 0;
    final sorted = List.from(_rankings.where((p) => (p[key] ?? 0) > 0));
    sorted.sort((a, b) => ((b[key] ?? 0) as num).compareTo((a[key] ?? 0) as num));
    for (int i = 0; i < sorted.length; i++) {
      if (sorted[i]['id'] == myId) return i + 1;
    }
    return 0;
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
            color: AppColors.surfaceBorder,
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
                color: AppColors.surfaceBorder,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.surfaceTint),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('$_selectedYear시즌', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white)),
                  const SizedBox(width: 6),
                  Icon(Icons.expand_more, color: AppColors.textHint, size: 18),
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
                  color: AppColors.surfaceBorder,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.surfaceTint),
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

  Widget _buildRankingSkeleton() {
    return Padding(
      padding: const EdgeInsets.all(AppTheme.space16),
      child: Column(
        children: [
          // 포디엄
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Column(children: [
                SkeletonBox(width: 56, height: 56, borderRadius: 28),
                const SizedBox(height: AppTheme.space8),
                SkeletonBox(width: 48, height: 12),
              ]),
              const SizedBox(width: AppTheme.space16),
              Column(children: [
                SkeletonBox(width: 72, height: 72, borderRadius: 36),
                const SizedBox(height: AppTheme.space8),
                SkeletonBox(width: 56, height: 14),
              ]),
              const SizedBox(width: AppTheme.space16),
              Column(children: [
                SkeletonBox(width: 56, height: 56, borderRadius: 28),
                const SizedBox(height: AppTheme.space8),
                SkeletonBox(width: 48, height: 12),
              ]),
            ],
          ),
          const SizedBox(height: AppTheme.space24),
          // 테이블 행
          ...List.generate(8, (_) => Padding(
            padding: const EdgeInsets.only(bottom: AppTheme.space8),
            child: Row(
              children: [
                SkeletonBox(width: 24, height: 14),
                const SizedBox(width: AppTheme.space12),
                SkeletonBox(width: 32, height: 32, borderRadius: 16),
                const SizedBox(width: AppTheme.space12),
                Expanded(child: SkeletonBox(height: 14)),
                const SizedBox(width: AppTheme.space12),
                SkeletonBox(width: 40, height: 14),
              ],
            ),
          )),
        ],
      ),
    );
  }

  Widget _buildRankingTab() {
    if (_loading) {
      return _buildRankingSkeleton();
    }

    return RefreshIndicator(
      onRefresh: () async {
        setState(() => _loading = true);
        await _loadRankings();
      },
      color: AppColors.primary,
      child: CustomScrollView(
        slivers: [
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: TipBanner(
                tipId: 'ranking_stats',
                text: '통계 탭에서 베스트 듀오, 라이벌 등 재미있는 통계를 확인하세요!',
                icon: Icons.analytics,
                color: AppColors.amber,
              ),
            ),
          ),
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
              color: AppColors.surfaceBorder,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                Text(item['value']!, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.primary)),
                const SizedBox(height: 2),
                Text(item['label']!, style: TextStyle(fontSize: 10, color: AppColors.textHint)),
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
                    color: isActive ? color.withAlpha(26) : AppColors.surfaceBorder,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: isActive ? color.withAlpha(102) : AppColors.surfaceTint),
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
                          color: isActive ? color : AppColors.textSecondary,
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
        child: const EmptyState(
          icon: Icons.emoji_events_outlined,
          title: '랭킹 데이터가 없습니다',
          subtitle: '완료된 세션이 있으면 랭킹이 표시됩니다',
        ),
      ),
    );
  }

  Widget _buildPlayerRow(dynamic player, int rank) {
    final name = player['name'] ?? '?';
    final val = player[_sortBy] ?? 0;
    final currentCat = _categories.firstWhere((c) => c['key'] == _sortBy);
    final color = currentCat['color'] as Color;
    final myPlayerId = context.read<AuthService>().player?['id'];
    final isMe = myPlayerId != null && player['id'] == myPlayerId;

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
          color: isMe ? AppColors.primary.withAlpha(15) : rank <= 3 ? color.withAlpha(8) : AppColors.surfaceBorder,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: isMe ? AppColors.primary.withAlpha(60) : rank <= 3 ? color.withAlpha(26) : AppColors.surfaceTint),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 32,
              child: Center(
                child: rank <= 3
                    ? Text(rankDisplay, style: const TextStyle(fontSize: 16))
                    : Text(rankDisplay, style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textHint)),
              ),
            ),
            const SizedBox(width: 10),
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withAlpha(15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: rank <= 3 ? color.withAlpha(51) : AppColors.surfaceTint),
              ),
              child: Center(
                child: Text(
                  name.toString().isNotEmpty ? name.toString()[0] : '?',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: rank <= 3 ? color : AppColors.textSecondary),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
                  if (player['attendance'] != null || player['winRate'] != null)
                    Text(
                      [
                        if (player['attendance'] != null) '${player['attendance']}경기',
                        if (player['winRate'] != null) '승률 ${(player['winRate'] as num).toInt()}%',
                      ].join(' / '),
                      style: TextStyle(fontSize: 11, color: AppColors.iconInactive),
                    ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.surfaceBorder,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text('$val', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  // ─── 통계 탭 ───────────────────────────────────

  Widget _buildStatsTab() {
    if (_loading) {
      return _buildRankingSkeleton();
    }

    return RefreshIndicator(
      onRefresh: () async {
        setState(() => _loading = true);
        _funStats = null;
        await _loadRankings();
        await _loadFunStats();
      },
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 1) Overview 카드
          _buildStatsOverview(),
          const SizedBox(height: 16),

          // 2) 내 통계
          _buildMyStats(),

          // 3) 카테고리별 Top 5 미니 랭킹
          _buildMiniRankings(),

          // 4) 시즌 요약
          _buildSeasonSummary(),

          // 5) Fun Stats (듀오/파트너/라이벌)
          _buildFunStatsSection(),

          const SizedBox(height: 32),
        ],
      ),
    );
  }

  /// Overview 카드 4개
  Widget _buildStatsOverview() {
    final totalSessions = _stats?['totalSessions'] ?? 0;
    final totalPlayers = _stats?['totalPlayers'] ?? 0;
    final totalGoals = _stats?['totalGoals'] ?? 0;

    // 총 승리 합산
    int totalWins = 0;
    for (final p in _rankings) {
      totalWins += ((p['sessionWins'] ?? 0) as num).toInt();
    }

    final items = [
      {'icon': Icons.sports_soccer, 'label': '총 세션', 'value': '$totalSessions', 'color': AppColors.primary},
      {'icon': Icons.people, 'label': '참여 선수', 'value': '$totalPlayers', 'color': AppColors.blue},
      {'icon': Icons.emoji_events, 'label': '총 득점', 'value': '$totalGoals', 'color': AppColors.amber},
      {'icon': Icons.military_tech, 'label': '총 승리', 'value': '$totalWins', 'color': AppColors.purple},
    ];

    return Row(
      children: items.map((item) {
        final color = item['color'] as Color;
        return Expanded(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 3),
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              color: color.withAlpha(10),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: color.withAlpha(30)),
            ),
            child: Column(
              children: [
                Icon(item['icon'] as IconData, size: 20, color: color),
                const SizedBox(height: 6),
                Text(
                  item['value'] as String,
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color),
                ),
                const SizedBox(height: 2),
                Text(
                  item['label'] as String,
                  style: TextStyle(fontSize: 10, color: AppColors.textHint),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  /// 내 통계 섹션
  Widget _buildMyStats() {
    final my = _myRanking;
    if (my == null) return const SizedBox.shrink();

    final games = (my['games'] ?? my['attendance'] ?? 0) as num;
    final goals = (my['goals'] ?? 0) as num;
    final assists = (my['assists'] ?? 0) as num;
    final wins = (my['sessionWins'] ?? 0) as num;
    final losses = (my['sessionLosses'] ?? 0) as num;
    final winRate = (my['winRate'] as num?)?.toDouble();
    final mvpScore = (my['mvpScore'] ?? 0) as num;
    final mvpCount = (my['mvpCount'] ?? 0) as num;

    final goalsPerGame = games > 0 ? (goals / games).toStringAsFixed(1) : '-';
    final assistsPerGame = games > 0 ? (assists / games).toStringAsFixed(1) : '-';
    final mvpRank = _myRankFor('mvpScore');
    final goalRank = _myRankFor('goals');

    final winRateStr = winRate != null ? '${winRate.toInt()}%' : '-';
    final record = '${wins.toInt()}승 ${losses.toInt()}패';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.primary.withAlpha(15), AppColors.blue.withAlpha(10)],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.primary.withAlpha(40)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.person, size: 16, color: AppColors.primary.withAlpha(180)),
              const SizedBox(width: 6),
              const Text('내 시즌 기록', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.primary)),
            ],
          ),
          const SizedBox(height: 14),
          // 상단: 주요 지표 3개
          Row(
            children: [
              _buildMyStatBadge('평점', mvpScore.toStringAsFixed(1), mvpRank > 0 ? '${mvpRank}위' : null, AppColors.primary),
              const SizedBox(width: 8),
              _buildMyStatBadge('득점', '${goals.toInt()}', goalRank > 0 ? '${goalRank}위' : null, AppColors.amber),
              const SizedBox(width: 8),
              _buildMyStatBadge('승률', winRateStr, null, AppColors.blue),
            ],
          ),
          const SizedBox(height: 12),
          // 하단: 세부 스탯 그리드
          Wrap(
            spacing: 16,
            runSpacing: 8,
            children: [
              _buildMyStatItem('경기', '${games.toInt()}'),
              _buildMyStatItem('전적', record),
              _buildMyStatItem('도움', '${assists.toInt()}'),
              _buildMyStatItem('경기당 골', goalsPerGame),
              _buildMyStatItem('경기당 도움', assistsPerGame),
              _buildMyStatItem('MVP', '${mvpCount.toInt()}회'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMyStatBadge(String label, String value, String? subLabel, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: color.withAlpha(15),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withAlpha(40)),
        ),
        child: Column(
          children: [
            Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 11, color: AppColors.textHint)),
            if (subLabel != null) ...[
              const SizedBox(height: 2),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: color.withAlpha(20),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(subLabel, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color)),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildMyStatItem(String label, String value) {
    return SizedBox(
      width: 100,
      child: Row(
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: AppColors.textHint)),
          const Spacer(),
          Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white)),
        ],
      ),
    );
  }

  /// 카테고리별 Top 5 미니 랭킹
  Widget _buildMiniRankings() {
    // 표시할 카테고리들
    final miniCats = <Map<String, dynamic>>[
      {'key': 'mvpScore', 'label': '평점 TOP 5', 'icon': '⭐', 'color': AppColors.primary},
      {'key': 'goals', 'label': '득점 TOP 5', 'icon': '⚽', 'color': AppColors.amber},
      {'key': 'assists', 'label': '도움 TOP 5', 'icon': '⚡', 'color': AppColors.blue},
      {'key': 'games', 'label': '출석 TOP 5', 'icon': '🎮', 'color': AppColors.slate},
    ];

    // enabled events에 따라 수비 카테고리 추가
    final events = context.read<AuthService>().enabledEvents;
    if (events.contains('DEFENSE')) {
      miniCats.insert(3, {'key': 'defenses', 'label': '수비 TOP 5', 'icon': '🛡️', 'color': AppColors.purple});
    } else if (events.contains('TACKLE')) {
      miniCats.insert(3, {'key': 'tackles', 'label': '태클 TOP 5', 'icon': '🦶', 'color': AppColors.purple});
    }

    // 승률 TOP 5 (3경기 이상)
    miniCats.add({'key': 'winRate', 'label': '승률 TOP 5', 'icon': '🏆', 'color': AppColors.primary, 'minGames': 3, 'isRate': true});

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            children: [
              Icon(Icons.leaderboard, size: 16, color: AppColors.textHint),
              const SizedBox(width: 6),
              Text('카테고리별 리더', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
            ],
          ),
        ),
        // 2열 그리드
        ...List.generate((miniCats.length / 2).ceil(), (rowIdx) {
          final first = miniCats[rowIdx * 2];
          final second = (rowIdx * 2 + 1 < miniCats.length) ? miniCats[rowIdx * 2 + 1] : null;
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: _buildMiniRankCard(first)),
                const SizedBox(width: 10),
                Expanded(child: second != null ? _buildMiniRankCard(second) : const SizedBox()),
              ],
            ),
          );
        }),
        const SizedBox(height: 6),
      ],
    );
  }

  Widget _buildMiniRankCard(Map<String, dynamic> cat) {
    final key = cat['key'] as String;
    final label = cat['label'] as String;
    final icon = cat['icon'] as String;
    final color = cat['color'] as Color;
    final minGames = (cat['minGames'] as int?) ?? 0;
    final isRate = cat['isRate'] == true;

    List<dynamic> top;
    if (isRate) {
      // 승률은 최소 경기수 필터 + 별도 정렬
      final filtered = _rankings.where((p) {
        final g = ((p['games'] ?? p['attendance'] ?? 0) as num).toInt();
        return g >= minGames && (p[key] ?? 0) > 0;
      }).toList();
      filtered.sort((a, b) => ((b[key] ?? 0) as num).compareTo((a[key] ?? 0) as num));
      top = filtered.take(5).toList();
    } else {
      top = _topN(key, 5);
    }

    if (top.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surfaceBorder,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.surfaceTint),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('$icon $label', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color)),
            const SizedBox(height: 12),
            Text('데이터 없음', style: TextStyle(fontSize: 11, color: AppColors.iconInactive)),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceBorder,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.surfaceTint),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('$icon $label', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color)),
          const SizedBox(height: 10),
          ...top.asMap().entries.map((entry) {
            final rank = entry.key + 1;
            final p = entry.value;
            final name = (p['name'] ?? '?').toString();
            final displayName = name.length > 5 ? '${name.substring(0, 5)}..' : name;
            final val = p[key] ?? 0;
            final valStr = isRate ? '${((val as num).toDouble() * 100).toInt()}%' : '$val';

            final medals = ['🥇', '🥈', '🥉'];
            final rankStr = rank <= 3 ? medals[rank - 1] : '$rank';

            final myId = context.read<AuthService>().player?['id'];
            final isMe = p['id'] == myId;

            return Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  SizedBox(
                    width: 20,
                    child: Text(rankStr, style: TextStyle(fontSize: rank <= 3 ? 12 : 11, color: AppColors.textHint)),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      displayName,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: isMe ? FontWeight.bold : FontWeight.normal,
                        color: isMe ? AppColors.primary : AppColors.textSecondary,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(valStr, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color)),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  /// 시즌 요약 (평균 통계)
  Widget _buildSeasonSummary() {
    if (_rankings.isEmpty) return const SizedBox.shrink();

    final totalPlayers = _rankings.length;
    final totalSessions = (_stats?['totalSessions'] ?? 0) as num;

    // 평균 계산
    double avgGoals = 0, avgAssists = 0, avgGames = 0, avgMvp = 0;
    for (final p in _rankings) {
      avgGoals += ((p['goals'] ?? 0) as num).toDouble();
      avgAssists += ((p['assists'] ?? 0) as num).toDouble();
      avgGames += ((p['games'] ?? p['attendance'] ?? 0) as num).toDouble();
      avgMvp += ((p['mvpScore'] ?? 0) as num).toDouble();
    }

    if (totalPlayers > 0) {
      avgGoals /= totalPlayers;
      avgAssists /= totalPlayers;
      avgGames /= totalPlayers;
      avgMvp /= totalPlayers;
    }

    // 세션당 평균 골
    final totalGoals = (_stats?['totalGoals'] ?? 0) as num;
    final goalsPerSession = totalSessions > 0 ? (totalGoals / totalSessions).toStringAsFixed(1) : '-';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceBorder,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.surfaceTint),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.bar_chart, size: 16, color: AppColors.textHint),
              const SizedBox(width: 6),
              Text('시즌 평균', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              _buildAvgItem('인당 평점', avgMvp.toStringAsFixed(1), AppColors.primary),
              _buildAvgItem('인당 득점', avgGoals.toStringAsFixed(1), AppColors.amber),
              _buildAvgItem('인당 도움', avgAssists.toStringAsFixed(1), AppColors.blue),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _buildAvgItem('인당 출석', avgGames.toStringAsFixed(1), AppColors.slate),
              _buildAvgItem('세션당 골', goalsPerSession, AppColors.rose),
              _buildAvgItem('참여 선수', '$totalPlayers', AppColors.purple),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAvgItem(String label, String value, Color color) {
    return Expanded(
      child: Column(
        children: [
          Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(fontSize: 10, color: AppColors.textHint)),
        ],
      ),
    );
  }

  /// Fun Stats 섹션 (기존 듀오/파트너/라이벌)
  Widget _buildFunStatsSection() {
    // 로딩 중
    if (_funStatsLoading) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Center(
          child: Column(
            children: [
              const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2),
              ),
              const SizedBox(height: 8),
              Text('재미있는 통계 불러오는 중...', style: TextStyle(fontSize: 12, color: AppColors.textHint)),
            ],
          ),
        ),
      );
    }

    if (_funStats == null) return const SizedBox.shrink();

    final goalDuos = (_funStats!['goalDuos'] as List?) ?? [];
    final bestPartners = (_funStats!['bestPartners'] as List?) ?? [];
    final worstPartners = (_funStats!['worstPartners'] as List?) ?? [];
    final rivals = (_funStats!['rivals'] as List?) ?? [];

    if (goalDuos.isEmpty && bestPartners.isEmpty && worstPartners.isEmpty && rivals.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            children: [
              Icon(Icons.auto_awesome, size: 16, color: AppColors.textHint),
              const SizedBox(width: 6),
              Text('케미 분석', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
            ],
          ),
        ),
        if (goalDuos.isNotEmpty)
          _buildDuoSection('⚽ 베스트 득점 듀오', goalDuos, AppColors.amber),
        if (bestPartners.isNotEmpty)
          _buildDuoSection('🤝 베스트 파트너', bestPartners, AppColors.primary),
        if (worstPartners.isNotEmpty)
          _buildDuoSection('💔 워스트 파트너', worstPartners, AppColors.red),
        if (rivals.isNotEmpty)
          _buildDuoSection('⚔️ 라이벌', rivals, AppColors.purple),
      ],
    );
  }

  Widget _buildDuoSection(String title, List<dynamic> items, Color color) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceBorder,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.surfaceTint),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: color)),
          const SizedBox(height: 12),
          ...items.take(5).map((item) {
            final p1 = item['player1'] ?? item['scorer'] ?? item['player1Name'] ?? '?';
            final p2 = item['player2'] ?? item['opponent'] ?? item['player2Name'] ?? '';
            final value = item['combo_count'] ?? item['wins_together'] ?? item['goals_against'] ?? item['goals'] ?? 0;
            final games = item['games_together'] ?? item['matches_faced'] ?? item['games'] ?? 0;
            final rawWinRate = item['win_rate'] ?? item['winRate'];
            // API win_rate는 이미 퍼센트(0~100), 소수점(0~1)이면 변환
            final winRatePct = rawWinRate != null
                ? ((rawWinRate as num).toDouble() <= 1.0
                    ? ((rawWinRate as num).toDouble() * 100).toInt()
                    : (rawWinRate as num).toInt())
                : null;

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
                          winRatePct != null ? '$games경기 / 승률 $winRatePct%' : '$games경기',
                          style: TextStyle(fontSize: 11, color: AppColors.textHint),
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
