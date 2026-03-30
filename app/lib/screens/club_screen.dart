import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../theme/app_colors.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../config/api_config.dart';
import 'player_detail_screen.dart';
import 'settlements_screen.dart';
import 'announcements_screen.dart';
import 'board_screen.dart';
import 'admin_exemptions_screen.dart';
import 'admin_dashboard_screen.dart';
import 'abilities_screen.dart';
import 'players_screen.dart';
import '../widgets/tip_banner.dart';
import '../utils/snackbar_helper.dart';

class ClubScreen extends StatefulWidget {
  const ClubScreen({super.key});

  @override
  State<ClubScreen> createState() => _ClubScreenState();
}

class _ClubScreenState extends State<ClubScreen> {
  final ApiService _api = ApiService();
  Map<String, dynamic>? _clubDetail;
  Map<String, dynamic>? _playerStats;
  int? _myRank;
  List<dynamic> _players = [];
  Map<String, dynamic>? _subscription;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final auth = context.read<AuthService>();
    final player = auth.player;
    final token = auth.token;
    if (token == null) return;

    final futures = <Future>[];

    futures.add(_api.getMyClub(token).then((res) {
      _clubDetail = res['club'] ?? res;
    }).catchError((_) {}));

    futures.add(_api.getPlayers(token: token).then((data) {
      _players = (data['players'] as List?)?.where((p) => p['is_guest'] != 1).toList() ?? [];
    }).catchError((_) {}));

    futures.add(_api.getSubscription(token).then((res) {
      _subscription = res;
    }).catchError((_) {}));

    if (player != null) {
      futures.add(_api.getRankings(year: DateTime.now().year, token: token).then((res) {
        final rankings = (res['data']?['rankings'] as List?) ?? [];
        rankings.sort((a, b) => ((b['mvpCount'] ?? 0) as num).compareTo((a['mvpCount'] ?? 0) as num));
        final idx = rankings.indexWhere((p) => p['id'] == player['id']);
        if (idx >= 0) {
          _playerStats = rankings[idx];
          _myRank = idx + 1;
        }
      }).catchError((_) {}));
    }

    await Future.wait(futures);
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final club = auth.club;

