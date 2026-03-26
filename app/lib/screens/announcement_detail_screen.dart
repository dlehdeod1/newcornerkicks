import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_colors.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../config/api_config.dart';
import 'announcement_form_screen.dart';

class AnnouncementDetailScreen extends StatefulWidget {
  final int announcementId;
  const AnnouncementDetailScreen({super.key, required this.announcementId});

  @override
  State<AnnouncementDetailScreen> createState() => _AnnouncementDetailScreenState();
}

class _AnnouncementDetailScreenState extends State<AnnouncementDetailScreen> {
  final ApiService _api = ApiService();
  Map<String, dynamic>? _announcement;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final token = context.read<AuthService>().token;
    if (token == null) return;
    try {
      final res = await _api.getAnnouncement(widget.announcementId, token);
      if (mounted) setState(() { _announcement = res['data']; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _formatDate(dynamic ts) {
    if (ts == null) return '';
    final dt = DateTime.fromMillisecondsSinceEpoch((ts as int) * 1000);
    return '${dt.year}/${dt.month}/${dt.day} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgCard,
        title: const Text('공지 삭제', style: TextStyle(color: Colors.white)),
        content: const Text('이 공지를 삭제하시겠습니까?', style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('취소')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('삭제', style: TextStyle(color: AppColors.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final token = context.read<AuthService>().token;
    if (token == null) return;
    try {
      await _api.deleteAnnouncement(widget.announcementId, token);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('삭제 실패: $e'), backgroundColor: AppColors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = context.watch<AuthService>().isAdmin;

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        title: const Text('공지사항', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: AppColors.bgBase,
        surfaceTintColor: Colors.transparent,
        actions: [
          if (isAdmin && _announcement != null)
            PopupMenuButton<String>(
              color: AppColors.bgCard,
              icon: const Icon(Icons.more_vert, color: Colors.white),
              onSelected: (val) async {
                if (val == 'edit') {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => AnnouncementFormScreen(existing: _announcement)),
                  );
                  _load();
                } else if (val == 'delete') {
                  _delete();
                }
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'edit', child: Text('수정', style: TextStyle(color: Colors.white))),
                const PopupMenuItem(value: 'delete', child: Text('삭제', style: TextStyle(color: AppColors.red))),
              ],
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _announcement == null
              ? Center(child: Text('공지를 불러올 수 없습니다', style: TextStyle(color: AppColors.textHint)))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: _buildContent(),
                ),
    );
  }

  Widget _buildContent() {
    final a = _announcement!;
    final isPinned = a['is_pinned'] == 1 || a['is_pinned'] == true;
    final isSystem = a['club_id'] == null;
    final imageUrl = a['image_url'] as String?;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Badges
        Row(
          children: [
            _typeBadge(isSystem),
            if (isPinned) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.amber.withAlpha(26),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.amber.withAlpha(64)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.push_pin, size: 11, color: AppColors.amber),
                    const SizedBox(width: 4),
                    Text('고정', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.amber)),
                  ],
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 16),
        // Title
        Text(
          a['title'] ?? '',
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        const SizedBox(height: 10),
        // Author + date
        Row(
          children: [
            Icon(Icons.person_outline, size: 14, color: AppColors.textHint),
            const SizedBox(width: 4),
            Text(a['author_name'] ?? '', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
            const SizedBox(width: 16),
            Icon(Icons.access_time, size: 14, color: AppColors.textHint),
            const SizedBox(width: 4),
            Text(_formatDate(a['created_at']), style: TextStyle(fontSize: 13, color: AppColors.textHint)),
          ],
        ),
        const SizedBox(height: 24),
        Divider(color: AppColors.surfaceTint),
        const SizedBox(height: 24),
        // Image
        if (imageUrl != null && imageUrl.isNotEmpty) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Image.network(
              '${ApiConfig.baseUrl}$imageUrl',
              width: double.infinity,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const SizedBox.shrink(),
            ),
          ),
          const SizedBox(height: 24),
        ],
        // Content
        Text(
          a['content'] ?? '',
          style: TextStyle(fontSize: 15, color: AppColors.textSecondary, height: 1.6),
        ),
        const SizedBox(height: 40),
      ],
    );
  }

  Widget _typeBadge(bool isSystem) {
    final color = isSystem ? AppColors.blue : AppColors.primary;
    final label = isSystem ? '시스템' : '클럽';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withAlpha(26),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withAlpha(64)),
      ),
      child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color)),
    );
  }
}
