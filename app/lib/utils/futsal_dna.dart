class FutsalDna {
  final String type;
  final String emoji;
  const FutsalDna(this.type, this.emoji);

  /// API 응답의 futsal_dna 맵에서 생성
  static FutsalDna? fromMap(dynamic map) {
    if (map == null) return null;
    final type = map['type'];
    final emoji = map['emoji'];
    if (type == null) return null;
    return FutsalDna(type.toString(), emoji?.toString() ?? '');
  }

  /// 능력치에서 직접 계산 (API futsal_dna 없을 때 폴백)
  static FutsalDna? fromStats(Map<String, dynamic> player) {
    double s(String key) => ((player[key] ?? 75) as num).toDouble();

    final statKeys = [
      'shooting', 'offball_run', 'ball_keeping', 'passing', 'linkup',
      'intercept', 'marking', 'stamina', 'speed', 'physical',
    ];
    if (statKeys.every((k) => s(k) == 75)) return null;

    final attack = (s('shooting') * 1.5 + s('offball_run') + s('ball_keeping')) / 3.5;
    final playmaking = (s('passing') * 1.5 + s('linkup') * 1.5) / 3;
    final defense = (s('intercept') * 1.5 + s('marking') * 1.5 + s('physical')) / 4;
    final engine = (s('stamina') * 1.5 + s('speed') * 1.5) / 3;

    final values = [attack, playmaking, defense, engine];
    final max = values.reduce((a, b) => a > b ? a : b);
    final min = values.reduce((a, b) => a < b ? a : b);

    if (max - min < max * 0.1) return const FutsalDna('올라운더', '⚡');
    if (max == attack) return const FutsalDna('스트라이커', '🎯');
    if (max == playmaking) return const FutsalDna('플레이메이커', '🎩');
    if (max == defense) return const FutsalDna('수비수', '🛡️');
    if (max == engine) return const FutsalDna('엔진', '🏃');
    return const FutsalDna('올라운더', '⚡');
  }

  /// API 응답 우선, 없으면 로컬 계산
  static FutsalDna? fromPlayer(Map<String, dynamic> player) {
    return fromMap(player['futsal_dna']) ?? fromStats(player);
  }
}
