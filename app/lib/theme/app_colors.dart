import 'package:flutter/material.dart';

/// 코너킥스 앱 공통 컬러 상수
/// 웹(#2ECC71)과 브랜드 컬러 통일
class AppColors {
  AppColors._();

  // ─── 브랜드 그린 ───────────────────────────────────────────────
  /// 브랜드 메인 그린 #2ECC71 (웹 brand-green 동일)
  static const primary = Color(0xFF2ECC71);

  /// 라이트모드 버튼용 짙은 그린 #16A34A (흰 텍스트 WCAG AA ✓)
  static const primaryDark = Color(0xFF16A34A);

  // ─── 다크 배경 ─────────────────────────────────────────────────
  /// slate-900 #0F172A — 최하단 배경
  static const bgBase = Color(0xFF0F172A);

  /// slate-800 #1E293B — 카드 배경
  static const bgCard = Color(0xFF1E293B);

  /// slate-700 #334155 — 구분선 / 테두리
  static const bgBorder = Color(0xFF334155);

  /// 더 진한 배경 #0D1B2A
  static const bgDeep = Color(0xFF0D1B2A);

  // ─── 액센트 컬러 ───────────────────────────────────────────────
  static const blue    = Color(0xFF3B82F6); // blue-500
  static const blueLight = Color(0xFF60A5FA); // blue-400
  static const blueSky = Color(0xFF0EA5E9); // sky-500
  static const teal    = Color(0xFF14B8A6); // teal-500
  static const cyan    = Color(0xFF06B6D4); // cyan-500
  static const purple  = Color(0xFF8B5CF6); // purple-500
  static const indigo  = Color(0xFF6366F1); // indigo-500
  static const violet  = Color(0xFFA855F7); // violet-500
  static const amber   = Color(0xFFF59E0B); // amber-500
  static const amberLight = Color(0xFFFBBF24); // amber-400
  static const orange  = Color(0xFFF97316); // orange-500
  static const red     = Color(0xFFEF4444); // red-500
  static const redLight = Color(0xFFF87171); // red-400
  static const pink    = Color(0xFFEC4899); // pink-500
  static const rose    = Color(0xFFF43F5E); // rose-500
  static const fuchsia = Color(0xFFF472B6); // fuchsia-400

  // ─── 뉴트럴 ────────────────────────────────────────────────────
  static const slate   = Color(0xFF64748B); // slate-500
  static const slateLight = Color(0xFF94A3B8); // slate-400

  // ─── 랭킹 메달 ─────────────────────────────────────────────────
  static const gold   = Color(0xFFF59E0B); // 1위 금
  static const silver = Color(0xFF94A3B8); // 2위 은
  static const bronze = Color(0xFFD97706); // 3위 동

  // ─── 시맨틱 텍스트 (다크 모드 기본) ──────────────────────────────
  /// 보조 텍스트 65% — alpha 153~220 대체
  static const textSecondary = Color.fromRGBO(255, 255, 255, 0.65);
  /// 힌트 텍스트 50% — alpha 100~128 대체
  static const textHint      = Color.fromRGBO(255, 255, 255, 0.50);
  /// 비활성 아이콘/텍스트 30% — alpha 51~80 대체
  static const iconInactive  = Color.fromRGBO(255, 255, 255, 0.30);

  // ─── 시맨틱 표면 (다크 모드 기본) ──────────────────────────────
  /// 미묘한 배경 tint ~8% — alpha 13~20 대체
  static const surfaceTint   = Color.fromRGBO(255, 255, 255, 0.08);
  /// 미묘한 보더/구분선 ~6% — alpha 5~12 대체
  static const surfaceBorder = Color.fromRGBO(255, 255, 255, 0.06);
  /// 강조 표면 ~10% — alpha 26~40 대체
  static const surfaceHighlight = Color.fromRGBO(255, 255, 255, 0.10);

  // ─── 테마 인식 헬퍼 (Phase 5 라이트모드 대비) ──────────────────
  static Color adaptiveTextSecondary(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? textSecondary
          : const Color.fromRGBO(0, 0, 0, 0.60);

  static Color adaptiveTextHint(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? textHint
          : const Color.fromRGBO(0, 0, 0, 0.45);

  static Color adaptiveIconInactive(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? iconInactive
          : const Color.fromRGBO(0, 0, 0, 0.25);

  // ─── 외부 브랜드 ───────────────────────────────────────────────
  static const google = Color(0xFF4285F4); // Google 브랜드 블루

  // ─── 조끼 색상 (vest_color) ──────────────────────────────────
  static const Map<String, Color> vestColors = {
    'yellow': Color(0xFFEAB308),
    'orange': Color(0xFFF97316),
    'white': Color(0xFF94A3B8),
    'red': Color(0xFFEF4444),
    'blue': Color(0xFF3B82F6),
    'green': Color(0xFF10B981),
    'purple': Color(0xFFA855F7),
    'pink': Color(0xFFEC4899),
  };

  /// vest_color 문자열로 Color 반환 (fallback: primary)
  static Color fromVestColor(String? vestColor) {
    return vestColors[vestColor] ?? primary;
  }
}
