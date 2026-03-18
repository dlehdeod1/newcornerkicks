import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../theme/app_colors.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import 'player_detail_screen.dart';
import 'settlements_screen.dart';

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
            _buildClubHero(auth),
            const SizedBox(height: 20),
            _buildSeasonStats(),
            const SizedBox(height: 20),
            _buildQuickLinks(),
            const SizedBox(height: 20),
            _buildMemberList(),
          ],
        ),
      ),
    );
  }

  Widget _buildClubHero(AuthService auth) {
    final club = auth.club!;
    final clubName = club['name'] ?? '';
    final slug = club['slug'] ?? '';
    final memberCount = _clubDetail?['memberCount'];
    final inviteCode = _clubDetail?['inviteCode'] ?? '';
    final planType = _clubDetail?['planType'] ?? 'free';

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
          // 클럽 아바타
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [AppColors.primary, AppColors.teal]),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Center(
              child: Text(
                clubName.isNotEmpty ? clubName[0] : '?',
                style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(clubName, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
          Text('@$slug', style: TextStyle(fontSize: 13, color: Colors.white.withAlpha(102))),
          const SizedBox(height: 12),
          // 뱃지 행
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (memberCount != null)
                _badge('$memberCount명', AppColors.primary),
              const SizedBox(width: 8),
              _badge(planType == 'pro' ? 'PRO' : 'FREE', planType == 'pro' ? AppColors.amber : AppColors.slateLight),
              if (auth.isAdmin) ...[
                const SizedBox(width: 8),
                _badge('관리자', AppColors.purple),
              ],
            ],
          ),
          // 초대 코드
          if (inviteCode.isNotEmpty) ...[
            const SizedBox(height: 16),
            Divider(color: Colors.white.withAlpha(20)),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.link, size: 14, color: Colors.white.withAlpha(102)),
                const SizedBox(width: 6),
                Text('초대 코드', style: TextStyle(fontSize: 12, color: Colors.white.withAlpha(102))),
                const SizedBox(width: 12),
                GestureDetector(
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: inviteCode));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('초대 코드가 복사되었습니다'), backgroundColor: AppColors.primary, duration: Duration(seconds: 2)),
                    );
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
          color: Colors.white.withAlpha(8),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withAlpha(20)),
        ),
        child: Column(
          children: [
            Icon(Icons.bar_chart, size: 32, color: Colors.white.withAlpha(51)),
            const SizedBox(height: 8),
            Text('시즌 기록이 없습니다', style: TextStyle(color: Colors.white.withAlpha(102))),
          ],
        ),
      );
    }

    final stats = _playerStats!;
    final year = DateTime.now().year;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(8),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withAlpha(20)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.trending_up, size: 18, color: AppColors.primary),
              const SizedBox(width: 8),
              Text('$year년 시즌 스탯', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white)),
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
              Expanded(child: _miniStat('1등', '${stats['rank1'] ?? 0}회', Icons.emoji_events)),
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
            Text(label, style: TextStyle(fontSize: 11, color: Colors.white.withAlpha(153))),
          ],
        ),
      ),
    );
  }

  Widget _miniStat(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(5),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withAlpha(13)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 15, color: Colors.white.withAlpha(102)),
              const SizedBox(width: 6),
              Text(label, style: TextStyle(fontSize: 12, color: Colors.white.withAlpha(102))),
            ],
          ),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
        ],
      ),
    );
  }

  Widget _buildQuickLinks() {
    return Row(
      children: [
        _quickLink(Icons.receipt_long, '정산', AppColors.primary, () {
          Navigator.push(context, MaterialPageRoute(builder: (_) => const SettlementsScreen()));
        }),
        const SizedBox(width: 10),
        _quickLink(Icons.people_outline, '멤버', AppColors.blue, () {
          // 이미 아래에 멤버 목록이 있으므로 스크롤
        }),
      ],
    );
  }

  Widget _quickLink(IconData icon, String label, Color color, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
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
              Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: color)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMemberList() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(8),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withAlpha(20)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
            child: Row(
              children: [
                const Icon(Icons.people, size: 18, color: AppColors.blue),
                const SizedBox(width: 8),
                Text('멤버 (${_players.length})', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white)),
              ],
            ),
          ),
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(20),
              child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
            )
          else if (_players.isEmpty)
            Padding(
              padding: const EdgeInsets.all(20),
              child: Center(child: Text('멤버가 없습니다', style: TextStyle(color: Colors.white.withAlpha(102)))),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _players.length,
              separatorBuilder: (_, __) => Divider(height: 1, color: Colors.white.withAlpha(13)),
              itemBuilder: (context, index) {
                final p = _players[index];
                final name = p['name'] ?? '?';
                final initial = name.isNotEmpty ? name[0] : '?';
                final nick = p['nickname'];

                return ListTile(
                  leading: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [AppColors.primary.withAlpha(80), AppColors.teal.withAlpha(60)],
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(child: Text(initial, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white))),
                  ),
                  title: Text(name, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500)),
                  subtitle: nick != null ? Text(nick, style: TextStyle(color: Colors.white.withAlpha(102), fontSize: 12)) : null,
                  trailing: Icon(Icons.chevron_right, size: 18, color: Colors.white.withAlpha(64)),
                  onTap: () {
                    Navigator.push(context, MaterialPageRoute(builder: (_) => PlayerDetailScreen(playerId: p['id'])));
                  },
                );
              },
            ),
        ],
      ),
    );
  }
}
