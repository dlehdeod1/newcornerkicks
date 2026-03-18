import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:io';

class MatchResultPopup {
  static Future<void> show(
    BuildContext context, {
    required Map<String, dynamic> session,
    required List<dynamic> teams,
    required List<dynamic> matches,
    required int sessionId,
  }) {
    return showDialog(
      context: context,
      barrierColor: Colors.black.withAlpha(200),
      builder: (_) => _MatchResultDialog(session: session, teams: teams, matches: matches, sessionId: sessionId),
    );
  }
}

class _MatchResultDialog extends StatefulWidget {
  final Map<String, dynamic> session;
  final List<dynamic> teams;
  final List<dynamic> matches;
  final int sessionId;
  const _MatchResultDialog({required this.session, required this.teams, required this.matches, required this.sessionId});

  @override
  State<_MatchResultDialog> createState() => _MatchResultDialogState();
}

class _MatchResultDialogState extends State<_MatchResultDialog> {
  final GlobalKey _cardKey = GlobalKey();
  bool _capturing = false;

  // ── 리그 스탠딩 계산 ─────────────────────────────
  List<Map<String, dynamic>> _calcStandings() {
    final standings = <int, Map<String, dynamic>>{};
    for (final team in widget.teams) {
      final tid = team['id'] as int;
      standings[tid] = {
        'id': tid, 'name': team['name'] ?? 'Team', 'emoji': team['emoji'] ?? '⚽',
        'played': 0, 'won': 0, 'drawn': 0, 'lost': 0,
        'gf': 0, 'ga': 0, 'points': 0,
        'results': <String>[],
      };
    }
    final completed = widget.matches.where((m) => m['status'] == 'completed').toList();
    for (final match in completed) {
      final t1id = match['team1_id'] as int?;
      final t2id = match['team2_id'] as int?;
      if (t1id == null || t2id == null) continue;
      final events = (match['events'] as List?) ?? [];
      final s1 = events.where((e) => e['event_type'] == 'GOAL' && e['team_id'] == t1id).length;
      final s2 = events.where((e) => e['event_type'] == 'GOAL' && e['team_id'] == t2id).length;
      final t1 = standings[t1id]; final t2 = standings[t2id];
      if (t1 == null || t2 == null) continue;
      t1['played'] = t1['played'] + 1; t2['played'] = t2['played'] + 1;
      t1['gf'] = t1['gf'] + s1; t1['ga'] = t1['ga'] + s2;
      t2['gf'] = t2['gf'] + s2; t2['ga'] = t2['ga'] + s1;
      if (s1 > s2) {
        t1['won'] = t1['won'] + 1; t2['lost'] = t2['lost'] + 1;
        t1['points'] = t1['points'] + 3;
        (t1['results'] as List).add('W'); (t2['results'] as List).add('L');
      } else if (s2 > s1) {
        t2['won'] = t2['won'] + 1; t1['lost'] = t1['lost'] + 1;
        t2['points'] = t2['points'] + 3;
        (t1['results'] as List).add('L'); (t2['results'] as List).add('W');
      } else {
        t1['drawn'] = t1['drawn'] + 1; t2['drawn'] = t2['drawn'] + 1;
        t1['points'] = t1['points'] + 1; t2['points'] = t2['points'] + 1;
        (t1['results'] as List).add('D'); (t2['results'] as List).add('D');
      }
    }
    return standings.values.toList()..sort((a, b) {
      final pd = (b['points'] as int) - (a['points'] as int);
      if (pd != 0) return pd;
      final gda = (a['gf'] as int) - (a['ga'] as int);
      final gdb = (b['gf'] as int) - (b['ga'] as int);
      if (gdb != gda) return gdb - gda;
      return (b['gf'] as int) - (a['gf'] as int);
    });
  }

