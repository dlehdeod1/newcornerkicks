import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// Shimmer 효과가 있는 스켈레톤 로딩 박스.
/// opacity 0.3~0.6 반복 애니메이션.
class SkeletonBox extends StatefulWidget {
  final double? width;
  final double height;
  final double borderRadius;

  const SkeletonBox({
    super.key,
    this.width,
    required this.height,
    this.borderRadius = AppTheme.radiusSm,
  });

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _opacity = Tween(begin: 0.3, end: 0.6).animate(_controller);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _opacity,
      builder: (_, _) => Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          color: AppColors.bgBorder.withValues(alpha: _opacity.value),
          borderRadius: BorderRadius.circular(widget.borderRadius),
        ),
      ),
    );
  }
}
