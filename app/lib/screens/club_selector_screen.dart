import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../config/api_config.dart';

/// 멀티클럽 사용자가 활성 클럽을 선택하는 화면
class ClubSelectorScreen extends StatefulWidget {
  const ClubSelectorScreen({super.key});

  @override
  State<ClubSelectorScreen> createState() => _ClubSelectorScreenState();
}

class _ClubSelectorScreenState extends State<ClubSelectorScreen> {
  bool _showJoin = false;
  bool _showCreate = false;

  static const List<List<Color>> _gradients = [
    [AppColors.primary, AppColors.teal],
    [AppColors.blue, AppColors.indigo],
    [AppColors.violet, AppColors.pink],
    [AppColors.amber, AppColors.orange],
    [AppColors.rose, AppColors.red],
    [AppColors.cyan, AppColors.blue],
  ];

  List<Color> _gradient(int index) => _gradients[index % _gradients.length];

  String _roleLabel(String role) {
    if (role == 'owner') return '오너';
    if (role == 'admin') return '관리자';
    return '멤버';
  }

  Widget _buildClubAvatar(Map<String, dynamic> club, int index, double size) {
    final logoUrl = club['logoUrl'] as String?;
    final clubName = club['name'] as String? ?? '';

    if (logoUrl != null && logoUrl.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(size * 0.3),
        child: Image.network(
          '${ApiConfig.baseUrl}$logoUrl',
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _buildFallbackAvatar(clubName, index, size),
        ),
      );
    }
    return _buildFallbackAvatar(clubName, index, size);
  }

  Widget _buildFallbackAvatar(String clubName, int index, double size) {
    final gradient = _gradient(index);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: gradient,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(size * 0.3),
      ),
      child: Center(
        child: Text(
          clubName.isNotEmpty ? clubName[0].toUpperCase() : '?',
          style: TextStyle(
            fontSize: size * 0.42,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final clubs = auth.clubs;

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      body: SafeArea(
        child: Stack(
          children: [
            // 메인 콘텐츠
            CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(24, 40, 24, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          '내 클럽',
                          style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '활성 클럽을 선택하세요',
                          style: TextStyle(fontSize: 14, color: AppColors.textHint),
                        ),
                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final club = clubs[index];
                        final isActive = auth.activeClub?['id'] == club['id'];
                        final clubName = club['name'] as String? ?? '';
                        final role = club['myRole'] as String? ?? 'member';
                        final slug = club['slug'] as String? ?? '';
                        final player = club['player'] as Map?;
                        final playerName = player?['nickname'] ?? player?['name'];

                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: GestureDetector(
                            onTap: () {
                              auth.setActiveClub(Map<String, dynamic>.from(club));
                              Navigator.of(context).pop();
                            },
                            child: Container(
                              decoration: BoxDecoration(
                                color: isActive
                                    ? AppColors.primary.withAlpha(20)
                                    : AppColors.surfaceBorder,
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(
                                  color: isActive
                                      ? AppColors.primary.withAlpha(128)
                                      : AppColors.surfaceTint,
                                ),
                              ),
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Row(
                                  children: [
                                    _buildClubAvatar(club, index, 52),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Flexible(
                                                child: Text(
                                                  clubName,
                                                  style: const TextStyle(
                                                    fontSize: 16,
                                                    fontWeight: FontWeight.bold,
                                                    color: Colors.white,
                                                  ),
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ),
                                              if (isActive) ...[
                                                const SizedBox(width: 8),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                                  decoration: BoxDecoration(
                                                    color: AppColors.primary.withAlpha(30),
                                                    borderRadius: BorderRadius.circular(6),
                                                    border: Border.all(color: AppColors.primary.withAlpha(100)),
                                                  ),
                                                  child: const Text(
                                                    '현재',
                                                    style: TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w600),
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ),
                                          const SizedBox(height: 4),
                                          Row(
                                            children: [
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: AppColors.surfaceBorder,
                                                  borderRadius: BorderRadius.circular(6),
                                                ),
                                                child: Text(
                                                  _roleLabel(role),
                                                  style: TextStyle(
                                                    fontSize: 11,
                                                    color: AppColors.textSecondary,
                                                    fontWeight: FontWeight.w500,
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(width: 6),
                                              Text(
                                                slug,
                                                style: TextStyle(fontSize: 12, color: AppColors.iconInactive),
                                              ),
                                              if (playerName != null) ...[
                                                Text(
                                                  ' · $playerName',
                                                  style: TextStyle(fontSize: 12, color: AppColors.textHint),
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ],
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                    const Icon(Icons.chevron_right, color: Colors.white38, size: 20),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                      childCount: clubs.length,
                    ),
                  ),
                ),
                // 클럽 추가 버튼
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(24, 8, 24, 40),
                    child: Row(
                      children: [
                        Expanded(
                          child: _ActionButton(
                            icon: Icons.group_add_outlined,
                            label: '클럽 참여',
                            subtitle: '초대 코드로 가입',
                            onTap: () => setState(() => _showJoin = true),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _ActionButton(
                            icon: Icons.add_circle_outline,
                            label: '클럽 만들기',
                            subtitle: '새 클럽 생성',
                            gradient: const [AppColors.primary, AppColors.teal],
                            onTap: () => setState(() => _showCreate = true),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),

            // 로그아웃 버튼
            Positioned(
              bottom: 16,
              right: 24,
              child: TextButton(
                onPressed: () => context.read<AuthService>().logout(),
                child: Text(
                  '다른 계정으로 로그인',
                  style: TextStyle(color: AppColors.iconInactive, fontSize: 12),
                ),
              ),
            ),

            // 클럽 참여 모달
            if (_showJoin)
              _JoinModal(onClose: () => setState(() => _showJoin = false)),

            // 클럽 만들기 모달
            if (_showCreate)
              _CreateModal(onClose: () => setState(() => _showCreate = false)),
          ],
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final List<Color>? gradient;
  final VoidCallback onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.subtitle,
    this.gradient,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
        decoration: BoxDecoration(
          color: AppColors.surfaceBorder,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.surfaceTint),
        ),
        child: Column(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: gradient != null ? LinearGradient(colors: gradient!) : null,
                color: gradient == null ? AppColors.surfaceTint : null,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: Colors.white, size: 20),
            ),
            const SizedBox(height: 8),
            Text(label, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 2),
            Text(subtitle, style: TextStyle(color: AppColors.textHint, fontSize: 11)),
          ],
        ),
      ),
    );
  }
}

// ─── 클럽 참여 모달 ───

class _JoinModal extends StatefulWidget {
  final VoidCallback onClose;
  const _JoinModal({required this.onClose});

  @override
  State<_JoinModal> createState() => _JoinModalState();
}

class _JoinModalState extends State<_JoinModal> {
  final _ctrl = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _join() async {
    final code = _ctrl.text.trim().toUpperCase();
    if (code.isEmpty) { setState(() => _error = '초대 코드를 입력해주세요.'); return; }
    setState(() { _loading = true; _error = null; });
    try {
      final auth = context.read<AuthService>();
      await ApiService().joinClub(code, auth.token!);
      await auth.refreshClub();
      widget.onClose();
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _ModalOverlay(
      onClose: widget.onClose,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('클럽 참여', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
          const SizedBox(height: 16),
          TextField(
            controller: _ctrl,
            style: const TextStyle(color: Colors.white, fontSize: 18, letterSpacing: 4),
            textCapitalization: TextCapitalization.characters,
            textAlign: TextAlign.center,
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[A-Z0-9a-z]'))],
            onSubmitted: (_) => _join(),
            decoration: InputDecoration(
              hintText: 'CK2025',
              hintStyle: TextStyle(color: AppColors.iconInactive, letterSpacing: 4),
              filled: true,
              fillColor: AppColors.surfaceBorder,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.surfaceHighlight)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.surfaceHighlight)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary)),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
          ],
          const SizedBox(height: 16),
          _buildBtn(label: '참여하기', loading: _loading, onTap: _join),
        ],
      ),
    );
  }
}

// ─── 클럽 만들기 모달 ───

class _CreateModal extends StatefulWidget {
  final VoidCallback onClose;
  const _CreateModal({required this.onClose});

  @override
  State<_CreateModal> createState() => _CreateModalState();
}

class _CreateModalState extends State<_CreateModal> {
  final _nameCtrl = TextEditingController();
  final _slugCtrl = TextEditingController();
  bool _loading = false;
  String? _error;
  String? _slugStatus;

  Future<void> _checkSlug(String slug) async {
    if (slug.length < 2) { setState(() => _slugStatus = null); return; }
    setState(() => _slugStatus = 'checking');
    try {
      final res = await ApiService().checkSlug(slug);
      if (mounted) setState(() => _slugStatus = res['available'] == true ? 'available' : 'taken');
    } catch (_) {
      if (mounted) setState(() => _slugStatus = null);
    }
  }

  Future<void> _create() async {
    final name = _nameCtrl.text.trim();
    final slug = _slugCtrl.text.trim().toLowerCase();
    if (name.isEmpty || slug.isEmpty) { setState(() => _error = '클럽 이름과 ID를 입력해주세요.'); return; }
    if (_slugStatus != 'available') { setState(() => _error = '사용 가능한 클럽 ID를 입력해주세요.'); return; }
    setState(() { _loading = true; _error = null; });
    try {
      final auth = context.read<AuthService>();
      await ApiService().createClub(slug, name, auth.token!);
      await auth.refreshClub();
      widget.onClose();
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _slugCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _ModalOverlay(
      onClose: widget.onClose,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('클럽 만들기', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
          const SizedBox(height: 16),
          _field(controller: _nameCtrl, hint: '클럽 이름 (예: 코너킥스 FC)'),
          const SizedBox(height: 10),
          _field(
            controller: _slugCtrl,
            hint: '클럽 ID (예: cornerkicks)',
            suffixIcon: _slugStatus == 'available'
                ? const Icon(Icons.check_circle, color: AppColors.primary, size: 18)
                : _slugStatus == 'taken'
                    ? const Icon(Icons.cancel, color: Colors.red, size: 18)
                    : null,
            onChanged: (v) {
              final cleaned = v.toLowerCase().replaceAll(RegExp(r'[^a-z0-9\-_]'), '');
              if (cleaned != v) {
                _slugCtrl.value = TextEditingValue(text: cleaned, selection: TextSelection.collapsed(offset: cleaned.length));
              }
              _checkSlug(cleaned);
            },
          ),
          const SizedBox(height: 4),
          Text('영문 소문자, 숫자, -, _ 만 사용 가능', style: TextStyle(fontSize: 11, color: AppColors.iconInactive)),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
          ],
          const SizedBox(height: 16),
          _buildBtn(label: '클럽 만들기', loading: _loading, onTap: _create),
        ],
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String hint,
    Widget? suffixIcon,
    void Function(String)? onChanged,
  }) {
    return TextField(
      controller: controller,
      style: const TextStyle(color: Colors.white, fontSize: 14),
      onChanged: onChanged,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: AppColors.iconInactive, fontSize: 14),
        suffixIcon: suffixIcon,
        filled: true,
        fillColor: AppColors.surfaceBorder,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.surfaceHighlight)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.surfaceHighlight)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
    );
  }
}

Widget _buildBtn({required String label, required bool loading, required VoidCallback onTap}) {
  return GestureDetector(
    onTap: loading ? null : onTap,
    child: Container(
      width: double.infinity,
      height: 48,
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [AppColors.primary, AppColors.teal]),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Center(
        child: loading
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white)),
      ),
    ),
  );
}

// ─── 공통 모달 오버레이 ───

class _ModalOverlay extends StatelessWidget {
  final VoidCallback onClose;
  final Widget child;

  const _ModalOverlay({required this.onClose, required this.child});

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        GestureDetector(
          onTap: onClose,
          child: Container(color: Colors.black.withAlpha(160)),
        ),
        Align(
          alignment: Alignment.bottomCenter,
          child: Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
            decoration: BoxDecoration(
              color: AppColors.bgCard,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.surfaceTint),
            ),
            child: child,
          ),
        ),
      ],
    );
  }
}
