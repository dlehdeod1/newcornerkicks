import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../utils/snackbar_helper.dart';

class AdminFeesScreen extends StatefulWidget {
  const AdminFeesScreen({super.key});

  @override
  State<AdminFeesScreen> createState() => _AdminFeesScreenState();
}

class _AdminFeesScreenState extends State<AdminFeesScreen> {
  final ApiService _api = ApiService();

  int _baseAmount = 0;
  bool _splitEnabled = false;
  int _splitTotal = 0;
  int _splitRoundUp = 100;
  bool _rankDiffEnabled = false;
  int _rankDiffAmount = 500;

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
          final fc = club['feeConfig'];
          if (fc is Map) {
            _baseAmount = (fc['baseAmount'] as num?)?.toInt() ?? 0;
            _splitEnabled = fc['splitEnabled'] == true;
            _splitTotal = (fc['splitTotal'] as num?)?.toInt() ?? 0;
            _splitRoundUp = (fc['splitRoundUp'] as num?)?.toInt() ?? 100;
            _rankDiffEnabled = fc['rankDiffEnabled'] == true;
            _rankDiffAmount = (fc['rankDiffAmount'] as num?)?.toInt() ?? 500;
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

    setState(() => _saving = true);
    try {
      await _api.updateClub({
        'feeConfig': {
          'baseAmount': _baseAmount,
          'splitEnabled': _splitEnabled,
          'splitTotal': _splitTotal,
          'splitRoundUp': _splitRoundUp,
          'rankDiffEnabled': _rankDiffEnabled,
          'rankDiffAmount': _rankDiffAmount,
        },
      }, token);
      if (mounted) {
        showSuccess(context, '참가비 설정이 저장되었습니다');
        await context.read<AuthService>().refreshClub();
      }
    } catch (e) {
      if (mounted) showError(context, e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String _formatNumber(int n) {
    return n.toString().replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: AppColors.bgBase,
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text('참가비 설정', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
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
                  Text('세션 참가비 규칙을 설정합니다. 총액 분할과 순위별 차등을 조합할 수 있습니다.',
                    style: TextStyle(fontSize: 12, color: AppColors.textHint)),
                  const SizedBox(height: 16),
                  _buildFeeConfigSection(),
                  const SizedBox(height: 40),
                ],
              ),
            ),
    );
  }

