import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  /// 활성 클럽 ID - 설정하면 모든 요청에 X-Club-Id 헤더 포함
  int? activeClubId;

  Future<dynamic> request(
    String endpoint, {
    String method = 'GET',
    Map<String, dynamic>? body,
    String? token,
  }) async {
    final url = Uri.parse('${ApiConfig.baseUrl}$endpoint');

    final headers = <String, String>{
      'Content-Type': 'application/json',
    };

    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }

    if (activeClubId != null) {
      headers['X-Club-Id'] = activeClubId.toString();
    }

    http.Response response;

    switch (method) {
      case 'POST':
        response = await http.post(url, headers: headers, body: body != null ? jsonEncode(body) : null);
        break;
      case 'PUT':
        response = await http.put(url, headers: headers, body: body != null ? jsonEncode(body) : null);
        break;
      case 'DELETE':
        response = await http.delete(url, headers: headers);
        break;
      default:
        response = await http.get(url, headers: headers);
    }

    final data = jsonDecode(response.body);

    if (response.statusCode >= 400) {
      throw ApiException(data['error'] ?? '요청에 실패했습니다.', response.statusCode);
    }

    return data;
  }

  // Auth
  Future<dynamic> login(String identifier, String password) =>
      request('/auth/login', method: 'POST', body: {'identifier': identifier, 'password': password});

  Future<dynamic> register(String email, String username, String password, {String? playerCode, String? inviteCode}) =>
      request('/auth/register', method: 'POST', body: {
        'email': email,
        'username': username,
        'password': password,
        if (playerCode != null) 'playerCode': playerCode,
        if (inviteCode != null) 'inviteCode': inviteCode,
      });

  Future<dynamic> me(String token) =>
      request('/auth/me', token: token);

  Future<dynamic> updateProfile(Map<String, dynamic> data, String token) =>
      request('/auth/profile', method: 'PUT', body: data, token: token);

  Future<dynamic> changePassword(String oldPassword, String newPassword, String token) =>
      request('/auth/password', method: 'PUT', body: {'oldPassword': oldPassword, 'newPassword': newPassword}, token: token);

  // Clubs
  Future<dynamic> checkSlug(String slug) =>
      request('/clubs/check-slug?slug=$slug');

  Future<dynamic> createClub(String slug, String name, String token, {String? description, List<String>? enabledEvents}) =>
      request('/clubs', method: 'POST', body: {
        'slug': slug,
        'name': name,
        if (description != null) 'description': description,
        'enabledEvents': enabledEvents ?? ['GOAL', 'SAVE'],
      }, token: token);

  Future<dynamic> joinClub(String inviteCode, String token) =>
      request('/clubs/join', method: 'POST', body: {'inviteCode': inviteCode}, token: token);

  Future<dynamic> getMyClub(String token) =>
      request('/clubs/me', token: token);

  Future<dynamic> updateClub(Map<String, dynamic> data, String token) =>
      request('/clubs/me', method: 'PUT', body: data, token: token);

  Future<dynamic> regenerateInvite(String token) =>
      request('/clubs/me/regenerate-invite', method: 'POST', token: token);

  Future<dynamic> getClubMembers(String token) =>
      request('/clubs/me/members', token: token);

  // Sessions
  Future<dynamic> getSessions({String? status, int? limit, String? token}) {
    final params = <String>[];
    if (status != null) params.add('status=$status');
    if (limit != null) params.add('limit=$limit');
    final query = params.isNotEmpty ? '?${params.join('&')}' : '';
    return request('/sessions$query', token: token);
  }

  Future<dynamic> getSession(int id, {String? token}) => request('/sessions/$id', token: token);

  // Rankings
  Future<dynamic> getRankings({int? year, String? token}) =>
      request('/rankings${year != null ? '?year=$year' : ''}', token: token);

  Future<dynamic> getHallOfFame(String token) => request('/rankings/hall-of-fame', token: token);

  Future<dynamic> getFunStats({int? year, String? token}) =>
      request('/rankings/fun-stats${year != null ? '?year=$year' : ''}', token: token);

  Future<dynamic> refreshRankings(int year, String token) =>
      request('/rankings/refresh?year=$year', method: 'POST', token: token);

  // Players
  Future<dynamic> getPlayers({String? token}) =>
      request('/players', token: token);

  Future<dynamic> getPlayer(int id) => request('/players/$id');

  Future<dynamic> getPlayerEventLogs(int playerId, {int? year}) =>
      request('/players/$playerId/event-logs${year != null ? '?year=$year' : ''}');

  Future<dynamic> submitRating(int playerId, Map<String, dynamic> ratings, String token) =>
      request('/players/$playerId/ratings', method: 'POST', body: ratings, token: token);

  // Me
  Future<dynamic> getMyStats(String token) =>
      request('/me/stats', token: token);

  // Matches
  Future<dynamic> getMatch(int id) => request('/matches/$id');

  Future<dynamic> addMatchEvent(int matchId, Map<String, dynamic> event, String token) =>
      request('/matches/$matchId/events', method: 'POST', body: event, token: token);

  Future<dynamic> deleteMatchEvent(int matchId, int eventId, String token) =>
      request('/matches/$matchId/events/$eventId', method: 'DELETE', token: token);

  Future<dynamic> updateMatch(int matchId, Map<String, dynamic> data, String token) =>
      request('/matches/$matchId', method: 'PUT', body: data, token: token);

  // Notifications
  Future<dynamic> getNotifications(String token, {int? limit, bool? unread}) {
    final params = <String>[];
    if (limit != null) params.add('limit=$limit');
    if (unread == true) params.add('unread=true');
    final query = params.isNotEmpty ? '?${params.join('&')}' : '';
    return request('/notifications$query', token: token);
  }

  Future<dynamic> markNotificationRead(int id, String token) =>
      request('/notifications/$id/read', method: 'PUT', token: token);

  Future<dynamic> markAllNotificationsRead(String token) =>
      request('/notifications/read-all', method: 'PUT', token: token);

  // RSVP
  Future<dynamic> rsvpSession(int sessionId, String status, String token) =>
      request('/sessions/$sessionId/rsvp', method: 'POST', body: {'status': status}, token: token);

  // Google OAuth
  Future<dynamic> loginWithGoogle(String idToken) =>
      request('/auth/google', method: 'POST', body: {'idToken': idToken});

  // Settlements (legacy)
  Future<dynamic> getSettlementSummary({int? year, String? token}) =>
      request('/settlements/summary${year != null ? '?year=$year' : ''}', token: token);

  Future<dynamic> getMySettlements(String token) =>
      request('/settlements/me', token: token);

  // Payments
  Future<dynamic> getSessionPayments(String token) =>
      request('/payments/sessions', token: token);

  Future<dynamic> getSessionPaymentDetail(int sessionId, String token) =>
      request('/payments/sessions/$sessionId', token: token);

  Future<dynamic> updatePaymentPaid(int paymentId, bool paid, String token) =>
      request('/payments/$paymentId/paid', method: 'PUT', body: {'paid': paid}, token: token);

  Future<dynamic> updatePaymentExempt(int paymentId, bool exempt, String token) =>
      request('/payments/$paymentId/exempt', method: 'PUT', body: {'exempt': exempt}, token: token);

  Future<dynamic> getMembershipPayments(String token) =>
      request('/payments/membership', token: token);
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  ApiException(this.message, this.statusCode);

  @override
  String toString() => message;
}
