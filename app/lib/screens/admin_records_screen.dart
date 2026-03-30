import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../utils/snackbar_helper.dart';

class AdminRecordsScreen extends StatefulWidget {
  const AdminRecordsScreen({super.key});

  @override
  State<AdminRecordsScreen> createState() => _AdminRecordsScreenState();
}

class _AdminRecordsScreenState extends State<AdminRecordsScreen> {
  final ApiService _api = ApiService();

  static const _allEventTypes = [
    {'key': 'GOAL', 'label': '득점', 'icon': '⚽', 'desc': '골을 넣을 때 기록', 'category': 'attack'},
    {'key': 'KEY_PASS', 'label': '키패스', 'icon': '⚡', 'desc': '결정적 패스 기록', 'category': 'attack'},
    {'key': 'DRIBBLE', 'label': '돌파', 'icon': '💨', 'desc': '돌파 성공 시 기록', 'category': 'attack'},
    {'key': 'SHOT_ON', 'label': '유효슈팅', 'icon': '🎯', 'desc': '골대 안 슈팅 기록', 'category': 'attack'},
    {'key': 'SHOT_OFF', 'label': '무효슈팅', 'icon': '💫', 'desc': '골대 밖 슈팅 기록', 'category': 'attack'},
    {'key': 'DEFENSE', 'label': '수비 (간편)', 'icon': '🛡️', 'desc': '간편 수비 기록 (상세와 동시 사용 불가)', 'category': 'defense'},
    {'key': 'TACKLE', 'label': '태클', 'icon': '🦶', 'desc': '태클 성공 시 기록', 'category': 'defense_detail'},
    {'key': 'INTERCEPTION', 'label': '인터셉트', 'icon': '✋', 'desc': '패스 차단 시 기록', 'category': 'defense_detail'},
    {'key': 'CLEARANCE', 'label': '클리어런스', 'icon': '🧹', 'desc': '위험 제거 시 기록', 'category': 'defense_detail'},
    {'key': 'SAVE', 'label': '선방', 'icon': '🧤', 'desc': '골키퍼 선방 기록', 'category': 'gk'},
  ];

  static const _defenseDetailKeys = ['TACKLE', 'INTERCEPTION', 'CLEARANCE'];

  Set<String> _enabledEvents = {'GOAL', 'DEFENSE'};

  Map<String, double> _mvpWeights = {
    'GOAL': 2.0, 'ASSIST': 1.5, 'DEFENSE': 0.5,
    'TACKLE': 0.3, 'INTERCEPTION': 0.3, 'CLEARANCE': 0.3,
    'SAVE': 0.5, 'KEY_PASS': 0.5, 'DRIBBLE': 0.3,
    'SHOT_ON': 0.2, 'SHOT_OFF': 0.1, 'SESSION_WIN': 1.5,
  };

