import 'package:flutter/material.dart';
import 'home_screen.dart';
import 'sessions_screen.dart';
import 'ranking_screen.dart';
import 'profile_screen.dart';

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
    const ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0f172a),
        elevation: 0,
        title: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF34d399), Color(0xFF14b8a6)],
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Center(child: Text('⚽', style: TextStyle(fontSize: 16))),
            ),
            const SizedBox(width: 10),
            const Text(
              '코너킥스',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Colors.white),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined, color: Colors.white54),
            onPressed: () {},
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF1e293b),
          border: Border(top: BorderSide(color: Colors.white.withAlpha(26))),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (idx) => setState(() => _currentIndex = idx),
          backgroundColor: Colors.transparent,
          elevation: 0,
          type: BottomNavigationBarType.fixed,
          selectedItemColor: const Color(0xFF34d399),
          unselectedItemColor: Colors.white38,
          selectedFontSize: 12,
          unselectedFontSize: 12,
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: '홈'),
            BottomNavigationBarItem(icon: Icon(Icons.calendar_today_outlined), activeIcon: Icon(Icons.calendar_today), label: '세션'),
            BottomNavigationBarItem(icon: Icon(Icons.emoji_events_outlined), activeIcon: Icon(Icons.emoji_events), label: '랭킹'),
            BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: '프로필'),
          ],
        ),
      ),
    );
  }
}



