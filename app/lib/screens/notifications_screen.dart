import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<dynamic> _notifications = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final token = context.read<AuthService>().token;
      if (token == null) {
        setState(() => _loading = false);
        return;
      }
      final data = await ApiService().getNotifications(token, limit: 50);
      setState(() {
        _notifications = data['notifications'] ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _markAllRead() async {
    final token = context.read<AuthService>().token;
    if (token == null) return;
    try {
      await ApiService().markAllNotificationsRead(token);
      _load();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: AppColors.bgBase,
        title: const Text('알림', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          if (_notifications.any((n) => n['is_read'] != 1))
            TextButton(
              onPressed: _markAllRead,
              child: const Text('모두 읽음', style: TextStyle(color: AppColors.primary, fontSize: 13)),
            ),
        ],
      ),
      body: !auth.isLoggedIn
          ? const Center(child: Text('로그인이 필요합니다', style: TextStyle(color: Colors.white38)))
          : _loading
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : _notifications.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.notifications_off_outlined, size: 48, color: Colors.white.withAlpha(51)),
                          const SizedBox(height: 12),
                          const Text('알림이 없습니다', style: TextStyle(color: Colors.white38)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      color: AppColors.primary,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _notifications.length,
                        itemBuilder: (ctx, i) {
                          final n = _notifications[i];
                          final isRead = n['is_read'] == 1;
                          final type = n['type'] ?? '';
                          final icon = type.contains('MVP')
                              ? '🏆'
                              : type.contains('GOAL')
                                  ? '⚽'
                                  : type.contains('SESSION')
                                      ? '📅'
                                      : '🔔';

                          return GestureDetector(
                            onTap: () async {
                              if (!isRead) {
                                final token = auth.token;
                                if (token != null) {
                                  await ApiService().markNotificationRead(n['id'], token);
                                  _load();
                                }
                              }
                            },
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: isRead ? AppColors.bgCard : AppColors.bgCard.withAlpha(230),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: isRead ? Colors.white.withAlpha(13) : AppColors.primary.withAlpha(51),
                                ),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(icon, style: const TextStyle(fontSize: 22)),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          n['title'] ?? '알림',
                                          style: TextStyle(
                                            color: isRead ? Colors.white54 : Colors.white,
                                            fontWeight: isRead ? FontWeight.normal : FontWeight.w600,
                                            fontSize: 14,
                                          ),
                                        ),
                                        if (n['body'] != null) ...[
                                          const SizedBox(height: 4),
                                          Text(n['body'], style: const TextStyle(color: Colors.white38, fontSize: 12)),
                                        ],
                                        const SizedBox(height: 6),
                                        Text(
                                          _formatTime(n['created_at']),
                                          style: const TextStyle(color: Colors.white24, fontSize: 11),
                                        ),
                                      ],
                                    ),
                                  ),
                                  if (!isRead)
                                    Container(
                                      width: 8, height: 8,
                                      decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                                    ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }

  String _formatTime(dynamic ts) {
    if (ts == null) return '';
    try {
      if (ts is int) {
        final d = DateTime.fromMillisecondsSinceEpoch(ts * 1000);
        return '${d.month}/${d.day} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
      }
      final d = DateTime.parse(ts.toString());
      return '${d.month}/${d.day} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '';
    }
  }
}
