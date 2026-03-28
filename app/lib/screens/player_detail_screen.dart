import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'dart:math';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../utils/snackbar_helper.dart';

class PlayerDetailScreen extends StatefulWidget {
  final int playerId;
  const PlayerDetailScreen({super.key, required this.playerId});
  @override
  State<PlayerDetailScreen> createState() => _PlayerDetailScreenState();
}

class _PlayerDetailScreenState extends State<PlayerDetailScreen> with SingleTickerProviderStateMixin {
  Map<String, dynamic>? _player;
  Map<String, dynamic>? _logs;
  Map<String, dynamic>? _chemistry;
  Map<String, dynamic>? _streaks;
  List<dynamic> _badges = [];
  bool _badgesLoading = false;
  bool _loading = true;
  bool _chemLoading = false;
  bool _streakLoading = false;
  late TabController _tabController;
  int _logTab = 0; // 0=goals, 1=assists, 2=defenses, 3=mvp, 4=placements
  bool _isFav = false;
  bool _favLoading = false;
  int _prefCount = 0;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _load();
    _loadFavStatus();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadFavStatus() async {
    final auth = context.read<AuthService>();
    final token = auth.token;
    if (token == null) return;
    try {
      final res = await ApiService().getProfileSummary(token);
      final prefs = (res['preferences'] as List?) ?? [];
      if (mounted) {
        setState(() {
          _prefCount = prefs.length;
          _isFav = prefs.any((p) => p['id'] == widget.playerId);
        });
      }
    } catch (_) {}
  }

