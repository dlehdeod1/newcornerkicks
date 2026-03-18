import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  late TabController _tab;
  bool _loading = false;
  String? _error;

  // 로그인 폼
  final _loginIdCtrl = TextEditingController();
  final _loginPwCtrl = TextEditingController();
  bool _loginObscure = true;

  // 회원가입 폼
  final _regEmailCtrl = TextEditingController();
  final _regUsernameCtrl = TextEditingController();
  final _regPwCtrl = TextEditingController();
  final _regInviteCtrl = TextEditingController();
  bool _regObscure = true;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tab.dispose();
    _loginIdCtrl.dispose();
    _loginPwCtrl.dispose();
    _regEmailCtrl.dispose();
    _regUsernameCtrl.dispose();
    _regPwCtrl.dispose();
    _regInviteCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (_loginIdCtrl.text.isEmpty || _loginPwCtrl.text.isEmpty) {
      setState(() => _error = '아이디와 비밀번호를 입력해주세요.');
      return;
    }
    setState(() { _loading = true; _error = null; });
    final auth = context.read<AuthService>();
    final success = await auth.login(_loginIdCtrl.text.trim(), _loginPwCtrl.text);
    if (!mounted) return;
    if (!success) {
      setState(() { _loading = false; _error = '로그인에 실패했습니다. 아이디/비밀번호를 확인해주세요.'; });
    }
  }

  Future<void> _googleLogin() async {
    setState(() { _loading = true; _error = null; });
    final auth = context.read<AuthService>();
    final success = await auth.loginWithGoogle();
    if (!mounted) return;
    if (!success) {
      setState(() { _loading = false; _error = auth.lastGoogleError ?? 'Google 로그인에 실패했습니다.'; });
    }
  }

  Future<void> _register() async {
    final email = _regEmailCtrl.text.trim();
    final username = _regUsernameCtrl.text.trim();
    final password = _regPwCtrl.text;
    final invite = _regInviteCtrl.text.trim().toUpperCase();

    if (email.isEmpty || username.isEmpty || password.isEmpty) {
      setState(() => _error = '이메일, 아이디, 비밀번호를 입력해주세요.');
      return;
    }
    if (password.length < 6) {
      setState(() => _error = '비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    setState(() { _loading = true; _error = null; });
    try {
      await ApiService().register(email, username, password, inviteCode: invite.isNotEmpty ? invite : null);
      if (!mounted) return;
      // 가입 성공 후 자동 로그인
      final auth = context.read<AuthService>();
      final success = await auth.login(username, password);
      if (!mounted) return;
      if (!success) {
        setState(() { _loading = false; _error = '가입은 완료됐지만 로그인에 실패했습니다.'; });
      }
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString(); });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.bgBase, AppColors.bgCard],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const SizedBox(height: 24),
                  // 로고
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [AppColors.primary, AppColors.teal]),
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(color: AppColors.primary.withAlpha(64), blurRadius: 20, offset: const Offset(0, 8)),
                      ],
                    ),
                    child: const Center(child: Text('⚽', style: TextStyle(fontSize: 36))),
                  ),
                  const SizedBox(height: 20),
                  const Text('CornerKicks', style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: Colors.white)),
                  const SizedBox(height: 4),
                  Text('풋살 동호회 관리 플랫폼', style: TextStyle(fontSize: 13, color: Colors.white.withAlpha(128))),
                  const SizedBox(height: 32),

                  // 탭
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Colors.white.withAlpha(13),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: TabBar(
                      controller: _tab,
                      onTap: (_) => setState(() => _error = null),
                      indicator: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(10)),
                      indicatorSize: TabBarIndicatorSize.tab,
                      labelColor: Colors.white,
                      unselectedLabelColor: Colors.white38,
                      labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                      dividerColor: Colors.transparent,
                      padding: EdgeInsets.zero,
                      tabs: const [Tab(text: '로그인'), Tab(text: '회원가입')],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // 폼
                  SizedBox(
                    height: 320,
                    child: TabBarView(
                      controller: _tab,
                      children: [_buildLoginForm(), _buildRegisterForm()],
                    ),
                  ),

                  // 에러
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: AppColors.red.withAlpha(26),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.red.withAlpha(77)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline, color: AppColors.red, size: 16),
                            const SizedBox(width: 8),
                            Expanded(child: Text(_error!, style: const TextStyle(color: AppColors.red, fontSize: 13))),
                          ],
                        ),
                      ),
                    ),
                  const SizedBox(height: 24),

                  // 버튼
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: _loading ? null : (_tab.index == 0 ? _login : _register),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        elevation: 0,
                      ),
                      child: _loading
                          ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : Text(_tab.index == 0 ? '로그인' : '가입하기', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  // 구분선
                  Row(children: [
                    Expanded(child: Divider(color: Colors.white.withAlpha(38))),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Text('또는', style: TextStyle(color: Colors.white.withAlpha(102), fontSize: 12)),
                    ),
                    Expanded(child: Divider(color: Colors.white.withAlpha(38))),
                  ]),
                  const SizedBox(height: 16),
                  // 구글 로그인
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: OutlinedButton(
                      onPressed: _loading ? null : _googleLogin,
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: Colors.white.withAlpha(64)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 20, height: 20,
                            decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white),
                            child: const Center(child: Text('G', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.google))),
                          ),
                          const SizedBox(width: 10),
                          const Text('Google로 계속하기', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w500)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLoginForm() {
    return Column(
      children: [
        _inputField(
          controller: _loginIdCtrl,
          hint: '아이디 또는 이메일',
          icon: Icons.person_outline,
          action: TextInputAction.next,
        ),
        const SizedBox(height: 14),
        _inputField(
          controller: _loginPwCtrl,
          hint: '비밀번호',
          icon: Icons.lock_outline,
          obscure: _loginObscure,
          onToggleObscure: () => setState(() => _loginObscure = !_loginObscure),
          action: TextInputAction.done,
          onSubmitted: (_) => _login(),
        ),
      ],
    );
  }

  Widget _buildRegisterForm() {
    return Column(
      children: [
        _inputField(
          controller: _regEmailCtrl,
          hint: '이메일',
          icon: Icons.mail_outline,
          keyboardType: TextInputType.emailAddress,
          action: TextInputAction.next,
        ),
        const SizedBox(height: 10),
        _inputField(
          controller: _regUsernameCtrl,
          hint: '아이디 (영문/숫자)',
          icon: Icons.person_outline,
          action: TextInputAction.next,
        ),
        const SizedBox(height: 10),
        _inputField(
          controller: _regPwCtrl,
          hint: '비밀번호 (6자 이상)',
          icon: Icons.lock_outline,
          obscure: _regObscure,
          onToggleObscure: () => setState(() => _regObscure = !_regObscure),
          action: TextInputAction.next,
        ),
        const SizedBox(height: 10),
        _inputField(
          controller: _regInviteCtrl,
          hint: '초대 코드 (선택)',
          icon: Icons.link,
          textCapitalization: TextCapitalization.characters,
          action: TextInputAction.done,
          onSubmitted: (_) => _register(),
        ),
      ],
    );
  }

  Widget _inputField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    bool obscure = false,
    VoidCallback? onToggleObscure,
    TextInputType keyboardType = TextInputType.text,
    TextCapitalization textCapitalization = TextCapitalization.none,
    TextInputAction action = TextInputAction.next,
    void Function(String)? onSubmitted,
  }) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      style: const TextStyle(color: Colors.white),
      keyboardType: keyboardType,
      textCapitalization: textCapitalization,
      textInputAction: action,
      onSubmitted: onSubmitted,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: Colors.white.withAlpha(102)),
        filled: true,
        fillColor: Colors.white.withAlpha(18),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
        prefixIcon: Icon(icon, color: Colors.white.withAlpha(128), size: 20),
        suffixIcon: onToggleObscure != null
            ? IconButton(
                icon: Icon(obscure ? Icons.visibility_off : Icons.visibility, color: Colors.white.withAlpha(128), size: 20),
                onPressed: onToggleObscure,
              )
            : null,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );
  }
}
