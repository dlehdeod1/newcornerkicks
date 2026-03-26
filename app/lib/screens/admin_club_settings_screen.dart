import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';

class AdminClubSettingsScreen extends StatefulWidget {
  const AdminClubSettingsScreen({super.key});

  @override
  State<AdminClubSettingsScreen> createState() => _AdminClubSettingsScreenState();
}

class _AdminClubSettingsScreenState extends State<AdminClubSettingsScreen> {
  final ApiService _api = ApiService();

  // Club info
  late TextEditingController _nameCtrl;
  late TextEditingController _descCtrl;

  // Fee settings
  late TextEditingController _entryFeeCtrl;
  late TextEditingController _monthlyFeeCtrl;
  late TextEditingController _perGameFeeCtrl;
  late TextEditingController _feeNotesCtrl;

  // 순위별 차등 참가비
  List<Map<String, dynamic>> _feeTiers = [];

  // Recording event types
  static const _allEventTypes = [
    // 공격
    {'key': 'GOAL', 'label': '득점', 'icon': '⚽', 'desc': '골을 넣을 때 기록', 'category': 'attack'},
    {'key': 'KEY_PASS', 'label': '키패스', 'icon': '⚡', 'desc': '결정적 패스 기록', 'category': 'attack'},
    {'key': 'DRIBBLE', 'label': '돌파', 'icon': '💨', 'desc': '돌파 성공 시 기록', 'category': 'attack'},
    {'key': 'SHOT_ON', 'label': '유효슈팅', 'icon': '🎯', 'desc': '골대 안 슈팅 기록', 'category': 'attack'},
    {'key': 'SHOT_OFF', 'label': '무효슈팅', 'icon': '💫', 'desc': '골대 밖 슈팅 기록', 'category': 'attack'},
    // 수비
    {'key': 'DEFENSE', 'label': '수비 (간편)', 'icon': '🛡️', 'desc': '간편 수비 기록 (상세와 동시 사용 불가)', 'category': 'defense'},
    {'key': 'TACKLE', 'label': '태클', 'icon': '🦶', 'desc': '태클 성공 시 기록', 'category': 'defense_detail'},
    {'key': 'INTERCEPTION', 'label': '인터셉트', 'icon': '✋', 'desc': '패스 차단 시 기록', 'category': 'defense_detail'},
    {'key': 'CLEARANCE', 'label': '클리어런스', 'icon': '🧹', 'desc': '위험 제거 시 기록', 'category': 'defense_detail'},
    // 골키퍼
    {'key': 'SAVE', 'label': '선방', 'icon': '🧤', 'desc': '골키퍼 선방 기록', 'category': 'gk'},
  ];

  Set<String> _enabledEvents = {'GOAL', 'DEFENSE'};
  int _seasonStartMonth = 1;
  bool _loading = true;
  bool _saving = false;

