import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_colors.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../utils/snackbar_helper.dart';

class AdminExemptionsScreen extends StatefulWidget {
  const AdminExemptionsScreen({super.key});

  @override
  State<AdminExemptionsScreen> createState() => _AdminExemptionsScreenState();
}

class _AdminExemptionsScreenState extends State<AdminExemptionsScreen> {
  final ApiService _api = ApiService();
  List<dynamic> _members = [];
  bool _loading = true;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final token = context.read<AuthService>().token;
    if (token == null) return;
    try {
      final res = await _api.getExemptions(token);
      if (mounted) {
        setState(() {
          _members = (res['members'] as List?) ?? [];
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        showError(context, '로드 실패: $e');
      }
    }
  }

  Future<void> _toggleExemption(dynamic member, String field, bool current) async {
    final token = context.read<AuthService>().token;
    if (token == null) return;
    try {
      await _api.updateExemption(
        member['user_id'].toString(),
        {field: !current},
        token,
      );
      await _load();
    } catch (e) {
      if (mounted) {
        showError(context, '변경 실패: $e');
      }
    }
  }

  Future<void> _editReason(dynamic member) async {
    final ctrl = TextEditingController(text: member['exempt_reason'] ?? '');
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgCard,
        title: const Text('면제 사유', style: TextStyle(color: Colors.white, fontSize: 16)),
        content: TextField(
          controller: ctrl,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            hintText: '면제 사유를 입력하세요 (선택)',
            hintStyle: TextStyle(color: AppColors.iconInactive),
            filled: true,
            fillColor: AppColors.bgBase,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('취소', style: TextStyle(color: Colors.white54)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, ctrl.text),
            child: const Text('저장', style: TextStyle(color: AppColors.primary)),
          ),
        ],
      ),
    );
    if (result == null || !mounted) return;
    final token = context.read<AuthService>().token;
    if (token == null) return;
    try {
      await _api.updateExemption(
        member['user_id'].toString(),
        {'exemptReason': result.trim().isEmpty ? null : result.trim()},
        token,
      );
      await _load();
    } catch (e) {
      if (mounted) {
        showError(context, '저장 실패: $e');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final exemptCount = _members.where((m) =>
      m['session_fee_exempt'] == 1 || m['membership_fee_exempt'] == 1
    ).length;

    final filtered = _search.isEmpty
        ? _members
        : _members.where((m) {
            final q = _search.toLowerCase();
            final name = (m['player_name'] ?? m['username'] ?? '').toString().toLowerCase();
            return name.contains(q);
          }).toList();

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: AppColors.bgCard,
        foregroundColor: Colors.white,
        title: const Text('회비 면제 관리', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primary,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // 통계
                  Row(
                    children: [
                      Expanded(child: _statCard('전체 멤버', '${_members.length}명', AppColors.bgCard)),
                      const SizedBox(width: 12),
                      Expanded(child: _statCard('면제 중', '$exemptCount명', AppColors.violet)),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // 검색
                  TextField(
                    onChanged: (v) => setState(() => _search = v),
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                    decoration: InputDecoration(
                      hintText: '이름 검색...',
                      hintStyle: TextStyle(color: AppColors.iconInactive),
                      prefixIcon: Icon(Icons.search, color: AppColors.iconInactive, size: 20),
                      filled: true,
                      fillColor: AppColors.bgCard,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // 멤버 목록
                  if (filtered.isEmpty)
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: Text('멤버가 없습니다', style: TextStyle(color: AppColors.textHint)),
                      ),
                    )
                  else
                    ...filtered.map((m) => _memberCard(m)),
                ],
              ),
            ),
    );
  }

  Widget _statCard(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withAlpha(color == AppColors.bgCard ? 255 : 30),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withAlpha(color == AppColors.bgCard ? 40 : 60)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color == AppColors.bgCard ? Colors.white : color)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(fontSize: 12, color: color == AppColors.bgCard ? Colors.white54 : color.withAlpha(180))),
        ],
      ),
    );
  }

  Widget _memberCard(dynamic member) {
    final name = member['player_name'] ?? member['username'] ?? '?';
    final username = member['username'] ?? '';
    final role = member['role'] ?? 'member';
    final sessionExempt = member['session_fee_exempt'] == 1;
    final membershipExempt = member['membership_fee_exempt'] == 1;
    final hasExempt = sessionExempt || membershipExempt;
    final reason = member['exempt_reason'];

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: hasExempt ? AppColors.violet.withAlpha(60) : AppColors.surfaceTint),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 이름 행
          Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: hasExempt ? AppColors.violet.withAlpha(40) : AppColors.surfaceTint,
                child: Text(
                  name.toString().isNotEmpty ? name.toString()[0] : '?',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: hasExempt ? AppColors.violet : Colors.white70,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name.toString(), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
                    Text(
                      '@$username · ${role == 'owner' ? '오너' : role == 'admin' ? '관리자' : '멤버'}',
                      style: TextStyle(fontSize: 11, color: AppColors.textHint),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // 토글 행
          Row(
            children: [
              Expanded(
                child: _toggleChip(
                  label: '참가비 면제',
                  active: sessionExempt,
                  onTap: () => _toggleExemption(member, 'sessionFeeExempt', sessionExempt),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _toggleChip(
                  label: '월회비 면제',
                  active: membershipExempt,
                  onTap: () => _toggleExemption(member, 'membershipFeeExempt', membershipExempt),
                ),
              ),
            ],
          ),

          // 면제 사유
          if (hasExempt) ...[
            const SizedBox(height: 8),
            GestureDetector(
              onTap: () => _editReason(member),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.surfaceBorder,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.surfaceBorder),
                ),
                child: Text(
                  reason != null && reason.toString().isNotEmpty
                      ? '사유: $reason'
                      : '면제 사유 추가...',
                  style: TextStyle(
                    fontSize: 12,
                    color: reason != null && reason.toString().isNotEmpty
                        ? AppColors.violet
                        : AppColors.iconInactive,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _toggleChip({required String label, required bool active, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: active ? AppColors.violet.withAlpha(25) : AppColors.surfaceBorder,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: active ? AppColors.violet.withAlpha(80) : AppColors.surfaceTint,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              active ? Icons.check_circle : Icons.circle_outlined,
              size: 16,
              color: active ? AppColors.violet : AppColors.iconInactive,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: active ? AppColors.violet : AppColors.textHint,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
