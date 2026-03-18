import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../services/tip_service.dart';

class TipBanner extends StatefulWidget {
  final String tipId;
  final String text;
  final IconData icon;
  final Color color;

  const TipBanner({
    super.key,
    required this.tipId,
    required this.text,
    this.icon = Icons.lightbulb_outline,
    this.color = AppColors.primary,
  });

  @override
  State<TipBanner> createState() => _TipBannerState();
}

class _TipBannerState extends State<TipBanner> with SingleTickerProviderStateMixin {
  bool _dismissed = true;
  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 300));
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _checkTip();
  }

  Future<void> _checkTip() async {
    final dismissed = await TipService.isTipDismissed(widget.tipId);
    if (!dismissed && mounted) {
      setState(() => _dismissed = false);
      _animCtrl.forward();
    }
  }

  Future<void> _dismiss() async {
    await _animCtrl.reverse();
    await TipService.dismissTip(widget.tipId);
    if (mounted) setState(() => _dismissed = true);
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_dismissed) return const SizedBox.shrink();

    return FadeTransition(
      opacity: _fadeAnim,
      child: SizeTransition(
        sizeFactor: _fadeAnim,
        child: Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: widget.color.withAlpha(20),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: widget.color.withAlpha(51)),
          ),
          child: Row(
            children: [
              Icon(widget.icon, size: 18, color: widget.color),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  widget.text,
                  style: TextStyle(fontSize: 13, color: widget.color, height: 1.4),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: _dismiss,
                child: Icon(Icons.close, size: 16, color: widget.color.withAlpha(128)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