  // MVP 가중치 설정
  Map<String, double> _mvpWeights = {
    'GOAL': 2.0, 'ASSIST': 1.5, 'DEFENSE': 0.5,
    'TACKLE': 0.3, 'INTERCEPTION': 0.3, 'CLEARANCE': 0.3,
    'SAVE': 0.5, 'KEY_PASS': 0.5, 'DRIBBLE': 0.3,
    'SHOT_ON': 0.2, 'SHOT_OFF': 0.1, 'SESSION_WIN': 1.5,
  };

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController();
    _descCtrl = TextEditingController();
    _entryFeeCtrl = TextEditingController();
    _monthlyFeeCtrl = TextEditingController();
    _perGameFeeCtrl = TextEditingController();
    _feeNotesCtrl = TextEditingController();
    _loadSettings();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _entryFeeCtrl.dispose();
    _monthlyFeeCtrl.dispose();
    _perGameFeeCtrl.dispose();
    _feeNotesCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadSettings() async {
    final token = context.read<AuthService>().token;
    if (token == null) return;
    try {
      final res = await _api.getMyClub(token);
      final club = res['club'] ?? res;
      if (mounted) {
        setState(() {
          _nameCtrl.text = club['name'] ?? '';
          _descCtrl.text = club['description'] ?? '';
          _entryFeeCtrl.text = (club['entryFee'] ?? 0).toString();
          _monthlyFeeCtrl.text = (club['monthlyFee'] ?? 0).toString();
          _perGameFeeCtrl.text = (club['perGameFee'] ?? 0).toString();
          _feeNotesCtrl.text = club['feeNotes'] ?? '';
          final tiers = club['feeTiers'];
          if (tiers is List && tiers.isNotEmpty) {
            _feeTiers = tiers.map((t) => Map<String, dynamic>.from(t as Map)).toList();
          }
          final events = club['enabledEvents'];
          if (events is List) {
            _enabledEvents = Set<String>.from(events.map((e) => e.toString()));
          }
          _seasonStartMonth = (club['seasonStartMonth'] as int?) ?? 1;
          final weights = club['mvpWeights'];
          if (weights is Map) {
            _mvpWeights = Map<String, double>.from(
              weights.map((k, v) => MapEntry(k.toString(), (v as num).toDouble())),
            );
          }
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    if (_saving) return;
    final token = context.read<AuthService>().token;
    if (token == null) return;

    // GOAL is mandatory
    if (!_enabledEvents.contains('GOAL')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('득점(GOAL)은 필수 기록 항목입니다.'), backgroundColor: AppColors.red),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      await _api.updateClub({
        'name': _nameCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
        'enabledEvents': _enabledEvents.toList(),
        'entryFee': int.tryParse(_entryFeeCtrl.text) ?? 0,
        'monthlyFee': int.tryParse(_monthlyFeeCtrl.text) ?? 0,
        'perGameFee': int.tryParse(_perGameFeeCtrl.text) ?? 0,
        'feeNotes': _feeNotesCtrl.text.trim(),
        'feeTiers': _feeTiers,
        'seasonStartMonth': _seasonStartMonth,
        'mvpWeights': _mvpWeights,
      }, token);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('설정이 저장되었습니다'), backgroundColor: AppColors.primary, duration: Duration(seconds: 2)),
        );
        // Refresh auth service club info
        await context.read<AuthService>().refreshClub();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: AppColors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: AppColors.bgBase,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('클럽 관리 설정', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w600)),
        actions: [
          if (!_loading)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: TextButton(
                onPressed: _saving ? null : _save,
                style: TextButton.styleFrom(
                  backgroundColor: AppColors.primary.withAlpha(26),
                  foregroundColor: AppColors.primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                ),
                child: _saving
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2))
                    : const Text('저장', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              ),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildSectionTitle(Icons.info_outline_rounded, '클럽 정보'),
                  const SizedBox(height: 12),
                  _buildClubInfoSection(),
                  const SizedBox(height: 28),
                  _buildSectionTitle(Icons.payments_rounded, '회비 설정'),
                  const SizedBox(height: 6),
                  Text(
                    '경기 참가비, 월회비 등을 설정하면 멤버들이 프로필에서 확인할 수 있습니다.',
                    style: TextStyle(fontSize: 12, color: AppColors.textHint),
                  ),
                  const SizedBox(height: 12),
                  _buildFeeSection(),
                  const SizedBox(height: 28),
                  _buildSectionTitle(Icons.leaderboard_rounded, '순위별 차등 참가비'),
                  const SizedBox(height: 6),
                  Text(
                    '경기 종료 시 팀 순위에 따라 참가비가 자동으로 계산됩니다. 비워두면 경기당 참가비가 모두에게 동일하게 적용됩니다.',
                    style: TextStyle(fontSize: 12, color: AppColors.textHint),
                  ),
                  const SizedBox(height: 12),
                  _buildFeeTiersSection(),
                  const SizedBox(height: 28),
                  _buildSectionTitle(Icons.edit_note_rounded, '기록 항목 설정'),
                  const SizedBox(height: 6),
                  Text(
                    '경기 중 어떤 기록을 남길지 선택하세요. 득점은 필수 항목입니다.',
                    style: TextStyle(fontSize: 12, color: AppColors.textHint),
                  ),
                  const SizedBox(height: 12),
                  _buildEventTypeSection(),
                  const SizedBox(height: 28),
                  _buildSectionTitle(Icons.tune_rounded, '평점 가중치 설정'),
                  const SizedBox(height: 6),
                  Text(
                    '평점 계산 시 각 기록 항목별 가중치를 설정합니다. 값이 클수록 해당 기록의 비중이 높아집니다.',
                    style: TextStyle(fontSize: 12, color: AppColors.textHint),
                  ),
                  const SizedBox(height: 12),
                  _buildMvpWeightsSection(),
                  const SizedBox(height: 28),
                  _buildSectionTitle(Icons.calendar_month_rounded, '시즌 설정'),
                  const SizedBox(height: 6),
                  Text(
                    '시즌이 시작되는 달을 설정합니다. 랭킹/통계가 이 기준으로 집계됩니다.',
                    style: TextStyle(fontSize: 12, color: AppColors.textHint),
                  ),
                  const SizedBox(height: 12),
                  _buildSeasonSection(),
                  const SizedBox(height: 28),
                  _buildSectionTitle(Icons.preview_rounded, '선택된 기록 미리보기'),
                  const SizedBox(height: 12),
                  _buildPreview(),
                  const SizedBox(height: 40),
                ],
              ),
            ),
    );
  }

  static const _monthLabels = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  Widget _buildSeasonSection() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surfaceBorder,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.surfaceTint),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.flag_rounded, size: 16, color: AppColors.primary),
              const SizedBox(width: 8),
              const Text('시즌 시작 월', style: TextStyle(color: Colors.white70, fontSize: 13)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.primary.withAlpha(20),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.primary.withAlpha(51)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<int>(
                    value: _seasonStartMonth,
                    dropdownColor: AppColors.bgCard,
                    style: const TextStyle(color: AppColors.primary, fontSize: 14, fontWeight: FontWeight.w600),
                    icon: const Icon(Icons.expand_more, color: AppColors.primary, size: 18),
                    isDense: true,
                    items: List.generate(12, (i) => DropdownMenuItem(
                      value: i + 1,
                      child: Text(_monthLabels[i]),
                    )),
                    onChanged: (v) { if (v != null) setState(() => _seasonStartMonth = v); },
                  ),
                ),
              ),
            ],
          ),
          if (_seasonStartMonth != 1) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.amber.withAlpha(15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.amber.withAlpha(40)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline, size: 14, color: Colors.amber),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '2025 시즌 = ${_seasonStartMonth}월 2025 ~ ${_seasonStartMonth == 1 ? 12 : _seasonStartMonth - 1}월 ${_seasonStartMonth == 1 ? 2025 : 2026}',
                      style: const TextStyle(color: Colors.amber, fontSize: 11),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSectionTitle(IconData icon, String title) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.primary),
        const SizedBox(width: 8),
        Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
      ],
    );
  }

  Widget _buildClubInfoSection() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surfaceBorder,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.surfaceTint),
      ),
      child: Column(
        children: [
          _buildTextField(
            controller: _nameCtrl,
            label: '클럽 이름',
            hint: '예: 코너킥스 FC',
            icon: Icons.group_rounded,
          ),
          const SizedBox(height: 14),
          _buildTextField(
            controller: _descCtrl,
            label: '클럽 소개',
            hint: '클럽을 간단히 소개해주세요',
            icon: Icons.notes_rounded,
            maxLines: 3,
          ),
        ],
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    int maxLines = 1,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 14, color: AppColors.textHint),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
          ],
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          maxLines: maxLines,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(color: AppColors.iconInactive, fontSize: 13),
            filled: true,
            fillColor: AppColors.surfaceBorder,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: AppColors.surfaceTint),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: AppColors.surfaceTint),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
        ),
      ],
    );
  }

  Widget _buildFeeSection() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surfaceBorder,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.surfaceTint),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(child: _buildFeeField(_entryFeeCtrl, '입단비', '0', Icons.person_add_rounded)),
              const SizedBox(width: 12),
              Expanded(child: _buildFeeField(_monthlyFeeCtrl, '월회비', '0', Icons.calendar_month_rounded)),
              const SizedBox(width: 12),
              Expanded(child: _buildFeeField(_perGameFeeCtrl, '경기당 참가비', '0', Icons.sports_soccer_rounded)),
            ],
          ),
          const SizedBox(height: 14),
          _buildTextField(
            controller: _feeNotesCtrl,
            label: '회비 안내 메모',
            hint: '예: 매월 1일 입금, 카카오뱅크 010-xxxx',
            icon: Icons.notes_rounded,
            maxLines: 2,
          ),
        ],
      ),
    );
  }

  Widget _buildFeeField(TextEditingController ctrl, String label, String hint, IconData icon) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 13, color: AppColors.textHint),
            const SizedBox(width: 4),
            Flexible(child: Text(label, style: TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.w500), overflow: TextOverflow.ellipsis)),
          ],
        ),
        const SizedBox(height: 8),
        TextField(
          controller: ctrl,
          keyboardType: TextInputType.number,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(color: AppColors.iconInactive, fontSize: 13),
            suffixText: '원',
            suffixStyle: TextStyle(color: AppColors.iconInactive, fontSize: 12),
            filled: true,
            fillColor: AppColors.surfaceBorder,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: AppColors.surfaceTint),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: AppColors.surfaceTint),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
        ),
      ],
    );
  }

  Widget _buildFeeTiersSection() {
    final medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣'];

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surfaceBorder,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.surfaceTint),
      ),
      child: Column(
        children: [
          // 현재 tier 목록
          ..._feeTiers.asMap().entries.map((entry) {
            final i = entry.key;
            final tier = entry.value;
            final ctrl = TextEditingController(text: tier['amount'].toString());
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Text(i < medals.length ? medals[i] : '${i + 1}등', style: const TextStyle(fontSize: 20, height: 1)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: ctrl,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                      onChanged: (v) => setState(() => _feeTiers[i] = {'rank': i + 1, 'amount': int.tryParse(v) ?? 0}),
                      decoration: InputDecoration(
                        suffixText: '원',
                        suffixStyle: TextStyle(color: AppColors.iconInactive, fontSize: 12),
                        filled: true,
                        fillColor: AppColors.surfaceBorder,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: AppColors.surfaceTint)),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: AppColors.surfaceTint)),
                        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        hintText: '참가비',
                        hintStyle: TextStyle(color: AppColors.iconInactive, fontSize: 13),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () => setState(() => _feeTiers.removeAt(i)),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.red.withAlpha(20),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.remove, color: AppColors.red, size: 16),
                    ),
                  ),
                ],
              ),
            );
          }),

          // 추가 버튼
          if (_feeTiers.length < 6)
            GestureDetector(
              onTap: () => setState(() {
                final baseAmount = int.tryParse(_perGameFeeCtrl.text) ?? 0;
                _feeTiers.add({'rank': _feeTiers.length + 1, 'amount': baseAmount});
              }),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.surfaceBorder,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.surfaceTint, style: BorderStyle.solid),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.add, size: 16, color: AppColors.textHint),
                    const SizedBox(width: 6),
                    Text(
                      _feeTiers.isEmpty ? '순위별 차등 적용하기' : '${_feeTiers.length + 1}등 추가',
                      style: TextStyle(fontSize: 13, color: AppColors.textHint),
                    ),
                  ],
                ),
              ),
            ),

          if (_feeTiers.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.primary.withAlpha(13),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline, size: 13, color: AppColors.primary.withAlpha(179)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '경기 종료 -> 순위 자동 계산 -> 각 선수 참가비 자동 생성',
                      style: TextStyle(fontSize: 11, color: AppColors.primary.withAlpha(179)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  static const _defenseDetailKeys = ['TACKLE', 'INTERCEPTION', 'CLEARANCE'];

  Widget _buildEventTypeSection() {
    final categories = <String, String>{
      'attack': '공격',
      'defense': '수비 (간편)',
      'defense_detail': '수비 (상세)',
      'gk': '골키퍼',
    };
    String? lastCategory;

    return Column(
      children: _allEventTypes.expand((type) {
        final key = type['key'] as String;
        final category = type['category'] as String;
        final enabled = _enabledEvents.contains(key);
        final isRequired = key == 'GOAL';

        final widgets = <Widget>[];
        if (category != lastCategory) {
          lastCategory = category;
          widgets.add(Padding(
            padding: const EdgeInsets.only(top: 12, bottom: 6, left: 4),
            child: Text(categories[category] ?? category, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textHint)),
          ));
        }

        widgets.add(Container(
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            color: enabled ? AppColors.primary.withAlpha(13) : AppColors.surfaceBorder,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: enabled ? AppColors.primary.withAlpha(51) : AppColors.surfaceTint,
            ),
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            leading: Text(type['icon'] as String, style: const TextStyle(fontSize: 22)),
            title: Row(
              children: [
                Text(
                  type['label'] as String,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: enabled ? Colors.white : AppColors.textHint,
                  ),
                ),
                if (isRequired) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withAlpha(26),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text('필수', style: TextStyle(fontSize: 9, color: AppColors.primary, fontWeight: FontWeight.w700)),
                  ),
                ],
              ],
            ),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                type['desc'] as String,
                style: TextStyle(fontSize: 11, color: AppColors.iconInactive),
              ),
            ),
            trailing: Switch(
              value: enabled,
              onChanged: isRequired ? null : (val) {
                setState(() {
                  if (val) {
                    _enabledEvents.add(key);
                    // 간편 수비 <-> 상세 수비 상호 배타
                    if (key == 'DEFENSE') {
                      _enabledEvents.removeAll(_defenseDetailKeys);
                    } else if (_defenseDetailKeys.contains(key)) {
                      _enabledEvents.remove('DEFENSE');
                    }
                  } else {
                    _enabledEvents.remove(key);
                  }
                });
              },
              activeThumbColor: AppColors.primary,
              activeTrackColor: AppColors.primary.withAlpha(77),
              inactiveThumbColor: AppColors.iconInactive,
              inactiveTrackColor: AppColors.surfaceHighlight,
            ),
          ),
        ));
        return widgets;
      }).toList(),
    );
  }

  // MVP 가중치에 표시할 항목 목록
  static const _allWeightItems = [
    {'key': 'GOAL', 'label': '득점', 'icon': '⚽', 'alwaysShow': true},
    {'key': 'ASSIST', 'label': '도움', 'icon': '⚡', 'alwaysShow': true},
    {'key': 'SESSION_WIN', 'label': '세션 승리', 'icon': '🏆', 'alwaysShow': true},
    {'key': 'DEFENSE', 'label': '수비', 'icon': '🛡️', 'alwaysShow': false},
    {'key': 'TACKLE', 'label': '태클', 'icon': '🦶', 'alwaysShow': false},
    {'key': 'INTERCEPTION', 'label': '인터셉트', 'icon': '✋', 'alwaysShow': false},
    {'key': 'CLEARANCE', 'label': '클리어런스', 'icon': '🧹', 'alwaysShow': false},
    {'key': 'SAVE', 'label': '선방', 'icon': '🧤', 'alwaysShow': false},
    {'key': 'KEY_PASS', 'label': '키패스', 'icon': '⚡', 'alwaysShow': false},
    {'key': 'DRIBBLE', 'label': '돌파', 'icon': '💨', 'alwaysShow': false},
    {'key': 'SHOT_ON', 'label': '유효슈팅', 'icon': '🎯', 'alwaysShow': false},
    {'key': 'SHOT_OFF', 'label': '무효슈팅', 'icon': '💫', 'alwaysShow': false},
  ];

  Widget _buildMvpWeightsSection() {
    final visible = _allWeightItems.where((item) {
      if (item['alwaysShow'] == true) return true;
      return _enabledEvents.contains(item['key']);
    }).toList();

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surfaceBorder,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.surfaceTint),
      ),
      child: Column(
        children: [
          ...visible.map((item) {
            final key = item['key'] as String;
            final label = item['label'] as String;
            final icon = item['icon'] as String;
            final weight = _mvpWeights[key] ?? 0.0;

            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.surfaceBorder,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.surfaceTint),
              ),
              child: Row(
                children: [
                  Text(icon, style: const TextStyle(fontSize: 18)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.white)),
                  ),
                  SizedBox(
                    width: 70,
                    height: 36,
                    child: TextFormField(
                      initialValue: weight.toString(),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.primary, fontSize: 14, fontWeight: FontWeight.w600),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: AppColors.surfaceBorder,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: BorderSide(color: AppColors.surfaceTint),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: BorderSide(color: AppColors.surfaceTint),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                      ),
                      onChanged: (v) {
                        final parsed = double.tryParse(v);
                        if (parsed != null) {
                          setState(() => _mvpWeights[key] = parsed);
                        }
                      },
                    ),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.primary.withAlpha(13),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline, size: 13, color: AppColors.primary.withAlpha(179)),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    '평점 합계 = 각 기록 x 가중치의 합. 기록 항목이 비활성이면 가중치도 숨겨집니다.',
                    style: TextStyle(fontSize: 11, color: AppColors.primary.withAlpha(179)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPreview() {
    if (_enabledEvents.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surfaceBorder,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.surfaceTint),
        ),
        child: Center(
          child: Text('기록 항목을 하나 이상 선택해주세요', style: TextStyle(color: AppColors.iconInactive, fontSize: 13)),
        ),
      );
    }

    final sorted = _allEventTypes.where((t) => _enabledEvents.contains(t['key'])).toList();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceBorder,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.surfaceTint),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '경기 기록 화면에서 이 버튼들이 표시됩니다:',
            style: TextStyle(fontSize: 12, color: AppColors.textHint),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: sorted.map((type) {
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.bgCard,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.surfaceTint),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(type['icon'] as String, style: const TextStyle(fontSize: 16)),
                    const SizedBox(width: 6),
                    Text(type['label'] as String, style: const TextStyle(fontSize: 13, color: Colors.white, fontWeight: FontWeight.w500)),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}
