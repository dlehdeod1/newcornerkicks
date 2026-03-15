import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/auth_service.dart';
import 'screens/login_screen.dart';
import 'screens/main_shell.dart';
import 'screens/club_onboarding_screen.dart';
import 'screens/club_selector_screen.dart';

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (_) => AuthService()..init(),
      child: const CornerKicksApp(),
    ),
  );
}

class CornerKicksApp extends StatelessWidget {
  const CornerKicksApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '코너킥스',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0f172a),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF10b981),
          brightness: Brightness.dark,
          surface: const Color(0xFF1e293b),
        ),
        useMaterial3: true,
      ),
      home: Consumer<AuthService>(
        builder: (context, auth, _) {
          if (auth.isLoading) {
            return const Scaffold(
              backgroundColor: Color(0xFF0f172a),
              body: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CircularProgressIndicator(color: Color(0xFF34d399)),
                    SizedBox(height: 16),
                    Text('로딩 중...', style: TextStyle(color: Colors.white54)),
                  ],
                ),
              ),
            );
          }

          if (!auth.isLoggedIn) return const LoginScreen();

          // 클럽이 없으면 온보딩 (신규 가입자)
          if (auth.clubs.isEmpty) return const ClubOnboardingScreen();

          // 클럽이 여러 개인데 아직 활성 클럽을 고르지 않은 경우
          // (hasClub이 false = _club이 null, 하지만 clubs는 있음)
          if (!auth.hasClub && auth.clubs.isNotEmpty) {
            return const ClubSelectorScreen();
          }

          return const MainShell();
        },
      ),
    );
  }
}