  InputDecoration _numInputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(color: AppColors.iconInactive, fontSize: 13),
      filled: true,
      fillColor: AppColors.surfaceBorder,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: AppColors.surfaceTint)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: AppColors.surfaceTint)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    );
  }

  Widget _buildFeeConfigSection() {
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
          // 기본 참가비
          Row(children: [
            const Icon(Icons.payments, size: 14, color: AppColors.textHint),
            const SizedBox(width: 6),
            Text('기본 참가비', style: TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            SizedBox(
              width: 140,
              child: TextField(
                keyboardType: TextInputType.number,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                controller: TextEditingController(text: _baseAmount.toString())
                  ..selection = TextSelection.collapsed(offset: _baseAmount.toString().length),
                onChanged: (v) => _baseAmount = int.tryParse(v) ?? 0,
                decoration: _numInputDecoration('0'),
              ),
            ),
            const SizedBox(width: 8),
            Text('원', style: TextStyle(fontSize: 13, color: AppColors.textHint)),
          ]),
          const SizedBox(height: 4),
          Text('토글을 둘 다 끄면 이 금액이 모든 참가자에게 동일 적용됩니다',
            style: TextStyle(fontSize: 11, color: AppColors.iconInactive)),

          const SizedBox(height: 20),

          // 총액 분할
          _buildToggleCard(
            title: '총액 분할',
            value: _splitEnabled,
            onChanged: (v) => setState(() => _splitEnabled = v),
            helpText: '구장비 등 총 금액을 참가 인원으로 나눕니다.\n예: 총 18만원 / 15명 = 12,000원',
            children: _splitEnabled ? [
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('총액', style: TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 6),
                    Row(children: [
                      Expanded(child: TextField(
                        keyboardType: TextInputType.number,
                        style: const TextStyle(color: Colors.white, fontSize: 14),
                        controller: TextEditingController(text: _splitTotal.toString())
                          ..selection = TextSelection.collapsed(offset: _splitTotal.toString().length),
                        onChanged: (v) => _splitTotal = int.tryParse(v) ?? 0,
                        decoration: _numInputDecoration('0'),
                      )),
                      const SizedBox(width: 4),
                      Text('원', style: TextStyle(fontSize: 11, color: AppColors.textHint)),
                    ]),
                  ],
                )),
                const SizedBox(width: 16),
                Expanded(child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('올림 단위', style: TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceBorder,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.surfaceTint),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<int>(
                          value: _splitRoundUp,
                          dropdownColor: AppColors.bgCard,
                          style: const TextStyle(color: Colors.white, fontSize: 14),
                          isExpanded: true,
                          isDense: false,
                          items: const [
                            DropdownMenuItem(value: 10, child: Text('10원')),
                            DropdownMenuItem(value: 100, child: Text('100원')),
                            DropdownMenuItem(value: 500, child: Text('500원')),
                            DropdownMenuItem(value: 1000, child: Text('1,000원')),
                          ],
                          onChanged: (v) { if (v != null) setState(() => _splitRoundUp = v); },
                        ),
                      ),
                    ),
                  ],
                )),
              ]),
            ] : [],
          ),

          const SizedBox(height: 12),

          // 순위별 차등
          _buildToggleCard(
            title: '순위별 차등',
            value: _rankDiffEnabled,
            onChanged: (v) => setState(() => _rankDiffEnabled = v),
            helpText: _splitEnabled
                ? '총액 분할 금액을 기준으로 순위에 따라 차등 적용됩니다.\n예: 기본 12,000원 / 차등 500원 → 1위 11,500원, 3위 12,500원'
                : '기본 참가비를 기준으로 순위에 따라 차등 적용됩니다.\n예: 기본 ${_formatNumber(_baseAmount)}원 / 차등 500원 → 1위 ${_formatNumber(_baseAmount - 500)}원, 3위 ${_formatNumber(_baseAmount + 500)}원',
            children: _rankDiffEnabled ? [
              const SizedBox(height: 12),
              Row(children: [
                Text('순위당 차등 금액', style: TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
              ]),
              const SizedBox(height: 6),
              Row(children: [
                SizedBox(
                  width: 140,
                  child: TextField(
                    keyboardType: TextInputType.number,
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                    controller: TextEditingController(text: _rankDiffAmount.toString())
                      ..selection = TextSelection.collapsed(offset: _rankDiffAmount.toString().length),
                    onChanged: (v) => _rankDiffAmount = int.tryParse(v) ?? 0,
                    decoration: _numInputDecoration('500'),
                  ),
                ),
                const SizedBox(width: 8),
                Text('원', style: TextStyle(fontSize: 13, color: AppColors.textHint)),
              ]),
            ] : [],
          ),

          // 조합 설명
          if (_splitEnabled && _rankDiffEnabled) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.amber.withAlpha(15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.amber.withAlpha(40)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.info_outline, size: 14, color: Colors.amber),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      '총액 분할 + 순위별 차등: 총액을 인원수로 나눈 금액을 기준으로 순위별 차등이 적용됩니다.',
                      style: TextStyle(color: Colors.amber, fontSize: 11),
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

  Widget _buildToggleCard({
    required String title,
    required bool value,
    required ValueChanged<bool> onChanged,
    required String helpText,
    required List<Widget> children,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceBorder,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: value ? AppColors.primary.withAlpha(51) : AppColors.surfaceTint),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
              Switch(
                value: value,
                onChanged: onChanged,
                activeThumbColor: AppColors.primary,
                activeTrackColor: AppColors.primary.withAlpha(77),
                inactiveThumbColor: AppColors.iconInactive,
                inactiveTrackColor: AppColors.surfaceHighlight,
              ),
            ],
          ),
          if (value) ...[
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.blue.withAlpha(15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.help_outline, size: 14, color: AppColors.blue),
                  const SizedBox(width: 8),
                  Expanded(child: Text(helpText, style: TextStyle(fontSize: 11, color: AppColors.blue))),
                ],
              ),
            ),
          ],
          ...children,
        ],
      ),
    );
  }
}
