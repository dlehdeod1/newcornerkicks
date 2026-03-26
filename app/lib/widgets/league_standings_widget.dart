import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// 리그 현황판 위젯 — 세션 내 팀별 순위를 표시
class LeagueStandingsWidget extends StatelessWidget {
  final List<dynamic> completedMatches;
  final List<dynamic> teams;

  const LeagueStandingsWidget({
    super.key,
    required this.completedMatches,
    required this.teams,
  });

  @override
  Widget build(BuildContext context) {
    final standings = _calculateStandings();
    if (standings.isEmpty) return const SizedBox.shrink();

    final maxPoints = standings.first['points'] as int;

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1a2040), Color(0xFF101528)],
        ),
        border: Border.all(color: AppColors.surfaceBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(50),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          // 헤더
          Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.amber.withAlpha(20), Colors.transparent],
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppColors.amber.withAlpha(25),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.emoji_events_rounded, size: 16, color: AppColors.amber),
                ),
                const SizedBox(width: 10),
                const Text(
                  '리그 현황판',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white, letterSpacing: -0.3),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceBorder,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    '${completedMatches.length}경기',
                    style: TextStyle(fontSize: 11, color: AppColors.textHint, fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),
          // 컬럼 헤더
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              border: Border(
                top: BorderSide(color: AppColors.surfaceBorder),
                bottom: BorderSide(color: AppColors.surfaceBorder),
              ),
            ),
            child: Row(
              children: [
                const SizedBox(width: 28),
                const Expanded(
                  flex: 4,
                  child: Text('팀', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.white38, letterSpacing: 0.5)),
                ),
                _colHeader('경기'),
                _colHeader('승'),
                _colHeader('무'),
                _colHeader('패'),
                _colHeader('득실'),
                const SizedBox(
                  width: 40,
                  child: Center(
                    child: Text('승점', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.amber, letterSpacing: 0.5)),
                  ),
                ),
              ],
            ),
          ),
          // 팀 행
          ...standings.asMap().entries.map((entry) {
            final rank = entry.key;
            final t = entry.value;
            final gd = (t['gf'] as int) - (t['ga'] as int);
            final played = t['played'] as int;
            final isFirst = rank == 0 && played > 0;
            final isSecond = rank == 1 && played > 0;
            final isThird = rank == 2 && played > 0;
            final vestColor = AppColors.fromVestColor(t['vest_color'] as String?);
            final points = t['points'] as int;

            return Container(
              decoration: BoxDecoration(
                color: isFirst ? AppColors.amber.withAlpha(10) : null,
                border: Border(top: BorderSide(color: AppColors.surfaceBorder)),
              ),
              child: IntrinsicHeight(
                child: Row(
                  children: [
                    // 좌측 팀 색상 바
                    Container(
                      width: 3,
                      decoration: BoxDecoration(
                        color: vestColor,
                        borderRadius: const BorderRadius.only(
                          topRight: Radius.circular(2),
                          bottomRight: Radius.circular(2),
                        ),
                      ),
                    ),
                    // 순위
                    SizedBox(
                      width: 28,
                      child: Center(
                        child: _rankBadge(rank, isFirst, isSecond, isThird),
                      ),
                    ),
                    // 팀 이름
                    Expanded(
                      flex: 4,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Row(
                          children: [
                            Text(
                              t['emoji'] as String,
                              style: const TextStyle(fontSize: 14),
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                t['name'] as String,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: isFirst ? FontWeight.w700 : FontWeight.w500,
                                  color: isFirst ? Colors.white : AppColors.textSecondary,
                                  letterSpacing: -0.2,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    // 경기 수
                    _statCell('$played', Colors.white54),
                    // 승
                    _statCell('${t['won']}', (t['won'] as int) > 0 ? AppColors.primary : Colors.white38),
                    // 무
                    _statCell('${t['drawn']}', Colors.white38),
                    // 패
                    _statCell('${t['lost']}', (t['lost'] as int) > 0 ? AppColors.red.withAlpha(200) : Colors.white38),
                    // 득실
                    _statCell(
                      gd > 0 ? '+$gd' : '$gd',
                      gd > 0 ? AppColors.primary : gd < 0 ? AppColors.red.withAlpha(200) : Colors.white38,
                    ),
                    // 승점 (강조 배지)
                    SizedBox(
                      width: 40,
                      child: Center(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: isFirst
                                ? AppColors.amber
                                : points > 0
                                    ? AppColors.surfaceTint
                                    : Colors.transparent,
                            borderRadius: BorderRadius.circular(6),
                            border: isFirst
                                ? null
                                : points > 0
                                    ? Border.all(color: AppColors.surfaceTint)
                                    : null,
                          ),
                          child: Text(
                            '$points',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: isFirst ? const Color(0xFF1a1a1a) : Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                  ],
                ),
              ),
            );
          }),
          // 하단 범례
          if (maxPoints > 0)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _legendDot(AppColors.primary, '승'),
                  const SizedBox(width: 12),
                  _legendDot(Colors.white38, '무'),
                  const SizedBox(width: 12),
                  _legendDot(AppColors.red.withAlpha(200), '패'),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _rankBadge(int rank, bool isFirst, bool isSecond, bool isThird) {
    if (isFirst) {
      return const Text('🥇', style: TextStyle(fontSize: 15));
    } else if (isSecond) {
      return const Text('🥈', style: TextStyle(fontSize: 15));
    } else if (isThird) {
      return const Text('🥉', style: TextStyle(fontSize: 15));
    }
    return Text(
      '${rank + 1}',
      style: TextStyle(fontSize: 12, color: AppColors.textHint, fontWeight: FontWeight.w500),
    );
  }

  Widget _colHeader(String text) {
    return SizedBox(
      width: 32,
      child: Center(
        child: Text(
          text,
          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.iconInactive, letterSpacing: 0.5),
        ),
      ),
    );
  }

  Widget _statCell(String text, Color color) {
    return SizedBox(
      width: 32,
      child: Center(
        child: Text(text, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w500)),
      ),
    );
  }

  Widget _legendDot(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(fontSize: 10, color: AppColors.iconInactive)),
      ],
    );
  }

  List<Map<String, dynamic>> _calculateStandings() {
    final standings = <int, Map<String, dynamic>>{};
    for (final team in teams) {
      final tid = team['id'] as int;
      standings[tid] = {
        'name': team['name'] ?? 'Team',
        'emoji': team['emoji'] ?? '⚽',
        'vest_color': team['vest_color'] as String?,
        'played': 0,
        'won': 0,
        'drawn': 0,
        'lost': 0,
        'gf': 0,
        'ga': 0,
        'points': 0,
      };
    }

    for (final match in completedMatches) {
      final t1id = match['team1_id'] as int?;
      final t2id = match['team2_id'] as int?;
      if (t1id == null || t2id == null) continue;
      final events = (match['events'] as List?) ?? [];
      final s1 = events.where((e) => e['event_type'] == 'GOAL' && e['team_id'] == t1id).length;
      final s2 = events.where((e) => e['event_type'] == 'GOAL' && e['team_id'] == t2id).length;
      final t1 = standings[t1id];
      final t2 = standings[t2id];
      if (t1 == null || t2 == null) continue;

      t1['played'] = t1['played'] + 1;
      t2['played'] = t2['played'] + 1;
      t1['gf'] = t1['gf'] + s1;
      t1['ga'] = t1['ga'] + s2;
      t2['gf'] = t2['gf'] + s2;
      t2['ga'] = t2['ga'] + s1;

      if (s1 > s2) {
        t1['won'] = t1['won'] + 1;
        t2['lost'] = t2['lost'] + 1;
        t1['points'] = t1['points'] + 3;
      } else if (s2 > s1) {
        t2['won'] = t2['won'] + 1;
        t1['lost'] = t1['lost'] + 1;
        t2['points'] = t2['points'] + 3;
      } else {
        t1['drawn'] = t1['drawn'] + 1;
        t2['drawn'] = t2['drawn'] + 1;
        t1['points'] = t1['points'] + 1;
        t2['points'] = t2['points'] + 1;
      }
    }

    // 정렬: 승점 → 골득실 → 다득점 → 맞대결
    final sorted = standings.values.toList()
      ..sort((a, b) {
        final pDiff = (b['points'] as int) - (a['points'] as int);
        if (pDiff != 0) return pDiff;
        final gdA = (a['gf'] as int) - (a['ga'] as int);
        final gdB = (b['gf'] as int) - (b['ga'] as int);
        if (gdB != gdA) return gdB - gdA;
        final gfDiff = (b['gf'] as int) - (a['gf'] as int);
        if (gfDiff != 0) return gfDiff;
        return 0;
      });

    return sorted;
  }
}
