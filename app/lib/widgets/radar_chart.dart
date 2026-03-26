import 'dart:math';
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class RadarChart extends StatelessWidget {
  final Map<String, double> stats;
  final double size;
  final Color? color;

  const RadarChart({
    super.key,
    required this.stats,
    this.size = 200,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        size: Size(size, size),
        painter: _RadarChartPainter(stats, color ?? AppColors.primary),
      ),
    );
  }
}

class _RadarChartPainter extends CustomPainter {
  final Map<String, double> stats;
  final Color accentColor;
  _RadarChartPainter(this.stats, this.accentColor);

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = min(size.width, size.height) / 2 - 30;
    final labels = stats.keys.toList();
    final values = stats.values.toList();
    final n = labels.length;
    if (n == 0) return;
    final angle = 2 * pi / n;

    // Grid
    final gridPaint = Paint()..color = AppColors.surfaceHighlight..style = PaintingStyle.stroke..strokeWidth = 1;
    for (int level = 1; level <= 5; level++) {
      final r = radius * level / 5;
      final path = Path();
      for (int i = 0; i <= n; i++) {
        final a = -pi / 2 + angle * (i % n);
        final pt = Offset(center.dx + r * cos(a), center.dy + r * sin(a));
        i == 0 ? path.moveTo(pt.dx, pt.dy) : path.lineTo(pt.dx, pt.dy);
      }
      canvas.drawPath(path, gridPaint);
    }

    // Axis lines
    for (int i = 0; i < n; i++) {
      final a = -pi / 2 + angle * i;
      canvas.drawLine(center, Offset(center.dx + radius * cos(a), center.dy + radius * sin(a)), gridPaint);
    }

    // Data polygon
    final dataPath = Path();
    final fillPaint = Paint()..color = accentColor.withAlpha(51)..style = PaintingStyle.fill;
    final strokePaint = Paint()..color = accentColor..style = PaintingStyle.stroke..strokeWidth = 2;

    for (int i = 0; i <= n; i++) {
      final idx = i % n;
      final a = -pi / 2 + angle * idx;
      final r = radius * (values[idx] / 100);
      final pt = Offset(center.dx + r * cos(a), center.dy + r * sin(a));
      i == 0 ? dataPath.moveTo(pt.dx, pt.dy) : dataPath.lineTo(pt.dx, pt.dy);
    }
    canvas.drawPath(dataPath, fillPaint);
    canvas.drawPath(dataPath, strokePaint);

    // Labels
    final tp = TextPainter(textDirection: TextDirection.ltr);
    for (int i = 0; i < n; i++) {
      final a = -pi / 2 + angle * i;
      final labelR = radius + 20;
      final pt = Offset(center.dx + labelR * cos(a), center.dy + labelR * sin(a));
      tp.text = TextSpan(text: labels[i], style: const TextStyle(color: Colors.white54, fontSize: 10));
      tp.layout();
      canvas.save();
      canvas.translate(pt.dx - tp.width / 2, pt.dy - tp.height / 2);
      tp.paint(canvas, Offset.zero);
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
