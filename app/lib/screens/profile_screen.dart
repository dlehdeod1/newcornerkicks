import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'package:provider/provider.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../widgets/tip_banner.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final ApiService _api = ApiService();
  bool? _googleLinked;
  bool _googleLinking = false;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final auth = context.read<AuthService>();
    final token = auth.token;

    if (token != null) {
      try {
        final res = await _api.me(token);
        _googleLinked = res['user']?['googleLinked'] == true;
      } catch (_) {}
    }

    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final user = auth.user;
    final player = auth.player;

    return RefreshIndicator(
      onRefresh: () async {
        await _loadProfile();
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            if (player != null && player['nickname'] == null)
              const TipBanner(
                tipId: 'profile_nickname',
                text: '닉네임을 설정하면 다른 멤버에게 표시돼요! 이름 옆 연필 아이콘을 눌러보세요.',
                icon: Icons.badge,
                color: AppColors.purple,
              ),
            _buildProfileCard(user, player, auth),
            const SizedBox(height: 20),
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
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [AppColors.primary, AppColors.teal]),
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
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _badge(role, auth.isAdmin ? AppColors.purple : AppColors.blue),
              if (player != null) ...[
                const SizedBox(width: 8),
                _badge('선수 연동됨', AppColors.primary),
              ],
            ],
          ),
          const SizedBox(height: 14),
          Divider(color: Colors.white.withAlpha(20)),
          const SizedBox(height: 10),
          _infoRow(Icons.mail_outline, email),
          const SizedBox(height: 6),
          _infoRow(Icons.person_outline, '@${user?['username'] ?? ''}'),
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

  Widget _buildMenuSection(AuthService auth) {
    return Column(
      children: [
        _menuItem(
          icon: Icons.lock_outline,
          label: '비밀번호 변경',
          color: AppColors.blue,
          onTap: () => _showPasswordDialog(auth),
        ),
        const SizedBox(height: 8),
        _googleLinked == true
          ? _menuItem(
              icon: Icons.link_off,
              label: 'Google 계정 연동됨 (해제하기)',
              color: AppColors.slateLight,
              onTap: () => _unlinkGoogle(auth),
            )
          : _menuItem(
              icon: Icons.add_link,
              label: 'Google 계정 연동하기',
              color: AppColors.google,
              onTap: () => _linkGoogle(auth),
            ),
        const SizedBox(height: 8),
        _menuItem(
          icon: Icons.logout,
          label: '로그아웃',
          color: AppColors.red,
          onTap: () async {
            final confirm = await showDialog<bool>(
              context: context,
              builder: (ctx) => AlertDialog(
                backgroundColor: AppColors.bgCard,
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
                    child: const Text('로그아웃', style: TextStyle(color: AppColors.red)),
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
          SnackBar(content: Text('${account.email} Google 계정이 연동되었습니다'), backgroundColor: AppColors.primary),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', '')), backgroundColor: AppColors.red),
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
        backgroundColor: AppColors.bgCard,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Google 연동 해제', style: TextStyle(color: Colors.white)),
        content: const Text('Google 계정 연동을 해제할까요?', style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('취소', style: TextStyle(color: Colors.white54))),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('해제', style: TextStyle(color: AppColors.red))),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _api.request('/auth/link-google', method: 'DELETE', token: auth.token);
      setState(() => _googleLinked = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Google 연동이 해제되었습니다'), backgroundColor: AppColors.primary),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', '')), backgroundColor: AppColors.red),
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
        backgroundColor: AppColors.bgCard,
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
                  const SnackBar(content: Text('새 비밀번호가 일치하지 않습니다'), backgroundColor: AppColors.red),
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
                    const SnackBar(content: Text('비밀번호가 변경되었습니다'), backgroundColor: AppColors.primary),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('$e'), backgroundColor: AppColors.red),
                  );
                }
              }
            },
            child: const Text('변경', style: TextStyle(color: AppColors.primary)),
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
        backgroundColor: AppColors.bgCard,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('닉네임 변경', style: TextStyle(color: Colors.white)),
        content: TextField(
          controller: nicknameCtrl,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            hintText: '새 닉네임 입력',
            hintStyle: const TextStyle(color: Colors.white38),
            filled: true,
            fillColor: AppColors.bgBase,
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
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('닉네임을 입력해주세요'), backgroundColor: AppColors.red));
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
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('닉네임이 변경되었습니다'), backgroundColor: AppColors.primary));
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.red));
                }
              }
            },
            child: const Text('변경', style: TextStyle(color: AppColors.primary)),
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
      fillColor: AppColors.bgBase,
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
