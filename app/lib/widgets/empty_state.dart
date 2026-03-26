import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// 데이터가 없을 때 표시하는 공용 빈 상태 위젯.
/// 아이콘 + 타이틀 + 부제목(옵션) + CTA 버튼(옵션).
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.space32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: AppColors.iconInactive),
            const SizedBox(height: AppTheme.space16),
            Text(
              title,
              style: AppTheme.headingSm.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: AppTheme.space8),
              Text(
                subtitle!,
                style: AppTheme.body.copyWith(color: AppColors.textHint),
                textAlign: TextAlign.center,
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: AppTheme.space24),
              ElevatedButton(
                onPressed: onAction,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  ),
                ),
                child: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
