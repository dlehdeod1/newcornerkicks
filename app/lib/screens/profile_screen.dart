import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import 'settlements_screen.dart';
import 'admin_club_settings_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final ApiService _api = ApiService();
  Map<String, dynamic>? _playerStats;
  Map<String, dynamic>? _clubDetail;
  int? _myRank;
  bool _loading = true;
  bool? _googleLinked;
  bool _googleLinking = false;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final auth = context.read<AuthService>();
    final player = auth.player;
    final token = auth.token;

    final futures = <Future>[];

    if (player != null && token != null) {
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

    if (token != null) {
      futures.add(_api.getMyClub(token).then((res) {
        _clubDetail = res['club'] ?? res;
      }).catchError((_) {}));
    }

    if (token != null) {
      futures.add(_api.me(token).then((res) {
        _googleLinked = res['user']?['googleLinked'] == true;
      }).catchError((_) {}));
    }

    await Future.wait(futures);
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _regenerateInviteCode(AuthService auth) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1e293b),
        title: const Text('초대 코드 재생성', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
        content: const Text('기존 초대 코드는 더 이상 사용할 수 없게 됩니다. 계속할까요?', style: TextStyle(color: Colors.white70, fontSize: 13)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('취소', style: TextStyle(color: Colors.white.withAlpha(102))),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF34d399),
              foregroundColor: const Color(0xFF0f172a),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('재생성', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      final res = await _api.request('/clubs/me/regenerate-invite', method: 'POST', token: auth.token);
      final newCode = res['inviteCode'] as String?;
      if (newCode != null && mounted) {
        setState(() {
          _clubDetail = {...?_clubDetail, 'inviteCode': newCode};
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('초대 코드가 재생성되었습니다'), backgroundColor: Color(0xFF34d399), duration: Duration(seconds: 2)),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: const Color(0xFFef4444)),
        );
      }
    }
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
            _buildProfileCard(user, player, auth),
            const SizedBox(height: 20),
            // 클럽 정보
            _buildClubCard(auth),
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

  Widget _buildProfileCard(Map<String, dynamic>? user, Map<String, dynamic>? player, AuthService auth) {
    final name = player?['name'] ?? user?['username'] ?? '사용자';
    final initial = name.toString().isNotEmpty ? name.toString()[0] : '?';
    final email = user?['email'] ?? '';
    final role = auth.isAdmin ? '관리자' : '멤버';

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
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
              if (player != null) ...[
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () => _showNicknameDialog(auth),
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(color: Colors.white.withAlpha(20), shape: BoxShape.circle),
                    child: const Icon(Icons.edit, size: 14, color: Colors.white70),
                  ),
                ),
              ],
            ],
          ),
          if (player?['nickname'] != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('(${player!['nickname']})', style: TextStyle(fontSize: 14, color: Colors.white.withAlpha(128))),
            ),
          const SizedBox(height: 10),
          // 뱃지
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _badge(role, auth.isAdmin ? const Color(0xFF8b5cf6) : const Color(0xFF3b82f6)),
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

  Widget _buildClubCard(AuthService auth) {
    final club = auth.club;
    if (club == null) return const SizedBox.shrink();

    final clubName = club['name'] ?? '';
    final slug = club['slug'] ?? '';
    final inviteCode = _clubDetail?['inviteCode'] ?? '';
    final memberCount = _clubDetail?['memberCount'];

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(8),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF34d399).withAlpha(30)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('⚽', style: TextStyle(fontSize: 18)),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(clubName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                    Text('@$slug', style: TextStyle(fontSize: 12, color: Colors.white.withAlpha(102))),
                  ],
                ),
              ),
              if (memberCount != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF34d399).withAlpha(20),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text('$memberCount명', style: const TextStyle(fontSize: 12, color: Color(0xFF34d399), fontWeight: FontWeight.w600)),
                ),
            ],
          ),
          if (auth.isAdmin && inviteCode.isNotEmpty) ...[
            const SizedBox(height: 14),
            Divider(color: Colors.white.withAlpha(15)),
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(Icons.link, size: 15, color: Colors.white.withAlpha(102)),
                const SizedBox(width: 8),
                Text('초대 코드', style: TextStyle(fontSize: 12, color: Colors.white.withAlpha(102))),
                const Spacer(),
                // 재생성 버튼
                GestureDetector(
                  onTap: () => _regenerateInviteCode(auth),
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    margin: const EdgeInsets.only(right: 8),
                    decoration: BoxDecoration(
                      color: Colors.white.withAlpha(13),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.white.withAlpha(26)),
                    ),
                    child: Icon(Icons.refresh, size: 14, color: Colors.white.withAlpha(153)),
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: inviteCode));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('초대 코드가 복사되었습니다 ✅'), backgroundColor: Color(0xFF34d399), duration: Duration(seconds: 2)),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF34d399).withAlpha(20),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFF34d399).withAlpha(51)),
                    ),
                    child: Row(
                      children: [
                        Text(inviteCode, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF34d399), letterSpacing: 1.5)),
                        const SizedBox(width: 6),
                        const Icon(Icons.copy, size: 13, color: Color(0xFF34d399)),
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
        if (auth.isAdmin) ...[
          _menuItem(
            icon: Icons.tune_rounded,
            label: '클럽 관리 설정',
            color: const Color(0xFF8b5cf6),
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminClubSettingsScreen())),
          ),
          const SizedBox(height: 8),
        ],
        _menuItem(
          icon: Icons.receipt_long,
          label: '정산 내역',
          color: const Color(0xFF34d399),
          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SettlementsScreen())),
        ),
        const SizedBox(height: 8),
        _menuItem(
          icon: Icons.lock_outline,
          label: '비밀번호 변경',
          color: const Color(0xFF3b82f6),
          onTap: () => _showPasswordDialog(auth),
        ),
        const SizedBox(height: 8),
        // 구글 계정 연동
        _googleLinked == true
          ? _menuItem(
              icon: Icons.link_off,
              label: 'Google 계정 연동됨 (해제하기)',
              color: const Color(0xFF94a3b8),
              onTap: () => _unlinkGoogle(auth),
            )
          : _menuItem(
              icon: Icons.add_link,
              label: 'Google 계정 연동하기',
              color: const Color(0xFF4285F4),
              onTap: () => _linkGoogle(auth),
            ),
        const SizedBox(height: 8),
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

  Future<void> _linkGoogle(AuthService auth) async {
    if (_googleLinking) return;
    setState(() => _googleLinking = true);
    try {
      final googleSignIn = GoogleSignIn(scopes: ['email', 'profile']);
      final account = await googleSignIn.signIn();
      if (account == null) return;
      final gAuth = await account.authentication;
      final idToken = gAuth.idToken;
      if (idToken == null) throw Exception('Google 인증 토큰을 가져올 수 없습니다.');

      await _api.request('/auth/link-google', method: 'POST', body: {'idToken': idToken}, token: auth.token);
      setState(() => _googleLinked = true);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${account.email} Google 계정이 연동되었습니다'), backgroundColor: const Color(0xFF34d399)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', '')), backgroundColor: const Color(0xFFef4444)),
        );
      }
    } finally {
      if (mounted) setState(() => _googleLinking = false);
    }
  }

  Future<void> _unlinkGoogle(AuthService auth) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1e293b),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Google 연동 해제', style: TextStyle(color: Colors.white)),
        content: const Text('Google 계정 연동을 해제할까요?', style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('취소', style: TextStyle(color: Colors.white54))),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('해제', style: TextStyle(color: Color(0xFFef4444)))),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _api.request('/auth/link-google', method: 'DELETE', token: auth.token);
      setState(() => _googleLinked = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Google 연동이 해제되었습니다'), backgroundColor: Color(0xFF34d399)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', '')), backgroundColor: const Color(0xFFef4444)),
        );
      }
    }
  }

  void _showPasswordDialog(AuthService auth) {
    final oldCtrl = TextEditingController();
    final newCtrl = TextEditingController();
    final confirmCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1e293b),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('비밀번호 변경', style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _pwField(oldCtrl, '현재 비밀번호'),
            const SizedBox(height: 10),
            _pwField(newCtrl, '새 비밀번호'),
            const SizedBox(height: 10),
            _pwField(confirmCtrl, '새 비밀번호 확인'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('취소', style: TextStyle(color: Colors.white54)),
          ),
          TextButton(
            onPressed: () async {
              if (newCtrl.text != confirmCtrl.text) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('새 비밀번호가 일치하지 않습니다'), backgroundColor: Color(0xFFef4444)),
                );
                return;
              }
              try {
                await ApiService().request('/auth/password', method: 'PUT', body: {
                  'oldPassword': oldCtrl.text,
                  'newPassword': newCtrl.text,
                }, token: auth.token);
                if (ctx.mounted) Navigator.pop(ctx);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('비밀번호가 변경되었습니다 ✅'), backgroundColor: Color(0xFF34d399)),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('$e'), backgroundColor: const Color(0xFFef4444)),
                  );
                }
              }
            },
            child: const Text('변경', style: TextStyle(color: Color(0xFF34d399))),
          ),
        ],
      ),
    );
  }

  void _showNicknameDialog(AuthService auth) {
    final player = auth.player;
    if (player == null) return;

    final nicknameCtrl = TextEditingController(text: player['nickname'] ?? '');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1e293b),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('닉네임 변경', style: TextStyle(color: Colors.white)),
        content: TextField(
          controller: nicknameCtrl,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            hintText: '새 닉네임 입력',
            hintStyle: const TextStyle(color: Colors.white38),
            filled: true,
            fillColor: const Color(0xFF0f172a),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('취소', style: TextStyle(color: Colors.white54)),
          ),
          TextButton(
            onPressed: () async {
              if (nicknameCtrl.text.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('닉네임을 입력해주세요'), backgroundColor: Color(0xFFef4444)));
                return;
              }
              try {
                await ApiService().request('/auth/profile', method: 'PUT', body: {
                  'nickname': nicknameCtrl.text,
                }, token: auth.token);
                await auth.init();
                if (ctx.mounted) Navigator.pop(ctx);
                if (mounted) {
                  _loadProfile();
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('닉네임이 변경되었습니다 ✅'), backgroundColor: Color(0xFF34d399)));
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: const Color(0xFFef4444)));
                }
              }
            },
            child: const Text('변경', style: TextStyle(color: Color(0xFF34d399))),
          ),
        ],
      ),
    );
  }

  TextField _pwField(TextEditingController ctrl, String hint) => TextField(
    controller: ctrl,
    obscureText: true,
    style: const TextStyle(color: Colors.white),
    decoration: InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: Colors.white38),
      filled: true,
      fillColor: const Color(0xFF0f172a),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    ),
  );

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
