import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'session_detail_screen.dart';

class SessionsScreen extends StatefulWidget {
  const SessionsScreen({super.key});

  @override
  State<SessionsScreen> createState() => _SessionsScreenState();
}

class _SessionsScreenState extends State<SessionsScreen> {
  final ApiService _api = ApiService();
  List<dynamic> _sessions = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadSessions();
  }

  Future<void> _loadSessions() async {
    try {
      final res = await _api.getSessions();
      if (mounted) {
        setState(() {
          _sessions = (res['sessions'] as List?) ?? [];
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _dayOfWeek(String dateStr) {
    try {
      final d = DateTime.parse(dateStr);
      return ['일', '월', '화', '수', '목', '금', '토'][d.weekday % 7];
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async {
        setState(() => _loading = true);
        await _loadSessions();
      },
      child: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF34d399)))
          : _sessions.isEmpty
              ? _buildEmpty()
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _sessions.length,
                  itemBuilder: (ctx, i) => _buildSessionCard(_sessions[i]),
                ),
    );
  }

  Widget _buildEmpty() {
    return ListView(
      children: [
        SizedBox(
          height: MediaQuery.of(context).size.height * 0.6,
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: Colors.white.withAlpha(13),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Icon(Icons.calendar_today, size: 32, color: Colors.white.withAlpha(64)),
                ),
                const SizedBox(height: 16),
                Text('등록된 일정이 없습니다', style: TextStyle(color: Colors.white.withAlpha(102), fontSize: 16)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSessionCard(Map<String, dynamic> session) {
    final status = session['status'] ?? 'closed';
    final date = session['session_date'] ?? '';
    final title = session['title'] ?? '코너킥스 정기 풋살';
    final dow = _dayOfWeek(date);

    Color statusColor;
    String statusLabel;
    switch (status) {
      case 'recruiting':
        statusColor = const Color(0xFF34d399);
        statusLabel = '모집중';
        break;
      case 'completed':
        statusColor = const Color(0xFF64748b);
        statusLabel = '완료';
        break;
      default:
        statusColor = const Color(0xFFf59e0b);
        statusLabel = '마감';
    }

    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => SessionDetailScreen(sessionId: session['id'])),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white.withAlpha(8),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withAlpha(20)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 상태 뱃지
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withAlpha(26),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: statusColor.withAlpha(64)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle),
                      ),
                      const SizedBox(width: 6),
                      Text(statusLabel, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: statusColor)),
                    ],
                  ),
                ),
                const Spacer(),
                Icon(Icons.chevron_right, color: Colors.white.withAlpha(64), size: 20),
              ],
            ),
            const SizedBox(height: 14),

            // 날짜
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(date, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
                const SizedBox(width: 8),
                Text('($dow요일)', style: TextStyle(fontSize: 13, color: Colors.white.withAlpha(128))),
              ],
            ),
            const SizedBox(height: 6),

            // 제목
            Text(title, style: TextStyle(fontSize: 15, color: Colors.white.withAlpha(179))),
            const SizedBox(height: 12),

            // 정보
            Row(
              children: [
                Icon(Icons.location_on_outlined, size: 15, color: Colors.white.withAlpha(102)),
                const SizedBox(width: 4),
                Text('수성대 풋살장 2번구장', style: TextStyle(fontSize: 12, color: Colors.white.withAlpha(102))),
                const SizedBox(width: 16),
                Icon(Icons.access_time, size: 15, color: Colors.white.withAlpha(102)),
                const SizedBox(width: 4),
                Text('21:00 ~ 23:00', style: TextStyle(fontSize: 12, color: Colors.white.withAlpha(102))),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
