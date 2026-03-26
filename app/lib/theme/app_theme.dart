import 'package:flutter/material.dart';

/// 코너킥스 디자인 토큰 — TextStyle, Spacing, BorderRadius
/// 웹 Tailwind 대응: docs/design-system-reference.md 참조
class AppTheme {
  AppTheme._();

  // ─── TextStyle (color 미지정 — 사용처에서 테마 따라 결정) ──────
  static const headingLg = TextStyle(fontSize: 22, fontWeight: FontWeight.w700);
  static const headingMd = TextStyle(fontSize: 18, fontWeight: FontWeight.w600);
  static const headingSm = TextStyle(fontSize: 15, fontWeight: FontWeight.w600);
  static const bodyLg    = TextStyle(fontSize: 16, fontWeight: FontWeight.w400);
  static const body      = TextStyle(fontSize: 14, fontWeight: FontWeight.w400);
  static const bodySm    = TextStyle(fontSize: 12, fontWeight: FontWeight.w400);
  static const caption   = TextStyle(fontSize: 11, fontWeight: FontWeight.w400);

  // ─── Spacing (4px grid) ──────
  static const space4  = 4.0;
  static const space8  = 8.0;
  static const space12 = 12.0;
  static const space16 = 16.0;
  static const space24 = 24.0;
  static const space32 = 32.0;
  static const space48 = 48.0;

  // ─── Border Radius ──────
  static const radiusSm = 8.0;
  static const radiusMd = 12.0;
  static const radiusLg = 16.0;
  static const radiusXl = 20.0;
}
