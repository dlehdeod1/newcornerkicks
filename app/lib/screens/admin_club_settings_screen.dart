import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../utils/snackbar_helper.dart';

class AdminClubSettingsScreen extends StatefulWidget {
  const AdminClubSettingsScreen({super.key});

  @override
  State<AdminClubSettingsScreen> createState() => _AdminClubSettingsScreenState();
}

class _AdminClubSettingsScreenState extends State<AdminClubSettingsScreen> {
  final ApiService _api = ApiService();

  late TextEditingController _nameCtrl;
  late TextEditingController _descCtrl;
  int _seasonStartMonth = 1;
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController();
    _descCtrl = TextEditingController();
    _loadSettings();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
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
          _seasonStartMonth = (club['seasonStartMonth'] as int?) ?? 1;
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
        'name': _nameCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
        'seasonStartMonth': _seasonStartMonth,
      }, token);

      if (mounted) {
        showSuccess(context, '설정이 저장되었습니다');
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
        title: const Text('클럽 정보', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
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

                  _buildSectionTitle(Icons.calendar_month_rounded, '시즌 설정'),
                  const SizedBox(height: 6),
                  Text('시즌이 시작되는 달을 설정합니다. 랭킹/통계가 이 기준으로 집계됩니다.',
                    style: TextStyle(fontSize: 12, color: AppColors.textHint)),
                  const SizedBox(height: 12),
                  _buildSeasonSection(),
                  const SizedBox(height: 40),
                ],
              ),
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
          _buildTextField(controller: _nameCtrl, label: '클럽 이름', hint: '예: 코너킥스 FC', icon: Icons.group_rounded),
          const SizedBox(height: 14),
          _buildTextField(controller: _descCtrl, label: '클럽 소개', hint: '클럽을 간단히 소개해주세요', icon: Icons.notes_rounded, maxLines: 3),
        ],
      ),
    );
  }

  Widget _buildTextField({required TextEditingController controller, required String label, required String hint, required IconData icon, int maxLines = 1}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          Icon(icon, size: 14, color: AppColors.textHint),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
        ]),
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
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.surfaceTint)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.surfaceTint)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
        ),
      ],
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
          Row(children: [
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
                  items: List.generate(12, (i) => DropdownMenuItem(value: i + 1, child: Text(_monthLabels[i]))),
                  onChanged: (v) { if (v != null) setState(() => _seasonStartMonth = v); },
                ),
              ),
            ),
          ]),
          if (_seasonStartMonth != 1) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.amber.withAlpha(15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.amber.withAlpha(40)),
              ),
              child: Row(children: [
                const Icon(Icons.info_outline, size: 14, color: Colors.amber),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '2025 시즌 = ${_seasonStartMonth}월 2025 ~ ${_seasonStartMonth == 1 ? 12 : _seasonStartMonth - 1}월 ${_seasonStartMonth == 1 ? 2025 : 2026}',
                    style: const TextStyle(color: Colors.amber, fontSize: 11),
                  ),
                ),
              ]),
            ),
          ],
        ],
      ),
    );
  }
}
