import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/auth_service.dart';
import 'home_screen.dart';
import 'sessions_screen.dart';
import 'ranking_screen.dart';
import 'club_screen.dart';
import 'profile_screen.dart';
import 'notifications_screen.dart';
import 'club_selector_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  static final navigatorKey = GlobalKey<_MainShellState>();

  @override
  State<MainShell> createState() => _MainShellState();

  static void switchTab(BuildContext context, int index) {
    final state = context.findAncestorStateOfType<_MainShellState>();
    state?._switchTab(index);
  }
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;

  void _switchTab(int index) {
    setState(() => _currentIndex = index);
  }

  final _screens = [
    const HomeScreen(),
    const SessionsScreen(),
    const RankingScreen(),
    const ClubScreen(),
    const ProfileScreen(),
  ];

  Widget _buildAdBanner(BuildContext context) {
    return GestureDetector(
      onTap: () {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: AppColors.bgCard,
            title: const Text('PRO 플랜으로 업그레이드', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _proFeatureRow('📵', '광고 완전 제거'),
                _proFeatureRow('⚡', 'AI 능력치 기반 팀 편성'),
                _proFeatureRow('🤖', 'AI 세션 분석 리포트'),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: Text('나중에', style: TextStyle(color: Colors.white.withAlpha(102))),
              ),
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  launchUrl(
                    Uri.parse('https://cornerkicks.pages.dev/upgrade'),
                    mode: LaunchMode.externalApplication,
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.bgBase,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('업그레이드', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        );
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.bgCard,
          border: Border(
            top: BorderSide(color: Colors.white.withAlpha(13)),
            bottom: BorderSide(color: Colors.white.withAlpha(13)),
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(26),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text('광고', style: TextStyle(color: Colors.white38, fontSize: 9)),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'PRO 업그레이드로 광고 없이 즐기세요',
                style: TextStyle(color: Colors.white54, fontSize: 12),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const Text('업그레이드 →', style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }

  Widget _proFeatureRow(String emoji, String text) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(
      children: [
        Text(emoji, style: const TextStyle(fontSize: 14)),
        const SizedBox(width: 8),
        Text(text, style: const TextStyle(color: Colors.white, fontSize: 13)),
      ],
    ),
  );

  void _showClubSwitcher() {
    final auth = context.read<AuthService>();
    final clubs = auth.clubs;
    if (clubs.length <= 1) return;

    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const ClubSelectorScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final clubName = auth.club?['name'] ?? '코너킥스';
    final hasMultiClubs = auth.clubs.length > 1;

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: AppColors.bgBase,
        elevation: 0,
        title: GestureDetector(
          onTap: hasMultiClubs ? _showClubSwitcher : null,
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.primary, AppColors.teal],
                  ),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Center(child: Text('⚽', style: TextStyle(fontSize: 16))),
              ),
              const SizedBox(width: 10),
              Flexible(
                child: Text(
                  clubName,
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Colors.white),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (hasMultiClubs) ...[
                const SizedBox(width: 4),
                Icon(Icons.arrow_drop_down, color: Colors.white.withAlpha(153), size: 20),
              ],
            ],
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined, color: Colors.white54),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsScreen())),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: IndexedStack(
              index: _currentIndex,
              children: _screens,
            ),
          ),
          if (auth.isLoggedIn && !auth.isPro) _buildAdBanner(context),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: AppColors.bgCard,
          border: Border(top: BorderSide(color: Colors.white.withAlpha(26))),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (idx) => setState(() => _currentIndex = idx),
          backgroundColor: Colors.transparent,
          elevation: 0,
          type: BottomNavigationBarType.fixed,
          selectedItemColor: AppColors.primary,
          unselectedItemColor: Colors.white38,
          selectedFontSize: 11,
          unselectedFontSize: 11,
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: '홈'),
            BottomNavigationBarItem(icon: Icon(Icons.calendar_today_outlined), activeIcon: Icon(Icons.calendar_today), label: '세션'),
            BottomNavigationBarItem(icon: Icon(Icons.emoji_events_outlined), activeIcon: Icon(Icons.emoji_events), label: '랭킹'),
            BottomNavigationBarItem(icon: Icon(Icons.sports_soccer_outlined), activeIcon: Icon(Icons.sports_soccer), label: '클럽'),
            BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: 'MY'),
          ],
        ),
      ),
    );
  }
}
