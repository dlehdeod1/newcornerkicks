import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_colors.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import 'player_detail_screen.dart';

class AdminPlayersScreen extends StatefulWidget {
  const AdminPlayersScreen({super.key});

  @override
  State<AdminPlayersScreen> createState() => _AdminPlayersScreenState();
}

enum _Filter { all, pending, linked, unlinked, guest }

class _AdminPlayersScreenState extends State<AdminPlayersScreen> {
  final ApiService _api = ApiService();
  final TextEditingController _searchCtrl = TextEditingController();

  bool _loading = true;
  List<dynamic> _allPlayers = [];
  _Filter _filter = _Filter.all;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final token = context.read<AuthService>().token;
    if (token == null) return;
    try {
      final data = await _api.request('/players?all=1', token: token);
      _allPlayers = (data['players'] as List?) ?? [];
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  List<dynamic> get _filtered {
    var list = _allPlayers;

    // filter
    switch (_filter) {
      case _Filter.pending:
        list = list.where((p) => p['link_status'] == 'PENDING').toList();
        break;
      case _Filter.linked:
        list = list.where((p) => p['user_id'] != null && p['is_guest'] != 1).toList();
        break;
      case _Filter.unlinked:
        list = list.where((p) => p['user_id'] == null && p['is_guest'] != 1).toList();
        break;
      case _Filter.guest:
        list = list.where((p) => p['is_guest'] == 1).toList();
        break;
      case _Filter.all:
        break;
    }

    // search
    final q = _searchCtrl.text.trim().toLowerCase();
    if (q.isNotEmpty) {
      list = list.where((p) {
        final name = (p['name'] ?? '').toString().toLowerCase();
        final nick = (p['nickname'] ?? '').toString().toLowerCase();
        final email = (p['user_email'] ?? '').toString().toLowerCase();
        return name.contains(q) || nick.contains(q) || email.contains(q);
      }).toList();
    }

    return list;
  }

  String _token() => context.read<AuthService>().token!;

  Future<void> _approveLink(dynamic player) async {
    try {
      await _api.approvePlayerLink(player['id'], _token());
      _snack('${player['name']} 연동 승인됨');
      setState(() => _loading = true);
      await _load();
    } catch (e) {
      _snack('실패: $e', error: true);
    }
  }

  Future<void> _resetPassword(dynamic player) async {
    final confirm = await _confirm('${player['name']}의 비밀번호를 초기화할까요?');
    if (!confirm) return;
    try {
      final res = await _api.resetPlayerPassword(player['id'], _token());
      final temp = res['tempPassword'] ?? '';
      if (mounted) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: AppColors.bgCard,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Text('임시 비밀번호', style: TextStyle(color: Colors.white, fontSize: 16)),
            content: SelectableText(temp, style: const TextStyle(color: AppColors.primary, fontSize: 18, fontWeight: FontWeight.bold)),
            actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('확인', style: TextStyle(color: AppColors.primary)))],
          ),
        );
      }
    } catch (e) {
      _snack('실패: $e', error: true);
    }
  }

  Future<void> _deletePlayerAction(dynamic player) async {
    final confirm = await _confirm('${player['name']} 선수를 삭제할까요?\n관련 기록이 모두 삭제됩니다.');
    if (!confirm) return;
    try {
      await _api.deletePlayer(player['id'], _token());
      _snack('${player['name']} 삭제됨');
      setState(() => _loading = true);
      await _load();
    } catch (e) {
      _snack('실패: $e', error: true);
    }
  }

  Future<void> _unlinkPlayer(dynamic player) async {
    final confirm = await _confirm('${player['name']}의 계정 연동을 해제할까요?');
    if (!confirm) return;
    try {
      await _api.relinkPlayer(player['id'], null, _token());
      _snack('연동 해제됨');
      setState(() => _loading = true);
      await _load();
    } catch (e) {
      _snack('실패: $e', error: true);
    }
  }

  Future<bool> _confirm(String message) async {
    return await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgCard,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        content: Text(message, style: const TextStyle(color: Colors.white, fontSize: 14)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('취소', style: TextStyle(color: AppColors.textHint))),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('확인', style: TextStyle(color: AppColors.red, fontWeight: FontWeight.bold))),
        ],
      ),
    ) ?? false;
  }

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: error ? AppColors.red : AppColors.primary, duration: const Duration(seconds: 2)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final pendingCount = _allPlayers.where((p) => p['link_status'] == 'PENDING').length;

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text('선수 관리 (${_allPlayers.length})', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : Column(
              children: [
                // Search
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: TextField(
                    controller: _searchCtrl,
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                    decoration: InputDecoration(
                      hintText: '이름, 닉네임, 이메일 검색',
                      hintStyle: TextStyle(color: AppColors.iconInactive),
                      prefixIcon: Icon(Icons.search, color: AppColors.iconInactive, size: 20),
                      filled: true,
                      fillColor: AppColors.bgCard,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
                // Filter chips
                SizedBox(
                  height: 40,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    children: [
                      _chip('전체', _Filter.all),
                      if (pendingCount > 0) _chip('대기 ($pendingCount)', _Filter.pending),
                      _chip('연동', _Filter.linked),
                      _chip('미연동', _Filter.unlinked),
                      _chip('용병', _Filter.guest),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                // List
                Expanded(
                  child: filtered.isEmpty
                      ? Center(child: Text('선수가 없습니다', style: TextStyle(color: AppColors.iconInactive)))
                      : RefreshIndicator(
                          color: AppColors.primary,
                          onRefresh: () async {
                            setState(() => _loading = true);
                            await _load();
                          },
                          child: ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            itemCount: filtered.length,
                            itemBuilder: (_, i) => _playerTile(filtered[i]),
                          ),
                        ),
                ),
              ],
            ),
    );
  }

  Widget _chip(String label, _Filter f) {
    final selected = _filter == f;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label, style: TextStyle(fontSize: 12, color: selected ? Colors.white : AppColors.textSecondary)),
        selected: selected,
        onSelected: (_) => setState(() => _filter = f),
        backgroundColor: AppColors.bgCard,
        selectedColor: AppColors.primary.withAlpha(40),
        checkmarkColor: AppColors.primary,
        side: BorderSide(color: selected ? AppColors.primary.withAlpha(100) : AppColors.surfaceTint),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        padding: const EdgeInsets.symmetric(horizontal: 4),
      ),
    );
  }

  Widget _playerTile(dynamic p) {
    final name = p['name'] ?? '?';
    final nickname = p['nickname'];
    final email = (p['user_email'] ?? '').toString();
    final isGuest = p['is_guest'] == 1;
    final userId = p['user_id'];
    final linkStatus = (p['link_status'] ?? '').toString();
    final isPending = linkStatus == 'PENDING';
    final ratingCount = p['rating_count'] ?? 0;
    final goals = p['total_goals'] ?? 0;
    final attendance = p['total_attendance'] ?? 0;

    Color statusColor;
    String statusText;
    if (isGuest) {
      statusColor = AppColors.amber;
      statusText = '용병';
    } else if (isPending) {
      statusColor = AppColors.orange;
      statusText = '대기';
    } else if (userId != null) {
      statusColor = AppColors.primary;
      statusText = '연동';
    } else {
      statusColor = AppColors.slate;
      statusText = '미연동';
    }

    return GestureDetector(
      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => PlayerDetailScreen(playerId: p['id']))),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.bgCard,
          borderRadius: BorderRadius.circular(14),
          border: isPending ? Border.all(color: AppColors.orange.withAlpha(60)) : null,
        ),
        child: Row(
          children: [
            // Avatar
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(
                color: statusColor.withAlpha(20),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  name.toString().isNotEmpty ? name.toString()[0] : '?',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: statusColor),
                ),
              ),
            ),
            const SizedBox(width: 12),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(name.toString(), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
                      if (nickname != null && nickname.toString().isNotEmpty) ...[
                        const SizedBox(width: 6),
                        Text('($nickname)', style: TextStyle(fontSize: 12, color: AppColors.textHint)),
                      ],
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: statusColor.withAlpha(20), borderRadius: BorderRadius.circular(6)),
                        child: Text(statusText, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: statusColor)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      if (email.isNotEmpty) ...[
                        Icon(Icons.email, size: 11, color: AppColors.iconInactive),
                        const SizedBox(width: 3),
                        Flexible(child: Text(email, style: TextStyle(fontSize: 11, color: AppColors.iconInactive), overflow: TextOverflow.ellipsis)),
                        const SizedBox(width: 8),
                      ],
                      Text('${attendance}경기  ${goals}골  평가${ratingCount}건', style: TextStyle(fontSize: 11, color: AppColors.iconInactive)),
                    ],
                  ),
                ],
              ),
            ),
            // Actions popup
            PopupMenuButton<String>(
              icon: Icon(Icons.more_vert, size: 18, color: AppColors.textHint),
              color: AppColors.bgCard,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              onSelected: (action) {
                switch (action) {
                  case 'approve': _approveLink(p); break;
                  case 'reset': _resetPassword(p); break;
                  case 'unlink': _unlinkPlayer(p); break;
                  case 'delete': _deletePlayerAction(p); break;
                }
              },
              itemBuilder: (_) => [
                if (isPending)
                  const PopupMenuItem(value: 'approve', child: Row(
                    children: [Icon(Icons.check_circle, size: 16, color: AppColors.primary), SizedBox(width: 8), Text('연동 승인', style: TextStyle(color: Colors.white, fontSize: 13))],
                  )),
                if (userId != null) ...[
                  const PopupMenuItem(value: 'reset', child: Row(
                    children: [Icon(Icons.lock_reset, size: 16, color: AppColors.amber), SizedBox(width: 8), Text('비밀번호 초기화', style: TextStyle(color: Colors.white, fontSize: 13))],
                  )),
                  const PopupMenuItem(value: 'unlink', child: Row(
                    children: [Icon(Icons.link_off, size: 16, color: AppColors.orange), SizedBox(width: 8), Text('연동 해제', style: TextStyle(color: Colors.white, fontSize: 13))],
                  )),
                ],
                const PopupMenuItem(value: 'delete', child: Row(
                  children: [Icon(Icons.delete_outline, size: 16, color: AppColors.red), SizedBox(width: 8), Text('삭제', style: TextStyle(color: AppColors.red, fontSize: 13))],
                )),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