  // ── 어워드 계산 (동적 이벤트 타입) ──────────────────
  Map<String, dynamic> _calcAwards() {
    final playerStats = <String, Map<String, dynamic>>{};
    final eventTypes = <String>[];
    final completed = widget.matches.where((m) => m['status'] == 'completed').toList();

    for (final match in completed) {
      final events = (match['events'] as List?) ?? [];
      for (final event in events) {
        final type = event['event_type'] as String? ?? 'OTHER';
        if (!eventTypes.contains(type)) eventTypes.add(type);

        final pid = event['player_id'];
        final name = event['player_name'] ?? event['guest_name'] ?? '?';
        final key = pid != null ? 'p_$pid' : 'g_$name';

        playerStats.putIfAbsent(key, () => {
          'name': name, 'byType': <String, int>{}, 'score': 0.0, 'assists': 0,
        });
        final s = playerStats[key]!;
        final byType = s['byType'] as Map<String, int>;
        byType[type] = (byType[type] ?? 0) + 1;

        // 이벤트 타입별 MVP 가중치
        final weight = _eventWeight(type);
        s['score'] = (s['score'] as double) + weight;

        // 어시스트는 GOAL의 assister_id로 별도 추적
        final aid = event['assister_id'];
        final aname = event['assister_name'] as String?;
        if ((aid != null || aname != null) && type == 'GOAL') {
          final akey = aid != null ? 'p_$aid' : 'g_$aname';
          playerStats.putIfAbsent(akey, () => {
            'name': aname ?? '?', 'byType': <String, int>{}, 'score': 0.0, 'assists': 0,
          });
          playerStats[akey]!['assists'] = (playerStats[akey]!['assists'] as int) + 1;
          playerStats[akey]!['score'] = (playerStats[akey]!['score'] as double) + 1.0;
        }
      }
    }

    if (playerStats.isEmpty) return {};

    final all = playerStats.values.toList();
    final sorted = List.from(all)..sort((a, b) => (b['score'] as double).compareTo(a['score'] as double));
    final mvp = sorted.first;
    final maxScore = mvp['score'] as double;
    final mvpNorm = maxScore > 0 ? (maxScore / maxScore) * 10 : 0.0;
    // 정규화: mvp는 항상 10점, 나머지 상대적으로
    for (final p in all) {
      p['normScore'] = maxScore > 0 ? ((p['score'] as double) / maxScore) * 10.0 : 0.0;
    }

    // 이벤트 타입별 1위
    final topByType = <String, Map<String, dynamic>>{};
    for (final type in eventTypes) {
      final withType = all.where((p) => ((p['byType'] as Map<String, int>)[type] ?? 0) > 0).toList();
      if (withType.isEmpty) continue;
      withType.sort((a, b) => ((b['byType'] as Map<String, int>)[type] ?? 0) - ((a['byType'] as Map<String, int>)[type] ?? 0));
      topByType[type] = {
        'player': withType.first,
        'count': (withType.first['byType'] as Map<String, int>)[type]!,
      };
    }

    // 어시스트 1위
    final withAssists = all.where((p) => (p['assists'] as int) > 0).toList();
    Map<String, dynamic>? topAssister;
    if (withAssists.isNotEmpty) {
      withAssists.sort((a, b) => (b['assists'] as int) - (a['assists'] as int));
      topAssister = {'player': withAssists.first, 'count': withAssists.first['assists'] as int};
    }

    return {
      'mvp': mvp, 'mvpScore': mvpNorm,
      'topByType': topByType,
      'topAssister': topAssister,
    };
  }

  double _eventWeight(String type) {
    switch (type) {
      case 'GOAL': return 2.0;
      case 'DEFENSE': return 0.5;
      default: return 1.0;
    }
  }

  String _typeIcon(String type) {
    switch (type) {
      case 'GOAL': return '⚽';
      case 'DEFENSE': return '🛡️';
      case 'YELLOW_CARD': return '🟨';
      case 'RED_CARD': return '🟥';
      case 'SAVE': return '🧤';
      default: return '📌';
    }
  }