  Future<void> _toggleFav() async {
    final auth = context.read<AuthService>();
    final token = auth.token;
    if (token == null || _favLoading) return;
    setState(() => _favLoading = true);
    try {
      if (_isFav) {
        await ApiService().removePreference(widget.playerId, token);
        setState(() { _isFav = false; _prefCount--; });
      } else {
        if (_prefCount >= 3) {
          if (mounted) {
            showError(context, '선호 선수는 최대 3명까지 등록 가능합니다');
          }
          return;
        }
        await ApiService().addPreference(widget.playerId, token);
        setState(() { _isFav = true; _prefCount++; });
      }
    } catch (e) {
      if (mounted) {
        showError(context, e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _favLoading = false);
    }
  }

  Future<void> _load() async {
    // Context 사용은 await 이전에 캡처
    final auth = context.read<AuthService>();
    final isPro = auth.isPro;
    final token = auth.token;

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

      // 배지 로드 (토큰 필요)
      if (token != null) {
        _loadBadges(token);
      }

      // PRO 기능 데이터 로드
      if (isPro && token != null) {
        _loadProData(token);
      }
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _loadBadges(String token) async {
    setState(() => _badgesLoading = true);
    try {
      final badges = await ApiService().getPlayerBadges(widget.playerId, token: token);
      if (mounted) setState(() { _badges = badges; _badgesLoading = false; });
    } catch (_) {
      if (mounted) setState(() => _badgesLoading = false);
    }
  }

  Future<void> _loadProData(String token) async {
    setState(() {
      _chemLoading = true;
      _streakLoading = true;
    });

    final results = await Future.wait([
      ApiService().getChemistry(widget.playerId, token).catchError((_) => null),
      ApiService().getStreaks(widget.playerId, token).catchError((_) => null),
    ]);

    if (mounted) {
      setState(() {
        _chemistry = results[0] as Map<String, dynamic>?;
        _streaks = results[1] as Map<String, dynamic>?;
        _chemLoading = false;
        _streakLoading = false;
      });
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
        actions: [
          if (!_loading)
            IconButton(
              onPressed: _favLoading ? null : _toggleFav,
              icon: Icon(
                _isFav ? Icons.favorite : Icons.favorite_border,
                color: _isFav ? AppColors.red : Colors.white38,
              ),
              tooltip: _isFav ? '선호 선수 해제' : '선호 선수 등록',
            ),
        ],
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

  Widget _statCell(String label, String value) {
    return Expanded(
      child: Column(
        children: [
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(color: Colors.white54, fontSize: 11)),
        ],
      ),
    );
  }

  void _showRatingDialog() {
    final auth = context.read<AuthService>();
    final token = auth.token;
    if (token == null) {
      showError(context, '로그인이 필요합니다');
      return;
    }

    final p = _player?['player'];
    if (p == null) return;

    // 현재 능력치를 초기값으로 설정
    final Map<String, double> tempStats = {
      'shooting': (p['shooting'] ?? 50).toDouble(),
      'offball_run': (p['offball_run'] ?? 50).toDouble(),
      'ball_keeping': (p['ball_keeping'] ?? 50).toDouble(),
      'passing': (p['passing'] ?? 50).toDouble(),
      'linkup': (p['linkup'] ?? 50).toDouble(),
      'intercept': (p['intercept'] ?? 50).toDouble(),
      'marking': (p['marking'] ?? 50).toDouble(),
      'stamina': (p['stamina'] ?? 50).toDouble(),
      'speed': (p['speed'] ?? 50).toDouble(),
      'physical': (p['physical'] ?? 50).toDouble(),
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
                              inactiveColor: AppColors.surfaceHighlight,
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
                          showSuccess(context, '평가가 등록되었습니다 ✅');
                        }
                      } catch (e) {
                        if (mounted) {
                          showError(context, '$e');
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
    final auth = context.watch<AuthService>();
    final isPro = auth.isPro;

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
              border: Border.all(color: AppColors.surfaceTint),
            ),
            child: Column(
              children: [
                Row(
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
                          Row(
                            children: [
                              Text(p['name'] ?? '', style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withAlpha(26),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text('OVR ${avgOverall.toStringAsFixed(0)}',
                                    style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 14)),
                              ),
                            ],
                          ),
                          if (p['nickname'] != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Text(p['nickname'], style: const TextStyle(color: Colors.white54, fontSize: 14)),
                            ),
                          if (_player?['futsalDna'] != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  '${_player!['futsalDna']['emoji']} ${_player!['futsalDna']['type']}',
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Colors.white70),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                // 통산 기록 요약
                Row(
                  children: [
                    _statCell('경기', '${_player?['stats']?['total_matches'] ?? 0}'),
                    _statCell('득점', '${_player?['stats']?['total_goals'] ?? 0}'),
                    _statCell('도움', '${_player?['stats']?['total_assists'] ?? 0}'),
                    _statCell('수비', '${_player?['stats']?['total_blocks'] ?? 0}'),
                    _statCell('출석', '${p['total_attendance'] ?? 0}'),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // 태그 칩
          if (_player?['tags'] != null && (_player!['tags'] as List).isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 0),
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children: (_player!['tags'] as List).map((t) => Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    '${t['tag']} (${t['votes']})',
                    style: TextStyle(fontSize: 12, color: AppColors.primary),
                  ),
                )).toList(),
              ),
            ),

          if (_player?['tags'] != null && (_player!['tags'] as List).isNotEmpty)
            const SizedBox(height: 16),

          // 레이더 차트
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.bgCard,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.surfaceTint),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('능력치', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 16),
                AspectRatio(
                  aspectRatio: 1,
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final size = constraints.maxWidth;
                      return CustomPaint(
                        size: Size(size, size),
                        painter: _RadarChartPainter(stats),
                      );
                    },
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
              border: Border.all(color: AppColors.surfaceTint),
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
                            backgroundColor: AppColors.surfaceTint,
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
          const SizedBox(height: 16),

          // 케미 섹션
          _buildChemistrySection(isPro),
          const SizedBox(height: 16),

          // 스트릭 섹션
          _buildStreaksSection(isPro),
          const SizedBox(height: 16),

          // 배지 섹션
          _buildBadgesSection(),
          const SizedBox(height: 80), // FAB 여백
        ],
      ),
    );
  }

  Widget _buildChemistrySection(bool isPro) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.surfaceTint),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('⚗️', style: TextStyle(fontSize: 16)),
              const SizedBox(width: 8),
              const Text('케미스트리', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
              if (isPro) ...[
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.amber.withAlpha(26),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text('PRO', style: TextStyle(color: Colors.amber, fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          if (!isPro)
            _buildLockedState('PRO 플랜에서 팀원과의 케미스트리를 확인하세요')
          else if (_chemLoading)
            const Center(child: Padding(
              padding: EdgeInsets.all(20),
              child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2),
            ))
          else if (_chemistry == null)
            const Text('케미 데이터를 불러올 수 없습니다', style: TextStyle(color: Colors.white38, fontSize: 13))
          else
            _buildChemistryContent(),
        ],
      ),
    );
  }

  Widget _buildChemistryContent() {
    final partners = _chemistry?['bestPartners'] as List? ?? _chemistry?['partners'] as List? ?? _chemistry?['data'] as List? ?? [];
    if (partners.isEmpty) {
      return const Text('아직 케미 데이터가 없습니다', style: TextStyle(color: Colors.white38, fontSize: 13));
    }
    return Column(
      children: partners.take(5).map((partner) {
        final name = partner['partnerName'] ?? partner['name'] ?? '?';
        final score = (partner['chemScore'] ?? partner['chem_score'] ?? 0).toDouble();
        final scoreInt = score.toInt();
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: AppColors.bgBorder,
                child: Text(name[0], style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: (score / 100).clamp(0.0, 1.0),
                        backgroundColor: AppColors.surfaceTint,
                        color: AppColors.primary,
                        minHeight: 6,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text('$scoreInt', style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 14)),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildStreaksSection(bool isPro) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.surfaceTint),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('🔥', style: TextStyle(fontSize: 16)),
              const SizedBox(width: 8),
              const Text('스트릭', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
              if (isPro) ...[
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.amber.withAlpha(26),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text('PRO', style: TextStyle(color: Colors.amber, fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          if (!isPro)
            _buildLockedState('PRO 플랜에서 연승, 득점, 출석 스트릭을 확인하세요')
          else if (_streakLoading)
            const Center(child: Padding(
              padding: EdgeInsets.all(20),
              child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2),
            ))
          else if (_streaks == null)
            const Text('스트릭 데이터를 불러올 수 없습니다', style: TextStyle(color: Colors.white38, fontSize: 13))
          else
            _buildStreaksContent(),
        ],
      ),
    );
  }

  Widget _buildStreaksContent() {
    final streakData = _streaks?['data'] ?? _streaks ?? {};
    // API returns: { current: {count}, attendance: {current, best}, scoring: {current, best} }
    final currentObj = streakData['current'];
    final attendanceObj = streakData['attendance'];
    final scoringObj = streakData['scoring'];
    final winStreak = (currentObj is Map ? currentObj['count'] : streakData['winStreak'] ?? streakData['win_streak']) ?? 0;
    final scoringStreak = (scoringObj is Map ? scoringObj['current'] : streakData['scoringStreak'] ?? streakData['scoring_streak']) ?? 0;
    final attendanceStreak = (attendanceObj is Map ? attendanceObj['current'] : streakData['attendanceStreak'] ?? streakData['attendance_streak']) ?? 0;

    final items = [
      {'icon': '🏆', 'label': '연승 스트릭', 'value': winStreak},
      {'icon': '⚽', 'label': '득점 스트릭', 'value': scoringStreak},
      {'icon': '📅', 'label': '출석 스트릭', 'value': attendanceStreak},
    ];

    return Row(
      children: items.map((item) {
        final val = item['value'] as int;
        return Expanded(
          child: Container(
            margin: const EdgeInsets.only(right: 8),
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
            decoration: BoxDecoration(
              color: val > 0 ? AppColors.primary.withValues(alpha: 0.08) : AppColors.surfaceBorder,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: val > 0 ? AppColors.primary.withAlpha(51) : AppColors.surfaceTint,
              ),
            ),
            child: Column(
              children: [
                Text(item['icon'] as String, style: const TextStyle(fontSize: 20)),
                const SizedBox(height: 6),
                Text(
                  '$val',
                  style: TextStyle(
                    color: val > 0 ? AppColors.primary : Colors.white38,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  item['label'] as String,
                  style: const TextStyle(color: Colors.white38, fontSize: 10),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  static const _badgeEmoji = {
    'FIRST_GOAL': '\u26BD', 'HAT_TRICK': '\uD83C\uDFA9', 'DEFENSE_KING': '\uD83D\uDEE1\uFE0F',
    'ATTENDANCE_90': '\uD83D\uDCC5', 'MATCH_100': '\uD83D\uDCAF', 'MATCH_50': '\uD83C\uDFC5',
    'MATCH_10': '\uD83C\uDFAE', 'WIN_STREAK_3': '\uD83D\uDD25', 'WIN_STREAK_5': '\uD83D\uDD25',
    'ALL_ROUNDER': '\u2B50', 'MVP': '\uD83C\uDFC6', 'MVP_3': '\uD83C\uDFC6',
    'FIRST_ASSIST': '\uD83D\uDC5F', 'SCORING_STREAK_3': '\u26A1',
  };

  Widget _buildBadgesSection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.surfaceTint),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Text('\uD83C\uDFC5', style: TextStyle(fontSize: 16)),
              SizedBox(width: 8),
              Text('배지', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 12),
          if (_badgesLoading)
            const Center(child: Padding(
              padding: EdgeInsets.all(20),
              child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2),
            ))
          else if (_badges.isEmpty)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Text('아직 획득한 배지가 없습니다', style: TextStyle(color: Colors.white38, fontSize: 13)),
              ),
            )
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _badges.map((badge) {
                final code = badge['code'] ?? '';
                final name = badge['name'] ?? code;
                final earnedAt = badge['earned_at'];
                final isEarned = earnedAt != null;
                final emoji = _badgeEmoji[code] ?? '\uD83C\uDFC5';

                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: isEarned ? AppColors.primary.withValues(alpha: 0.1) : AppColors.surfaceBorder,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isEarned ? AppColors.primary.withAlpha(60) : AppColors.surfaceTint,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(emoji, style: TextStyle(fontSize: 18, color: isEarned ? null : Colors.white24)),
                      const SizedBox(width: 6),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            name,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: isEarned ? Colors.white : Colors.white38,
                            ),
                          ),
                          if (isEarned && earnedAt is int) ...[
                            Text(
                              _formatBadgeDate(earnedAt),
                              style: TextStyle(fontSize: 10, color: AppColors.primary.withAlpha(180)),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
        ],
      ),
    );
  }

  String _formatBadgeDate(int ts) {
    final dt = DateTime.fromMillisecondsSinceEpoch(ts * 1000);
    return '${dt.year}.${dt.month}/${dt.day}';
  }

  Widget _buildLockedState(String message) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Column(
        children: [
          const Icon(Icons.lock_outline, color: Colors.white24, size: 32),
          const SizedBox(height: 8),
          Text(
            message,
            style: const TextStyle(color: Colors.white38, fontSize: 13),
            textAlign: TextAlign.center,
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
                      border: Border.all(color: active ? AppColors.primary.withAlpha(77) : AppColors.surfaceTint),
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
                          decoration: BoxDecoration(color: active ? AppColors.surfaceHighlight : AppColors.surfaceTint, borderRadius: BorderRadius.circular(6)),
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
    final gridPaint = Paint()..color = AppColors.surfaceHighlight..style = PaintingStyle.stroke..strokeWidth = 1;
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
