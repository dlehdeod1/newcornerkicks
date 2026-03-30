import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../utils/snackbar_helper.dart';

class SettlementsScreen extends StatefulWidget {
  const SettlementsScreen({super.key});
  @override
  State<SettlementsScreen> createState() => _SettlementsScreenState();
}

class _SettlementsScreenState extends State<SettlementsScreen> {
  dynamic _data;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final token = context.read<AuthService>().token;
      if (token == null) { setState(() => _loading = false); return; }
      final data = await ApiService().getSessionPayments(token);
      setState(() { _data = data; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final isAdmin = auth.isAdmin;

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: AppColors.bgBase,
        title: const Text('정산 내역', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: !auth.isLoggedIn
          ? const Center(child: Text('로그인이 필요합니다', style: TextStyle(color: Colors.white38)))
          : _loading
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : _error != null
                  ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                  : RefreshIndicator(
                      onRefresh: _load,
                      color: AppColors.primary,
                      child: isAdmin ? _AdminView(data: _data) : _MemberView(data: _data),
                    ),
    );
  }
}

// ── 멤버 뷰 ────────────────────────────────────────────────────────────────
class _MemberView extends StatelessWidget {
  final dynamic data;
  const _MemberView({required this.data});

  @override
  Widget build(BuildContext context) {
    final payments = (data?['payments'] as List?) ?? [];

    if (payments.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 120),
          Center(child: Text('납부 내역이 없습니다', style: TextStyle(color: Colors.white38))),
        ],
      );
    }

    // 미납 총액 계산 (면제 제외)
    final unpaidTotal = payments
        .where((p) => p['paid'] != 1 && p['exempt'] != 1)
        .fold<int>(0, (sum, p) => sum + ((p['amount'] as num?)?.toInt() ?? 0));

    // 납부 완료 총액
    final paidTotal = payments
        .where((p) => p['paid'] == 1 && p['exempt'] != 1)
        .fold<int>(0, (sum, p) => sum + ((p['amount'] as num?)?.toInt() ?? 0));

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── 요약 카드 ──
        Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.bgCard,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: unpaidTotal > 0
                  ? AppColors.amber.withAlpha(60)
                  : AppColors.primary.withAlpha(40),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '내 참가비 현황',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  _StatCol(
                    label: '납부 완료',
                    value: paidTotal > 0 ? '₩${_fmt(paidTotal)}' : '-',
                    color: AppColors.primary,
                  ),
                  Container(
                    width: 1,
                    height: 36,
                    color: AppColors.surfaceTint,
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                  ),
                  _StatCol(
                    label: '미납 합계',
                    value: unpaidTotal > 0 ? '₩${_fmt(unpaidTotal)}' : '없음',
                    color: unpaidTotal > 0 ? AppColors.amber : Colors.white38,
                    isBig: unpaidTotal > 0,
                  ),
                  if (unpaidTotal > 0) ...[
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColors.amber.withAlpha(26),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.amber.withAlpha(80)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Text('⚠️', style: TextStyle(fontSize: 12)),
                          SizedBox(width: 4),
                          Text('미납', style: TextStyle(
                            color: AppColors.amber,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          )),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
        // ── 세션별 카드 ──
        ...payments.map((p) => _PaymentTile(payment: p)),
      ],
    );
  }
}

class _StatCol extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final bool isBig;
  const _StatCol({
    required this.label,
    required this.value,
    required this.color,
    this.isBig = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: isBig ? 20 : 16,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 3),
        Text(label, style: TextStyle(color: AppColors.textHint, fontSize: 11)),
      ],
    );
  }
}

class _PaymentTile extends StatelessWidget {
  final dynamic payment;
  const _PaymentTile({required this.payment});

