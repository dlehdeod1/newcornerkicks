import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import '../theme/app_colors.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../config/api_config.dart';

const _categoryLabels = {'free': '자유', 'recruit': '팀 모집', 'mercenary': '용병 모집', 'match': '매칭', 'review': '경기 후기', 'patchnote': '패치노트'};
const _regionOptions = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
const _dayLabels = {'mon': '월', 'tue': '화', 'wed': '수', 'thu': '목', 'fri': '금', 'sat': '토', 'sun': '일'};
const _timeSlotLabels = {'morning': '오전', 'afternoon': '오후', 'evening': '저녁', 'night': '심야'};
const _skillLabels = {'beginner': '입문', 'low': '초급', 'mid': '중급', 'high': '상급'};

class CommunityPostFormScreen extends StatefulWidget {
  final String? category;
  final Map<String, dynamic>? existing;

  const CommunityPostFormScreen({super.key, this.category, this.existing});

  @override
  State<CommunityPostFormScreen> createState() => _CommunityPostFormScreenState();
}

class _CommunityPostFormScreenState extends State<CommunityPostFormScreen> {
  final ApiService _api = ApiService();
  final _titleCtrl = TextEditingController();
  final _contentCtrl = TextEditingController();
  final _headcountCtrl = TextEditingController();

  late String _category;
  String? _region;
  Set<String> _selectedDays = {};
  String? _timeSlot;
  String? _skillLevel;
  File? _imageFile;
  String? _existingImageUrl;
  bool _saving = false;

  bool get _isEdit => widget.existing != null;
  bool get _isRecruitOrMatch => _category == 'recruit' || _category == 'match' || _category == 'mercenary';

  @override
  void initState() {
    super.initState();
    _category = widget.category ?? widget.existing?['category'] as String? ?? 'free';

    if (_isEdit) {
      final e = widget.existing!;
      _titleCtrl.text = e['title'] as String? ?? '';
      _contentCtrl.text = e['content'] as String? ?? '';
      _existingImageUrl = e['image_url'] as String?;
      _region = e['region'] as String?;
      final dw = e['day_of_week'] as String?;
      if (dw != null) {
        _selectedDays = dw.split(',').toSet();
      }
      _timeSlot = e['time_slot'] as String?;
      _skillLevel = e['skill_level'] as String?;
      final hc = e['headcount'];
      if (hc != null) _headcountCtrl.text = '$hc';
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _contentCtrl.dispose();
    _headcountCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1200);
    if (picked != null) {
      setState(() {
        _imageFile = File(picked.path);
        _existingImageUrl = null;
      });
    }
  }

