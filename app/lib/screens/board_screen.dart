import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../widgets/skeleton.dart';
import '../widgets/empty_state.dart';
import 'announcement_detail_screen.dart';
import 'post_detail_screen.dart';
import 'post_form_screen.dart';

class BoardScreen extends StatefulWidget {
  final String? initialCategory;
  const BoardScreen({super.key, this.initialCategory});

  @override
  State<BoardScreen> createState() => _BoardScreenState();
}

class _BoardScreenState extends State<BoardScreen> with TickerProviderStateMixin {
  late TabController _tabController;
  final ApiService _api = ApiService();

  // Tab data
  static const _tabs = ['notice', 'free', 'review', 'schedule'];
  static const _tabLabels = ['공지', '자유', '경기 후기', '일정 논의'];
  static const _categoryLabels = {
    'free': '자유',
    'review': '경기 후기',
    'schedule': '일정 논의',
  };
  static const _categoryColors = {
    'free': AppColors.primary,
    'review': AppColors.amber,
    'schedule': AppColors.blue,
  };

  // Per-tab state
  final Map<String, List<dynamic>> _data = {};
  final Map<String, bool> _loading = {};

  @override
  void initState() {
    super.initState();
    int initialIndex = 0;
    if (widget.initialCategory != null) {
      final idx = _tabs.indexOf(widget.initialCategory!);
      if (idx >= 0) initialIndex = idx;
    }
    _tabController = TabController(length: _tabs.length, vsync: this, initialIndex: initialIndex);
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) {
        _loadTab(_tabs[_tabController.index]);
      }
    });
    _loadTab(_tabs[initialIndex]);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadTab(String tab) async {
    if (_loading[tab] == true) return;
    setState(() => _loading[tab] = true);

    final token = context.read<AuthService>().token;
    if (token == null) {
      setState(() => _loading[tab] = false);
      return;
    }

    try {
      if (tab == 'notice') {
        final res = await _api.getAnnouncements(token, limit: 50);
        final list = (res['data'] as List?) ?? [];
        list.sort((a, b) {
          final aPin = a['is_pinned'] == 1 || a['is_pinned'] == true ? 1 : 0;
          final bPin = b['is_pinned'] == 1 || b['is_pinned'] == true ? 1 : 0;
          if (aPin != bPin) return bPin - aPin;
          return ((b['created_at'] ?? 0) as int).compareTo((a['created_at'] ?? 0) as int);
        });
        if (mounted) setState(() { _data[tab] = list; _loading[tab] = false; });
      } else {
        final res = await _api.getPosts(token, category: tab, limit: 50);
        final list = (res['data'] as List?) ?? [];
        list.sort((a, b) {
          final aPin = a['is_pinned'] == 1 || a['is_pinned'] == true ? 1 : 0;
          final bPin = b['is_pinned'] == 1 || b['is_pinned'] == true ? 1 : 0;
          if (aPin != bPin) return bPin - aPin;
          return ((b['created_at'] ?? 0) as int).compareTo((a['created_at'] ?? 0) as int);
        });
        if (mounted) setState(() { _data[tab] = list; _loading[tab] = false; });
      }
    } catch (_) {
      if (mounted) setState(() { _data[tab] = []; _loading[tab] = false; });
    }
  }

  String _formatDate(dynamic ts) {
    if (ts == null) return '';
    final dt = DateTime.fromMillisecondsSinceEpoch((ts as int) * 1000);
    return '${dt.month}/${dt.day} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final currentTab = _tabs[_tabController.index];

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        title: const Text('게시판', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: AppColors.bgBase,
        foregroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor: Colors.white54,
          labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
          tabs: _tabLabels.map((l) => Tab(text: l)).toList(),
        ),
      ),
      floatingActionButton: currentTab != 'notice'
          ? FloatingActionButton(
              backgroundColor: AppColors.primary,
              child: const Icon(Icons.edit, color: Colors.white),
              onPressed: () async {
                await Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => PostFormScreen(category: currentTab)),
                );
                _loadTab(currentTab);
              },
            )
          : null,
      body: TabBarView(
        controller: _tabController,
        children: _tabs.map((tab) => _buildTabContent(tab)).toList(),
      ),
    );
  }

  Widget _buildTabContent(String tab) {
    final loading = _loading[tab] == true;
    final items = _data[tab] ?? [];

    return RefreshIndicator(
      onRefresh: () => _loadTab(tab),
      color: AppColors.primary,
      child: loading
          ? ListView(
              padding: const EdgeInsets.all(16),
              children: List.generate(6, (_) => Padding(
                padding: const EdgeInsets.only(bottom: AppTheme.space12),
                child: Container(
                  padding: const EdgeInsets.all(AppTheme.space16),
                  decoration: BoxDecoration(
                    color: AppColors.bgCard,
                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                    border: Border.all(color: AppColors.surfaceTint),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SkeletonBox(height: 15, width: 200),
                      const SizedBox(height: AppTheme.space8),
                      SkeletonBox(height: 12, width: 140),
                      const SizedBox(height: AppTheme.space8),
                      SkeletonBox(height: 12),
                    ],
                  ),
                ),
              )),
            )
          : items.isEmpty
              ? ListView(
                  children: [
                    SizedBox(
                      height: MediaQuery.of(context).size.height * 0.5,
                      child: EmptyState(
                        icon: tab == 'notice' ? Icons.campaign_outlined : Icons.article_outlined,
                        title: tab == 'notice' ? '공지가 없습니다' : '게시글이 없습니다',
                        subtitle: tab != 'notice' ? '첫 번째 글을 작성해보세요!' : null,
                        actionLabel: tab != 'notice' ? '글쓰기' : null,
                        onAction: tab != 'notice' ? () {
                          Navigator.push(context, MaterialPageRoute(
                            builder: (_) => PostFormScreen(category: tab),
                          )).then((_) => _loadTab(tab));
                        } : null,
                      ),
                    ),
                  ],
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: items.length,
                  itemBuilder: (context, index) {
                    if (tab == 'notice') {
                      return _buildNoticeItem(items[index]);
                    }
                    return _buildPostItem(items[index]);
                  },
                ),
    );
  }

  Widget _buildNoticeItem(Map<String, dynamic> item) {
    final isPinned = item['is_pinned'] == 1 || item['is_pinned'] == true;
    final isRead = item['is_read'] == 1 || item['is_read'] == true;
    final title = item['title'] ?? '';
    final authorName = item['author_name'] ?? '';

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        onTap: () async {
          await Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => AnnouncementDetailScreen(announcementId: item['id'] as int)),
          );
          _loadTab('notice');
        },
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surfaceBorder,
            borderRadius: BorderRadius.circular(AppTheme.radiusLg),
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
                  const Icon(Icons.push_pin, size: 14, color: AppColors.amber),
                  const SizedBox(width: 6),
                ],
                _categoryBadge('공지', AppColors.red),
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
            Text(authorName, style: TextStyle(fontSize: 12, color: AppColors.iconInactive)),
          ],
        ),
      ),
      ),
    );
  }

  Widget _buildPostItem(Map<String, dynamic> item) {
    final isPinned = item['is_pinned'] == 1 || item['is_pinned'] == true;
    final title = item['title'] ?? '';
    final authorName = item['author_name'] ?? '';
    final commentCount = item['comment_count'] ?? 0;
    final category = item['category'] ?? 'free';
    final hasImage = item['image_url'] != null && (item['image_url'] as String).isNotEmpty;
    final catLabel = _categoryLabels[category] ?? category;
    final catColor = _categoryColors[category] ?? AppColors.primary;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        onTap: () async {
          await Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => PostDetailScreen(postId: item['id'] as int)),
          );
          _loadTab(category);
        },
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surfaceBorder,
            borderRadius: BorderRadius.circular(AppTheme.radiusLg),
            border: Border.all(color: AppColors.surfaceBorder),
          ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (isPinned) ...[
                  const Icon(Icons.push_pin, size: 14, color: AppColors.amber),
                  const SizedBox(width: 6),
                ],
                _categoryBadge(catLabel, catColor),
                const Spacer(),
                if (hasImage) ...[
                  Icon(Icons.image_outlined, size: 14, color: AppColors.iconInactive),
                  const SizedBox(width: 8),
                ],
                if ((commentCount as int) > 0) ...[
                  Icon(Icons.chat_bubble_outline, size: 13, color: AppColors.iconInactive),
                  const SizedBox(width: 3),
                  Text('$commentCount', style: TextStyle(fontSize: 12, color: AppColors.textHint)),
                  const SizedBox(width: 8),
                ],
                Text(_formatDate(item['created_at']), style: TextStyle(fontSize: 11, color: AppColors.iconInactive)),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              title,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 6),
            Text(authorName, style: TextStyle(fontSize: 12, color: AppColors.iconInactive)),
          ],
        ),
      ),
      ),
    );
  }

  Widget _categoryBadge(String label, Color color) {
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
