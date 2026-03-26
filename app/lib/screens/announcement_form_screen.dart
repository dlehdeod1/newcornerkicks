import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import '../theme/app_colors.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../config/api_config.dart';

class AnnouncementFormScreen extends StatefulWidget {
  final Map<String, dynamic>? existing;
  const AnnouncementFormScreen({super.key, this.existing});

  @override
  State<AnnouncementFormScreen> createState() => _AnnouncementFormScreenState();
}

class _AnnouncementFormScreenState extends State<AnnouncementFormScreen> {
  final ApiService _api = ApiService();
  final _titleController = TextEditingController();
  final _contentController = TextEditingController();
  bool _isPinned = false;
  String? _imageUrl;
  File? _pickedImage;
  bool _saving = false;
  bool _uploading = false;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    if (_isEdit) {
      final e = widget.existing!;
      _titleController.text = e['title'] ?? '';
      _contentController.text = e['content'] ?? '';
      _isPinned = e['is_pinned'] == 1 || e['is_pinned'] == true;
      _imageUrl = e['image_url'] as String?;
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1200);
    if (picked == null) return;

    setState(() { _pickedImage = File(picked.path); _uploading = true; });

    final token = context.read<AuthService>().token;
    if (token == null) return;

    try {
      final res = await _api.uploadImage(_pickedImage!, 'announcements', token);
      final url = res['url'] ?? res['data']?['url'];
      if (url != null) {
        setState(() { _imageUrl = url; _uploading = false; });
      } else {
        setState(() => _uploading = false);
      }
    } catch (e) {
      setState(() => _uploading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('이미지 업로드 실패: $e'), backgroundColor: AppColors.red),
        );
      }
    }
  }

  Future<void> _save() async {
    final title = _titleController.text.trim();
    final content = _contentController.text.trim();
    if (title.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('제목을 입력해주세요'), backgroundColor: AppColors.red),
      );
      return;
    }
    if (content.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('내용을 입력해주세요'), backgroundColor: AppColors.red),
      );
      return;
    }

    final token = context.read<AuthService>().token;
    if (token == null) return;

    setState(() => _saving = true);

    final body = <String, dynamic>{
      'title': title,
      'content': content,
      'is_pinned': _isPinned,
    };
    if (_imageUrl != null) body['image_url'] = _imageUrl;

    try {
      if (_isEdit) {
        await _api.updateAnnouncement(widget.existing!['id'] as int, body, token);
      } else {
        await _api.createAnnouncement(body, token);
      }
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('저장 실패: $e'), backgroundColor: AppColors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        title: Text(_isEdit ? '공지 수정' : '공지 작성', style: const TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: AppColors.bgBase,
        surfaceTintColor: Colors.transparent,
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
                : const Text('저장', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 15)),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Title
            TextField(
              controller: _titleController,
              style: const TextStyle(color: Colors.white, fontSize: 16),
              decoration: InputDecoration(
                hintText: '제목',
                hintStyle: TextStyle(color: AppColors.iconInactive),
                filled: true,
                fillColor: AppColors.surfaceBorder,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide(color: AppColors.surfaceBorder),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide(color: AppColors.surfaceBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: AppColors.primary),
                ),
              ),
            ),
            const SizedBox(height: 16),
            // Content
            TextField(
              controller: _contentController,
              style: const TextStyle(color: Colors.white, fontSize: 15),
              maxLines: 10,
              decoration: InputDecoration(
                hintText: '내용을 입력하세요',
                hintStyle: TextStyle(color: AppColors.iconInactive),
                filled: true,
                fillColor: AppColors.surfaceBorder,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide(color: AppColors.surfaceBorder),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide(color: AppColors.surfaceBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: AppColors.primary),
                ),
              ),
            ),
            const SizedBox(height: 20),
            // Image picker
            Text('이미지', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
            const SizedBox(height: 10),
            if (_uploading)
              Container(
                height: 120,
                decoration: BoxDecoration(
                  color: AppColors.surfaceBorder,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.surfaceBorder),
                ),
                child: const Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2)),
              )
            else if (_imageUrl != null) ...[
              Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: _pickedImage != null
                        ? Image.file(_pickedImage!, width: double.infinity, height: 200, fit: BoxFit.cover)
                        : Image.network(
                            '${ApiConfig.baseUrl}$_imageUrl',
                            width: double.infinity,
                            height: 200,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              height: 200,
                              color: AppColors.surfaceBorder,
                              child: const Center(child: Icon(Icons.broken_image, color: Colors.white38)),
                            ),
                          ),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: GestureDetector(
                      onTap: () => setState(() { _imageUrl = null; _pickedImage = null; }),
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Icon(Icons.close, size: 16, color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
            ] else
              GestureDetector(
                onTap: _pickImage,
                child: Container(
                  height: 120,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceBorder,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.surfaceBorder, style: BorderStyle.solid),
                  ),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.add_photo_alternate_outlined, size: 32, color: AppColors.iconInactive),
                        const SizedBox(height: 8),
                        Text('이미지 추가', style: TextStyle(fontSize: 13, color: AppColors.iconInactive)),
                      ],
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 20),
            // Pin toggle
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.surfaceBorder,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.surfaceBorder),
              ),
              child: SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('상단 고정', style: TextStyle(color: Colors.white, fontSize: 15)),
                subtitle: Text('공지 목록 최상단에 표시됩니다', style: TextStyle(color: AppColors.textHint, fontSize: 12)),
                value: _isPinned,
                activeColor: AppColors.primary,
                onChanged: (v) => setState(() => _isPinned = v),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
