import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import '../theme/app_colors.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../config/api_config.dart';

class PostFormScreen extends StatefulWidget {
  final String? category;
  final Map<String, dynamic>? existing;
  const PostFormScreen({super.key, this.category, this.existing});

  @override
  State<PostFormScreen> createState() => _PostFormScreenState();
}

class _PostFormScreenState extends State<PostFormScreen> {
  final ApiService _api = ApiService();
  final _titleCtrl = TextEditingController();
  final _contentCtrl = TextEditingController();
  String _category = 'free';
  bool _isPinned = false;
  bool _saving = false;

  // Image
  File? _pickedFile;
  String? _existingImageUrl;
  bool _uploading = false;

  bool get _isEdit => widget.existing != null;

  static const _categories = ['free', 'review', 'schedule'];
  static const _categoryLabels = {
    'free': '자유',
    'review': '경기 후기',
    'schedule': '일정 논의',
  };

  @override
  void initState() {
    super.initState();
    if (widget.category != null && _categories.contains(widget.category)) {
      _category = widget.category!;
    }
    if (widget.existing != null) {
      final e = widget.existing!;
      _titleCtrl.text = e['title'] ?? '';
      _contentCtrl.text = e['content'] ?? '';
      if (e['category'] != null && _categories.contains(e['category'])) {
        _category = e['category'];
      }
      _isPinned = e['is_pinned'] == 1 || e['is_pinned'] == true;
      if (e['image_url'] != null && (e['image_url'] as String).isNotEmpty) {
        _existingImageUrl = e['image_url'];
      }
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _contentCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1200);
    if (picked != null) {
      setState(() {
        _pickedFile = File(picked.path);
        _existingImageUrl = null;
      });
    }
  }

  Future<String?> _uploadImage() async {
    if (_pickedFile == null) return _existingImageUrl;
    final token = context.read<AuthService>().token;
    if (token == null) return null;

    setState(() => _uploading = true);
    try {
      final res = await _api.uploadImage(_pickedFile!, 'community', token);
      return res['url'] ?? res['data']?['url'];
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('이미지 업로드 실패: $e'), backgroundColor: AppColors.red),
        );
      }
      return null;
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _save() async {
    final title = _titleCtrl.text.trim();
    final content = _contentCtrl.text.trim();
    if (title.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('제목을 입력하세요'), backgroundColor: AppColors.amber),
      );
      return;
    }
    if (content.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('내용을 입력하세요'), backgroundColor: AppColors.amber),
      );
      return;
    }

    final token = context.read<AuthService>().token;
    if (token == null) return;

    setState(() => _saving = true);

    try {
      // Upload image if picked
      String? imageUrl;
      if (_pickedFile != null) {
        imageUrl = await _uploadImage();
      } else {
        imageUrl = _existingImageUrl;
      }

      final body = <String, dynamic>{
        'title': title,
        'content': content,
        'category': _category,
        'is_pinned': _isPinned,
      };
      if (imageUrl != null) {
        body['image_url'] = imageUrl;
      }

      if (_isEdit) {
        await _api.updatePost(widget.existing!['id'] as int, body, token);
      } else {
        await _api.createPost(body, token);
      }

      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('저장 실패: $e'), backgroundColor: AppColors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = context.watch<AuthService>().isAdmin;

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        title: Text(_isEdit ? '글 수정' : '글 작성', style: const TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: AppColors.bgBase,
        surfaceTintColor: Colors.transparent,
        actions: [
          TextButton(
            onPressed: _saving || _uploading ? null : _save,
            child: _saving || _uploading
                ? const SizedBox(
                    width: 20, height: 20,
                    child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2),
                  )
                : const Text('저장', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600, fontSize: 15)),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Category dropdown
            Text('카테고리', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white.withAlpha(179))),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(8),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white.withAlpha(15)),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _category,
                  isExpanded: true,
                  dropdownColor: AppColors.bgCard,
                  style: const TextStyle(color: Colors.white, fontSize: 14),
                  items: _categories.map((c) => DropdownMenuItem(
                    value: c,
                    child: Text(_categoryLabels[c] ?? c),
                  )).toList(),
                  onChanged: (val) {
                    if (val != null) setState(() => _category = val);
                  },
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Title
            Text('제목', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white.withAlpha(179))),
            const SizedBox(height: 8),
            TextField(
              controller: _titleCtrl,
              style: const TextStyle(color: Colors.white, fontSize: 15),
              decoration: _inputDecoration('제목을 입력하세요'),
            ),
            const SizedBox(height: 20),

            // Content
            Text('내용', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white.withAlpha(179))),
            const SizedBox(height: 8),
            TextField(
              controller: _contentCtrl,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              maxLines: 10,
              decoration: _inputDecoration('내용을 입력하세요'),
            ),
            const SizedBox(height: 20),

            // Image
            Text('이미지', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white.withAlpha(179))),
            const SizedBox(height: 8),
            _buildImagePicker(),
            const SizedBox(height: 20),

            // Pinned toggle (admin only)
            if (isAdmin) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.white.withAlpha(8),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withAlpha(15)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.push_pin, size: 18, color: AppColors.amber),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text('상단 고정', style: TextStyle(color: Colors.white, fontSize: 14)),
                    ),
                    Switch(
                      value: _isPinned,
                      activeColor: AppColors.primary,
                      onChanged: (val) => setState(() => _isPinned = val),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildImagePicker() {
    if (_pickedFile != null) {
      return Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.file(_pickedFile!, width: double.infinity, height: 200, fit: BoxFit.cover),
          ),
          Positioned(
            top: 8,
            right: 8,
            child: GestureDetector(
              onTap: () => setState(() { _pickedFile = null; _existingImageUrl = null; }),
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: Colors.black.withAlpha(153),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.close, color: Colors.white, size: 18),
              ),
            ),
          ),
        ],
      );
    }

    if (_existingImageUrl != null) {
      return Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.network(
              '${ApiConfig.baseUrl}$_existingImageUrl',
              width: double.infinity,
              height: 200,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                height: 200,
                decoration: BoxDecoration(
                  color: Colors.white.withAlpha(8),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Center(child: Icon(Icons.broken_image, color: Colors.white24, size: 40)),
              ),
            ),
          ),
          Positioned(
            top: 8,
            right: 8,
            child: GestureDetector(
              onTap: () => setState(() => _existingImageUrl = null),
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: Colors.black.withAlpha(153),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.close, color: Colors.white, size: 18),
              ),
            ),
          ),
        ],
      );
    }

    return GestureDetector(
      onTap: _pickImage,
      child: Container(
        width: double.infinity,
        height: 100,
        decoration: BoxDecoration(
          color: Colors.white.withAlpha(8),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white.withAlpha(15), style: BorderStyle.solid),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.add_photo_alternate_outlined, size: 32, color: Colors.white.withAlpha(64)),
            const SizedBox(height: 6),
            Text('이미지 추가', style: TextStyle(fontSize: 13, color: Colors.white.withAlpha(64))),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(color: Colors.white.withAlpha(51)),
      filled: true,
      fillColor: Colors.white.withAlpha(8),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.white.withAlpha(15)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.white.withAlpha(15)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primary),
      ),
    );
  }
}