  @override
  Widget build(BuildContext context) {
    final isPaid = payment['paid'] == 1;
    final isExempt = payment['exempt'] == 1;
    final amount = (payment['amount'] as num?)?.toInt() ?? 0;
    final date = payment['session_date'] as String? ?? '';
    final d = DateTime.tryParse(date);
    final dateStr = d != null
        ? '${d.year}.${d.month.toString().padLeft(2, '0')}.${d.day.toString().padLeft(2, '0')}'
        : '';
    final rank = payment['team_rank'] as int?;
    final medal = rank == 1 ? '🥇' : rank == 2 ? '🥈' : rank == 3 ? '🥉' : '⚽';

    Color statusColor;
    String statusLabel;
    if (isExempt) {
      statusColor = AppColors.purple;
      statusLabel = '면제';
    } else if (isPaid) {
      statusColor = AppColors.primary;
      statusLabel = '납부완료';
    } else {
      statusColor = AppColors.amber;
      statusLabel = '미납';
    }

    // 테두리 색상: 미납이면 주황 강조, 납부완료 초록, 면제 보라
    final borderColor = isExempt
        ? AppColors.purple.withAlpha(50)
        : isPaid
            ? AppColors.primary.withAlpha(40)
            : AppColors.amber.withAlpha(70);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        children: [
          // 메달/이모지
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.surfaceBorder,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Text(medal, style: const TextStyle(fontSize: 18)),
            ),
          ),
          const SizedBox(width: 12),
          // 세션 정보
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  payment['session_title'] ?? '정기 풋살',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  dateStr,
                  style: TextStyle(color: AppColors.textHint, fontSize: 11),
                ),
              ],
            ),
          ),
          // 금액 + 상태
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                isExempt ? '면제' : '₩${_fmt(amount)}',
                style: TextStyle(
                  // 미납이면 주황색, 납부완료면 초록색, 면제면 보라색
                  color: isExempt
                      ? AppColors.purple
                      : isPaid
                          ? AppColors.primary
                          : AppColors.amber,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 5),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withAlpha(26),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: statusColor.withAlpha(60)),
                ),
                child: Text(
                  statusLabel,
                  style: TextStyle(
                    color: statusColor,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── 어드민 뷰 ───────────────────────────────────────────────────────────────
class _AdminView extends StatelessWidget {
  final dynamic data;
  const _AdminView({required this.data});

  @override
  Widget build(BuildContext context) {
    final sessions = (data?['sessions'] as List?) ?? [];

    if (sessions.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 120),
          Center(child: Text('정산된 세션이 없습니다', style: TextStyle(color: Colors.white38))),
        ],
      );
    }

    // 전체 요약 계산
    final totalUnpaid = sessions.fold<int>(
        0, (sum, s) => sum + ((s['unpaid_amount'] as num?)?.toInt() ?? 0));
    final totalCollected = sessions.fold<int>(
        0, (sum, s) => sum + ((s['paid_amount'] as num?)?.toInt() ?? 0));

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── 전체 요약 헤더 ──
        if (sessions.isNotEmpty)
          Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: AppColors.bgCard,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.surfaceTint),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '클럽 정산 현황',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _StatCol(
                      label: '징수 완료',
                      value: totalCollected > 0 ? '₩${_fmt(totalCollected)}' : '-',
                      color: AppColors.primary,
                    ),
                    Container(
                      width: 1,
                      height: 36,
                      color: AppColors.surfaceTint,
                      margin: const EdgeInsets.symmetric(horizontal: 16),
                    ),
                    _StatCol(
                      label: '미수금 합계',
                      value: totalUnpaid > 0 ? '₩${_fmt(totalUnpaid)}' : '없음',
                      color: totalUnpaid > 0 ? AppColors.amber : Colors.white38,
                      isBig: totalUnpaid > 0,
                    ),
                    const Spacer(),
                    Text(
                      '${sessions.length}개 세션',
                      style: TextStyle(color: AppColors.iconInactive, fontSize: 11),
                    ),
                  ],
                ),
              ],
            ),
          ),
        // ── 세션 목록 ──
        ...sessions.map<Widget>((s) => _SessionRow(session: s)),
      ],
    );
  }
}

class _SessionRow extends StatelessWidget {
  final dynamic session;
  const _SessionRow({required this.session});

