import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_colors.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import 'session_detail_screen.dart';
import 'announcements_screen.dart';
import 'admin_club_settings_screen.dart';
import 'admin_exemptions_screen.dart';
import 'player_detail_screen.dart';
import 'admin_players_screen.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  final ApiService _api = ApiService();
  bool _loading = true;
  bool _refreshingRankings = false;

  List<dynamic> _players = [];
  List<dynamic> _sessions = [];
  int _totalPlayers = 0;
  int _unlinkedPlayers = 0;
  int _recruitingSessions = 0;
  int _totalSessions = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final token = context.read<AuthService>().token;
    if (token == null) return;

    await Future.wait([
      _api.getPlayers(token: token).then((data) {
        final list = (data['players'] as List?) ?? [];
        _players = list;
        _totalPlayers = list.where((p) => p['is_guest'] != 1).length;
        _unlinkedPlayers = list.where((p) => p['is_guest'] != 1 && p['user_id'] == null).length;
      }).catchError((_) {}),
      _api.getSessions(token: token, limit: 20).then((data) {
        final list = (data['sessions'] as List?) ?? [];
        _sessions = list;
        _totalSessions = list.length;
        _recruitingSessions = list.where((s) => s['status'] == 'recruiting').length;
      }).catchError((_) {}),
    ]);

    if (mounted) setState(() => _loading = false);
  }

  Future<void> _showAddPlayerDialog() async {
    final nameCtrl = TextEditingController();
    final nicknameCtrl = TextEditingController();

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgCard,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('선수 등록', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: '이름 *',
                labelStyle: TextStyle(color: Colors.white.withAlpha(128)),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: Colors.white.withAlpha(30)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.primary),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: nicknameCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: '닉네임 (선택)',
                labelStyle: TextStyle(color: Colors.white.withAlpha(128)),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: Colors.white.withAlpha(30)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.primary),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('취소', style: TextStyle(color: Colors.white.withAlpha(128))),
          ),
          TextButton(
            onPressed: () {
              if (nameCtrl.text.trim().length >= 2) {
                Navigator.pop(ctx, true);
              } else {
                ScaffoldMessenger.of(ctx).showSnackBar(
                  const SnackBar(content: Text('이름은 2자 이상 입력하세요'), backgroundColor: AppColors.red, duration: Duration(seconds: 2)),
                );
              }
            },
            child: const Text('등록', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (result == true && mounted) {
      final token = context.read<AuthService>().token;
      if (token == null) return;

      try {
        final nickname = nicknameCtrl.text.trim().isEmpty ? null : nicknameCtrl.text.trim();
        final res = await _api.createPlayer(nameCtrl.text.trim(), nickname: nickname, token: token);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('${nameCtrl.text.trim()} 선수가 등록되었습니다'),
              backgroundColor: AppColors.primary,
              duration: const Duration(seconds: 2),
            ),
          );
          setState(() => _loading = true);
          await _load();
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('선수 등록 실패: $e'), backgroundColor: AppColors.red, duration: const Duration(seconds: 2)),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('관리자 대시보드', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.primary,
        onPressed: _showAddPlayerDialog,
        child: const Icon(Icons.person_add, color: Colors.white),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : RefreshIndicator(
              onRefresh: () async {
                setState(() => _loading = true);
                await _load();
              },
              color: AppColors.primary,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _buildStatCards(),
                  const SizedBox(height: 20),
                  _buildQuickActions(),
                  const SizedBox(height: 20),
                  if (_unlinkedPlayers > 0) ...[
                    _buildUnlinkedAlert(),
                    const SizedBox(height: 20),
                  ],
                  _buildRecentSessions(),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }

  Widget _buildStatCards() {
    final items = [
      {'icon': Icons.people, 'label': '총 선수', 'value': '$_totalPlayers', 'color': AppColors.blue},
      {'icon': Icons.sports_soccer, 'label': '총 세션', 'value': '$_totalSessions', 'color': AppColors.primary},
      {'icon': Icons.how_to_reg, 'label': '모집중', 'value': '$_recruitingSessions', 'color': AppColors.amber},
      {'icon': Icons.link_off, 'label': '미연동', 'value': '$_unlinkedPlayers', 'color': _unlinkedPlayers > 0 ? AppColors.red : AppColors.slate},
    ];

    return Row(
      children: items.map((item) {
        final color = item['color'] as Color;
        return Expanded(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 4),
            padding: const EdgeInsets.symmetric(vertical: 16),
            decoration: BoxDecoration(
              color: color.withAlpha(10),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: color.withAlpha(30)),
            ),
            child: Column(
              children: [
                Icon(item['icon'] as IconData, size: 22, color: color),
                const SizedBox(height: 8),
                Text(item['value'] as String, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
                const SizedBox(height: 2),
                Text(item['label'] as String, style: TextStyle(fontSize: 11, color: Colors.white.withAlpha(102))),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildQuickActions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.flash_on, size: 16, color: Colors.white.withAlpha(128)),
            const SizedBox(width: 6),
            Text('빠른 실행', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white.withAlpha(179))),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _actionCard(Icons.campaign, '공지 관리', AppColors.amber, () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const AnnouncementsScreen(isAdmin: true)));
            }),
            const SizedBox(width: 10),
            _actionCard(Icons.person_add, '선수 등록', AppColors.primary, _showAddPlayerDialog),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            _actionCard(Icons.settings, '클럽 설정', AppColors.blue, () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminClubSettingsScreen()));
            }),
            const SizedBox(width: 10),
            _actionCard(Icons.shield_outlined, '회비 면제', AppColors.violet, () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminExemptionsScreen()));
            }),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            _actionCard(
              Icons.refresh,
              '랭킹 갱신',
              AppColors.primary,
              _refreshingRankings ? null : () async {
                setState(() => _refreshingRankings = true);
                try {
                  final token = context.read<AuthService>().token!;
                  await _api.refreshRankings(DateTime.now().year, token);
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('랭킹이 갱신되었습니다'), backgroundColor: AppColors.primary, duration: Duration(seconds: 2)),
                    );
                  }
                } catch (_) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('랭킹 갱신 실패'), backgroundColor: AppColors.red, duration: Duration(seconds: 2)),
                    );
                  }
                } finally {
                  if (mounted) setState(() => _refreshingRankings = false);
                }
              },
            ),
            const SizedBox(width: 10),
            _actionCard(Icons.people_outline, '선수 관리', AppColors.blue, () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminPlayersScreen()));
            }),
          ],
        ),
      ],
    );
  }

  Widget _actionCard(IconData icon, String label, Color color, VoidCallback? onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 18),
          decoration: BoxDecoration(
            color: color.withAlpha(10),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: color.withAlpha(30)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(width: 8),
              Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: color)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildUnlinkedAlert() {
    final unlinked = _players.where((p) => p['is_guest'] != 1 && p['user_id'] == null).toList();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.amber.withAlpha(10),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.amber.withAlpha(40)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.warning_amber, size: 18, color: AppColors.amber),
              const SizedBox(width: 8),
              Text('미연동 선수 $_unlinkedPlayers명', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.amber)),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '아직 계정과 연동되지 않은 선수입니다. 선수에게 초대 코드를 공유하세요.',
            style: TextStyle(fontSize: 12, color: Colors.white.withAlpha(128)),
          ),
          const SizedBox(height: 10),
          ...unlinked.take(5).map((p) {
            final name = (p['name'] ?? '?').toString();
            return Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: GestureDetector(
                onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => PlayerDetailScreen(playerId: p['id']))),
                child: Row(
                  children: [
                    Container(
                      width: 28, height: 28,
                      decoration: BoxDecoration(
                        color: AppColors.amber.withAlpha(20),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Center(child: Text(name.isNotEmpty ? name[0] : '?', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.amber))),
                    ),
                    const SizedBox(width: 10),
                    Text(name, style: const TextStyle(fontSize: 13, color: Colors.white)),
                    const Spacer(),
                    Icon(Icons.chevron_right, size: 16, color: Colors.white.withAlpha(51)),
                  ],
                ),
              ),
            );
          }),
          if (unlinked.length > 5)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('외 ${unlinked.length - 5}명', style: TextStyle(fontSize: 11, color: Colors.white.withAlpha(77))),
            ),
        ],
      ),
    );
  }

  Widget _buildRecentSessions() {
    final recent = _sessions.take(5).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.history, size: 16, color: Colors.white.withAlpha(128)),
            const SizedBox(width: 6),
            Text('최근 세션', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white.withAlpha(179))),
          ],
        ),
        const SizedBox(height: 12),
        if (recent.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(5),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withAlpha(13)),
            ),
            child: Center(child: Text('세션이 없습니다', style: TextStyle(fontSize: 13, color: Colors.white.withAlpha(77)))),
          )
        else
          ...recent.map((s) {
            final title = s['title'] ?? '세션';
            final status = s['status'] ?? '';
            final date = s['date'] ?? '';
            final attendeeCount = s['attendee_count'] ?? s['attendeeCount'] ?? 0;

            Color statusColor;
            String statusLabel;
            switch (status) {
              case 'recruiting':
                statusColor = AppColors.primary;
                statusLabel = '모집중';
                break;
              case 'ended':
                statusColor = AppColors.amber;
                statusLabel = '종료';
                break;
              case 'completed':
                statusColor = AppColors.blue;
                statusLabel = '정산완료';
                break;
              case 'closed':
                statusColor = AppColors.slate;
                statusLabel = '마감';
                break;
              default:
                statusColor = AppColors.slate;
                statusLabel = status;
            }

            return GestureDetector(
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => SessionDetailScreen(sessionId: s['id']))),
              child: Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: Colors.white.withAlpha(5),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.white.withAlpha(13)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title.toString(), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
                          const SizedBox(height: 2),
                          Text(
                            '$date / ${attendeeCount}명',
                            style: TextStyle(fontSize: 11, color: Colors.white.withAlpha(77)),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withAlpha(20),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(statusLabel, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: statusColor)),
                    ),
                  ],
                ),
              ),
            );
          }),
      ],
    );
  }
}
