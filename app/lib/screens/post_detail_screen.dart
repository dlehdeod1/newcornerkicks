import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_colors.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../config/api_config.dart';
import '../utils/snackbar_helper.dart';
import 'post_form_screen.dart';

class PostDetailScreen extends StatefulWidget {
  final int postId;
  const PostDetailScreen({super.key, required this.postId});

  @override
  State<PostDetailScreen> createState() => _PostDetailScreenState();
}

class _PostDetailScreenState extends State<PostDetailScreen> {
  final ApiService _api = ApiService();
  final TextEditingController _commentCtrl = TextEditingController();
  Map<String, dynamic>? _post;
  List<dynamic> _comments = [];
  bool _loading = true;
  bool _sending = false;

  // Reactions
  static const _reactionEmojis = ['\uD83D\uDC4D', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83D\uDD25', '\uD83D\uDC4F', '\uD83D\uDE22'];
  Map<String, int> _reactionCounts = {};
  Set<String> _myReactions = {};

  static const _categoryLabels = {
    'free': '\uC790\uC720',
    'review': '\uACBD\uAE30 \uD6C4\uAE30',
    'schedule': '\uC77C\uC815 \uB17C\uC758',
  };
  static const _categoryColors = {
    'free': AppColors.primary,
    'review': AppColors.amber,
    'schedule': AppColors.blue,
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final token = context.read<AuthService>().token;
    if (token == null) return;
    try {
      final res = await _api.getPost(widget.postId, token);
      final data = res['data'] ?? res;
      if (mounted) {
        setState(() {
          _post = data;
          _comments = (data['comments'] as List?) ?? [];
          // Parse reactions
          final reactions = (data['reactions'] as List?) ?? [];
          _reactionCounts = {};
          _myReactions = {};
          final myUserId = context.read<AuthService>().user?['id'];
          for (final r in reactions) {
            final emoji = r['emoji'] as String? ?? '';
            _reactionCounts[emoji] = (_reactionCounts[emoji] ?? 0) + 1;
            if (r['user_id'] == myUserId) {
              _myReactions.add(emoji);
            }
          }
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleReaction(String emoji) async {
    final token = context.read<AuthService>().token;
    if (token == null) return;
    try {
      if (_myReactions.contains(emoji)) {
        await _api.removeReaction(widget.postId, emoji, token);
        setState(() {
          _myReactions.remove(emoji);
          _reactionCounts[emoji] = (_reactionCounts[emoji] ?? 1) - 1;
          if ((_reactionCounts[emoji] ?? 0) <= 0) _reactionCounts.remove(emoji);
        });
      } else {
        await _api.addReaction(widget.postId, emoji, token);
        setState(() {
          _myReactions.add(emoji);
          _reactionCounts[emoji] = (_reactionCounts[emoji] ?? 0) + 1;
        });
      }
    } catch (e) {
      if (mounted) showError(context, '\uBC18\uC751 \uCC98\uB9AC \uC2E4\uD328');
    }
  }

  Future<void> _submitComment() async {
    final text = _commentCtrl.text.trim();
    if (text.isEmpty) return;
    final token = context.read<AuthService>().token;
    if (token == null) return;

    setState(() => _sending = true);
    try {
      await _api.addComment(widget.postId, text, token);
      _commentCtrl.clear();
      await _load();
    } catch (e) {
      if (mounted) {
        showError(context, '\uB313\uAE00 \uC791\uC131 \uC2E4\uD328: $e');
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _deletePost() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgCard,
        title: const Text('\uAC8C\uC2DC\uAE00 \uC0AD\uC81C', style: TextStyle(color: Colors.white)),
        content: const Text('\uC815\uB9D0 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?', style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('\uCDE8\uC18C')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('\uC0AD\uC81C', style: TextStyle(color: AppColors.red)),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    final token = context.read<AuthService>().token;
    if (token == null) return;
    try {
      await _api.deletePost(widget.postId, token);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        showError(context, '\uC0AD\uC81C \uC2E4\uD328: $e');
      }
    }
  }

  Future<void> _deleteComment(int commentId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgCard,
        title: const Text('\uB313\uAE00 \uC0AD\uC81C', style: TextStyle(color: Colors.white)),
        content: const Text('\uB313\uAE00\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?', style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('\uCDE8\uC18C')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('\uC0AD\uC81C', style: TextStyle(color: AppColors.red)),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    final token = context.read<AuthService>().token;
    if (token == null) return;
    try {
      await _api.deleteComment(widget.postId, commentId, token);
      await _load();
    } catch (e) {
      if (mounted) {
        showError(context, '\uC0AD\uC81C \uC2E4\uD328: $e');
      }
    }
  }

  Future<void> _editComment(Map<String, dynamic> comment) async {
    final ctrl = TextEditingController(text: comment['content'] ?? '');
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgCard,
        title: const Text('\uB313\uAE00 \uC218\uC815', style: TextStyle(color: Colors.white)),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          maxLines: 4,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            filled: true,
            fillColor: AppColors.surfaceBorder,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: AppColors.surfaceTint),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: AppColors.surfaceTint),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.primary),
            ),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('\uCDE8\uC18C')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
            child: const Text('\uC218\uC815', style: TextStyle(color: AppColors.primary)),
          ),
        ],
      ),
    );

    if (result == null || result.isEmpty) return;
    final token = context.read<AuthService>().token;
    if (token == null) return;
    try {
      await _api.editComment(widget.postId, comment['id'] as int, result, token);
      await _load();
      if (mounted) showSuccess(context, '\uB313\uAE00\uC774 \uC218\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4');
    } catch (e) {
      if (mounted) showError(context, '\uC218\uC815 \uC2E4\uD328: $e');
    }
  }

  String _formatDate(dynamic ts) {
    if (ts == null) return '';
    final dt = DateTime.fromMillisecondsSinceEpoch((ts as int) * 1000);
    final month = dt.month;
    final day = dt.day;
    final hour = dt.hour.toString().padLeft(2, '0');
    final minute = dt.minute.toString().padLeft(2, '0');
    return '$month/$day $hour:$minute';
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final myUserId = auth.user?['id'];
    final isAdmin = auth.isAdmin;

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        title: const Text('\uAC8C\uC2DC\uAE00', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: AppColors.bgBase,
        surfaceTintColor: Colors.transparent,
        actions: _post != null && (_post!['user_id'] == myUserId || isAdmin)
            ? [
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_vert, color: Colors.white70),
                  color: AppColors.bgCard,
                  onSelected: (val) async {
                    if (val == 'edit') {
                      await Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => PostFormScreen(
                          category: _post!['category'],
                          existing: _post,
                        )),
                      );
                      _load();
                    } else if (val == 'delete') {
                      _deletePost();
                    }
                  },
                  itemBuilder: (_) => [
                    const PopupMenuItem(value: 'edit', child: Text('\uC218\uC815', style: TextStyle(color: Colors.white))),
                    const PopupMenuItem(value: 'delete', child: Text('\uC0AD\uC81C', style: TextStyle(color: AppColors.red))),
                  ],
                ),
              ]
            : null,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _post == null
              ? Center(child: Text('\uAC8C\uC2DC\uAE00\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4', style: TextStyle(color: AppColors.textHint)))
              : Column(
                  children: [
                    Expanded(
                      child: RefreshIndicator(
                        onRefresh: _load,
                        color: AppColors.primary,
                        child: SingleChildScrollView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildPostHeader(),
                              const SizedBox(height: 16),
                              _buildPostContent(),
                              const SizedBox(height: 16),
                              _buildReactionBar(),
                              const SizedBox(height: 24),
                              _buildCommentsSection(myUserId),
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

  Widget _buildPostHeader() {
    final post = _post!;
    final category = post['category'] ?? 'free';
    final catLabel = _categoryLabels[category] ?? category;
    final catColor = _categoryColors[category] ?? AppColors.primary;
    final isPinned = post['is_pinned'] == 1 || post['is_pinned'] == true;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            if (isPinned) ...[
              const Icon(Icons.push_pin, size: 14, color: AppColors.amber),
              const SizedBox(width: 6),
            ],
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: catColor.withAlpha(26),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: catColor.withAlpha(64)),
              ),
              child: Text(catLabel, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: catColor)),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          post['title'] ?? '',
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: AppColors.primary.withAlpha(40),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Center(
                child: Text(
                  (post['author_name'] ?? '?').toString().isNotEmpty ? (post['author_name'] ?? '?')[0] : '?',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(post['author_name'] ?? '', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
            const SizedBox(width: 12),
            Text(_formatDate(post['created_at']), style: TextStyle(fontSize: 12, color: AppColors.iconInactive)),
          ],
        ),
      ],
    );
  }

  Widget _buildPostContent() {
    final post = _post!;
    final imageUrl = post['image_url'];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (imageUrl != null && (imageUrl as String).isNotEmpty) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.network(
              ApiConfig.baseUrl + imageUrl,
              width: double.infinity,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const SizedBox.shrink(),
            ),
          ),
          const SizedBox(height: 16),
        ],
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surfaceBorder,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.surfaceTint),
          ),
          child: Text(
            post['content'] ?? '',
            style: TextStyle(fontSize: 15, color: AppColors.textSecondary, height: 1.6),
          ),
        ),
      ],
    );
  }

  Widget _buildReactionBar() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: _reactionEmojis.map((emoji) {
        final count = _reactionCounts[emoji] ?? 0;
        final isActive = _myReactions.contains(emoji);
        return GestureDetector(
          onTap: () => _toggleReaction(emoji),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: isActive ? AppColors.primary.withAlpha(25) : AppColors.surfaceBorder,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isActive ? AppColors.primary.withAlpha(80) : AppColors.surfaceTint,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(emoji, style: const TextStyle(fontSize: 16)),
                if (count > 0) ...[
                  const SizedBox(width: 4),
                  Text(
                    '$count',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: isActive ? AppColors.primary : AppColors.textSecondary,
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildCommentsSection(int? myUserId) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.chat_bubble_outline, size: 16, color: AppColors.textHint),
            const SizedBox(width: 6),
            Text(
              '\uB313\uAE00 ${_comments.length}',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_comments.isEmpty)
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Text('\uC544\uC9C1 \uB313\uAE00\uC774 \uC5C6\uC2B5\uB2C8\uB2E4', style: TextStyle(color: AppColors.iconInactive, fontSize: 13)),
            ),
          )
        else
          ...List.generate(_comments.length, (i) {
            final c = _comments[i] as Map<String, dynamic>;
            final isMyComment = c['user_id'] == myUserId;
            return _buildCommentItem(c, isMyComment);
          }),
        const SizedBox(height: 80), // bottom padding for input
      ],
    );
  }

  Widget _buildCommentItem(Map<String, dynamic> comment, bool isMine) {
    return GestureDetector(
      onLongPress: isMine
          ? () => _showCommentActions(comment)
          : null,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surfaceBorder,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.surfaceBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  comment['author_name'] ?? '',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                ),
                const SizedBox(width: 8),
                Text(_formatDate(comment['created_at']), style: TextStyle(fontSize: 11, color: AppColors.iconInactive)),
                if (comment['updated_at'] != null && comment['updated_at'] != comment['created_at'])
                  Text(' (\uC218\uC815\uB428)', style: TextStyle(fontSize: 10, color: AppColors.iconInactive)),
                if (isMine) ...[
                  const Spacer(),
                  GestureDetector(
                    onTap: () => _showCommentActions(comment),
                    child: Icon(Icons.more_horiz, size: 16, color: AppColors.iconInactive),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 6),
            Text(
              comment['content'] ?? '',
              style: TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }

  void _showCommentActions(Map<String, dynamic> comment) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgCard,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.edit, color: Colors.white70),
              title: const Text('\uC218\uC815', style: TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.pop(ctx);
                _editComment(comment);
              },
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline, color: AppColors.red),
              title: const Text('\uC0AD\uC81C', style: TextStyle(color: AppColors.red)),
              onTap: () {
                Navigator.pop(ctx);
                _deleteComment(comment['id'] as int);
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCommentInput() {
    return Container(
      padding: EdgeInsets.fromLTRB(16, 10, 16, MediaQuery.of(context).padding.bottom + 10),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        border: Border(top: BorderSide(color: AppColors.surfaceTint)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _commentCtrl,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: '\uB313\uAE00\uC744 \uC785\uB825\uD558\uC138\uC694...',
                hintStyle: TextStyle(color: AppColors.iconInactive),
                filled: true,
                fillColor: AppColors.surfaceBorder,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.surfaceTint),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.surfaceTint),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.primary),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: _sending ? null : _submitComment,
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
