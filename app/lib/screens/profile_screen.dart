import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'package:provider/provider.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../widgets/tip_banner.dart';
import 'player_detail_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final ApiService _api = ApiService();
  bool? _googleLinked;
  bool _googleLinking = false;

  // 프로필 요약 데이터
  Map<String, dynamic>? _summary;
  bool _summaryLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _loadSummary();
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

  Future<void> _loadSummary() async {
    final auth = context.read<AuthService>();
    final token = auth.token;
    if (token == null || auth.player == null) {
      setState(() => _summaryLoading = false);
      return;
    }
    try {
      final res = await _api.getProfileSummary(token);
      if (mounted) setState(() { _summary = res; _summaryLoading = false; });
    } catch (_) {
      if (mounted) setState(() => _summaryLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final user = auth.user;
    final player = auth.player;

    return RefreshIndicator(
      onRefresh: () async {
        await Future.wait([_loadProfile(), _loadSummary()]);
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
            if (player != null && !_summaryLoading) ...[
              const SizedBox(height: 16),
              _buildBodyInfo(),
              const SizedBox(height: 16),
              _buildSeasonStats(),
              const SizedBox(height: 16),
              _buildAbilitiesAndPrefs(),
            ],
            const SizedBox(height: 20),
            _buildMenuSection(auth),
          ],
        ),
      ),
    );
  }

  Widget _buildBodyInfo() {
    final p = _summary?['player'];
    if (p == null) return const SizedBox.shrink();

    final height = p['heightCm'];
    final weight = p['weightKg'];
    final birthYear = p['birthYear'];

    if (height == null && weight == null && birthYear == null) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surfaceBorder,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.surfaceTint),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('신체 정보', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary, letterSpacing: 1)),
          const SizedBox(height: 12),
          Row(
            children: [
              if (height != null)
                _bodyInfoItem(Icons.height, '키', '${height}cm'),
              if (weight != null)
                _bodyInfoItem(Icons.fitness_center, '몸무게', '${weight}kg'),
              if (birthYear != null)
                _bodyInfoItem(Icons.cake, '출생', '$birthYear'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _bodyInfoItem(IconData icon, String label, String value) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, size: 18, color: AppColors.textHint),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(fontSize: 11, color: AppColors.textHint)),
        ],
      ),
    );
  }

  Widget _buildSeasonStats() {
    final ss = _summary?['seasonStats'];
    if (ss == null) return const SizedBox.shrink();
    final year = ss['year'] ?? DateTime.now().year;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surfaceBorder,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.surfaceTint),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('$year 시즌 기록', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary, letterSpacing: 1)),
              if (_summary?['player'] != null)
                GestureDetector(
                  onTap: () {
                    final pid = _summary!['player']['id'];
                    Navigator.push(context, MaterialPageRoute(builder: (_) => PlayerDetailScreen(playerId: pid)));
                  },
                  child: Row(
                    children: [
                      Text('자세히 보기', style: const TextStyle(fontSize: 12, color: AppColors.primary)),
                      const SizedBox(width: 2),
                      const Icon(Icons.chevron_right, size: 14, color: AppColors.primary),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _statItem(Icons.calendar_today, '출석', ss['attendance']),
              _statItem(Icons.sports_soccer, '경기', ss['games']),
              _statItem(Icons.flash_on, '득점', ss['goals'], color: AppColors.primary),
              _statItem(Icons.emoji_events, '도움', ss['assists'], color: AppColors.amber),
              _statItem(Icons.shield, '수비', ss['defenses'], color: AppColors.purple),
            ],
          ),
        ],
      ),
    );
  }

  Widget _statItem(IconData icon, String label, dynamic value, {Color color = AppColors.blue}) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(height: 6),
          Text('${value ?? 0}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(fontSize: 11, color: AppColors.textHint)),
        ],
      ),
    );
  }

  Widget _buildAbilitiesAndPrefs() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: _buildAbilities()),
        const SizedBox(width: 12),
        Expanded(child: _buildPreferences()),
      ],
    );
  }

  Widget _buildAbilities() {
    final ab = _summary?['abilities'];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceBorder,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.surfaceTint),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('능력치', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary, letterSpacing: 1)),
          const SizedBox(height: 12),
          if (ab != null) ...[
            Row(
              children: [
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [AppColors.primary, AppColors.teal]),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(child: Text('${ab['overall']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white))),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('종합', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white)),
                      Text('${ab['raterCount']}명 평가', style: TextStyle(fontSize: 10, color: AppColors.textHint)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _abilityBar('슈팅', ab['shooting'], AppColors.red),
            _abilityBar('패스', ab['passing'], AppColors.amber),
            _abilityBar('수비', ab['marking'], AppColors.blue),
            _abilityBar('체력', ab['stamina'], AppColors.primary),
          ] else
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Text('평가 데이터 없음', style: TextStyle(fontSize: 12, color: AppColors.textHint)),
            ),
        ],
      ),
    );
  }

  Widget _abilityBar(String label, dynamic value, Color color) {
    final v = (value ?? 0) is int ? (value as int).toDouble() : ((value ?? 0) as num).toDouble();
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          SizedBox(width: 28, child: Text(label, style: TextStyle(fontSize: 10, color: AppColors.textSecondary))),
          const SizedBox(width: 6),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: v / 100,
                minHeight: 6,
                backgroundColor: AppColors.surfaceTint,
                valueColor: AlwaysStoppedAnimation(color),
              ),
            ),
          ),
          const SizedBox(width: 6),
          SizedBox(width: 22, child: Text('${v.round()}', textAlign: TextAlign.right, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.textSecondary))),
        ],
      ),
    );
  }

  Widget _buildPreferences() {
    final prefs = (_summary?['preferences'] as List?) ?? [];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceBorder,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.surfaceTint),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.favorite, size: 14, color: AppColors.red),
              const SizedBox(width: 4),
              Text('선호 선수 (${prefs.length}/3)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary, letterSpacing: 1)),
            ],
          ),
          const SizedBox(height: 12),
          if (prefs.isNotEmpty)
            ...prefs.map<Widget>((p) => _prefItem(p))
          else ...[
            const SizedBox(height: 12),
            Center(
              child: Column(
                children: [
                  Icon(Icons.favorite_border, size: 28, color: AppColors.iconInactive),
                  const SizedBox(height: 6),
                  Text('같이 뛰고 싶은\n선수를 선택하세요', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: AppColors.textHint)),
                ],
              ),
            ),
          ],
          const SizedBox(height: 10),
          if (prefs.length < 3)
            GestureDetector(
              onTap: () => _showPrefModal(),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.primary.withAlpha(20),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.primary.withAlpha(51)),
                ),
                child: const Center(
                  child: Text('+ 추가', style: TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w600)),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _prefItem(Map<String, dynamic> p) {
    final name = p['name'] ?? '?';
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.surfaceBorder,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Container(
              width: 30, height: 30,
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFFF472B6), AppColors.red]),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Center(child: Text(name[0], style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white))),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white), overflow: TextOverflow.ellipsis),
                  if (p['nickname'] != null)
                    Text(p['nickname'], style: TextStyle(fontSize: 10, color: AppColors.textHint), overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            GestureDetector(
              onTap: () => _removePref(p['id']),
              child: const Icon(Icons.favorite, size: 16, color: AppColors.red),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _removePref(int targetId) async {
    final auth = context.read<AuthService>();
    try {
      await _api.removePreference(targetId, auth.token!);
      await _loadSummary();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.red));
      }
    }
  }

  void _showPrefModal() async {
    final auth = context.read<AuthService>();
    if (auth.token == null) return;

    // 선수 목록 불러오기
    List<dynamic> players = [];
    try {
      final res = await _api.request('/players', token: auth.token);
      players = (res is List) ? res : (res['players'] ?? res['data'] ?? []);
    } catch (_) {}

    final myPlayerId = _summary?['player']?['id'];
    final currentPrefs = Set<int>.from(
      ((_summary?['preferences'] as List?) ?? []).map((p) => p['id'] as int),
    );

    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.bgCard,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) {
        String search = '';
        return StatefulBuilder(builder: (ctx2, setModalState) {
          final filtered = players.where((p) {
            if (p['id'] == myPlayerId) return false;
            if (p['is_guest'] == 1) return false;
            if (search.isEmpty) return true;
            return (p['name'] ?? '').toString().contains(search) || (p['nickname'] ?? '').toString().contains(search);
          }).toList();

          return DraggableScrollableSheet(
            initialChildSize: 0.7,
            maxChildSize: 0.9,
            minChildSize: 0.4,
            expand: false,
            builder: (_, scrollCtrl) => Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                  child: Row(
                    children: [
                      const Text('선호 선수 선택', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                      const Spacer(),
                      GestureDetector(
                        onTap: () => Navigator.pop(ctx2),
                        child: const Icon(Icons.close, color: Colors.white54),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: TextField(
                    style: const TextStyle(color: Colors.white),
                    onChanged: (v) => setModalState(() => search = v),
                    decoration: InputDecoration(
                      hintText: '선수 이름으로 검색...',
                      hintStyle: const TextStyle(color: Colors.white38),
                      filled: true,
                      fillColor: AppColors.bgBase,
                      prefixIcon: const Icon(Icons.search, color: Colors.white38, size: 20),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: ListView.builder(
                    controller: scrollCtrl,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    itemCount: filtered.length,
                    itemBuilder: (_, i) {
                      final p = filtered[i];
                      final isFav = currentPrefs.contains(p['id']);
                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                        leading: Container(
                          width: 36, height: 36,
                          decoration: BoxDecoration(
                            color: isFav ? AppColors.red.withAlpha(26) : AppColors.surfaceTint,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Center(child: Text((p['name'] ?? '?')[0], style: TextStyle(fontWeight: FontWeight.bold, color: isFav ? AppColors.red : Colors.white70))),
                        ),
                        title: Text(p['name'] ?? '?', style: const TextStyle(fontSize: 14, color: Colors.white)),
                        subtitle: p['nickname'] != null ? Text(p['nickname'], style: TextStyle(fontSize: 11, color: AppColors.textHint)) : null,
                        trailing: GestureDetector(
                          onTap: () async {
                            if (isFav) {
                              await _api.removePreference(p['id'], auth.token!);
                              currentPrefs.remove(p['id']);
                            } else {
                              if (currentPrefs.length >= 3) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('최대 3명까지 등록 가능합니다'), backgroundColor: AppColors.red),
                                );
                                return;
                              }
                              await _api.addPreference(p['id'], auth.token!);
                              currentPrefs.add(p['id']);
                            }
                            setModalState(() {});
                            _loadSummary();
                          },
                          child: Icon(
                            isFav ? Icons.favorite : Icons.favorite_border,
                            color: isFav ? AppColors.red : Colors.white38,
                            size: 22,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          );
        });
      },
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
        color: AppColors.surfaceBorder,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.surfaceTint),
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
                    decoration: BoxDecoration(color: AppColors.surfaceTint, shape: BoxShape.circle),
                    child: const Icon(Icons.edit, size: 14, color: Colors.white70),
                  ),
                ),
              ],
            ],
          ),
          if (player?['nickname'] != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('(${player!['nickname']})', style: TextStyle(fontSize: 14, color: AppColors.textHint)),
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
          Divider(color: AppColors.surfaceTint),
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
        Icon(icon, size: 16, color: AppColors.textHint),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: TextStyle(fontSize: 13, color: AppColors.textSecondary))),
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
          color: AppColors.surfaceBorder,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.surfaceTint),
        ),
        child: Row(
          children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(width: 12),
            Text(label, style: TextStyle(fontSize: 15, color: color)),
            const Spacer(),
            Icon(Icons.chevron_right, size: 18, color: AppColors.iconInactive),
          ],
        ),
      ),
    );
  }
}