  String _typeLabel(String type) {
    switch (type) {
      case 'GOAL': return '득점왕';
      case 'DEFENSE': return '수비왕';
      case 'YELLOW_CARD': return '경고왕';
      case 'RED_CARD': return '퇴장왕';
      case 'SAVE': return '선방왕';
      default: return '${type}왕';
    }
  }

  String _typeUnit(String type) {
    switch (type) {
      case 'GOAL': return '골';
      case 'DEFENSE': return '수비';
      case 'YELLOW_CARD': return '경고';
      case 'RED_CARD': return '퇴장';
      case 'SAVE': return '선방';
      default: return '회';
    }
  }

  // ── 텍스트 공유 ──────────────────────────────────
  String _buildShareText(List<Map<String, dynamic>> standings, Map<String, dynamic> awards) {
    final s = widget.session;
    final date = s['session_date'] as String? ?? '';
    final title = s['title'] as String? ?? '정기 풋살';
    DateTime? dt; try { dt = DateTime.parse(date); } catch (_) {}
    final dows = ['일', '월', '화', '수', '목', '금', '토'];
    final dateStr = dt != null
        ? '${dt.year}.${dt.month.toString().padLeft(2,'0')}.${dt.day.toString().padLeft(2,'0')} ${dows[dt.weekday % 7]}요일'
        : date;

    final buf = StringBuffer();
    buf.writeln('⚽ $title 경기결과 ⚽');
    buf.writeln('📅 $dateStr');
    buf.writeln();
    buf.writeln('🏆 리그 최종 순위');
    buf.writeln('─────────────────');
    final medals = ['🥇', '🥈', '🥉'];
    for (var i = 0; i < standings.length; i++) {
      final t = standings[i];
      final medal = i < medals.length ? medals[i] : '${i+1}위';
      final gd = (t['gf'] as int) - (t['ga'] as int);
      final gdStr = gd >= 0 ? '+$gd' : '$gd';
      buf.writeln('$medal ${t['name']}  ${t['won']}승${t['drawn']}무${t['lost']}패  득실$gdStr  ${t['points']}승점');
    }
    if (awards.isNotEmpty) {
      buf.writeln();
      buf.writeln('🌟 오늘의 수훈선수');
      buf.writeln('─────────────────');
      final mvp = awards['mvp'] as Map;
      final mvpScore = awards['mvpScore'] as double;
      buf.writeln('⭐ MVP: ${mvp['name']} (${mvpScore.toStringAsFixed(1)}점)');
      final topByType = awards['topByType'] as Map<String, Map<String, dynamic>>;
      for (final entry in topByType.entries) {
        final icon = _typeIcon(entry.key);
        final label = _typeLabel(entry.key);
        final unit = _typeUnit(entry.key);
        final player = entry.value['player'] as Map;
        final count = entry.value['count'] as int;
        buf.writeln('$icon $label: ${player['name']} $count$unit');
      }
      final topAssister = awards['topAssister'] as Map<String, dynamic>?;
      if (topAssister != null) {
        final ap = topAssister['player'] as Map;
        buf.writeln('⚡ 도움왕: ${ap['name']} ${topAssister['count']}도움');
      }
    }
    buf.writeln();
    buf.write('#킥킥 #풋살 #경기결과');
    return buf.toString();
  }

  Future<void> _shareText(String text) async {
    await Share.share(text, subject: '경기 결과');
  }

  Future<void> _shareImage() async {
    setState(() => _capturing = true);
    try {
      final boundary = _cardKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) return;
      final image = await boundary.toImage(pixelRatio: 3.0);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      if (bytes == null) return;
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/match_result_${DateTime.now().millisecondsSinceEpoch}.png');
      await file.writeAsBytes(bytes.buffer.asUint8List());
      await Share.shareXFiles([XFile(file.path)], text: '⚽ 경기 결과');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('이미지 생성 실패: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _capturing = false);
    }
  }