    if (club == null) {
      return const Center(
        child: Text('소속 클럽이 없습니다', style: TextStyle(color: Colors.white54)),
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        setState(() => _loading = true);
        await _load();
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            const TipBanner(
              tipId: 'club_invite',
              text: '초대 코드를 공유해서 멤버를 초대하세요! 멤버를 눌러 능력치도 평가할 수 있어요.',
              icon: Icons.group_add,
              color: AppColors.teal,
            ),
            _buildClubHero(auth),
            const SizedBox(height: 20),
            _buildSeasonStats(),
            const SizedBox(height: 20),
            _buildQuickLinks(),
            const SizedBox(height: 20),
            _buildSubscriptionCard(),
          ],
        ),
      ),
    );
  }

  Widget _buildClubHero(AuthService auth) {
    final club = auth.club!;
    final clubName = club['name'] ?? '';
    final slug = club['slug'] ?? '';
    final memberCount = _players.length;
    final inviteCode = _clubDetail?['inviteCode'] ?? '';

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary.withAlpha(30), AppColors.teal.withAlpha(20)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.primary.withAlpha(40)),
      ),
      child: Column(
        children: [
          // 클럽 아바타 / 로고
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [AppColors.primary, AppColors.teal]),
              borderRadius: BorderRadius.circular(20),
            ),
            clipBehavior: Clip.antiAlias,
            child: _clubDetail?['logoUrl'] != null
                ? Image.network(
                    '${ApiConfig.baseUrl}${_clubDetail!['logoUrl']}',
                    width: 64, height: 64, fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Center(
                      child: Text(clubName.isNotEmpty ? clubName[0] : '?',
                          style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white)),
                    ),
                  )
                : Center(
                    child: Text(clubName.isNotEmpty ? clubName[0] : '?',
                        style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white)),
                  ),
          ),
          const SizedBox(height: 12),
          Text(clubName, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
          Text('@$slug', style: TextStyle(fontSize: 13, color: AppColors.textHint)),
          const SizedBox(height: 12),
          // 뱃지 행
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _badge('$memberCount명', AppColors.primary),
              if (auth.isAdmin) ...[
                const SizedBox(width: 8),
                _badge('관리자', AppColors.purple),
              ],
            ],
          ),
          // 초대 코드
          if (inviteCode.isNotEmpty) ...[
            const SizedBox(height: 16),
            Divider(color: AppColors.surfaceTint),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.link, size: 14, color: AppColors.textHint),
                const SizedBox(width: 6),
                Text('초대 코드', style: TextStyle(fontSize: 12, color: AppColors.textHint)),
                const SizedBox(width: 12),
                GestureDetector(
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: inviteCode));
                    showSuccess(context, '초대 코드가 복사되었습니다');
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withAlpha(20),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.primary.withAlpha(51)),
                    ),
                    child: Row(
                      children: [
                        Text(inviteCode, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.primary, letterSpacing: 1.5)),
                        const SizedBox(width: 6),
                        const Icon(Icons.copy, size: 13, color: AppColors.primary),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _badge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withAlpha(26),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withAlpha(64)),
      ),
      child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: color)),
    );
  }

  Widget _buildSeasonStats() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    if (_playerStats == null) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: AppColors.surfaceBorder,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.surfaceTint),
        ),
        child: Column(
          children: [
            Icon(Icons.bar_chart, size: 32, color: AppColors.iconInactive),
            const SizedBox(height: 8),
            Text('시즌 기록이 없습니다', style: TextStyle(color: AppColors.textHint)),
          ],
        ),
      );
    }

    final stats = _playerStats!;
    final year = DateTime.now().year;

    return Container(
      padding: const EdgeInsets.all(20),
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
              const Icon(Icons.trending_up, size: 18, color: AppColors.primary),
              const SizedBox(width: 8),
              Text('${year}년 시즌 스탯', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white)),
              if (_myRank != null) ...[
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.amber.withAlpha(26),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text('MVP $_myRank위', style: const TextStyle(fontSize: 12, color: AppColors.amber, fontWeight: FontWeight.w600)),
                ),
              ],
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _statCard('⭐', 'MVP', '${stats['mvpCount'] ?? 0}회', AppColors.primary),
              _statCard('⚽', '득점', '${stats['goals'] ?? 0}', AppColors.amber),
              _statCard('⚡', '도움', '${stats['assists'] ?? 0}', AppColors.blue),
              _statCard('🛡️', '수비', '${stats['defenses'] ?? 0}', AppColors.purple),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _miniStat('경기', '${stats['games'] ?? 0}경기', Icons.sports_soccer)),
              const SizedBox(width: 10),
              Expanded(child: _miniStat('우승', '${stats['sessionWins'] ?? 0}회', Icons.emoji_events)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _statCard(String icon, String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(10),
        margin: const EdgeInsets.symmetric(horizontal: 3),
        decoration: BoxDecoration(
          color: color.withAlpha(20),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withAlpha(51)),
        ),
        child: Column(
          children: [
            Text(icon, style: const TextStyle(fontSize: 16)),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
            Text(label, style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
          ],
        ),
      ),
    );
  }

  Widget _miniStat(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceBorder,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.surfaceBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 15, color: AppColors.textHint),
              const SizedBox(width: 6),
              Text(label, style: TextStyle(fontSize: 12, color: AppColors.textHint)),
            ],
          ),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
        ],
      ),
    );
  }

  Widget _buildQuickLinks() {
    final auth = context.watch<AuthService>();
    return Column(
      children: [
        Row(
          children: [
            Expanded(child: _quickLink(Icons.receipt_long, '정산', AppColors.primary, () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const SettlementsScreen()));
            })),
            const SizedBox(width: 10),
            Expanded(child: _quickLink(Icons.forum_rounded, '게시판', AppColors.blue, () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const BoardScreen()));
            })),
            const SizedBox(width: 10),
            Expanded(child: _quickLink(Icons.people_outline, '멤버', AppColors.teal, () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const PlayersScreen()));
            })),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: _quickLink(Icons.bar_chart, '능력치', AppColors.cyan, () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const AbilitiesScreen()));
            })),
            const SizedBox(width: 10),
            if (auth.isAdmin) ...[
              Expanded(child: _quickLink(Icons.dashboard, '관리자', AppColors.purple, () {
                Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminDashboardScreen()));
              })),
            ] else ...[
              const Expanded(child: SizedBox()),
            ],
            const SizedBox(width: 10),
            const Expanded(child: SizedBox()),
          ],
        ),
      ],
    );
  }

  Widget _quickLink(IconData icon, String label, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: color.withAlpha(15),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withAlpha(40)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 6),
            Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color)),
          ],
        ),
      ),
    );
  }

  Widget _buildSubscriptionCard() {
    // _subscription API 결과 또는 auth.isPro fallback
    final auth = context.read<AuthService>();
    final isPro = _subscription?['isPro'] == true || auth.isPro;
    final sub = _subscription?['subscription'];
    final expiresAt = sub?['expiresAt'] ?? sub?['expires_at'];

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isPro
              ? [AppColors.amber.withAlpha(20), AppColors.amber.withAlpha(10)]
              : [AppColors.surfaceBorder, AppColors.surfaceBorder],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: isPro ? AppColors.amber.withAlpha(51) : AppColors.surfaceTint),
      ),
      child: Row(
        children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(
              color: isPro ? AppColors.amber.withAlpha(30) : AppColors.surfaceBorder,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              isPro ? Icons.workspace_premium : Icons.star_border,
              color: isPro ? AppColors.amber : Colors.white54,
              size: 24,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isPro ? 'PRO 플랜' : 'FREE 플랜',
                  style: TextStyle(
                    fontSize: 15, fontWeight: FontWeight.bold,
                    color: isPro ? AppColors.amber : Colors.white,
                  ),
                ),
                if (isPro && expiresAt != null)
                  Text(
                    '만료: $expiresAt',
                    style: TextStyle(fontSize: 11, color: AppColors.textHint),
                  )
                else if (!isPro)
                  Text(
                    'PRO로 업그레이드하면 케미스트리, 스트릭 등을 이용할 수 있어요',
                    style: TextStyle(fontSize: 11, color: AppColors.textHint),
                  ),
              ],
            ),
          ),
          if (!isPro)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.primary.withAlpha(20),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.primary.withAlpha(51)),
              ),
              child: const Text('업그레이드', style: TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w600)),
            ),
        ],
      ),
    );
  }

}
