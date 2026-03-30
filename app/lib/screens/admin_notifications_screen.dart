import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../utils/snackbar_helper.dart';

class AdminNotificationsScreen extends StatefulWidget {
  const AdminNotificationsScreen({super.key});

  @override
  State<AdminNotificationsScreen> createState() => _AdminNotificationsScreenState();
}

class _AdminNotificationsScreenState extends State<AdminNotificationsScreen> {
  final ApiService _api = ApiService();
  final _titleCtrl = TextEditingController();
  final _messageCtrl = TextEditingController();

  String _type = 'announcement';
  bool _sending = false;

  static const _types = [
    {'value': 'announcement', 'label': '공지사항', 'icon': Icons.campaign, 'color': AppColors.red},
    {'value': 'session_created', 'label': '새 세션', 'icon': Icons.calendar_month, 'color': AppColors.blue},
    {'value': 'settlement', 'label': '정산 알림', 'icon': Icons.emoji_events, 'color': AppColors.primary},
  ];

  static const _templates = [
    {'type': 'announcement', 'title': '공지사항', 'message': '새로운 공지가 있습니다. 확인해주세요!'},
    {'type': 'session_created', 'title': '새 세션 오픈!', 'message': '다음 주 풋살 세션이 열렸습니다. 참가 신청해주세요!'},
    {'type': 'settlement', 'title': '정산 완료', 'message': '이번 세션 정산이 완료되었습니다. 확인하세요!'},
  ];

  @override
  void dispose() {
    _titleCtrl.dispose();
    _messageCtrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_titleCtrl.text.trim().isEmpty || _messageCtrl.text.trim().isEmpty) {
      showError(context, '제목과 내용을 입력하세요');
      return;
    }
    final token = context.read<AuthService>().token;
    if (token == null) return;

    setState(() => _sending = true);
    try {
      await _api.broadcastNotification(
        type: _type,
        title: _titleCtrl.text.trim(),
        message: _messageCtrl.text.trim(),
        token: token,
      );
      if (mounted) {
        showSuccess(context, '알림이 발송되었습니다');
        _titleCtrl.clear();
        _messageCtrl.clear();
      }
    } catch (e) {
      if (mounted) showError(context, '발송 실패: $e');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _applyTemplate(Map<String, String> t) {
    setState(() {
      _type = t['type']!;
      _titleCtrl.text = t['title']!;
      _messageCtrl.text = t['message']!;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: AppColors.bgBase,
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text('알림 발송', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('모든 클럽 회원에게 알림을 발송합니다', style: TextStyle(fontSize: 13, color: AppColors.textHint)),
            const SizedBox(height: 20),

            // 빠른 템플릿
            Text('빠른 템플릿', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _templates.map((t) => GestureDetector(
                onTap: () => _applyTemplate(t.cast<String, String>()),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceBorder,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.surfaceTint),
                  ),
                  child: Text(t['title'] as String, style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                ),
              )).toList(),
            ),
            const SizedBox(height: 24),

            // 알림 유형
            Text('알림 유형', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
            const SizedBox(height: 8),
            Row(
              children: _types.map((t) {
                final selected = _type == t['value'];
                final color = t['color'] as Color;
                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _type = t['value'] as String),
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        color: selected ? color.withAlpha(20) : AppColors.surfaceBorder,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: selected ? color.withAlpha(100) : AppColors.surfaceTint, width: selected ? 1.5 : 1),
                      ),
                      child: Column(children: [
                        Icon(t['icon'] as IconData, size: 22, color: selected ? color : AppColors.iconInactive),
                        const SizedBox(height: 6),
                        Text(t['label'] as String, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: selected ? color : AppColors.textHint)),
                      ]),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),

            // 제목
            Text('알림 제목 *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
            const SizedBox(height: 8),
            TextField(
              controller: _titleCtrl,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: _inputDecoration('알림 제목을 입력하세요'),
            ),
            const SizedBox(height: 20),

            // 내용
            Text('알림 내용 *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
            const SizedBox(height: 8),
            TextField(
              controller: _messageCtrl,
              maxLines: 4,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: _inputDecoration('알림 내용을 입력하세요'),
            ),
            const SizedBox(height: 24),

            // 미리보기
            if (_titleCtrl.text.isNotEmpty || _messageCtrl.text.isNotEmpty) ...[
              Text('미리보기', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surfaceBorder,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.surfaceTint),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('📢', style: TextStyle(fontSize: 22)),
                    const SizedBox(width: 12),
                    Expanded(child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_titleCtrl.text.isEmpty ? '제목' : _titleCtrl.text,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14)),
                        const SizedBox(height: 4),
                        Text(_messageCtrl.text.isEmpty ? '내용' : _messageCtrl.text,
                          style: TextStyle(color: AppColors.textHint, fontSize: 12)),
                      ],
                    )),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],

            // 발송 버튼
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _sending ? null : _send,
                icon: _sending
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Icon(Icons.send, size: 18),
                label: const Text('전체 발송', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.amber,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  disabledBackgroundColor: AppColors.amber.withAlpha(100),
                ),
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(color: AppColors.iconInactive, fontSize: 13),
      filled: true,
      fillColor: AppColors.surfaceBorder,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.surfaceTint)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.surfaceTint)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    );
  }
}