  Future<void> _copyText(String text) async {
    await Clipboard.setData(ClipboardData(text: text));
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('클립보드에 복사됐습니다 ✓'), backgroundColor: AppColors.primary, duration: Duration(seconds: 2)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final standings = _calcStandings();
    final awards = _calcAwards();
    final shareText = _buildShareText(standings, awards);
    final screenH = MediaQuery.of(context).size.height;

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 결과 카드
          ConstrainedBox(
            constraints: BoxConstraints(maxHeight: screenH * 0.65),
            child: SingleChildScrollView(
              child: RepaintBoundary(
                key: _cardKey,
                child: _MatchResultCard(
                  session: widget.session,
                  standings: standings,
                  awards: awards,
                  typeIcon: _typeIcon,
                  typeLabel: _typeLabel,
                  typeUnit: _typeUnit,
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          // 버튼 영역
          Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
            decoration: BoxDecoration(
              color: AppColors.bgCard,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Expanded(child: _ActionBtn(
                        icon: Icons.copy_rounded, label: '텍스트 복사',
                        subtitle: '카톡에 붙여넣기',
                        color: AppColors.primary, onTap: () => _copyText(shareText),
                      )),
                      const SizedBox(width: 8),
                      Expanded(child: _ActionBtn(
                        icon: Icons.share_rounded, label: '텍스트 공유',
                        subtitle: '카톡 바로 공유',
                        color: AppColors.blue, onTap: () => _shareText(shareText),
                      )),
                      const SizedBox(width: 8),
                      Expanded(child: _ActionBtn(
                        icon: Icons.image_rounded, label: '이미지 공유',
                        subtitle: '사진으로 저장',
                        color: AppColors.amber, loading: _capturing, onTap: _shareImage,
                      )),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextButton(
                        onPressed: () => Navigator.pop(context),
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          minimumSize: Size.zero,
                        ),
                        child: Text('닫기', style: TextStyle(color: Colors.white.withAlpha(77), fontSize: 12)),
                      ),
                    ),
                    Container(width: 1, height: 14, color: Colors.white.withAlpha(26)),
                    Expanded(
                      child: TextButton(
                        onPressed: () async {
                          final prefs = await SharedPreferences.getInstance();
                          await prefs.setBool('result_popup_seen_${widget.sessionId}', true);
                          if (context.mounted) Navigator.pop(context);
                        },
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          minimumSize: Size.zero,
                        ),
                        child: Text('다시 보지 않기', style: TextStyle(color: Colors.white.withAlpha(77), fontSize: 12)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── 결과 카드 ─────────────────────────────────────
class _MatchResultCard extends StatelessWidget {
  final Map<String, dynamic> session;
  final List<Map<String, dynamic>> standings;
  final Map<String, dynamic> awards;
  final String Function(String) typeIcon;
  final String Function(String) typeLabel;
  final String Function(String) typeUnit;

  const _MatchResultCard({
    required this.session, required this.standings, required this.awards,
    required this.typeIcon, required this.typeLabel, required this.typeUnit,
  });

  @override
  Widget build(BuildContext context) {
    final date = session['session_date'] as String? ?? '';
    final title = session['title'] as String? ?? '정기 풋살';
    DateTime? dt; try { dt = DateTime.parse(date); } catch (_) {}
    final dows = ['일', '월', '화', '수', '목', '금', '토'];
    final dateStr = dt != null
        ? '${dt.year}.${dt.month.toString().padLeft(2,'0')}.${dt.day.toString().padLeft(2,'0')} (${dows[dt.weekday % 7]})'
        : date;

    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.bgDeep, AppColors.bgDeep, AppColors.bgDeep],
          begin: Alignment.topCenter, end: Alignment.bottomCenter,
        ),
        borderRadius: BorderRadius.all(Radius.circular(20)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── 헤더 ──
          Container(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.primary.withAlpha(50), AppColors.teal.withAlpha(25)],
                begin: Alignment.topLeft, end: Alignment.bottomRight,
              ),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
              border: Border(bottom: BorderSide(color: AppColors.primary.withAlpha(40))),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('⚽', style: TextStyle(fontSize: 20)),
                    const SizedBox(width: 10),
                    const Flexible(
                      child: Text('MATCH  DAY', style: TextStyle(
                        fontSize: 24, fontWeight: FontWeight.w900,
                        color: AppColors.primary, letterSpacing: 4,
                      )),
                    ),
                    const SizedBox(width: 10),
                    const Text('⚽', style: TextStyle(fontSize: 20)),
                  ],
                ),
                const SizedBox(height: 6),
                Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white), overflow: TextOverflow.ellipsis),
                const SizedBox(height: 3),
                Text(dateStr, style: TextStyle(fontSize: 12, color: Colors.white.withAlpha(153))),
              ],
            ),
          ),

          // ── 리그 최종 순위 ──
          _Section(
            title: '🏆 리그 최종 순위',
            child: Column(
              children: standings.asMap().entries.map((entry) {
                final rank = entry.key;
                final t = entry.value;
                final gd = (t['gf'] as int) - (t['ga'] as int);
                final gdStr = gd > 0 ? '+$gd' : '$gd';
                final results = t['results'] as List;
                final medals = ['🥇', '🥈', '🥉'];
                final isFirst = rank == 0;

                return Container(
                  margin: const EdgeInsets.only(bottom: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: isFirst ? AppColors.amber.withAlpha(20) : Colors.white.withAlpha(8),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: isFirst ? AppColors.amber.withAlpha(51) : Colors.white.withAlpha(13)),
                  ),
                  child: Row(
                    children: [
                      SizedBox(width: 26, child: Text(
                        rank < medals.length ? medals[rank] : '${rank+1}',
                        style: TextStyle(fontSize: isFirst ? 18 : 13),
                      )),
                      Text(t['emoji'] as String, style: const TextStyle(fontSize: 15)),
                      const SizedBox(width: 6),
                      Expanded(child: Text(t['name'] as String, style: TextStyle(
                        fontSize: 14, fontWeight: isFirst ? FontWeight.bold : FontWeight.w500,
                        color: isFirst ? AppColors.amber : Colors.white,
                      ), overflow: TextOverflow.ellipsis)),
                      // 최근 결과 ●
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: results.take(5).map((r) {
                          final c = r == 'W' ? AppColors.primary : r == 'D' ? AppColors.amber : AppColors.red;
                          return Padding(padding: const EdgeInsets.only(right: 2), child: Text('●', style: TextStyle(fontSize: 11, color: c)));
                        }).toList(),
                      ),
                      const SizedBox(width: 8),
                      Text(gdStr, style: TextStyle(fontSize: 11, color: Colors.white.withAlpha(102))),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                        decoration: BoxDecoration(
                          color: isFirst ? AppColors.amber.withAlpha(40) : Colors.white.withAlpha(13),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text('${t['points']}pt', style: TextStyle(
                          fontSize: 12, fontWeight: FontWeight.bold,
                          color: isFirst ? AppColors.amber : Colors.white,
                        )),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),

          // ── 오늘의 수훈선수 (동적) ──
          if (awards.isNotEmpty) _buildAwardsSection(),

          // ── 푸터 ──
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 18),
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.primary.withAlpha(20),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.primary.withAlpha(40)),
                ),
                child: Text(
                  '#킥킥  #풋살  #경기결과',
                  style: TextStyle(fontSize: 11, color: AppColors.primary.withAlpha(179)),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAwardsSection() {
    final mvp = awards['mvp'] as Map;
    final mvpScore = awards['mvpScore'] as double;
    final topByType = awards['topByType'] as Map<String, Map<String, dynamic>>;
    final topAssister = awards['topAssister'] as Map<String, dynamic>?;

    // 어워드 카드 목록 구성
    final cards = <Widget>[];

    // 이벤트 타입별 1위 카드
    for (final entry in topByType.entries) {
      final player = entry.value['player'] as Map;
      final count = entry.value['count'] as int;
      cards.add(_AwardCard(
        icon: typeIcon(entry.key),
        title: typeLabel(entry.key),
        name: player['name'] as String? ?? '?',
        value: '$count${typeUnit(entry.key)}',
        color: _typeColor(entry.key),
      ));
    }

    // 어시스트 카드
    if (topAssister != null) {
      final ap = topAssister['player'] as Map;
      cards.add(_AwardCard(
        icon: '⚡', title: '도움왕',
        name: ap['name'] as String? ?? '?',
        value: '${topAssister['count']}도움',
        color: AppColors.blue,
      ));
    }

    // 2열 그리드로 배치
    final rows = <Widget>[];
    for (var i = 0; i < cards.length; i += 2) {
      rows.add(Row(
        children: [
          Expanded(child: cards[i]),
          const SizedBox(width: 8),
          i + 1 < cards.length ? Expanded(child: cards[i + 1]) : const Expanded(child: SizedBox()),
        ],
      ));
      if (i + 2 < cards.length) rows.add(const SizedBox(height: 8));
    }

    return _Section(
      title: '🌟 오늘의 수훈선수',
      child: Column(children: [
        // MVP 풀 너비
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppColors.amber, AppColors.orange],
              begin: Alignment.topLeft, end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              const Text('⭐', style: TextStyle(fontSize: 28)),
              const SizedBox(width: 12),
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('오늘의 MVP', style: TextStyle(fontSize: 11, color: Colors.white.withAlpha(204), fontWeight: FontWeight.w600)),
                Text(mvp['name'] as String? ?? '?', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white)),
              ]),
              const Spacer(),
              Text('${(mvp['normScore'] as double? ?? mvpScore).toStringAsFixed(1)}', style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w900, color: Colors.white)),
              Text('/10', style: TextStyle(fontSize: 14, color: Colors.white.withAlpha(179))),
            ],
          ),
        ),
        if (rows.isNotEmpty) ...[
          const SizedBox(height: 8),
          ...rows,
        ],
      ]),
    );
  }

  Color _typeColor(String type) {
    switch (type) {
      case 'GOAL': return AppColors.primary;
      case 'DEFENSE': return AppColors.purple;
      case 'SAVE': return AppColors.blueSky;
      case 'YELLOW_CARD': return AppColors.amber;
      case 'RED_CARD': return AppColors.red;
      default: return AppColors.indigo;
    }
  }
}

