import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import 'session_detail_screen.dart';
import '../widgets/tip_banner.dart';

class SessionsScreen extends StatefulWidget {
  const SessionsScreen({super.key});

  @override
  State<SessionsScreen> createState() => _SessionsScreenState();
}

class _SessionsScreenState extends State<SessionsScreen> {
  final ApiService _api = ApiService();
  List<dynamic> _sessions = [];
  bool _loading = true;
  // 낙관적 업데이트: sessionId → rsvp status
  final Map<int, String?> _rsvpUpdating = {};

  @override
  void initState() {
    super.initState();
    _loadSessions();
  }

  Future<void> _loadSessions() async {
    final token = context.read<AuthService>().token;
    try {
      final res = await _api.getSessions(token: token);
      if (mounted) {
        setState(() {
          _sessions = (res['sessions'] as List?) ?? [];
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleRsvp(dynamic session) async {
    final auth = context.read<AuthService>();
    if (auth.token == null || auth.player == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('선수 연동 후 참석 투표가 가능합니다'), backgroundColor: AppColors.blue),
      );
      return;
    }
    final sid = session['id'] as int;
    final currentStatus = session['my_rsvp'] as String?;
    final newStatus = currentStatus == 'going' ? 'not_going' : 'going';

    // 낙관적 업데이트
    setState(() {
      final idx = _sessions.indexWhere((s) => s['id'] == sid);
      if (idx >= 0) {
        final updated = Map<String, dynamic>.from(_sessions[idx]);
        final prevCount = (updated['rsvp_count'] ?? 0) as int;
        if (currentStatus == 'going') {
          updated['rsvp_count'] = prevCount - 1;
          updated['my_rsvp'] = null;
        } else {
          updated['rsvp_count'] = prevCount + 1;
          updated['my_rsvp'] = 'going';
        }
        _sessions[idx] = updated;
      }
      _rsvpUpdating[sid] = newStatus;
    });

    try {
      await _api.rsvpSession(sid, newStatus, auth.token!);
    } catch (_) {
      // 실패 시 롤백
      await _loadSessions();
    } finally {
      if (mounted) setState(() => _rsvpUpdating.remove(sid));
    }
  }

  String _dayOfWeek(String dateStr) {
    try {
      final d = DateTime.parse(dateStr);
      return ['일', '월', '화', '수', '목', '금', '토'][d.weekday % 7];
    } catch (_) {
      return '';
    }
  }

  String _formatDate(String dateStr) {
    try {
      final d = DateTime.parse(dateStr);
      return '${d.month}월 ${d.day}일 (${_dayOfWeek(dateStr)})';
    } catch (_) {
      return dateStr;
    }
  }

  Color _statusColor(String? status) {
    switch (status) {
      case 'recruiting':
      case 'open': return AppColors.primary;
      case 'closed': return AppColors.blue;
      case 'ended': return AppColors.orange;
      case 'completed': return AppColors.slate;
      default: return Colors.white38;
    }
  }

  String _statusLabel(String? status) {
    switch (status) {
      case 'recruiting':
      case 'open': return '모집중';
      case 'closed': return '마감';
      case 'ended': return '경기완료';
      case 'completed': return '정산완료';
      default: return status ?? '';
    }
  }

  Future<void> _showCreateSessionSheet() async {
    final auth = context.read<AuthService>();
    if (auth.token == null) return;
    DateTime? picked = DateTime.now().add(const Duration(days: 7));
    final titleCtrl = TextEditingController();
    bool saving = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.bgCard,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => Padding(
          padding: EdgeInsets.only(
            left: 20, right: 20, top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Text('세션 만들기', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold)),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white54),
                    onPressed: () => Navigator.pop(ctx),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              // 날짜 선택
              GestureDetector(
                onTap: () async {
                  final d = await showDatePicker(
                    context: ctx,
                    initialDate: picked ?? DateTime.now(),
                    firstDate: DateTime.now().subtract(const Duration(days: 30)),
                    lastDate: DateTime.now().add(const Duration(days: 180)),
                    builder: (c, child) => Theme(
                      data: ThemeData.dark().copyWith(colorScheme: const ColorScheme.dark(primary: AppColors.primary)),
                      child: child!,
                    ),
                  );
                  if (d != null) setS(() => picked = d);
                },
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceBorder,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.surfaceHighlight),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.calendar_today, size: 16, color: AppColors.primary),
                      const SizedBox(width: 10),
                      Text(
                        picked != null
                            ? '${picked!.year}.${picked!.month.toString().padLeft(2, '0')}.${picked!.day.toString().padLeft(2, '0')}'
                            : '날짜 선택',
                        style: const TextStyle(color: Colors.white, fontSize: 14),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: titleCtrl,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  hintText: '세션 제목 (선택)',
                  hintStyle: TextStyle(color: AppColors.iconInactive, fontSize: 13),
                  filled: true,
                  fillColor: AppColors.surfaceBorder,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: saving || picked == null
                      ? null
                      : () async {
                          setS(() => saving = true);
                          try {
                            final dateStr =
                                '${picked!.year}-${picked!.month.toString().padLeft(2, '0')}-${picked!.day.toString().padLeft(2, '0')}';
                            await _api.request(
                              '/sessions',
                              method: 'POST',
                              body: {
                                'sessionDate': dateStr,
                                if (titleCtrl.text.trim().isNotEmpty) 'title': titleCtrl.text.trim(),
                              },
                              token: auth.token,
                            );
                            if (ctx.mounted) Navigator.pop(ctx);
                            await _loadSessions();
                          } catch (e) {
                            if (ctx.mounted) {
                              setS(() => saving = false);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(e.toString()), backgroundColor: AppColors.red),
                              );
                            }
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.bgBase,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: saving
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('세션 생성', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: auth.isAdmin
          ? FloatingActionButton(
              onPressed: _showCreateSessionSheet,
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.bgBase,
              child: const Icon(Icons.add),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () async {
          setState(() => _loading = true);
          await _loadSessions();
        },
        color: AppColors.primary,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
            : _sessions.isEmpty
                ? _buildEmpty()
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
                    itemCount: _sessions.length + 1,
                    itemBuilder: (ctx, i) {
                      if (i == 0) {
                        return const TipBanner(
                          tipId: 'sessions_intro',
                          text: '세션을 눌러서 경기 기록, 팀 편성, 정산을 확인하세요!',
                          icon: Icons.touch_app,
                          color: AppColors.blue,
                        );
                      }
                      return _buildSessionCard(_sessions[i - 1]);
                    },
                  ),
      ),
    );
  }

  Widget _buildEmpty() {
    return ListView(
      children: [
        SizedBox(
          height: MediaQuery.of(context).size.height * 0.6,
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 72, height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceBorder,
                    borderRadius: BorderRadius.circular(22),
                  ),
                  child: const Center(child: Text('📅', style: TextStyle(fontSize: 32))),
                ),
                const SizedBox(height: 16),
                const Text('세션이 없습니다', style: TextStyle(color: Colors.white54, fontSize: 16)),
                const SizedBox(height: 8),
                Text('아직 등록된 세션이 없어요', style: TextStyle(color: AppColors.iconInactive, fontSize: 13)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSessionCard(dynamic session) {
    final status = session['status'] as String?;
    final statusColor = _statusColor(status);
    final dateStr = session['session_date'] as String? ?? '';
    final title = session['title'] as String? ?? '정기 풋살';
    final rsvpCount = (session['rsvp_count'] ?? 0) as int;
    final myRsvp = session['my_rsvp'] as String?;
    final isRecruiting = status == 'recruiting';
    final isGoing = myRsvp == 'going';
    final sid = session['id'] as int;
    final isUpdating = _rsvpUpdating.containsKey(sid);

    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => SessionDetailScreen(sessionId: session['id'])),
      ).then((_) => _loadSessions()),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surfaceBorder,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isGoing ? AppColors.primary.withAlpha(51) : AppColors.surfaceTint),
        ),
        child: Column(
          children: [
            Row(
              children: [
                // 날짜 블록
                Container(
                  width: 52, height: 52,
                  decoration: BoxDecoration(
                    color: statusColor.withAlpha(20),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: statusColor.withAlpha(51)),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        dateStr.length >= 10 ? dateStr.substring(5, 7) : '-',
                        style: TextStyle(fontSize: 11, color: statusColor.withAlpha(204), fontWeight: FontWeight.w600),
                      ),
                      Text(
                        dateStr.length >= 10 ? dateStr.substring(8, 10) : '-',
                        style: TextStyle(fontSize: 18, color: statusColor, fontWeight: FontWeight.bold, height: 1.1),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: statusColor.withAlpha(20),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(_statusLabel(status), style: TextStyle(fontSize: 10, color: statusColor, fontWeight: FontWeight.w600)),
                          ),
                          const SizedBox(width: 8),
                          Text(_formatDate(dateStr), style: TextStyle(fontSize: 12, color: AppColors.iconInactive)),
                        ],
                      ),
                    ],
                  ),
                ),
                // 상태 배지 + 화살표
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Icon(Icons.chevron_right, color: AppColors.iconInactive, size: 18),
                    if (rsvpCount > 0) ...[
                      const SizedBox(height: 4),
                      Text('$rsvpCount명', style: TextStyle(fontSize: 11, color: AppColors.textHint)),
                    ],
                  ],
                ),
              ],
            ),
            // RSVP 버튼 (모집중인 세션만)
            if (isRecruiting) ...[
              const SizedBox(height: 12),
              GestureDetector(
                onTap: isUpdating ? null : () => _toggleRsvp(session),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: isGoing
                        ? AppColors.primary.withAlpha(26)
                        : AppColors.surfaceBorder,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isGoing ? AppColors.primary.withAlpha(77) : AppColors.surfaceTint,
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (isUpdating)
                        const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 1.5, color: AppColors.primary))
                      else
                        Text(
                          isGoing ? '✓' : '+',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: isGoing ? AppColors.primary : AppColors.textSecondary,
                          ),
                        ),
                      const SizedBox(width: 6),
                      Text(
                        isGoing ? '참석 예정 ($rsvpCount명)' : '참석하기',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: isGoing ? FontWeight.w600 : FontWeight.normal,
                          color: isGoing ? AppColors.primary : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