  @override
  Widget build(BuildContext context) {
    final date = session['session_date'] as String? ?? '';
    final d = DateTime.tryParse(date);
    final total = (session['total_members'] as num?)?.toInt() ?? 0;
    final paid = (session['paid_count'] as num?)?.toInt() ?? 0;
    final exempt = (session['exempt_count'] as num?)?.toInt() ?? 0;
    final unpaidAmt = (session['unpaid_amount'] as num?)?.toInt() ?? 0;
    final totalAmt = (session['total_amount'] as num?)?.toInt() ?? 0;
    final paidAmt = (session['paid_amount'] as num?)?.toInt() ?? 0;
    final sessionId = session['session_id'] as int?;
    final isFullyPaid = unpaidAmt == 0 && total > 0;

    return GestureDetector(
      onTap: sessionId != null
          ? () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => _SessionDetailPage(
                    sessionId: sessionId,
                    title: session['title'] ?? (d != null
                        ? '${d.month}/${d.day} 세션'
                        : '세션'),
                  ),
                ),
              )
          : null,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.bgCard,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isFullyPaid
                ? AppColors.primary.withAlpha(40)
                : AppColors.surfaceTint,
          ),
        ),
        child: Column(
          children: [
            Row(
              children: [
                // 날짜 박스
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withAlpha(20),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        date.length >= 7 ? date.substring(5, 7) : '-',
                        style: TextStyle(
                          fontSize: 10,
                          color: AppColors.primary.withAlpha(179),
                        ),
                      ),
                      Text(
                        date.length >= 10 ? date.substring(8, 10) : '-',
                        style: const TextStyle(
                          fontSize: 15,
                          color: AppColors.primary,
                          fontWeight: FontWeight.bold,
                          height: 1.1,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 14),
                // 세션 제목 + 납부 배지
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        session['title'] ?? '정기 풋살',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          _badge('$paid/$total 납부', AppColors.primary),
                          if (exempt > 0) ...[
                            const SizedBox(width: 6),
                            _badge('면제 $exempt명', AppColors.purple),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                // 완납/미납 상태
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (isFullyPaid)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withAlpha(26),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppColors.primary.withAlpha(60)),
                        ),
                        child: const Text(
                          '완납',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                      )
                    else if (unpaidAmt > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.amber.withAlpha(20),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppColors.amber.withAlpha(60)),
                        ),
                        child: Text(
                          '미수 ₩${_fmt(unpaidAmt)}',
                          style: const TextStyle(
                            color: AppColors.amber,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    const SizedBox(height: 4),
                    Icon(Icons.chevron_right, color: AppColors.iconInactive, size: 18),
                  ],
                ),
              ],
            ),
            // ── 금액 진행 바 ──
            if (totalAmt > 0) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // 진행률 텍스트
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              '징수 ₩${_fmt(paidAmt)} / 총 ₩${_fmt(totalAmt)}',
                              style: TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 11,
                              ),
                            ),
                            Text(
                              totalAmt > 0
                                  ? '${((paidAmt / totalAmt) * 100).round()}%'
                                  : '0%',
                              style: const TextStyle(
                                color: AppColors.primary,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 5),
                        // 진행 바
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: totalAmt > 0 ? (paidAmt / totalAmt).clamp(0.0, 1.0) : 0,
                            backgroundColor: AppColors.surfaceTint,
                            valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                            minHeight: 6,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _badge(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withAlpha(26),
        borderRadius: BorderRadius.circular(5),
      ),
      child: Text(label, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w600)),
    );
  }
}

// ── 어드민 세션 상세 페이지 ─────────────────────────────────────────────────
class _SessionDetailPage extends StatefulWidget {
  final int sessionId;
  final String title;
  const _SessionDetailPage({required this.sessionId, required this.title});

  @override
  State<_SessionDetailPage> createState() => _SessionDetailPageState();
}

