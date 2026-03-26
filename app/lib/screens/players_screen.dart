import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import 'package:provider/provider.dart';
import 'player_detail_screen.dart';
import '../widgets/skeleton.dart';
import '../widgets/empty_state.dart';
import '../utils/snackbar_helper.dart';

class PlayersScreen extends StatefulWidget {
  const PlayersScreen({super.key});
  @override
  State<PlayersScreen> createState() => _PlayersScreenState();
}

class _PlayersScreenState extends State<PlayersScreen> {
  List<dynamic> _players = [];
  bool _loading = true;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final auth = context.read<AuthService>();
      final data = await ApiService().getPlayers(token: auth.token);
      setState(() {
        _players = (data['players'] as List?)?.where((p) => p['is_guest'] != 1).toList() ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _showAddPlayerDialog() async {
    final auth = context.read<AuthService>();
    if (auth.token == null) return;
    final nameCtrl = TextEditingController();
    final nicknameCtrl = TextEditingController();
    bool saving = false;

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          backgroundColor: AppColors.bgCard,
          title: const Text('선수 추가', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _dialogField(nameCtrl, '이름 (2자 이상)', autofocus: true),
              const SizedBox(height: 10),
              _dialogField(nicknameCtrl, '닉네임 (선택)'),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text('취소', style: TextStyle(color: AppColors.textHint)),
            ),
            ElevatedButton(
              onPressed: saving ? null : () async {
                if (nameCtrl.text.trim().length < 2) return;
                setS(() => saving = true);
                try {
                  await ApiService().request(
                    '/players',
                    method: 'POST',
                    body: {
                      'name': nameCtrl.text.trim(),
                      if (nicknameCtrl.text.trim().isNotEmpty) 'nickname': nicknameCtrl.text.trim(),
                    },
                    token: auth.token,
                  );
                  if (ctx.mounted) Navigator.pop(ctx);
                  _load();
                } catch (e) {
                  setS(() => saving = false);
                  if (ctx.mounted) showError(context, e.toString());
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.bgBase,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: saving
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('추가', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }

  TextField _dialogField(TextEditingController ctrl, String hint, {bool autofocus = false}) =>
      TextField(
        controller: ctrl,
        autofocus: autofocus,
        style: const TextStyle(color: Colors.white),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(color: AppColors.iconInactive, fontSize: 13),
          filled: true,
          fillColor: AppColors.surfaceTint,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final filtered = _players.where((p) =>
        (p['name'] ?? '').toString().toLowerCase().contains(_search.toLowerCase())).toList();

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      floatingActionButton: auth.isAdmin
          ? FloatingActionButton(
              onPressed: _showAddPlayerDialog,
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.bgBase,
              child: const Icon(Icons.person_add_outlined),
            )
          : null,
      appBar: AppBar(
        backgroundColor: AppColors.bgBase,
        title: const Text('선수 목록', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Column(
        children: [
          // 검색
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: TextField(
              onChanged: (v) => setState(() => _search = v),
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: '선수 검색...',
                hintStyle: const TextStyle(color: Colors.white38),
                prefixIcon: const Icon(Icons.search, color: Colors.white38),
                filled: true,
                fillColor: AppColors.bgCard,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
          Expanded(
            child: _loading
                ? ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    children: List.generate(8, (_) => Padding(
                      padding: const EdgeInsets.only(bottom: AppTheme.space8),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.bgCard,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppColors.surfaceTint),
                        ),
                        child: Row(
                          children: [
                            SkeletonBox(width: 44, height: 44, borderRadius: 22),
                            const SizedBox(width: AppTheme.space12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  SkeletonBox(height: 14, width: 80),
                                  const SizedBox(height: AppTheme.space4),
                                  SkeletonBox(height: 12, width: 120),
                                ],
                              ),
                            ),
                            SkeletonBox(width: 40, height: 12),
                          ],
                        ),
                      ),
                    )),
                  )
                : RefreshIndicator(
                    onRefresh: _load,
                    color: AppColors.primary,
                    child: filtered.isEmpty
                      ? ListView(
                          children: [
                            SizedBox(
                              height: MediaQuery.of(context).size.height * 0.5,
                              child: EmptyState(
                                icon: Icons.people_outline,
                                title: '등록된 선수가 없습니다',
                                subtitle: '선수를 추가해서 기록을 관리하세요',
                                actionLabel: context.read<AuthService>().isAdmin ? '선수 추가' : null,
                                onAction: context.read<AuthService>().isAdmin ? _showAddPlayerDialog : null,
                              ),
                            ),
                          ],
                        )
                      : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: filtered.length,
                      itemBuilder: (ctx, i) {
                        final p = filtered[i];
                        final goals = p['total_goals'] ?? 0;
                        final assists = p['total_assists'] ?? 0;
                        return GestureDetector(
                          onTap: () => Navigator.push(context, MaterialPageRoute(
                            builder: (_) => PlayerDetailScreen(playerId: p['id']),
                          )),
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: AppColors.bgCard,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: AppColors.surfaceTint),
                            ),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  radius: 22,
                                  backgroundColor: AppColors.bgBorder,
                                  child: Text(
                                    (p['name'] ?? '?')[0],
                                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(p['name'] ?? '', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15)),
                                      const SizedBox(height: 4),
                                      Row(
                                        children: [
                                          _miniTag('⚽ $goals', AppColors.primary),
                                          const SizedBox(width: 8),
                                          _miniTag('⚡ $assists', AppColors.blueLight),
                                          const SizedBox(width: 8),
                                          _miniTag('${p['rating_count'] ?? 0}명 평가', Colors.white38),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                                const Icon(Icons.chevron_right, color: Colors.white24),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _miniTag(String text, Color color) => Text(text, style: TextStyle(color: color, fontSize: 12));
}
