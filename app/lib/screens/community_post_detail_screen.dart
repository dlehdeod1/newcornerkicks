import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_colors.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../config/api_config.dart';
import 'community_post_form_screen.dart';

const _categoryLabels = {'free': '자유', 'recruit': '팀 모집', 'mercenary': '용병 모집', 'match': '매칭', 'review': '경기 후기', 'patchnote': '패치노트'};
const _categoryColors = {'free': AppColors.primary, 'recruit': AppColors.amber, 'mercenary': const Color(0xFFF43F5E), 'match': AppColors.blue, 'review': AppColors.purple, 'patchnote': const Color(0xFF64748B)};
const _dayLabels = {'mon': '월', 'tue': '화', 'wed': '수', 'thu': '목', 'fri': '금', 'sat': '토', 'sun': '일'};
const _timeSlotLabels = {'morning': '오전', 'afternoon': '오후', 'evening': '저녁', 'night': '심야'};
const _skillLabels = {'beginner': '입문', 'low': '초급', 'mid': '중급', 'high': '상급'};

class CommunityPostDetailScreen extends StatefulWidget {
  final int postId;
  const CommunityPostDetailScreen({super.key, required this.postId});

  @override
  State<CommunityPostDetailScreen> createState() => _CommunityPostDetailScreenState();
}