  bool _mvpVoteEnabled = false;
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final token = context.read<AuthService>().token;
    if (token == null) return;
    try {
      final res = await _api.getMyClub(token);
      final club = res['club'] ?? res;
      if (mounted) {
        setState(() {
          final events = club['enabledEvents'];
          if (events is List) {
            _enabledEvents = Set<String>.from(events.map((e) => e.toString()));
          }
          _mvpVoteEnabled = club['mvpVoteEnabled'] == true;
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

    if (!_enabledEvents.contains('GOAL')) {
      showError(context, '득점(GOAL)은 필수 기록 항목입니다.');
      return;
    }

    setState(() => _saving = true);
    try {
      await _api.updateClub({
        'enabledEvents': _enabledEvents.toList(),
        'mvpWeights': _mvpWeights,
        'mvpVoteEnabled': _mvpVoteEnabled,
      }, token);
      if (mounted) {
        showSuccess(context, '기록 설정이 저장되었습니다');
        await context.read<AuthService>().refreshClub();
      }
    } catch (e) {
      if (mounted) showError(context, e.toString());
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
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text('기록 설정', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
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
                  // MVP 투표
                  _buildMvpVoteToggle(),
                  const SizedBox(height: 28),

                  // 미리보기
                  _buildSectionTitle(Icons.preview_rounded, '선택된 기록 미리보기'),
                  const SizedBox(height: 12),
                  _buildPreview(),
                  const SizedBox(height: 28),

                  // 기록 항목
                  _buildSectionTitle(Icons.edit_note_rounded, '기록 항목 설정'),
                  const SizedBox(height: 6),
                  Text('경기 중 어떤 기록을 남길지 선택하세요. 득점은 필수 항목입니다.',
                    style: TextStyle(fontSize: 12, color: AppColors.textHint)),
                  const SizedBox(height: 12),
                  _buildEventTypeSection(),
                  const SizedBox(height: 28),

                  // 평점 가중치
                  _buildSectionTitle(Icons.tune_rounded, '평점 가중치 설정'),
                  const SizedBox(height: 6),
                  Text('평점 계산 시 각 기록 항목별 가중치를 설정합니다. 값이 클수록 해당 기록의 비중이 높아집니다.',
                    style: TextStyle(fontSize: 12, color: AppColors.textHint)),
                  const SizedBox(height: 12),
                  _buildMvpWeightsSection(),
                  const SizedBox(height: 40),
                ],
              ),
            ),
    );
  }

  Widget _buildMvpVoteToggle() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _mvpVoteEnabled ? AppColors.primary.withAlpha(13) : AppColors.surfaceBorder,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _mvpVoteEnabled ? AppColors.primary.withAlpha(51) : AppColors.surfaceTint),
      ),
      child: Row(children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: _mvpVoteEnabled ? AppColors.primary.withAlpha(26) : AppColors.surfaceHighlight,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(Icons.how_to_vote_rounded, size: 20,
            color: _mvpVoteEnabled ? AppColors.primary : AppColors.iconInactive),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('MVP 투표', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
              const SizedBox(height: 3),
              Text(
                _mvpVoteEnabled ? '세션 종료 후 MVP 투표가 진행됩니다' : 'MVP 투표 기능이 비활성화 상태입니다',
                style: TextStyle(fontSize: 12, color: AppColors.textHint),
              ),
            ],
          ),
        ),
        Switch(
          value: _mvpVoteEnabled,
          onChanged: (val) => setState(() => _mvpVoteEnabled = val),
          activeThumbColor: AppColors.primary,
          activeTrackColor: AppColors.primary.withAlpha(77),
          inactiveThumbColor: AppColors.iconInactive,
          inactiveTrackColor: AppColors.surfaceHighlight,
        ),
      ]),
    );
  }

  Widget _buildSectionTitle(IconData icon, String title) {
    return Row(children: [
      Icon(icon, size: 18, color: AppColors.primary),
      const SizedBox(width: 8),
      Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
    ]);
  }

  // ── 미리보기 ──

  Widget _buildPreview() {
    if (_enabledEvents.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surfaceBorder,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.surfaceTint),
        ),
        child: Center(child: Text('기록 항목을 하나 이상 선택해주세요', style: TextStyle(color: AppColors.iconInactive, fontSize: 13))),
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
          Text('경기 기록 화면에서 이 버튼들이 표시됩니다:', style: TextStyle(fontSize: 12, color: AppColors.textHint)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: sorted.map((type) => Container(
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
            )).toList(),
          ),
        ],
      ),
    );
  }

  // ── 기록 항목 ──

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
            border: Border.all(color: enabled ? AppColors.primary.withAlpha(51) : AppColors.surfaceTint),
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            leading: Text(type['icon'] as String, style: const TextStyle(fontSize: 22)),
            title: Row(children: [
              Text(type['label'] as String, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: enabled ? Colors.white : AppColors.textHint)),
              if (isRequired) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: AppColors.primary.withAlpha(26), borderRadius: BorderRadius.circular(6)),
                  child: const Text('필수', style: TextStyle(fontSize: 9, color: AppColors.primary, fontWeight: FontWeight.w700)),
                ),
              ],
            ]),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(type['desc'] as String, style: TextStyle(fontSize: 11, color: AppColors.iconInactive)),
            ),
            trailing: Switch(
              value: enabled,
              onChanged: isRequired ? null : (val) {
                setState(() {
                  if (val) {
                    _enabledEvents.add(key);
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

  // ── MVP 가중치 ──

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
      child: Column(children: [
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
            child: Row(children: [
              Text(icon, style: const TextStyle(fontSize: 18)),
              const SizedBox(width: 10),
              Expanded(child: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.white))),
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
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: AppColors.surfaceTint)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: AppColors.surfaceTint)),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                  ),
                  onChanged: (v) {
                    final parsed = double.tryParse(v);
                    if (parsed != null) setState(() => _mvpWeights[key] = parsed);
                  },
                ),
              ),
            ]),
          );
        }),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: AppColors.primary.withAlpha(13),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(children: [
            Icon(Icons.info_outline, size: 13, color: AppColors.primary.withAlpha(179)),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                '평점 합계 = 각 기록 x 가중치의 합. 기록 항목이 비활성이면 가중치도 숨겨집니다.',
                style: TextStyle(fontSize: 11, color: AppColors.primary.withAlpha(179)),
              ),
            ),
          ]),
        ),
      ]),
    );
  }
}
