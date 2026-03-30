import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import 'community_post_detail_screen.dart';
import 'community_post_form_screen.dart';
import 'post_detail_screen.dart';

const categoryLabels = {'free': '자유', 'recruit': '팀 모집', 'mercenary': '용병 모집', 'match': '매칭', 'review': '경기 후기', 'patchnote': '패치노트'};
const categoryColors = {'free': AppColors.primary, 'recruit': AppColors.amber, 'mercenary': Color(0xFFF43F5E), 'match': AppColors.blue, 'review': AppColors.purple, 'patchnote': Color(0xFF64748B)};
const regionOptions = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
const dayLabels = {'mon': '월', 'tue': '화', 'wed': '수', 'thu': '목', 'fri': '금', 'sat': '토', 'sun': '일'};
const timeSlotLabels = {'morning': '오전', 'afternoon': '오후', 'evening': '저녁', 'night': '심야'};
const skillLabels = {'beginner': '입문', 'low': '초급', 'mid': '중급', 'high': '상급'};

class CommunityScreen extends StatefulWidget {
  const CommunityScreen({super.key});

  @override
  State<CommunityScreen> createState() => _CommunityScreenState();
}

class _CommunityScreenState extends State<CommunityScreen> with TickerProviderStateMixin {
  late TabController _globalTabController;
  late TabController _clubTabController;
  final _globalCategoryKeys = ['free', 'recruit', 'mercenary', 'match', 'review', 'patchnote'];
  final _clubCategoryKeys = ['free', 'review', 'schedule'];
  final _clubCategoryLabels = {'free': '자유', 'review': '경기 후기', 'schedule': '일정 논의'};
  bool _isGlobal = true; // true=전체 커뮤니티, false=클럽 게시판

  @override
  void initState() {
    super.initState();
    _globalTabController = TabController(length: 6, vsync: this);
    _clubTabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _globalTabController.dispose();
    _clubTabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final hasClub = auth.hasClub;
    final clubName = auth.activeClub?['name'] ?? '클럽';

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: AppColors.bgBase,
        foregroundColor: Colors.white,
        title: const Text('커뮤니티', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(80),
          child: Column(
            children: [
              // 전역/클럽 토글
              if (hasClub)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  child: Row(
                    children: [
                      _modeChip('전체', _isGlobal, () => setState(() => _isGlobal = true)),
                      const SizedBox(width: 8),
                      _modeChip(clubName, !_isGlobal, () => setState(() => _isGlobal = false)),
                    ],
                  ),
                ),
              // 카테고리 탭
              TabBar(
                controller: _isGlobal ? _globalTabController : _clubTabController,
                isScrollable: true,
                indicatorColor: AppColors.primary,
                indicatorWeight: 3,
                labelColor: Colors.white,
                unselectedLabelColor: AppColors.textHint,
                labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                tabs: _isGlobal
                    ? _globalCategoryKeys.map((k) => Tab(text: categoryLabels[k])).toList()
                    : _clubCategoryKeys.map((k) => Tab(text: _clubCategoryLabels[k])).toList(),
              ),
            ],
          ),
        ),
      ),
      body: _isGlobal
          ? TabBarView(
              controller: _globalTabController,
              children: _globalCategoryKeys.map((k) => _CommunityTab(categoryKey: k)).toList(),
            )
          : TabBarView(
              controller: _clubTabController,
              children: _clubCategoryKeys.map((k) => _ClubBoardTab(categoryKey: k)).toList(),
            ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.primary,
        onPressed: () async {
          if (_isGlobal) {
            final cat = _globalCategoryKeys[_globalTabController.index];
            final result = await Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => CommunityPostFormScreen(category: cat)),
            );
            if (result == true && mounted) setState(() {});
          } else {
            final cat = _clubCategoryKeys[_clubTabController.index];
            final result = await Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => _ClubPostFormScreen(category: cat)),
            );
            if (result == true && mounted) setState(() {});
          }
        },
        child: const Icon(Icons.edit, color: Colors.white),
      ),
    );
  }

  Widget _modeChip(String label, bool active, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: active ? AppColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: active ? AppColors.primary : AppColors.surfaceTint),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? Colors.white : AppColors.textHint,
            fontSize: 13,
            fontWeight: active ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
      ),
    );
  }
}