class _CommunityPostDetailScreenState extends State<CommunityPostDetailScreen> {
  final ApiService _api = ApiService();
  final TextEditingController _commentCtrl = TextEditingController();
  Map<String, dynamic>? _post;
  List<dynamic> _comments = [];
  bool _loading = true;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _loadPost();
  }

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadPost() async {
    final auth = context.read<AuthService>();
    final token = auth.token;
    if (token == null) return;

    try {
      final res = await _api.getCommunityPost(widget.postId, token);
      final data = res['data'] ?? res;
      _post = data is Map<String, dynamic> ? data : null;
      _comments = (_post?['comments'] as List?) ?? [];
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('로딩 실패: $e')));
      }
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _sendComment() async {
    final text = _commentCtrl.text.trim();
    if (text.isEmpty) return;
    final auth = context.read<AuthService>();
    final token = auth.token;
    if (token == null) return;

    setState(() => _sending = true);
    try {
      await _api.addCommunityComment(widget.postId, text, token);
      _commentCtrl.clear();
      FocusScope.of(context).unfocus();
      await _loadPost();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('댓글 작성 실패: $e')));
      }
    }
    if (mounted) setState(() => _sending = false);
  }

  Future<void> _deleteComment(int commentId) async {
    final auth = context.read<AuthService>();
    final token = auth.token;
    if (token == null) return;

    try {
      await _api.deleteCommunityComment(widget.postId, commentId, token);
      await _loadPost();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('삭제 실패: $e')));
      }
    }
  }

  Future<void> _deletePost() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgCard,
        title: const Text('삭제', style: TextStyle(color: Colors.white)),
        content: const Text('이 게시글을 삭제하시겠습니까?', style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('취소', style: TextStyle(color: AppColors.textHint))),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('삭제', style: TextStyle(color: AppColors.red))),
        ],
      ),
    );
    if (confirmed != true) return;

    final auth = context.read<AuthService>();
    final token = auth.token;
    if (token == null) return;

    try {
      await _api.deleteCommunityPost(widget.postId, token);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('삭제 실패: $e')));
      }
    }
  }

  Future<void> _toggleStatus() async {
    if (_post == null) return;
    final auth = context.read<AuthService>();
    final token = auth.token;
    if (token == null) return;

    final currentStatus = _post!['status'] as String?;
    final newStatus = currentStatus == 'open' ? 'closed' : 'open';

    try {
      await _api.updateCommunityPost(widget.postId, {'status': newStatus}, token);
      await _loadPost();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('상태 변경 실패: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final myUserId = auth.user?['id'];

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: AppColors.bgBase,
        title: const Text('게시글', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
        actions: [
          if (_post != null && _post!['author_id'] == myUserId)
            PopupMenuButton<String>(
              color: AppColors.bgCard,
              onSelected: (v) async {
                if (v == 'edit') {
                  final result = await Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => CommunityPostFormScreen(category: _post!['category'], existing: _post)),
                  );
                  if (result == true) _loadPost();
                } else if (v == 'delete') {
                  _deletePost();
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
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2))
          : _post == null
              ? Center(child: Text('게시글을 찾을 수 없습니다', style: TextStyle(color: AppColors.textHint)))
              : Column(
                  children: [
                    Expanded(
                      child: RefreshIndicator(
                        onRefresh: _loadPost,
                        color: AppColors.primary,
                        child: SingleChildScrollView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildHeader(),
                              const SizedBox(height: 16),
                              _buildContent(),
                              if (_isRecruitOrMatch) ...[
                                const SizedBox(height: 16),
                                _buildMetadata(),
                              ],
                              const SizedBox(height: 24),
                              _buildComments(),
                            ],
                          ),
                        ),
                      ),
                    ),
                    _buildCommentInput(),
                  ],
                ),
    );
  }

  bool get _isRecruitOrMatch {
    final cat = _post?['category'] as String?;
    return cat == 'recruit' || cat == 'match' || cat == 'mercenary';
  }

  Widget _buildHeader() {
    final cat = _post!['category'] as String? ?? 'free';
    final catColor = _categoryColors[cat] ?? AppColors.primary;
    final catLabel = _categoryLabels[cat] ?? cat;
    final authorName = _post!['author_name'] as String? ?? '익명';
    final clubName = _post!['club_name'] as String?;
    final createdAt = _post!['created_at'];
    final auth = context.read<AuthService>();
    final isAuthor = _post!['author_id'] == auth.user?['id'];

    String dateStr = '';
    if (createdAt != null) {
      try {
        final dt = createdAt is int
            ? DateTime.fromMillisecondsSinceEpoch(createdAt * 1000)
            : DateTime.parse(createdAt.toString());
        dateStr = '${dt.year}.${dt.month.toString().padLeft(2, '0')}.${dt.day.toString().padLeft(2, '0')} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
      } catch (_) {}
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: catColor.withAlpha(20),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(catLabel, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: catColor)),
            ),
            if (_isRecruitOrMatch && _post!['status'] != null) ...[
              const SizedBox(width: 8),
              GestureDetector(
                onTap: isAuthor ? _toggleStatus : null,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _post!['status'] == 'open' ? AppColors.primary.withAlpha(20) : AppColors.slate.withAlpha(20),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _post!['status'] == 'open' ? '모집중' : '마감',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: _post!['status'] == 'open' ? AppColors.primary : AppColors.slate,
                        ),
                      ),
                      if (isAuthor) ...[
                        const SizedBox(width: 4),
                        Icon(Icons.swap_horiz, size: 12, color: _post!['status'] == 'open' ? AppColors.primary : AppColors.slate),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 12),
        Text(
          _post!['title'] as String? ?? '',
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Text(authorName, style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
            if (clubName != null && clubName.isNotEmpty) ...[
              Text(' · ', style: TextStyle(fontSize: 13, color: AppColors.iconInactive)),
              Text(clubName, style: TextStyle(fontSize: 13, color: catColor.withAlpha(179))),
            ],
            Text(' · ', style: TextStyle(fontSize: 13, color: AppColors.iconInactive)),
            Text(dateStr, style: TextStyle(fontSize: 12, color: AppColors.textHint)),
          ],
        ),
      ],
    );
  }

  Widget _buildContent() {
    final content = _post!['content'] as String? ?? '';
    final imageUrl = _post!['image_url'] as String?;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (imageUrl != null && imageUrl.isNotEmpty) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.network(
              '${ApiConfig.baseUrl}$imageUrl',
              width: double.infinity,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const SizedBox.shrink(),
            ),
          ),
          const SizedBox(height: 16),
        ],
        Text(
          content,
          style: TextStyle(fontSize: 15, color: AppColors.textSecondary, height: 1.6),
        ),
      ],
    );
  }

  Widget _buildMetadata() {
    final cat = _post!['category'] as String? ?? 'free';
    final catColor = _categoryColors[cat] ?? AppColors.primary;
    final region = _post!['region'] as String?;
    final dayOfWeek = _post!['day_of_week'] as String?;
    final timeSlot = _post!['time_slot'] as String?;
    final skillLevel = _post!['skill_level'] as String?;
    final headcount = _post!['headcount'];

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceBorder,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.surfaceBorder),
      ),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          if (region != null) _infoChip(Icons.location_on_outlined, region, catColor),
          if (dayOfWeek != null) _infoChip(Icons.calendar_today_outlined, _dayLabels[dayOfWeek] ?? dayOfWeek, catColor),
          if (timeSlot != null) _infoChip(Icons.access_time, _timeSlotLabels[timeSlot] ?? timeSlot, catColor),
          if (skillLevel != null) _infoChip(Icons.fitness_center, _skillLabels[skillLevel] ?? skillLevel, catColor),
          if (headcount != null) _infoChip(Icons.people_outline, '$headcount명 모집', catColor),
        ],
      ),
    );
  }

  Widget _infoChip(IconData icon, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withAlpha(15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withAlpha(40)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 5),
          Text(label, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Widget _buildComments() {
    final auth = context.read<AuthService>();
    final myUserId = auth.user?['id'];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.chat_bubble_outline, size: 16, color: AppColors.textSecondary),
            const SizedBox(width: 6),
            Text('댓글 ${_comments.length}', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
          ],
        ),
        const SizedBox(height: 12),
        if (_comments.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Center(child: Text('첫 댓글을 작성해보세요', style: TextStyle(fontSize: 13, color: AppColors.iconInactive))),
          )
        else
          ..._comments.map((c) {
            final cAuthor = c['author_name'] as String? ?? '익명';
            final cContent = c['content'] as String? ?? '';
            final cId = c['id'] as int?;
            final cAuthorId = c['author_id'];
            final cCreatedAt = c['created_at'];
            final isMine = cAuthorId == myUserId;

            String cDate = '';
            if (cCreatedAt != null) {
              try {
                final dt = cCreatedAt is int
                    ? DateTime.fromMillisecondsSinceEpoch(cCreatedAt * 1000)
                    : DateTime.parse(cCreatedAt.toString());
                cDate = '${dt.month}/${dt.day} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
              } catch (_) {}
            }

            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surfaceBorder,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.surfaceBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(cAuthor, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                      const SizedBox(width: 8),
                      Text(cDate, style: TextStyle(fontSize: 11, color: AppColors.iconInactive)),
                      const Spacer(),
                      if (isMine && cId != null)
                        GestureDetector(
                          onTap: () => _deleteComment(cId),
                          child: Icon(Icons.close, size: 14, color: AppColors.iconInactive),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(cContent, style: TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.4)),
                ],
              ),
            );
          }),
      ],
    );
  }

  Widget _buildCommentInput() {
    return Container(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 12,
        bottom: MediaQuery.of(context).padding.bottom + 12,
      ),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        border: Border(top: BorderSide(color: AppColors.surfaceBorder)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _commentCtrl,
              style: const TextStyle(fontSize: 14, color: Colors.white),
              decoration: InputDecoration(
                hintText: '댓글을 입력하세요...',
                hintStyle: TextStyle(fontSize: 14, color: AppColors.iconInactive),
                filled: true,
                fillColor: AppColors.surfaceBorder,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => _sendComment(),
            ),
          ),
          const SizedBox(width: 10),
          GestureDetector(
            onTap: _sending ? null : _sendComment,
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(12),
              ),
              child: _sending
                  ? const Padding(
                      padding: EdgeInsets.all(10),
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : const Icon(Icons.send, color: Colors.white, size: 18),
            ),
          ),
        ],
      ),
    );
  }
}
