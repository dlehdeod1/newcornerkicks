import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

class HallOfFameScreen extends StatefulWidget {
  const HallOfFameScreen({super.key});
  @override
  State<HallOfFameScreen> createState() => _HallOfFameScreenState();
}

class _HallOfFameScreenState extends State<HallOfFameScreen> {
  List<dynamic> _records = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final token = context.read<AuthService>().token ?? "";
      final data = await ApiService().getHallOfFame(token);
      setState(() {
        _records = data['data']?['records'] ?? data['records'] ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0f172a),
        title: const Text('🏆 명예의 전당', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF34d399)))
          : _records.isEmpty
              ? const Center(child: Text('기록이 없습니다', style: TextStyle(color: Colors.white38)))
              : RefreshIndicator(
                  onRefresh: _load,
                  color: const Color(0xFF34d399),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _records.length,
                    itemBuilder: (ctx, i) {
                      final r = _records[i];
                      final medal = i == 0 ? '🥇' : i == 1 ? '🥈' : i == 2 ? '🥉' : '🏅';
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          gradient: i < 3
                              ? LinearGradient(
                                  colors: [
                                    i == 0 ? const Color(0xFFfbbf24).withAlpha(26) : i == 1 ? const Color(0xFF94a3b8).withAlpha(26) : const Color(0xFFf97316).withAlpha(26),
                                    const Color(0xFF1e293b),
                                  ],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                )
                              : null,
                          color: i >= 3 ? const Color(0xFF1e293b) : null,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: i == 0 ? const Color(0xFFfbbf24).withAlpha(51) : Colors.white.withAlpha(13),
                          ),
                        ),
                        child: Row(
                          children: [
                            Text(medal, style: const TextStyle(fontSize: 28)),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${r['year'] ?? ''}년 시즌',
                                    style: const TextStyle(color: Colors.white54, fontSize: 12),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    r['playerName'] ?? r['player_name'] ?? '알 수 없음',
                                    style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      _tag('MVP ${r['mvpCount'] ?? r['mvp_count'] ?? 0}회', const Color(0xFF34d399)),
                                      const SizedBox(width: 8),
                                      _tag('${r['goals'] ?? 0}골', const Color(0xFFfbbf24)),
                                      const SizedBox(width: 8),
                                      _tag('${r['assists'] ?? 0}도움', const Color(0xFF60a5fa)),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
    );
  }

  Widget _tag(String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: color.withAlpha(26),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(text, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
      );
}