class _CommunityTab extends StatefulWidget {
  final String categoryKey;
  const _CommunityTab({required this.categoryKey});

  @override
  State<_CommunityTab> createState() => _CommunityTabState();
}

class _CommunityTabState extends State<_CommunityTab> with AutomaticKeepAliveClientMixin {
  final ApiService _api = ApiService();
  List<dynamic> _posts = [];
  bool _loading = true;

  // Filters (recruit/match/mercenary only)
  String? _selectedRegion;
  String? _selectedDay;
  bool _openOnly = false;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _loadPosts();
  }

  Future<void> _loadPosts() async {
    setState(() => _loading = true);
    final auth = context.read<AuthService>();
    final token = auth.token;
    if (token == null) return;

    try {
      final hasFilters = widget.categoryKey == 'recruit' || widget.categoryKey == 'match' || widget.categoryKey == 'mercenary';
      final res = await _api.getCommunityPosts(
        token,
        category: widget.categoryKey,
        region: hasFilters ? _selectedRegion : null,
        dayOfWeek: hasFilters ? _selectedDay : null,
        status: hasFilters && _openOnly ? 'open' : null,
      );
      _posts = (res['data'] as List?) ?? [];
    } catch (e) {
      _posts = [];
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final hasFilters = widget.categoryKey == 'recruit' || widget.categoryKey == 'match' || widget.categoryKey == 'mercenary';

    return RefreshIndicator(
      onRefresh: _loadPosts,
      color: AppColors.primary,
      child: Column(
        children: [
          if (hasFilters) _buildFilterBar(),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2))
                : _posts.isEmpty
                    ? ListView(
                        children: [
                          SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                          Center(
                            child: Column(
                              children: [
                                Icon(Icons.article_outlined, size: 48, color: AppColors.iconInactive),
                                const SizedBox(height: 12),
                                Text('게시글이 없습니다', style: TextStyle(color: AppColors.textHint, fontSize: 14)),
                              ],
                            ),
                          ),
                        ],
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _posts.length,
                        itemBuilder: (ctx, i) => _buildPostCard(_posts[i]),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: AppColors.bgBase,
      child: Column(
        children: [
          Row(
            children: [
              // Region dropdown
              Expanded(
                child: Container(
                  height: 36,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceBorder,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.surfaceTint),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedRegion,
                      hint: Text('지역', style: TextStyle(fontSize: 13, color: AppColors.textHint)),
                      dropdownColor: AppColors.bgCard,
                      isExpanded: true,
                      style: const TextStyle(fontSize: 13, color: Colors.white),
                      icon: Icon(Icons.keyboard_arrow_down, size: 18, color: AppColors.textHint),
                      items: [
                        DropdownMenuItem<String>(value: null, child: Text('전체', style: TextStyle(fontSize: 13, color: AppColors.textSecondary))),
                        ...regionOptions.map((r) => DropdownMenuItem(value: r, child: Text(r))),
                      ],
                      onChanged: (v) {
                        setState(() => _selectedRegion = v);
                        _loadPosts();
                      },
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              // Open only toggle
              Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: () {
                    setState(() => _openOnly = !_openOnly);
                    _loadPosts();
                  },
                  child: Container(
                    height: 36,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: _openOnly ? AppColors.primary.withAlpha(26) : AppColors.surfaceBorder,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: _openOnly ? AppColors.primary.withAlpha(80) : AppColors.surfaceTint),
                    ),
                    child: Center(
                      child: Text(
                        '모집중',
                        style: TextStyle(
                          fontSize: 13,
                          color: _openOnly ? AppColors.primary : AppColors.textHint,
                          fontWeight: _openOnly ? FontWeight.w600 : FontWeight.normal,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Day of week chips
          SizedBox(
            height: 32,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: dayLabels.entries.map((e) {
                final selected = _selectedDay == e.key;
                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                      onTap: () {
                        setState(() => _selectedDay = selected ? null : e.key);
                        _loadPosts();
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                        decoration: BoxDecoration(
                          color: selected ? AppColors.primary.withAlpha(26) : AppColors.surfaceBorder,
                          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                          border: Border.all(color: selected ? AppColors.primary.withAlpha(80) : AppColors.surfaceTint),
                        ),
                        child: Text(
                          e.value,
                          style: TextStyle(
                            fontSize: 12,
                            color: selected ? AppColors.primary : AppColors.textHint,
                            fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPostCard(Map<String, dynamic> post) {
    final cat = post['category'] as String? ?? 'free';
    final catColor = categoryColors[cat] ?? AppColors.primary;
    final title = post['title'] as String? ?? '';
    final authorName = post['author_name'] as String? ?? '익명';
    final clubName = post['club_name'] as String?;
    final commentCount = post['comment_count'] ?? 0;
    final createdAt = post['created_at'];
    final status = post['status'] as String?;
    final region = post['region'] as String?;
    final dayOfWeek = post['day_of_week'] as String?;
    final skillLevel = post['skill_level'] as String?;
    final headcount = post['headcount'];
    final isRecruit = cat == 'recruit' || cat == 'match' || cat == 'mercenary';

    String dateStr = '';
    if (createdAt != null) {
      try {
        final dt = createdAt is int
            ? DateTime.fromMillisecondsSinceEpoch(createdAt * 1000)
            : DateTime.parse(createdAt.toString());
        dateStr = '${dt.month}/${dt.day}';
      } catch (_) {}
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () async {
          final result = await Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => CommunityPostDetailScreen(postId: post['id'] as int)),
          );
          if (result == true) _loadPosts();
        },
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surfaceBorder,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.surfaceBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Title row
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (commentCount > 0) ...[
                    const SizedBox(width: 8),
                    Row(
                      children: [
                        Icon(Icons.chat_bubble_outline, size: 13, color: AppColors.textHint),
                        const SizedBox(width: 3),
                        Text('$commentCount', style: TextStyle(fontSize: 12, color: AppColors.textHint)),
                      ],
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 8),
              // Author / club / date
              Row(
                children: [
                  Text(authorName, style: TextStyle(fontSize: 12, color: AppColors.textHint)),
                  if (clubName != null && clubName.isNotEmpty) ...[
                    Text(' · ', style: TextStyle(fontSize: 12, color: AppColors.iconInactive)),
                    Text(clubName, style: TextStyle(fontSize: 12, color: catColor.withAlpha(179))),
                  ],
                  Text(' · ', style: TextStyle(fontSize: 12, color: AppColors.iconInactive)),
                  Text(dateStr, style: TextStyle(fontSize: 12, color: AppColors.iconInactive)),
                ],
              ),
              // Recruit/match/mercenary metadata chips
              if (isRecruit) ...[
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    if (region != null) _chip(region, catColor),
                    if (dayOfWeek != null) _chip(dayLabels[dayOfWeek] ?? dayOfWeek, catColor),
                    if (skillLevel != null) _chip(skillLabels[skillLevel] ?? skillLevel, catColor),
                    if (headcount != null) _chip('$headcount명 모집', catColor),
                    if (status != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: status == 'open' ? AppColors.primary.withAlpha(20) : AppColors.slate.withAlpha(20),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          status == 'open' ? '모집중' : '마감',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: status == 'open' ? AppColors.primary : AppColors.slate,
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _chip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withAlpha(15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withAlpha(40)),
      ),
      child: Text(label, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w500)),
    );
  }
}

// ── 클럽 게시판 탭 ──────────────────────────────────────────────

class _ClubBoardTab extends StatefulWidget {
  final String categoryKey;
  const _ClubBoardTab({required this.categoryKey});
  @override
  State<_ClubBoardTab> createState() => _ClubBoardTabState();
}

class _ClubBoardTabState extends State<_ClubBoardTab> {
  List<dynamic> _posts = [];
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
      if (token == null) return;
      final res = await ApiService().getPosts(token, category: widget.categoryKey, limit: 30);
      final posts = (res['posts'] ?? res['data'] ?? []) as List;
      if (mounted) setState(() { _posts = posts; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2));
    }
    if (_posts.isEmpty) {
      return Center(child: Text('게시글이 없습니다', style: TextStyle(color: AppColors.textHint)));
    }
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _posts.length,
        separatorBuilder: (_, __) => Divider(color: AppColors.surfaceTint, height: 1),
        itemBuilder: (ctx, i) {
          final p = _posts[i];
          final title = p['title'] ?? '';
          final author = p['author_name'] ?? '익명';
          final date = p['created_at'] != null
              ? DateTime.fromMillisecondsSinceEpoch((p['created_at'] as num).toInt() * 1000)
              : null;
          final commentCount = (p['comment_count'] as num?)?.toInt() ?? 0;

          return ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w500), maxLines: 1, overflow: TextOverflow.ellipsis),
            subtitle: Row(
              children: [
                Text(author, style: TextStyle(color: AppColors.textHint, fontSize: 12)),
                if (date != null) ...[
                  const SizedBox(width: 8),
                  Text('${date.month}/${date.day}', style: TextStyle(color: AppColors.textHint, fontSize: 12)),
                ],
              ],
            ),
            trailing: commentCount > 0
                ? Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.chat_bubble_outline, size: 13, color: AppColors.textHint),
                      const SizedBox(width: 3),
                      Text('$commentCount', style: TextStyle(fontSize: 12, color: AppColors.textHint)),
                    ],
                  )
                : null,
            onTap: () async {
              final postId = p['id'] as int?;
              if (postId == null) return;
              await Navigator.push(context, MaterialPageRoute(builder: (_) => PostDetailScreen(postId: postId)));
              _load();
            },
          );
        },
      ),
    );
  }
}

// ── 클럽 게시글 작성 (간단 폼) ──────────────────────────────────

class _ClubPostFormScreen extends StatefulWidget {
  final String category;
  const _ClubPostFormScreen({required this.category});
  @override
  State<_ClubPostFormScreen> createState() => _ClubPostFormScreenState();
}

class _ClubPostFormScreenState extends State<_ClubPostFormScreen> {
  final _titleCtrl = TextEditingController();
  final _contentCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _contentCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_titleCtrl.text.trim().isEmpty || _contentCtrl.text.trim().isEmpty) return;
    setState(() => _submitting = true);
    try {
      final token = context.read<AuthService>().token;
      if (token == null) return;
      await ApiService().createPost({
        'title': _titleCtrl.text.trim(),
        'content': _contentCtrl.text.trim(),
        'category': widget.category,
      }, token);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: AppColors.bgBase,
        foregroundColor: Colors.white,
        title: const Text('글 작성', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          TextButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
                : const Text('등록', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            TextField(
              controller: _titleCtrl,
              style: const TextStyle(color: Colors.white, fontSize: 16),
              decoration: InputDecoration(
                hintText: '제목',
                hintStyle: TextStyle(color: AppColors.textHint),
                border: InputBorder.none,
              ),
            ),
            Divider(color: AppColors.surfaceTint),
            Expanded(
              child: TextField(
                controller: _contentCtrl,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                maxLines: null,
                expands: true,
                decoration: InputDecoration(
                  hintText: '내용을 입력하세요',
                  hintStyle: TextStyle(color: AppColors.textHint),
                  border: InputBorder.none,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
