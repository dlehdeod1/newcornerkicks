import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import 'package:provider/provider.dart';
import '../widgets/skeleton.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import 'main_shell.dart';
import '../widgets/tip_banner.dart';
import 'session_detail_screen.dart';
import 'players_screen.dart';
import 'hall_of_fame_screen.dart';
import 'settlements_screen.dart';
import 'match_result_popup.dart';
import 'announcements_screen.dart';
import 'announcement_detail_screen.dart';
import 'community_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ApiService _api = ApiService();
  Map<String, dynamic>? _myStats;
  Map<String, dynamic>? _recentSession;
  Map<String, dynamic>? _seasonSummary;
  List<dynamic> _announcements = [];
  int _unreadCount = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final auth = context.read<AuthService>();
    final token = auth.token;

    try {
      if (token != null && auth.player != null) {
        try {
          final stats = await _api.getMyStats(token);
          _myStats = stats['stats'];
        } catch (_) {}
      }

      try {
        final summary = await _api.getSeasonSummary(token!);
        _seasonSummary = summary;
      } catch (_) {}

      try {
        final closedRes = await _api.getSessions(status: 'closed', limit: 1, token: token);
        final completedRes = await _api.getSessions(status: 'completed', limit: 1, token: token);
        final closed = (closedRes['sessions'] as List?)?.isNotEmpty == true ? closedRes['sessions'][0] : null;
        final completed = (completedRes['sessions'] as List?)?.isNotEmpty == true ? completedRes['sessions'][0] : null;

        if (closed != null && completed != null) {
          _recentSession = (closed['session_date'] ?? '').compareTo(completed['session_date'] ?? '') >= 0 ? closed : completed;
        } else {
          _recentSession = closed ?? completed;
        }
      } catch (_) {}

      // Load announcements
      try {
        final annRes = await _api.getAnnouncements(token!, limit: 3);
        _announcements = (annRes['data'] as List?) ?? [];
        // Sort pinned first
        _announcements.sort((a, b) {
          final aPin = a['is_pinned'] == 1 || a['is_pinned'] == true ? 1 : 0;
          final bPin = b['is_pinned'] == 1 || b['is_pinned'] == true ? 1 : 0;
          if (aPin != bPin) return bPin - aPin;
          return ((b['created_at'] ?? 0) as int).compareTo((a['created_at'] ?? 0) as int);
        });
      } catch (_) {}

      try {
        final ucRes = await _api.getAnnouncementUnreadCount(token!);
        _unreadCount = (ucRes['data']?['count'] ?? ucRes['count'] ?? 0) as int;
      } catch (_) {}
    } finally {
      if (mounted) {
        setState(() => _loading = false);
        _checkAndShowResultPopup();
      }
    }
  }

  Future<void> _checkAndShowResultPopup() async {
    if (_recentSession == null) return;
    final status = _recentSession!['status'] as String?;
    if (status != 'ended' && status != 'completed') return;

    final sessionId = _recentSession!['id'];
    if (sessionId == null) return;

    final prefs = await SharedPreferences.getInstance();
    final key = 'result_popup_seen_$sessionId';
    if (prefs.getBool(key) == true) return;

    // Load full session details to get teams/matches
    try {
      final res = await _api.getSession(sessionId as int);
      final matches = (res['matches'] as List?) ?? [];
      if (matches.isEmpty) return;
      final allDone = matches.every((m) => m['status'] == 'completed');
      if (!allDone) return;

      if (mounted) {
        await Future.delayed(const Duration(milliseconds: 600));
        if (mounted) {
          await MatchResultPopup.show(
            context,
            session: res['session'] as Map<String, dynamic>,
            teams: (res['teams'] as List?) ?? [],
            matches: matches,
            sessionId: sessionId,
          );
        }
      }
    } catch (_) {}
  }

  String _formatAnnouncementDate(dynamic ts) {
    if (ts == null) return '';
    final dt = DateTime.fromMillisecondsSinceEpoch((ts as int) * 1000);
    return '${dt.month}/${dt.day} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final player = auth.player;
    final club = auth.club;

    return RefreshIndicator(
      onRefresh: () async {
        setState(() => _loading = true);
        await _loadData();
      },
      color: AppColors.primary,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const TipBanner(
              tipId: 'home_intro',
              text: '클럽 탭에서 멤버 능력치 평가, 초대 코드 공유 등을 할 수 있어요!',
              icon: Icons.sports_soccer,
            ),
            // 클럽 헤더
            Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.primary, AppColors.teal],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withAlpha(51),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: const Center(child: Text('⚽', style: TextStyle(fontSize: 24))),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        player != null ? '안녕하세요, ${player['name']}님!' : (auth.user?['username'] ?? '코너킥스'),
                        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        club?['name'] ?? '클럽',
                        style: TextStyle(fontSize: 13, color: AppColors.primary.withAlpha(204)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // 공지사항 섹션
            if (_announcements.isNotEmpty) ...[
              Row(
                children: [
                  Text(
                    '공지사항',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textSecondary, letterSpacing: 0.5),
                  ),
                  if (_unreadCount > 0) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.red.withAlpha(26),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text('$_unreadCount', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.red)),
                    ),
                  ],
                  const Spacer(),
                  GestureDetector(
                    onTap: () async {
                      await Navigator.push(context, MaterialPageRoute(builder: (_) => const AnnouncementsScreen()));
                      setState(() => _loading = true);
                      _loadData();
                    },
                    child: Row(
                      children: [
                        Text('전체 보기', style: TextStyle(fontSize: 12, color: AppColors.textHint)),
                        const SizedBox(width: 2),
                        Icon(Icons.chevron_right, size: 16, color: AppColors.textHint),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ...(_announcements.take(2).map((a) => _buildAnnouncementCard(a))),
              const SizedBox(height: 24),
            ],

            // 내 최근 기록 카드
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.surfaceTint, AppColors.surfaceBorder],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.surfaceTint),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.bar_chart_rounded, color: AppColors.textSecondary, size: 18),
                      const SizedBox(width: 8),
                      Text(
                        _myStats?['sessionDate'] != null
                            ? () {
                                final d = DateTime.tryParse(_myStats!['sessionDate'] as String);
                                return d != null ? '최근 세션 (${d.month}/${d.day})' : '최근 세션 기록';
                              }()
                            : '최근 세션 기록',
                        style: TextStyle(fontSize: 13, color: AppColors.textSecondary, fontWeight: FontWeight.w500),
                      ),
                      const Spacer(),
                      if (auth.player == null)
                        Text('선수 미연동', style: TextStyle(fontSize: 11, color: AppColors.iconInactive)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (_loading)
                    Row(
                      children: [
                        Expanded(child: SkeletonBox(height: 36)),
                        const SizedBox(width: AppTheme.space8),
                        Expanded(child: SkeletonBox(height: 36)),
                        const SizedBox(width: AppTheme.space8),
                        Expanded(child: SkeletonBox(height: 36)),
                        const SizedBox(width: AppTheme.space8),
                        Expanded(child: SkeletonBox(height: 36)),
                      ],
                    )
                  else if (_myStats != null)
                    Builder(builder: (context) {
                      final events = context.read<AuthService>().enabledEvents;
                      final hasDefense = events.contains('DEFENSE') || events.contains('TACKLE') || events.contains('INTERCEPTION') || events.contains('CLEARANCE');
                      return Row(
                        children: [
                          _StatMini(label: '득점', value: '${_myStats!['goals'] ?? 0}', icon: '⚽', color: AppColors.primary),
                          _StatMini(label: '도움', value: '${_myStats!['assists'] ?? 0}', icon: '⚡', color: AppColors.blue),
                          if (hasDefense)
                            _StatMini(label: '수비', value: '${_myStats!['defenses'] ?? 0}', icon: '🛡️', color: AppColors.purple),
                          _StatMini(
                            label: '평점',
                            value: _myStats!['mvpScore'] != null
                                ? () {
                                    final v = (_myStats!['mvpScore'] as num).toDouble();
                                    return '${v == v.truncate() ? v.toInt() : v.toStringAsFixed(1)}';
                                  }()
                                : '-',
                            icon: '⭐',
                            color: AppColors.amber,
                          ),
                        ],
                      );
                    })
                  else
                    Text(
                      auth.player != null ? '기록이 없습니다' : '선수 연동 후 기록이 표시됩니다',
                      style: TextStyle(color: AppColors.textHint, fontSize: 14),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // 빠른 메뉴
            Text(
              '빠른 메뉴',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textSecondary, letterSpacing: 0.5),
            ),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 1.65,
              children: [
                _QuickMenu(
                  icon: Icons.calendar_today_rounded,
                  title: '경기 세션',
                  subtitle: '지난 매치 결과 확인',
                  color: AppColors.primary,
                  onTap: () => MainShell.switchTab(context, 1),
                ),
                _QuickMenu(
                  icon: Icons.emoji_events_rounded,
                  title: '랭킹',
                  subtitle: '시즌 순위 보기',
                  color: AppColors.amber,
                  onTap: () => MainShell.switchTab(context, 2),
                ),
                _QuickMenu(
                  icon: Icons.people_rounded,
                  title: '선수단',
                  subtitle: '팀원 능력치 평가',
                  color: AppColors.blue,
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const PlayersScreen())),
                ),
                _QuickMenu(
                  icon: Icons.workspace_premium_rounded,
                  title: '명예의전당',
                  subtitle: '역대 시즌 챔피언',
                  color: AppColors.purple,
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const HallOfFameScreen())),
                ),
                _QuickMenu(
                  icon: Icons.receipt_long_rounded,
                  title: '정산',
                  subtitle: '회비 납부 현황',
                  color: AppColors.teal,
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SettlementsScreen())),
                ),
                _QuickMenu(
                  icon: Icons.public_rounded,
                  title: '커뮤니티',
                  subtitle: '팀 모집 · 매칭 · 자유글',
                  color: AppColors.teal,
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CommunityScreen())),
                ),
              ],
            ),
            // 시즌 요약
            if (_seasonSummary != null) ...[
              const SizedBox(height: 24),
              Text(
                '시즌 요약',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textSecondary, letterSpacing: 0.5),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  _SummaryStat(icon: Icons.calendar_month, label: '총 세션', value: '${_seasonSummary!['totalSessions'] ?? 0}', color: AppColors.primary),
                  const SizedBox(width: 8),
                  _SummaryStat(icon: Icons.people, label: '평균 참석', value: '${(_seasonSummary!['averageAttendance'] as num?)?.round() ?? 0}명', color: AppColors.blue),
                  const SizedBox(width: 8),
                  _SummaryStat(icon: Icons.sports_soccer, label: '총 골', value: '${_seasonSummary!['totalGoals'] ?? 0}', color: AppColors.amber),
                  const SizedBox(width: 8),
                  _SummaryStat(icon: Icons.sports, label: '총 경기', value: '${_seasonSummary!['totalMatches'] ?? 0}', color: AppColors.purple),
                ],
              ),
            ],

            const SizedBox(height: 24),

            // 지난 세션
            Text(
              '지난 세션',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textSecondary, letterSpacing: 0.5),
            ),
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: AppColors.surfaceBorder,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.surfaceTint),
              ),
              child: _loading
                  ? Padding(
                      padding: const EdgeInsets.all(AppTheme.space16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SkeletonBox(height: 16, width: 140),
                          const SizedBox(height: AppTheme.space12),
                          SkeletonBox(height: 13, width: 200),
                          const SizedBox(height: AppTheme.space8),
                          Row(
                            children: [
                              Expanded(child: SkeletonBox(height: 32)),
                              const SizedBox(width: AppTheme.space8),
                              Expanded(child: SkeletonBox(height: 32)),
                            ],
                          ),
                        ],
                      ),
                    )
                  : _recentSession != null
                      ? _buildRecentSession(_recentSession!)
                      : Padding(
                          padding: const EdgeInsets.all(24),
                          child: Center(
                            child: Text(
                              '완료된 세션이 없습니다.',
                              style: TextStyle(color: AppColors.iconInactive, fontSize: 14),
                            ),
                          ),
                        ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget _buildAnnouncementCard(Map<String, dynamic> a) {
    final isPinned = a['is_pinned'] == 1 || a['is_pinned'] == true;
    final isRead = a['is_read'] == 1 || a['is_read'] == true;
    final title = a['title'] ?? '';

    return GestureDetector(
      onTap: () async {
        await Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => AnnouncementDetailScreen(announcementId: a['id'] as int)),
        );
        setState(() => _loading = true);
        _loadData();
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.surfaceBorder,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isRead ? AppColors.surfaceTint : AppColors.primary.withAlpha(80),
          ),
        ),
        child: Row(
          children: [
            if (isPinned) ...[
              Icon(Icons.push_pin, size: 14, color: AppColors.amber),
              const SizedBox(width: 8),
            ],
            if (!isRead) ...[
              Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
              ),
              const SizedBox(width: 8),
            ],
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: isRead ? FontWeight.w400 : FontWeight.w600,
                  color: isRead ? AppColors.textSecondary : Colors.white,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              _formatAnnouncementDate(a['created_at']),
              style: TextStyle(fontSize: 11, color: AppColors.iconInactive),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecentSession(Map<String, dynamic> session) {
    final dateStr = session['session_date'] as String? ?? '';
    final title = session['title'] as String? ?? '정기 풋살';
    final status = session['status'] as String?;

    Color statusColor;
    String statusLabel;
    switch (status) {
      case 'completed': statusColor = AppColors.slate; statusLabel = '정산완료'; break;
      case 'ended': statusColor = AppColors.orange; statusLabel = '경기완료'; break;
      case 'closed': statusColor = AppColors.blue; statusLabel = '마감'; break;
      default: statusColor = AppColors.primary; statusLabel = '진행중'; break;
    }

    return GestureDetector(
      onTap: () {
        if (session['id'] != null) {
          Navigator.push(context, MaterialPageRoute(builder: (_) => SessionDetailScreen(sessionId: session['id'])));
        }
      },
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: statusColor.withAlpha(20),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    dateStr.length >= 10 ? dateStr.substring(5, 7) : '-',
                    style: TextStyle(fontSize: 10, color: statusColor.withAlpha(179)),
                  ),
                  Text(
                    dateStr.length >= 10 ? dateStr.substring(8, 10) : '-',
                    style: TextStyle(fontSize: 16, color: statusColor, fontWeight: FontWeight.bold, height: 1.1),
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
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: statusColor.withAlpha(20),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(statusLabel, style: TextStyle(fontSize: 10, color: statusColor, fontWeight: FontWeight.w600)),
                      ),
                      const SizedBox(width: 8),
                      Text(dateStr, style: TextStyle(fontSize: 12, color: AppColors.iconInactive)),
                    ],
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: AppColors.iconInactive, size: 20),
          ],
        ),
      ),
    );
  }
}

class _StatMini extends StatelessWidget {
  final String label;
  final String value;
  final String icon;
  final Color color;

  const _StatMini({required this.label, required this.value, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
        margin: const EdgeInsets.symmetric(horizontal: 3),
        decoration: BoxDecoration(
          color: color.withAlpha(20),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withAlpha(40)),
        ),
        child: Column(
          children: [
            Text(icon, style: const TextStyle(fontSize: 15)),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
            Text(label, style: TextStyle(fontSize: 10, color: AppColors.textHint)),
          ],
        ),
      ),
    );
  }
}

class _QuickMenu extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _QuickMenu({required this.icon, required this.title, required this.subtitle, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surfaceBorder,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.surfaceTint),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: color.withAlpha(26),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(height: 8),
            Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white)),
            Text(subtitle, style: TextStyle(fontSize: 10, color: AppColors.textHint)),
          ],
        ),
      ),
    );
  }
}

class _SummaryStat extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _SummaryStat({required this.icon, required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
        decoration: BoxDecoration(
          color: color.withAlpha(15),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withAlpha(30)),
        ),
        child: Column(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(height: 6),
            Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 10, color: AppColors.textHint)),
          ],
        ),
      ),
    );
  }
}