  Future<void> _save() async {
    final title = _titleCtrl.text.trim();
    final content = _contentCtrl.text.trim();
    if (title.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('제목을 입력하세요')));
      return;
    }
    if (content.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('내용을 입력하세요')));
      return;
    }

    final auth = context.read<AuthService>();
    final token = auth.token;
    if (token == null) return;

    setState(() => _saving = true);

    try {
      String? imageUrl = _existingImageUrl;

      // Upload image if new
      if (_imageFile != null) {
        final uploadRes = await _api.uploadImage(_imageFile!, 'community', token);
        imageUrl = uploadRes['url'] as String? ?? uploadRes['data']?['url'] as String?;
      }

      final body = <String, dynamic>{
        'title': title,
        'content': content,
        'category': _category,
        if (imageUrl != null) 'image_url': imageUrl,
      };

      if (_isRecruitOrMatch) {
        if (_region != null) body['region'] = _region;
        if (_selectedDays.isNotEmpty) body['day_of_week'] = _selectedDays.join(',');
        if (_timeSlot != null) body['time_slot'] = _timeSlot;
        if (_skillLevel != null) body['skill_level'] = _skillLevel;
        final hc = int.tryParse(_headcountCtrl.text.trim());
        if (hc != null) body['headcount'] = hc;
        if (!_isEdit) body['status'] = 'open';
      }

      if (_isEdit) {
        await _api.updateCommunityPost(widget.existing!['id'] as int, body, token);
      } else {
        await _api.createCommunityPost(body, token);
      }

      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('저장 실패: $e')));
      }
    }

    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: AppColors.bgBase,
        title: Text(_isEdit ? '게시글 수정' : '새 게시글', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2))
                : const Text('저장', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Category selector
            _sectionLabel('카테고리'),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: _categoryLabels.entries.map((e) {
                final selected = _category == e.key;
                return GestureDetector(
                  onTap: () => setState(() => _category = e.key),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: selected ? AppColors.primary.withAlpha(26) : AppColors.surfaceBorder,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: selected ? AppColors.primary.withAlpha(80) : AppColors.surfaceTint),
                    ),
                    child: Text(
                      e.value,
                      style: TextStyle(
                        fontSize: 13,
                        color: selected ? AppColors.primary : AppColors.textSecondary,
                        fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 20),

            // Title
            _sectionLabel('제목'),
            const SizedBox(height: 8),
            _textField(_titleCtrl, '제목을 입력하세요'),
            const SizedBox(height: 20),

            // Content
            _sectionLabel('내용'),
            const SizedBox(height: 8),
            _textField(_contentCtrl, '내용을 입력하세요', maxLines: 8),
            const SizedBox(height: 20),

            // Image
            _sectionLabel('이미지 (선택)'),
            const SizedBox(height: 8),
            _buildImagePicker(),

            // Recruit/match/mercenary extra fields
            if (_isRecruitOrMatch) ...[
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surfaceBorder,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.surfaceBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('모집 정보', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                    const SizedBox(height: 16),

                    // Region
                    _sectionLabel('지역'),
                    const SizedBox(height: 8),
                    _buildDropdown<String>(
                      value: _region,
                      hint: '지역 선택',
                      items: _regionOptions.map((r) => DropdownMenuItem(value: r, child: Text(r))).toList(),
                      onChanged: (v) => setState(() => _region = v),
                    ),
                    const SizedBox(height: 16),

                    // Day of week multi-select
                    _sectionLabel('요일'),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      children: _dayLabels.entries.map((e) {
                        final selected = _selectedDays.contains(e.key);
                        return GestureDetector(
                          onTap: () {
                            setState(() {
                              if (selected) {
                                _selectedDays.remove(e.key);
                              } else {
                                _selectedDays.add(e.key);
                              }
                            });
                          },
                          child: Container(
                            width: 40,
                            height: 36,
                            decoration: BoxDecoration(
                              color: selected ? AppColors.primary.withAlpha(26) : AppColors.surfaceBorder,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: selected ? AppColors.primary.withAlpha(80) : AppColors.surfaceTint),
                            ),
                            child: Center(
                              child: Text(
                                e.value,
                                style: TextStyle(
                                  fontSize: 13,
                                  color: selected ? AppColors.primary : AppColors.textHint,
                                  fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                                ),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 16),

                    // Time slot
                    _sectionLabel('시간대'),
                    const SizedBox(height: 8),
                    _buildDropdown<String>(
                      value: _timeSlot,
                      hint: '시간대 선택',
                      items: _timeSlotLabels.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
                      onChanged: (v) => setState(() => _timeSlot = v),
                    ),
                    const SizedBox(height: 16),

                    // Skill level
                    _sectionLabel('실력'),
                    const SizedBox(height: 8),
                    _buildDropdown<String>(
                      value: _skillLevel,
                      hint: '실력 선택',
                      items: _skillLabels.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
                      onChanged: (v) => setState(() => _skillLevel = v),
                    ),
                    const SizedBox(height: 16),

                    // Headcount
                    _sectionLabel('모집 인원'),
                    const SizedBox(height: 8),
                    _textField(_headcountCtrl, '인원 수', keyboardType: TextInputType.number),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _sectionLabel(String text) {
    return Text(text, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.textSecondary));
  }

  Widget _textField(TextEditingController ctrl, String hint, {int maxLines = 1, TextInputType? keyboardType}) {
    return TextField(
      controller: ctrl,
      maxLines: maxLines,
      keyboardType: keyboardType,
      style: const TextStyle(fontSize: 14, color: Colors.white),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(fontSize: 14, color: AppColors.iconInactive),
        filled: true,
        fillColor: AppColors.surfaceBorder,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.surfaceTint)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.surfaceTint)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary)),
      ),
    );
  }

  Widget _buildDropdown<T>({T? value, required String hint, required List<DropdownMenuItem<T>> items, required ValueChanged<T?> onChanged}) {
    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: AppColors.surfaceBorder,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.surfaceTint),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          hint: Text(hint, style: TextStyle(fontSize: 14, color: AppColors.iconInactive)),
          dropdownColor: AppColors.bgCard,
          isExpanded: true,
          style: const TextStyle(fontSize: 14, color: Colors.white),
          icon: Icon(Icons.keyboard_arrow_down, size: 18, color: AppColors.textHint),
          items: items,
          onChanged: onChanged,
        ),
      ),
    );
  }

  Widget _buildImagePicker() {
    if (_imageFile != null) {
      return Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.file(_imageFile!, width: double.infinity, height: 200, fit: BoxFit.cover),
          ),
          Positioned(
            top: 8,
            right: 8,
            child: GestureDetector(
              onTap: () => setState(() {
                _imageFile = null;
                _existingImageUrl = null;
              }),
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                child: const Icon(Icons.close, color: Colors.white, size: 18),
              ),
            ),
          ),
        ],
      );
    }

    if (_existingImageUrl != null && _existingImageUrl!.isNotEmpty) {
      return Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.network(
              '${ApiConfig.baseUrl}$_existingImageUrl',
              width: double.infinity,
              height: 200,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const SizedBox.shrink(),
            ),
          ),
          Positioned(
            top: 8,
            right: 8,
            child: GestureDetector(
              onTap: () => setState(() => _existingImageUrl = null),
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
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
          color: AppColors.surfaceBorder,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.surfaceTint, style: BorderStyle.solid),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.add_photo_alternate_outlined, size: 28, color: AppColors.iconInactive),
            const SizedBox(height: 6),
            Text('이미지 추가', style: TextStyle(fontSize: 12, color: AppColors.iconInactive)),
          ],
        ),
      ),
    );
  }
}
