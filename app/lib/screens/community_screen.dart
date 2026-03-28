import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import 'community_post_detail_screen.dart';
import 'community_post_form_screen.dart';

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
  late TabController _tabController;
  final _categoryKeys = ['free', 'recruit', 'mercenary', 'match', 'review', 'patchnote'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 6, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: AppColors.bgBase,
        foregroundColor: Colors.white,
        title: const Text('커뮤니티', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          indicatorColor: AppColors.primary,
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: AppColors.textHint,
          labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
          tabs: _categoryKeys.map((k) => Tab(text: categoryLabels[k])).toList(),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: _categoryKeys.map((k) => _CommunityTab(categoryKey: k)).toList(),
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.primary,
        onPressed: () async {
          final cat = _categoryKeys[_tabController.index];
          final result = await Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => CommunityPostFormScreen(category: cat)),
          );
          if (result == true && mounted) {
            setState(() {}); // triggers rebuild → tabs reload
          }
        },
        child: const Icon(Icons.edit, color: Colors.white),
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
