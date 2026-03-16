import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';

class ClubOnboardingScreen extends StatefulWidget {
  const ClubOnboardingScreen({super.key});

  @override
  State<ClubOnboardingScreen> createState() => _ClubOnboardingScreenState();
}

class _ClubOnboardingScreenState extends State<ClubOnboardingScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tab;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 40),
            // 로고
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.primary, AppColors.teal],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(22),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withAlpha(77),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: const Center(child: Text('⚽', style: TextStyle(fontSize: 32))),
            ),
            const SizedBox(height: 20),
            const Text(
              '클럽에 참여하세요',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 8),
            Text(
              '초대 코드로 기존 클럽에 참여하거나\n새 클럽을 만들어보세요',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: Colors.white.withAlpha(153), height: 1.5),
            ),
            const SizedBox(height: 32),
            // 탭
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 24),
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(10),
                borderRadius: BorderRadius.circular(14),
              ),
              child: TabBar(
                controller: _tab,
                indicator: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(10),
                ),
                indicatorSize: TabBarIndicatorSize.tab,
                labelColor: Colors.white,
                unselectedLabelColor: Colors.white54,
                labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                dividerColor: Colors.transparent,
                tabs: const [
                  Tab(text: '클럽 참여'),
                  Tab(text: '클럽 만들기'),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: TabBarView(
                controller: _tab,
                children: const [
                  _JoinTab(),
                  _CreateTab(),
                ],
              ),
            ),
            // 로그아웃
            Padding(
              padding: const EdgeInsets.only(bottom: 24),
              child: TextButton(
                onPressed: () => context.read<AuthService>().logout(),
                child: Text(
                  '다른 계정으로 로그인',
                  style: TextStyle(color: Colors.white.withAlpha(102), fontSize: 13),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _JoinTab extends StatefulWidget {
  const _JoinTab();

  @override
  State<_JoinTab> createState() => _JoinTabState();
}

class _JoinTabState extends State<_JoinTab> {
  final _codeCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _join() async {
    final code = _codeCtrl.text.trim().toUpperCase();
    if (code.isEmpty) {
      setState(() => _error = '초대 코드를 입력해주세요.');
      return;
    }

    setState(() { _loading = true; _error = null; });

    try {
      final auth = context.read<AuthService>();
      await ApiService().joinClub(code, auth.token!);
      await auth.refreshClub();
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          const SizedBox(height: 24),
          _buildInput(
            controller: _codeCtrl,
            label: '초대 코드',
            hint: '예: CK2025',
            textCapitalization: TextCapitalization.characters,
            onSubmitted: (_) => _join(),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.withAlpha(26),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.red.withAlpha(77)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: Colors.red, size: 16),
                  const SizedBox(width: 8),
                  Expanded(child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13))),
                ],
              ),
            ),
          ],
          const SizedBox(height: 24),
          _buildButton(
            label: '참여하기',
            loading: _loading,
            onTap: _join,
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(8),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline, color: AppColors.primary, size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '초대 코드는 클럽 관리자에게 받을 수 있습니다.',
                    style: TextStyle(color: Colors.white.withAlpha(153), fontSize: 13, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CreateTab extends StatefulWidget {
  const _CreateTab();

  @override
  State<_CreateTab> createState() => _CreateTabState();
}

class _CreateTabState extends State<_CreateTab> {
  final _nameCtrl = TextEditingController();
  final _slugCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  bool _loading = false;
  String? _error;
  String? _slugStatus; // null / 'checking' / 'available' / 'taken'
  List<String> _slugSuggestions = [];

  @override
  void dispose() {
    _nameCtrl.dispose();
    _slugCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _checkSlug(String slug) async {
    if (slug.length < 2) {
      setState(() { _slugStatus = null; _slugSuggestions = []; });
      return;
    }
    setState(() => _slugStatus = 'checking');
    try {
      final res = await ApiService().checkSlug(slug);
      if (mounted) {
        setState(() {
          _slugStatus = res['available'] == true ? 'available' : 'taken';
          _slugSuggestions = res['suggestions'] != null
              ? List<String>.from(res['suggestions'])
              : [];
        });
      }
    } catch (_) {
      if (mounted) setState(() => _slugStatus = null);
    }
  }

  Future<void> _create() async {
    final name = _nameCtrl.text.trim();
    final slug = _slugCtrl.text.trim().toLowerCase();

    if (name.isEmpty || slug.isEmpty) {
      setState(() => _error = '클럽 이름과 클럽 ID를 입력해주세요.');
      return;
    }
    if (_slugStatus != 'available') {
      setState(() => _error = '사용 가능한 클럽 ID를 입력해주세요.');
      return;
    }

    setState(() { _loading = true; _error = null; });

    try {
      final auth = context.read<AuthService>();
      await ApiService().createClub(slug, name, auth.token!, description: _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim());
      await auth.refreshClub();
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 24),
          _buildInput(controller: _nameCtrl, label: '클럽 이름', hint: '예: 코너킥스 FC'),
          const SizedBox(height: 16),
          // 클럽 ID
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('클럽 ID', style: TextStyle(fontSize: 13, color: Colors.white.withAlpha(179), fontWeight: FontWeight.w500)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _slugCtrl,
                      style: const TextStyle(color: Colors.white, fontSize: 15),
                      textCapitalization: TextCapitalization.none,
                      onChanged: (v) {
                        final cleaned = v.toLowerCase().replaceAll(RegExp(r'[^a-z0-9\-_]'), '');
                        if (cleaned != v) {
                          _slugCtrl.value = TextEditingValue(
                            text: cleaned,
                            selection: TextSelection.collapsed(offset: cleaned.length),
                          );
                        }
                        _checkSlug(cleaned);
                      },
                      decoration: InputDecoration(
                        hintText: '예: cornerkicks',
                        hintStyle: TextStyle(color: Colors.white.withAlpha(77)),
                        filled: true,
                        fillColor: Colors.white.withAlpha(10),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: Colors.white.withAlpha(26)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(
                            color: _slugStatus == 'available'
                                ? AppColors.primary.withAlpha(128)
                                : _slugStatus == 'taken'
                                    ? Colors.red.withAlpha(128)
                                    : Colors.white.withAlpha(26),
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppColors.primary),
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                        suffixIcon: _slugStatus == 'checking'
                            ? const Padding(
                                padding: EdgeInsets.all(12),
                                child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary)),
                              )
                            : _slugStatus == 'available'
                                ? const Icon(Icons.check_circle, color: AppColors.primary, size: 20)
                                : _slugStatus == 'taken'
                                    ? const Icon(Icons.cancel, color: Colors.red, size: 20)
                                    : null,
                      ),
                    ),
                  ),
                ],
              ),
              if (_slugStatus == 'taken' && _slugSuggestions.isNotEmpty) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: _slugSuggestions.map((s) => GestureDetector(
                    onTap: () {
                      _slugCtrl.text = s;
                      _checkSlug(s);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withAlpha(20),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.primary.withAlpha(77)),
                      ),
                      child: Text(s, style: const TextStyle(color: AppColors.primary, fontSize: 12)),
                    ),
                  )).toList(),
                ),
              ],
              const SizedBox(height: 4),
              Text(
                '영문 소문자, 숫자, -, _ 만 사용 가능',
                style: TextStyle(fontSize: 11, color: Colors.white.withAlpha(77)),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildInput(controller: _descCtrl, label: '소개 (선택)', hint: '클럽 소개를 입력하세요'),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.withAlpha(26),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.red.withAlpha(77)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: Colors.red, size: 16),
                  const SizedBox(width: 8),
                  Expanded(child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13))),
                ],
              ),
            ),
          ],
          const SizedBox(height: 24),
          _buildButton(label: '클럽 만들기', loading: _loading, onTap: _create),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

// 공통 위젯
Widget _buildInput({
  required TextEditingController controller,
  required String label,
  required String hint,
  TextCapitalization textCapitalization = TextCapitalization.none,
  void Function(String)? onSubmitted,
}) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: TextStyle(fontSize: 13, color: Colors.white.withAlpha(179), fontWeight: FontWeight.w500)),
      const SizedBox(height: 8),
      TextField(
        controller: controller,
        style: const TextStyle(color: Colors.white, fontSize: 15),
        textCapitalization: textCapitalization,
        onSubmitted: onSubmitted,
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(color: Colors.white.withAlpha(77)),
          filled: true,
          fillColor: Colors.white.withAlpha(10),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.white.withAlpha(26)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.white.withAlpha(26)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: AppColors.primary),
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        ),
      ),
    ],
  );
}

Widget _buildButton({required String label, required bool loading, required VoidCallback onTap}) {
  return GestureDetector(
    onTap: loading ? null : onTap,
    child: Container(
      width: double.infinity,
      height: 52,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, AppColors.teal],
        ),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withAlpha(51),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Center(
        child: loading
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
      ),
    ),
  );
}
