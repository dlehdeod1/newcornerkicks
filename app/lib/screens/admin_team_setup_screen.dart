import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

class AdminTeamSetupScreen extends StatefulWidget {
  final int sessionId;
  final String sessionTitle;
  const AdminTeamSetupScreen({super.key, required this.sessionId, required this.sessionTitle});

  @override
  State<AdminTeamSetupScreen> createState() => _AdminTeamSetupScreenState();
}

class _AdminTeamSetupScreenState extends State<AdminTeamSetupScreen>
    with SingleTickerProviderStateMixin {
  final ApiService _api = ApiService();
  late TabController _tab;

  List<dynamic> _allPlayers = [];
  final Set<int> _selected = {};
  final _kakaoCtrl = TextEditingController();
  List<dynamic> _parsed = [];

  bool _loadingPlayers = true;
  bool _assigning = false;

  // 결과
  List<dynamic> _resultTeams = [];
  List<dynamic> _resultMatches = [];
  bool _showResult = false;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
    _loadPlayers();
  }

  @override
  void dispose() {
    _tab.dispose();
    _kakaoCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadPlayers() async {
    final token = context.read<AuthService>().token;
    try {
      final res = await _api.getPlayers(token: token);
      if (mounted) {
        setState(() {
          _allPlayers = (res['players'] as List?)?.where((p) => p['is_guest'] != 1).toList() ?? [];
          _loadingPlayers = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingPlayers = false);
    }
  }

  String _buildTemplate() {
    final club = context.read<AuthService>().club;
    final clubName = club?['name'] ?? '우리팀';
    final now = DateTime.now();
    final days = ['일', '월', '화', '수', '목', '금', '토'];
    final dow = days[now.weekday % 7];
    final dateStr = '${now.month}/${now.day}($dow)';
    final names = _allPlayers.map((p) => p['name'] as String).join(', ');
    return '⚽ [$clubName] $dateStr 참석 투표 ⚽\n\n참석하시면 성함 남겨주세요!\n\n등록 선수: $names';
  }

  Future<void> _parseKakao() async {
    final text = _kakaoCtrl.text.trim();
    if (text.isEmpty) return;
    final token = context.read<AuthService>().token;
    try {
      final res = await _api.request(
        '/sessions/${widget.sessionId}/parse',
        method: 'POST',
        body: {'text': text},
        token: token,
      );
      final attendees = (res['attendees'] as List?) ?? [];
      setState(() {
        _parsed = attendees;
        for (final a in attendees) {
          final pid = a['playerId'];
          if (pid != null) _selected.add(pid as int);
        }
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: const Color(0xFFef4444)),
        );
      }
    }
  }

  Future<void> _assignTeams() async {
    if (_selected.length < 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('최소 4명 이상 선택해주세요'), backgroundColor: Colors.orange),
      );
      return;
    }
    setState(() => _assigning = true);
    final token = context.read<AuthService>().token;
    try {
      final attendees = _selected.map((pid) => {'playerId': pid, 'isGuest': false}).toList();
      final res = await _api.request(
        '/sessions/${widget.sessionId}/teams',
        method: 'POST',
        body: {'attendees': attendees},
        token: token,
      );
      if (mounted) {
        setState(() {
          _resultTeams = (res['teams'] as List?) ?? [];
          _resultMatches = (res['matches'] as List?) ?? [];
          _showResult = true;
          _assigning = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _assigning = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: const Color(0xFFef4444)),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0f172a),
        foregroundColor: Colors.white,
        elevation: 0,
        title: Text(
          _showResult ? '팀 배정 결과' : '출석 / 팀 구성',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        actions: _showResult
            ? [
                TextButton(
                  onPressed: () => setState(() {
                    _showResult = false;
                    _resultTeams = [];
                  }),
                  child: const Text('다시', style: TextStyle(color: Colors.white54, fontSize: 14)),
                ),
              ]
            : null,
      ),
      body: _showResult ? _buildResultStep() : _buildSelectStep(),
    );
  }

  // ── 선택 단계 ─────────────────────────────────────
  Widget _buildSelectStep() {
    return Column(
      children: [
        // 탭
        Container(
          margin: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: Colors.white.withAlpha(10),
            borderRadius: BorderRadius.circular(12),
          ),
          child: TabBar(
            controller: _tab,
            indicator: BoxDecoration(color: const Color(0xFF34d399), borderRadius: BorderRadius.circular(9)),
            indicatorSize: TabBarIndicatorSize.tab,
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white38,
            labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            dividerColor: Colors.transparent,
            tabs: const [Tab(text: '직접 선택'), Tab(text: '카톡 파싱')],
          ),
        ),
        // 선택 카운트
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Text(
                '${_selected.length}명 선택됨',
                style: TextStyle(
                  color: _selected.length >= 4 ? const Color(0xFF34d399) : Colors.white.withAlpha(102),
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              if (_allPlayers.isNotEmpty && _tab.index == 0)
                GestureDetector(
                  onTap: () => setState(() {
                    if (_selected.length == _allPlayers.length) {
                      _selected.clear();
                    } else {
                      _selected.addAll(_allPlayers.map((p) => p['id'] as int));
                    }
                  }),
                  child: Text(
                    _selected.length == _allPlayers.length ? '전체 해제' : '전체 선택',
                    style: TextStyle(color: Colors.white.withAlpha(102), fontSize: 12),
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _tab,
            children: [_buildDirectSelect(), _buildKakaoParser()],
          ),
        ),
        _buildBottomBar(),
      ],
    );
  }

  Widget _buildDirectSelect() {
    if (_loadingPlayers) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF34d399)));
    }
    if (_allPlayers.isEmpty) {
      return Center(
        child: Text('등록된 선수가 없습니다', style: TextStyle(color: Colors.white.withAlpha(77))),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      itemCount: _allPlayers.length,
      itemBuilder: (ctx, i) {
        final p = _allPlayers[i];
        final pid = p['id'] as int;
        final checked = _selected.contains(pid);
        return GestureDetector(
          onTap: () => setState(() => checked ? _selected.remove(pid) : _selected.add(pid)),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            margin: const EdgeInsets.only(bottom: 6),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            decoration: BoxDecoration(
              color: checked ? const Color(0xFF34d399).withAlpha(20) : Colors.white.withAlpha(8),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: checked ? const Color(0xFF34d399).withAlpha(77) : Colors.white.withAlpha(13),
              ),
            ),
            child: Row(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                    color: checked ? const Color(0xFF34d399) : Colors.transparent,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: checked ? const Color(0xFF34d399) : Colors.white38),
                  ),
                  child: checked ? const Icon(Icons.check, size: 14, color: Colors.white) : null,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    p['name'] as String? ?? '',
                    style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (p['nickname'] != null)
                  Text(
                    p['nickname'] as String,
                    style: TextStyle(color: Colors.white.withAlpha(77), fontSize: 12),
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildKakaoParser() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 템플릿 복사 버튼
          GestureDetector(
            onTap: () {
              Clipboard.setData(ClipboardData(text: _buildTemplate()));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('투표 템플릿이 복사됐습니다 ✓'),
                  backgroundColor: Color(0xFF34d399),
                  duration: Duration(seconds: 2),
                ),
              );
            },
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
              decoration: BoxDecoration(
                color: const Color(0xFF34d399).withAlpha(20),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF34d399).withAlpha(51)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.copy_outlined, size: 16, color: Color(0xFF34d399)),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      '투표 템플릿 복사 → 카톡 붙여넣기',
                      style: TextStyle(color: Color(0xFF34d399), fontSize: 13, fontWeight: FontWeight.w600),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text('탭하면 복사', style: TextStyle(color: Colors.white.withAlpha(77), fontSize: 11)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text('투표 결과 붙여넣기', style: TextStyle(color: Colors.white.withAlpha(153), fontSize: 12)),
          const SizedBox(height: 6),
          Expanded(
            flex: 3,
            child: TextField(
              controller: _kakaoCtrl,
              maxLines: null,
              expands: true,
              textAlignVertical: TextAlignVertical.top,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                hintText: '카톡 채팅 내용을 붙여넣어 주세요\n참석자 이름이 포함된 부분만 OK',
                hintStyle: TextStyle(color: Colors.white.withAlpha(51), fontSize: 12),
                filled: true,
                fillColor: Colors.white.withAlpha(8),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFF34d399), width: 1.5),
                ),
                contentPadding: const EdgeInsets.all(14),
              ),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: _parseKakao,
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: Colors.white.withAlpha(38)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(vertical: 11),
              ),
              child: const Text('파싱하기', style: TextStyle(color: Colors.white, fontSize: 14)),
            ),
          ),
          if (_parsed.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(8),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '매칭: ${_parsed.where((a) => a['playerId'] != null).length}/${_parsed.length}명',
                    style: const TextStyle(color: Color(0xFF34d399), fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: _parsed.map((a) {
                      final matched = a['playerId'] != null;
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: matched ? const Color(0xFF34d399).withAlpha(26) : Colors.orange.withAlpha(26),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          a['name'] as String? ?? '?',
                          style: TextStyle(
                            fontSize: 11,
                            color: matched ? const Color(0xFF34d399) : Colors.orange,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      );
                    }).toList(),
                  ),
                  if (_parsed.any((a) => a['playerId'] == null)) ...[
                    const SizedBox(height: 6),
                    Text(
                      '주황색: 등록되지 않은 이름 (선수 등록 후 재시도)',
                      style: TextStyle(color: Colors.orange.withAlpha(179), fontSize: 10),
                    ),
                  ],
                ],
              ),
            ),
          ],
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  void _showUpgradeDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1e293b),
        title: const Text('PRO 플랜 업그레이드', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'PRO 플랜으로 업그레이드하면 다음 기능을 이용할 수 있어요:',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 12),
            _upgradeFeatureRow('⚡', 'AI 능력치 기반 팀 균형 편성'),
            _upgradeFeatureRow('🤖', 'AI 세션 분석 리포트'),
            _upgradeFeatureRow('📵', '클럽 멤버 광고 제거'),
            const SizedBox(height: 12),
            const Text(
              '현재는 랜덤 팀 편성으로 진행됩니다.',
              style: TextStyle(color: Colors.white38, fontSize: 12),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('닫기', style: TextStyle(color: Colors.white.withAlpha(102))),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              launchUrl(
                Uri.parse('https://cornerkicks.pages.dev/upgrade'),
                mode: LaunchMode.externalApplication,
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF34d399),
              foregroundColor: const Color(0xFF0f172a),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('업그레이드', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  Widget _upgradeFeatureRow(String emoji, String text) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Row(
      children: [
        Text(emoji, style: const TextStyle(fontSize: 14)),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: const TextStyle(color: Colors.white, fontSize: 13))),
      ],
    ),
  );

  Widget _buildBottomBar() {
    final auth = context.watch<AuthService>();
    final isPro = auth.isPro;
    final canAssign = _selected.length >= 4 && !_assigning;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 플랜 상태 표시
            if (!isPro)
              GestureDetector(
                onTap: _showUpgradeDialog,
                child: Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.amber.withAlpha(20),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.amber.withAlpha(51)),
                  ),
                  child: Row(
                    children: [
                      const Text('FREE', style: TextStyle(color: Colors.amber, fontSize: 10, fontWeight: FontWeight.w800)),
                      const SizedBox(width: 8),
                      const Expanded(
                        child: Text(
                          '랜덤 팀 편성 모드 · PRO로 업그레이드하면 AI 편성',
                          style: TextStyle(color: Colors.amber, fontSize: 11),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios, size: 10, color: Colors.amber),
                    ],
                  ),
                ),
              ),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: canAssign ? _assignTeams : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF34d399),
                  foregroundColor: const Color(0xFF0f172a),
                  disabledBackgroundColor: Colors.white.withAlpha(20),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: _assigning
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : Text(
                        _selected.length < 4
                            ? '최소 4명 선택 필요 (${_selected.length}명)'
                            : isPro
                                ? '⚡ AI 팀 편성  ${_selected.length}명'
                                : '🎲 팀 편성  ${_selected.length}명',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                        overflow: TextOverflow.ellipsis,
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── 결과 단계 ─────────────────────────────────────
  Widget _buildResultStep() {
    final teamColors = [const Color(0xFF34d399), const Color(0xFFf59e0b), const Color(0xFF60a5fa), const Color(0xFFf472b6)];
    final hasTwoTeams = _resultTeams.length == 2;

    return Column(
      children: [
        // 통계 바
        Container(
          margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white.withAlpha(8),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _statItem('총 인원', '${_selected.length}명'),
              Container(width: 1, height: 28, color: Colors.white.withAlpha(26)),
              _statItem('팀 수', '${_resultTeams.length}팀'),
              Container(width: 1, height: 28, color: Colors.white.withAlpha(26)),
              _statItem('경기 수', '${_resultMatches.length}경기'),
            ],
          ),
        ),
        // 팀 목록
        Expanded(
          child: hasTwoTeams
              ? _buildTwoTeamView(teamColors)
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  itemCount: _resultTeams.length,
                  itemBuilder: (ctx, i) => _buildTeamCard(_resultTeams[i], i, teamColors),
                ),
        ),
        // 확정 버튼
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context, true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF34d399),
                  foregroundColor: const Color(0xFF0f172a),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: const Text(
                  '팀 편성 완료 ✓',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTwoTeamView(List<Color> teamColors) {
    final team1 = _resultTeams[0];
    final team2 = _resultTeams[1];
    final color1 = teamColors[0];
    final color2 = teamColors[1];
    final members1 = (team1['members'] as List?) ?? [];
    final members2 = (team2['members'] as List?) ?? [];

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        children: [
          // 두 팀 나란히
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: _buildTeamCard(team1, 0, teamColors)),
                const SizedBox(width: 8),
                Expanded(child: _buildTeamCard(team2, 1, teamColors)),
              ],
            ),
          ),
          // VS 배지
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(10),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withAlpha(20)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    team1['name'] as String? ?? 'A팀',
                    style: TextStyle(color: color1, fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text('VS', style: TextStyle(color: Colors.white.withAlpha(102), fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
                  Text(
                    team2['name'] as String? ?? 'B팀',
                    style: TextStyle(color: color2, fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
          ),
          // 멤버 균형 표시
          if (members1.isNotEmpty || members2.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(6),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('${members1.length}명', style: TextStyle(color: color1, fontSize: 14, fontWeight: FontWeight.bold)),
                  Text(' : ', style: TextStyle(color: Colors.white.withAlpha(102), fontSize: 14)),
                  Text('${members2.length}명', style: TextStyle(color: color2, fontSize: 14, fontWeight: FontWeight.bold)),
                  const SizedBox(width: 8),
                  Text(
                    members1.length == members2.length ? '균형 잡힌 팀!' : '팀 인원 차이 있음',
                    style: TextStyle(
                      color: members1.length == members2.length ? const Color(0xFF34d399) : Colors.orange,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildTeamCard(dynamic team, int i, List<Color> teamColors) {
    final color = teamColors[i % teamColors.length];
    final members = (team['members'] as List?) ?? [];

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withAlpha(13),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withAlpha(51)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(team['emoji'] as String? ?? '⚽', style: const TextStyle(fontSize: 18)),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  team['name'] as String? ?? 'Team ${i + 1}',
                  style: TextStyle(color: color, fontSize: 14, fontWeight: FontWeight.bold),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: color.withAlpha(26),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text('${members.length}명', style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 5,
            runSpacing: 5,
            children: members.map((m) {
              final name = m['name'] as String? ?? m['guest_name'] as String? ?? '?';
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: color.withAlpha(20),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  name,
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                  overflow: TextOverflow.ellipsis,
                ),
              );
            }).toList(),
          ),
          if (team['key_player'] != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Text('🔑 ', style: TextStyle(fontSize: 11)),
                Expanded(
                  child: Text(
                    team['key_player'] as String,
                    style: TextStyle(color: Colors.white.withAlpha(102), fontSize: 11),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _statItem(String label, String value) => Column(
        children: [
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: Colors.white.withAlpha(102), fontSize: 11)),
        ],
      );
}