// ── 섹션 ─────────────────────────────────────────
class _Section extends StatelessWidget {
  final String title;
  final Widget child;
  const _Section({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 0, 14, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Row(children: [
              Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white70)),
              const SizedBox(width: 8),
              Expanded(child: Container(height: 1, color: Colors.white12)),
            ]),
          ),
          child,
          const SizedBox(height: 4),
        ],
      ),
    );
  }
}

// ── 어워드 카드 ───────────────────────────────────
class _AwardCard extends StatelessWidget {
  final String icon;
  final String title;
  final String name;
  final String value;
  final Color color;
  const _AwardCard({required this.icon, required this.title, required this.name, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withAlpha(51)),
      ),
      child: Row(
        children: [
          Text(icon, style: const TextStyle(fontSize: 20)),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(title, style: TextStyle(fontSize: 10, color: color.withAlpha(179), fontWeight: FontWeight.w600)),
                Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white), overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: color)),
        ],
      ),
    );
  }
}

// ── 액션 버튼 ────────────────────────────────────
class _ActionBtn extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;
  final bool loading;
  const _ActionBtn({required this.icon, required this.label, required this.subtitle, required this.color, required this.onTap, this.loading = false});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: loading ? null : onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        decoration: BoxDecoration(
          color: color.withAlpha(20),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withAlpha(51)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            loading
                ? SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: color, strokeWidth: 2))
                : Icon(icon, color: color, size: 22),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color), textAlign: TextAlign.center),
            Text(subtitle, style: TextStyle(fontSize: 9, color: Colors.white.withAlpha(77)), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }
}
