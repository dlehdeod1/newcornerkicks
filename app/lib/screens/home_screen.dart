import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import 'main_shell.dart';
import 'session_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ApiService _api = ApiService();
  Map<String, dynamic>? _myStats;
  Map<String, dynamic>? _recentSession;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final auth = context.read<AuthService>();

    try {
      // 내 스탯 조회
      if (auth.token != null && auth.player != null) {
        try {
          final stats = await _api.getMyStats(auth.token!);
          _myStats = stats['stats'];
        } catch (_) {}
      }

      // 최근 세션 조회
      try {
        final closedRes = await _api.getSessions(status: 'closed', limit: 1);
        final completedRes = await _api.getSessions(status: 'completed', limit: 1);
        final closed = (closedRes['sessions'] as List?)?.isNotEmpty == true ? closedRes['sessions'][0] : null;
        final completed = (completedRes['sessions'] as List?)?.isNotEmpty == true ? completedRes['sessions'][0] : null;

        if (closed != null && completed != null) {
          _recentSession = (closed['session_date'] ?? '').compareTo(completed['session_date'] ?? '') >= 0 ? closed : completed;
        } else {
          _recentSession = closed ?? completed;
        }
      } catch (_) {}
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final player = auth.player;

    return RefreshIndicator(
      onRefresh: () async {
        setState(() => _loading = true);
        await _loadData();
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 헤더
            Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF34d399), Color(0xFF14b8a6)],
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Center(child: Text('⚽', style: TextStyle(fontSize: 24))),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        player != null ? '안녕하세요, ${player['name']}님!' : '코너킥스',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      Text(
                        '매주 수요일 21:00',
                        style: TextStyle(fontSize: 13, color: Colors.white.withAlpha(153)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 28),

            // 내 최근 기록 카드
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(13),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withAlpha(26)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.person, color: Colors.white.withAlpha(153), size: 20),
                      const SizedBox(width: 8),
                      Text(
                        '내 최근 기록',
                        style: TextStyle(fontSize: 13, color: Colors.white.withAlpha(153)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (_loading)
                    const Center(child: CircularProgressIndicator(color: Color(0xFF34d399)))
                  else if (_myStats != null)
                    Row(
                      children: [
                        _StatMini(label: '득점', value: '${_myStats!['goals'] ?? 0}', icon: '⚽', color: const Color(0xFF34d399)),
                        _StatMini(label: '도움', value: '${_myStats!['assists'] ?? 0}', icon: '⚡', color: const Color(0xFF3b82f6)),
                        _StatMini(label: '수비', value: '${_myStats!['defenses'] ?? 0}', icon: '🛡️', color: const Color(0xFF8b5cf6)),
                        _StatMini(label: 'MVP', value: _myStats!['mvpScore'] != null ? (_myStats!['mvpScore'] as num).toStringAsFixed(1) : '-', icon: '⭐', color: const Color(0xFFf59e0b)),
                      ],
                    )
                  else
                    Text(
                      auth.isLoggedIn ? (player != null ? '기록을 불러올 수 없습니다' : '선수 연동이 필요합니다') : '로그인이 필요합니다',
                      style: TextStyle(color: Colors.white.withAlpha(153), fontSize: 14),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // 빠른 메뉴
            Text(
              '⚡ 빠른 메뉴',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white.withAlpha(230)),
            ),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 1.6,
              children: [
                _QuickMenu(icon: Icons.calendar_today, title: '경기 결과', subtitle: '지난 매치 확인', color: const Color(0xFF34d399), onTap: () => MainShell.switchTab(context, 1)),
                _QuickMenu(icon: Icons.emoji_events, title: '랭킹', subtitle: '시즌 순위', color: const Color(0xFFf59e0b), onTap: () => MainShell.switchTab(context, 2)),
                _QuickMenu(icon: Icons.star, title: '능력치 평가', subtitle: '팀원 능력치', color: const Color(0xFF3b82f6), onTap: () {}),
                _QuickMenu(icon: Icons.workspace_premium, title: '명예의 전당', subtitle: '시즌 챔피언', color: const Color(0xFF8b5cf6), onTap: () {}),
              ],
            ),
            const SizedBox(height: 24),

            // 최근 세션 하이라이트
            Text(
              '🕐 지난 세션',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white.withAlpha(230)),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(13),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withAlpha(26)),
              ),
              child: _loading
                  ? const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator(color: Color(0xFF34d399))))
                  : _recentSession != null
                      ? GestureDetector(
                          onTap: () {
                            if (_recentSession!['id'] != null) {
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => SessionDetailScreen(sessionId: _recentSession!['id'])),
                              );
                            }
                          },
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _recentSession!['title'] ?? '정기 풋살',
                                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      _recentSession!['session_date'] ?? '',
                                      style: TextStyle(fontSize: 13, color: Colors.white.withAlpha(153)),
                                    ),
                                  ],
                                ),
                              ),
                              Icon(Icons.chevron_right, color: Colors.white.withAlpha(64), size: 20),
                            ],
                          ),
                        )
                      : Text(
                          '완료된 세션이 없습니다.',
                          style: TextStyle(color: Colors.white.withAlpha(102), fontSize: 14),
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatMini extends StatelessWidget {
  final String label;
  final String value;
  final String icon;
  final Color color;

  const _StatMini({required this.label, required this.value, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        margin: const EdgeInsets.symmetric(horizontal: 3),
        decoration: BoxDecoration(
          color: color.withAlpha(26),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withAlpha(51)),
        ),
        child: Column(
          children: [
            Text(icon, style: const TextStyle(fontSize: 16)),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
            Text(label, style: TextStyle(fontSize: 11, color: Colors.white.withAlpha(153))),
          ],
        ),
      ),
    );
  }
}

class _QuickMenu extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _QuickMenu({required this.icon, required this.title, required this.subtitle, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white.withAlpha(10),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withAlpha(20)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withAlpha(26),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 10),
            Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
            Text(subtitle, style: TextStyle(fontSize: 11, color: Colors.white.withAlpha(102))),
          ],
        ),
      ),
    );
  }
}
