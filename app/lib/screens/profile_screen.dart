import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final ApiService _api = ApiService();
  Map<String, dynamic>? _playerStats;
  int? _myRank;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final auth = context.read<AuthService>();
    final player = auth.player;

    if (player == null) {
      if (mounted) setState(() => _loading = false);
      return;
    }

    try {
      final res = await _api.getRankings(year: DateTime.now().year);
      final rankings = (res['data']?['rankings'] as List?) ?? [];

      // MVP 기준 정렬
      rankings.sort((a, b) => ((b['mvpCount'] ?? 0) as num).compareTo((a['mvpCount'] ?? 0) as num));

      final idx = rankings.indexWhere((p) => p['id'] == player['id']);
      if (idx >= 0) {
        _playerStats = rankings[idx];
        _myRank = idx + 1;
      }
    } catch (_) {}

    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final user = auth.user;
    final player = auth.player;

    return RefreshIndicator(
      onRefresh: () async {
        setState(() => _loading = true);
        await _loadProfile();
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // 프로필 카드
            _buildProfileCard(user, player),
            const SizedBox(height: 20),
            // 시즌 스탯
            if (player != null) _buildSeasonStats(),
            const SizedBox(height: 20),
            // 메뉴
            _buildMenuSection(auth),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileCard(Map<String, dynamic>? user, Map<String, dynamic>? player) {
    final name = player?['name'] ?? user?['username'] ?? '사용자';
    final initial = name.toString().isNotEmpty ? name.toString()[0] : '?';
    final email = user?['email'] ?? '';
    final role = user?['role'] == 'admin' ? '관리자' : '멤버';

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(8),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withAlpha(20)),
      ),
      child: Column(
        children: [
          // 아바타
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFF34d399), Color(0xFF14b8a6)]),
              borderRadius: BorderRadius.circular(24),
            ),
            child: Center(child: Text(initial, style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white))),
          ),
          const SizedBox(height: 14),
          Text(name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
          if (player?['nickname'] != null)
            Text('(${player!['nickname']})', style: TextStyle(fontSize: 14, color: Colors.white.withAlpha(128))),
          const SizedBox(height: 10),
          // 뱃지
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _badge(role, role == '관리자' ? const Color(0xFF8b5cf6) : const Color(0xFF3b82f6)),
              if (player != null) ...[
                const SizedBox(width: 8),
                _badge('선수 연동됨', const Color(0xFF34d399)),
              ],
            ],
          ),
          const SizedBox(height: 14),
          Divider(color: Colors.white.withAlpha(20)),
          const SizedBox(height: 10),
          // 정보
          _infoRow(Icons.mail_outline, email),
          const SizedBox(height: 6),
          _infoRow(Icons.person_outline, '@${user?['username'] ?? ''}'),
          if (_myRank != null) ...[
            const SizedBox(height: 6),
            _infoRow(Icons.emoji_events_outlined, 'MVP 순위 $_myRank위'),
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

  Widget _infoRow(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 16, color: Colors.white.withAlpha(102)),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: TextStyle(fontSize: 13, color: Colors.white.withAlpha(153)))),
      ],
    );
  }

  Widget _buildSeasonStats() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF34d399)));
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
              const Icon(Icons.trending_up, size: 18, color: Color(0xFF34d399)),
              const SizedBox(width: 8),
              Text('$year년 시즌 스탯', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white)),
            ],
          ),
          const SizedBox(height: 16),
          // 주요 스탯 4개
          Row(
            children: [
              _statCard('⭐', 'MVP', '${stats['mvpCount'] ?? 0}회', const Color(0xFF34d399)),
              _statCard('⚽', '득점', '${stats['goals'] ?? 0}', const Color(0xFFf59e0b)),
              _statCard('⚡', '도움', '${stats['assists'] ?? 0}', const Color(0xFF3b82f6)),
              _statCard('🛡️', '수비', '${stats['defenses'] ?? 0}', const Color(0xFF8b5cf6)),
            ],
          ),
          const SizedBox(height: 12),
          // 추가 스탯
          Row(
            children: [
              Expanded(
                child: _miniStat('경기', '${stats['games'] ?? 0}경기', Icons.sports_soccer),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _miniStat('1등', '${stats['rank1'] ?? 0}회', Icons.emoji_events),
              ),
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

  Widget _buildMenuSection(AuthService auth) {
    return Column(
      children: [
        _menuItem(
          icon: Icons.logout,
          label: '로그아웃',
          color: const Color(0xFFef4444),
          onTap: () async {
            final confirm = await showDialog<bool>(
              context: context,
              builder: (ctx) => AlertDialog(
                backgroundColor: const Color(0xFF1e293b),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                title: const Text('로그아웃', style: TextStyle(color: Colors.white)),
                content: const Text('정말 로그아웃 하시겠습니까?', style: TextStyle(color: Colors.white70)),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    child: const Text('취소', style: TextStyle(color: Colors.white54)),
                  ),
                  TextButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    child: const Text('로그아웃', style: TextStyle(color: Color(0xFFef4444))),
                  ),
                ],
              ),
            );
            if (confirm == true) {
              await auth.logout();
            }
          },
        ),
      ],
    );
  }

  Widget _menuItem({required IconData icon, required String label, required Color color, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white.withAlpha(5),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white.withAlpha(13)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(width: 12),
            Text(label, style: TextStyle(fontSize: 15, color: color)),
            const Spacer(),
            Icon(Icons.chevron_right, size: 18, color: Colors.white.withAlpha(64)),
          ],
        ),
      ),
    );
  }
}
