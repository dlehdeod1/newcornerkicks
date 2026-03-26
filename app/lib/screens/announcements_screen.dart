import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import 'announcement_detail_screen.dart';
import 'announcement_form_screen.dart';

class AnnouncementsScreen extends StatefulWidget {
  final bool isAdmin;
  const AnnouncementsScreen({super.key, this.isAdmin = false});

  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  final ApiService _api = ApiService();
  List<dynamic> _announcements = [];
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
      final res = await _api.getAnnouncements(token, limit: 50);
      final list = (res['data'] as List?) ?? [];
      // Sort: pinned first, then by created_at descending
      list.sort((a, b) {
        final aPin = a['is_pinned'] == 1 || a['is_pinned'] == true ? 1 : 0;
        final bPin = b['is_pinned'] == 1 || b['is_pinned'] == true ? 1 : 0;
        if (aPin != bPin) return bPin - aPin;
        return ((b['created_at'] ?? 0) as int).compareTo((a['created_at'] ?? 0) as int);
      });
      if (mounted) setState(() { _announcements = list; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _formatDate(dynamic ts) {
    if (ts == null) return '';
    final dt = DateTime.fromMillisecondsSinceEpoch((ts as int) * 1000);
    return '${dt.month}/${dt.day} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final showAdmin = widget.isAdmin || context.watch<AuthService>().isAdmin;

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        title: const Text('공지사항', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: AppColors.bgBase,
        surfaceTintColor: Colors.transparent,
      ),
      floatingActionButton: showAdmin
          ? FloatingActionButton(
              backgroundColor: AppColors.primary,
              child: const Icon(Icons.add, color: Colors.white),
              onPressed: () async {
                await Navigator.push(context, MaterialPageRoute(builder: (_) => const AnnouncementFormScreen()));
                _load();
              },
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () async {
          setState(() => _loading = true);
          await _load();
        },
        color: AppColors.primary,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
            : _announcements.isEmpty
                ? ListView(
                    children: [
                      SizedBox(
                        height: MediaQuery.of(context).size.height * 0.6,
                        child: Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.campaign_outlined, size: 48, color: AppColors.iconInactive),
                              const SizedBox(height: 12),
                              Text('공지가 없습니다', style: TextStyle(color: AppColors.textHint, fontSize: 15)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _announcements.length,
                    itemBuilder: (context, index) => _buildItem(_announcements[index]),
                  ),
      ),
    );
  }

  Widget _buildItem(Map<String, dynamic> item) {
    final isPinned = item['is_pinned'] == 1 || item['is_pinned'] == true;
    final isRead = item['is_read'] == 1 || item['is_read'] == true;
    final isSystem = item['club_id'] == null;
    final title = item['title'] ?? '';
    final authorName = item['author_name'] ?? '';

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        onTap: () async {
          await Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => AnnouncementDetailScreen(announcementId: item['id'] as int)),
          );
          _load();
        },
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surfaceBorder,
            borderRadius: BorderRadius.circular(AppTheme.radiusXl),
          border: Border.all(
            color: isRead ? AppColors.surfaceBorder : AppColors.primary.withAlpha(80),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (isPinned) ...[
                  Icon(Icons.push_pin, size: 14, color: AppColors.amber),
                  const SizedBox(width: 6),
                ],
                _typeBadge(isSystem),
                const Spacer(),
                Text(_formatDate(item['created_at']), style: TextStyle(fontSize: 11, color: AppColors.iconInactive)),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              title,
              style: TextStyle(
                fontSize: 15,
                fontWeight: isRead ? FontWeight.w400 : FontWeight.w700,
                color: isRead ? AppColors.textSecondary : Colors.white,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 6),
            Text(
              authorName,
              style: TextStyle(fontSize: 12, color: AppColors.iconInactive),
            ),
          ],
        ),
      ),
      ),
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
