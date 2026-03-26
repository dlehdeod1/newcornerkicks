import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

class HallOfFameScreen extends StatefulWidget {
  final bool embedded;
  const HallOfFameScreen({super.key, this.embedded = false});
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

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }
    if (_records.isEmpty) {
      return const Center(child: Text('기록이 없습니다', style: TextStyle(color: Colors.white38)));
    }
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
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
                        i == 0
                            ? AppColors.amberLight.withAlpha(26)
                            : i == 1
                                ? AppColors.slateLight.withAlpha(26)
                                : AppColors.orange.withAlpha(26),
                        AppColors.bgCard,
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    )
                  : null,
              color: i >= 3 ? AppColors.bgCard : null,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: i == 0 ? AppColors.amberLight.withAlpha(51) : AppColors.surfaceBorder,
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
                          _tag('MVP ${r['mvpCount'] ?? r['mvp_count'] ?? 0}회', AppColors.primary),
                          const SizedBox(width: 8),
                          _tag('${r['goals'] ?? 0}골', AppColors.amberLight),
                          const SizedBox(width: 8),
                          _tag('${r['assists'] ?? 0}도움', AppColors.blueLight),
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
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.embedded) return _buildBody();
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: AppColors.bgBase,
        title: const Text('🏆 명예의 전당', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _buildBody(),
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