class _SessionDetailPageState extends State<_SessionDetailPage> {
  List<dynamic> _payments = [];
  dynamic _summary;
  bool _loading = true;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final token = context.read<AuthService>().token!;
      final data = await ApiService().getSessionPaymentDetail(widget.sessionId, token);
      setState(() {
        _payments = (data['payments'] as List?) ?? [];
        _summary = data['summary'];
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  Future<void> _sendRemind() async {
    setState(() => _sending = true);
    try {
      final token = context.read<AuthService>().token!;
      final res = await ApiService().sendSettlementRemind(widget.sessionId, token);
      final count = res['sentCount'] ?? 0;
      if (mounted) {
        if (count > 0) {
          showSuccess(context, '$count명에게 독촉 알림을 보냈습니다');
        } else {
          showError(context, '알림 대상이 없습니다 (모두 납부 또는 계정 미연동)');
        }
      }
    } catch (e) {
      if (mounted) showError(context, e.toString());
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _togglePaid(int paymentId, bool current) async {
    try {
      final token = context.read<AuthService>().token!;
      await ApiService().updatePaymentPaid(paymentId, !current, token);
      await _load();
    } catch (e) {
      if (mounted) {
        showError(context, e.toString());
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final totalMembers = _summary?['total'] ?? 0;
    final paidCount = _summary?['paid'] ?? 0;
    final unpaidAmt = (_summary?['unpaidAmount'] as num?)?.toInt() ?? 0;
    final totalAmt = (_summary?['totalAmount'] as num?)?.toInt() ?? 0;
    final paidAmt = (_summary?['paidAmount'] as num?)?.toInt() ?? 0;

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: AppColors.bgBase,
        title: Text(widget.title,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : Column(
              children: [
                // ── 요약 헤더 ──
                Container(
                  margin: const EdgeInsets.all(16),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.bgCard,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.surfaceTint),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          _SummaryChip(
                            label: '전체',
                            value: '$totalMembers명',
                            color: Colors.white,
                          ),
                          _SummaryChip(
                            label: '납부',
                            value: '$paidCount명',
                            color: AppColors.primary,
                          ),
                          _SummaryChip(
                            label: '미납액',
                            value: unpaidAmt > 0 ? '₩${_fmt(unpaidAmt)}' : '없음',
                            color: unpaidAmt > 0
                                ? AppColors.amber
                                : AppColors.primary,
                          ),
                        ],
                      ),
                      // ── 총 징수 현황 바 ──
                      if (totalAmt > 0) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceBorder,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Column(
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        '총 징수 대상',
                                        style: TextStyle(
                                          color: AppColors.textSecondary,
                                          fontSize: 11,
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        '₩${_fmt(totalAmt)}',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ),
                                  Row(
                                    children: [
                                      Text(
                                        '납부 ',
                                        style: TextStyle(
                                          color: AppColors.textSecondary,
                                          fontSize: 11,
                                        ),
                                      ),
                                      Text(
                                        '₩${_fmt(paidAmt)}',
                                        style: const TextStyle(
                                          color: AppColors.primary,
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      Text(
                                        ' / ${totalAmt > 0 ? ((paidAmt / totalAmt) * 100).round() : 0}%',
                                        style: TextStyle(
                                          color: AppColors.textHint,
                                          fontSize: 11,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(4),
                                child: LinearProgressIndicator(
                                  value: totalAmt > 0
                                      ? (paidAmt / totalAmt).clamp(0.0, 1.0)
                                      : 0,
                                  backgroundColor: AppColors.surfaceTint,
                                  valueColor: const AlwaysStoppedAnimation<Color>(
                                      AppColors.primary),
                                  minHeight: 7,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                // ── 미입금 독촉 알림 버튼 ──
                if (unpaidAmt > 0)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _sending ? null : _sendRemind,
                        icon: _sending
                            ? const SizedBox(
                                width: 16, height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.notifications_active_rounded, size: 18),
                        label: Text(_sending ? '발송 중...' : '미입금자 알림 발송'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.amber,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                          textStyle: const TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                  ),
                if (unpaidAmt > 0) const SizedBox(height: 12),
                // ── 멤버별 납부 목록 ──
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _load,
                    color: AppColors.primary,
                    child: ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: _payments.length,
                      itemBuilder: (ctx, i) {
                        final p = _payments[i];
                        final isPaid = p['paid'] == 1;
                        final isExempt = p['exempt'] == 1;
                        final amount = (p['amount'] as num?)?.toInt() ?? 0;
                        final rank = p['team_rank'] as int?;
                        final medal =
                            rank == 1 ? '🥇' : rank == 2 ? '🥈' : rank == 3 ? '🥉' : '⚽';

                        // 테두리 색상
                        final borderColor = isExempt
                            ? AppColors.purple.withAlpha(40)
                            : isPaid
                                ? AppColors.primary.withAlpha(40)
                                : AppColors.amber.withAlpha(70);

                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: AppColors.bgCard,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: borderColor),
                          ),
                          child: Row(
                            children: [
                              Text(medal,
                                  style: const TextStyle(fontSize: 18)),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      p['player_name'] ?? '선수',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w600,
                                        fontSize: 14,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      isExempt ? '면제' : '₩${_fmt(amount)}',
                                      style: TextStyle(
                                        color: isExempt
                                            ? AppColors.purple
                                            : isPaid
                                                ? AppColors.primary
                                                : AppColors.amber,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              // 납부 토글 버튼
                              if (isExempt)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 6),
                                  decoration: BoxDecoration(
                                    color:
                                        AppColors.purple.withAlpha(26),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Text(
                                    '면제',
                                    style: TextStyle(
                                      color: AppColors.purple,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                )
                              else
                                GestureDetector(
                                  onTap: () =>
                                      _togglePaid(p['id'] as int, isPaid),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 10, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: isPaid
                                          ? AppColors.primary.withAlpha(26)
                                          : AppColors.amber.withAlpha(26),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                        color: isPaid
                                            ? AppColors.primary.withAlpha(80)
                                            : AppColors.amber.withAlpha(80),
                                      ),
                                    ),
                                    child: Text(
                                      isPaid ? '납부완료' : '미납',
                                      style: TextStyle(
                                        color: isPaid
                                            ? AppColors.primary
                                            : AppColors.amber,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}

class _SummaryChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _SummaryChip(
      {required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(value,
              style: TextStyle(
                  color: color, fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(label,
              style: TextStyle(color: AppColors.textHint, fontSize: 11)),
        ],
      ),
    );
  }
}

String _fmt(int n) {
  if (n >= 1000) return '${n ~/ 1000},${(n % 1000).toString().padLeft(3, '0')}';
  return '$n';
}
