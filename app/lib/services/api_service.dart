import 'dart:convert';
import 'dart:io';
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

  // Me (프로필 요약)
  Future<dynamic> getProfileSummary(String token) =>
      request('/me/profile-summary', token: token);

  // 선호 선수
  Future<dynamic> getPreferences(String token) =>
      request('/players/preferences/mine', token: token);

  Future<dynamic> addPreference(int targetId, String token) =>
      request('/players/preferences/$targetId', method: 'POST', token: token);

  Future<dynamic> removePreference(int targetId, String token) =>
      request('/players/preferences/$targetId', method: 'DELETE', token: token);

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

  Future<dynamic> getExemptions(String token) =>
      request('/clubs/me/members/exemptions', token: token);

  Future<dynamic> updateExemption(String userId, Map<String, dynamic> data, String token) =>
      request('/clubs/me/members/$userId/exemption', method: 'PUT', body: data, token: token);

  // Sessions
  Future<dynamic> getSessions({String? status, int? limit, String? token}) {
    final params = <String>[];
    if (status != null) params.add('status=$status');
    if (limit != null) params.add('limit=$limit');
    final query = params.isNotEmpty ? '?${params.join('&')}' : '';
    return request('/sessions$query', token: token);
  }

  Future<dynamic> getSession(int id, {String? token}) => request('/sessions/$id', token: token);

  Future<dynamic> deleteSession(int id, String token) =>
      request('/sessions/$id', method: 'DELETE', token: token);

  Future<dynamic> duplicateSession(int sessionId, String sessionDate, {String? title, required String token}) =>
      request('/sessions/$sessionId/duplicate', method: 'POST', body: {
        'sessionDate': sessionDate,
        if (title != null) 'title': title,
      }, token: token);

  // Rankings
  Future<dynamic> getRankings({int? year, String? token}) =>
      request('/rankings${year != null ? '?year=$year' : ''}', token: token);

  Future<dynamic> getHallOfFame(String token) => request('/rankings/hall-of-fame', token: token);

  Future<dynamic> getFunStats({int? year, String? token}) =>
      request('/rankings/fun-stats${year != null ? '?year=$year' : ''}', token: token);

  Future<dynamic> refreshRankings(int year, String token) =>
      request('/rankings/refresh?year=$year', method: 'POST', token: token);

  // Players
  Future<dynamic> createPlayer(String name, {String? nickname, required String token}) =>
      request('/players', method: 'POST', body: {'name': name, if (nickname != null) 'nickname': nickname}, token: token);

  Future<dynamic> getPlayers({String? token}) =>
      request('/players', token: token);

  Future<dynamic> getPlayer(int id) => request('/players/$id');

  Future<dynamic> getPlayerEventLogs(int playerId, {int? year}) =>
      request('/players/$playerId/event-logs${year != null ? '?year=$year' : ''}');

  Future<dynamic> submitRating(int playerId, Map<String, dynamic> ratings, String token) =>
      request('/players/$playerId/ratings', method: 'POST', body: ratings, token: token);

  // 태그 투표
  Future<dynamic> voteTags(int playerId, List<String> tags, String token) =>
      request('/players/$playerId/tags', method: 'POST', body: {'tags': tags}, token: token);

  Future<dynamic> deleteTag(int playerId, String tag, String token) =>
      request('/players/$playerId/tags/${Uri.encodeComponent(tag)}', method: 'DELETE', token: token);

  // 케미
  Future<dynamic> getChemistry(int playerId, String token) =>
      request('/players/$playerId/chemistry', token: token);

  // 스트릭
  Future<dynamic> getStreaks(int playerId, String token, {int? year}) =>
      request('/players/$playerId/streaks${year != null ? '?year=$year' : ''}', token: token);

  // 사진 업로드 (multipart)
  Future<dynamic> uploadPlayerPhoto(int playerId, File file, String token) async {
    final url = Uri.parse('${ApiConfig.baseUrl}/players/$playerId/photo');
    final req = http.MultipartRequest('POST', url);
    req.headers['Authorization'] = 'Bearer $token';
    if (activeClubId != null) {
      req.headers['X-Club-Id'] = activeClubId.toString();
    }
    req.files.add(await http.MultipartFile.fromPath('photo', file.path));
    final streamed = await req.send();
    final body = await streamed.stream.bytesToString();
    final data = jsonDecode(body);
    if (streamed.statusCode >= 400) {
      throw ApiException(data['error'] ?? '업로드 실패', streamed.statusCode);
    }
    return data;
  }

  Future<dynamic> deletePlayerPhoto(int playerId, String token) =>
      request('/players/$playerId/photo', method: 'DELETE', token: token);

  // 관리자 선수 관리
  Future<dynamic> approvePlayerLink(int playerId, String token) =>
      request('/players/$playerId/approve-link', method: 'POST', token: token);

  Future<dynamic> resetPlayerPassword(int playerId, String token) =>
      request('/players/$playerId/reset-password', method: 'POST', token: token);

  Future<dynamic> deletePlayer(int playerId, String token) =>
      request('/players/$playerId', method: 'DELETE', token: token);

  Future<dynamic> updatePlayer(int playerId, Map<String, dynamic> data, String token) =>
      request('/players/$playerId', method: 'PUT', body: data, token: token);

  Future<dynamic> relinkPlayer(int playerId, int? userId, String token) =>
      request('/players/$playerId/relink', method: 'POST', body: {'userId': userId}, token: token);

  Future<dynamic> searchUsers(String query, String token) =>
      request('/players/admin/search-users?q=${Uri.encodeQueryComponent(query)}', token: token);

  // 팀 편성
  Future<dynamic> createTeams(int sessionId, List<Map<String, dynamic>> attendees, String token, {bool useAI = false}) =>
      request('/sessions/$sessionId/teams', method: 'POST', body: {'attendees': attendees, 'useAI': useAI}, token: token);

  Future<dynamic> createTeamsManual(int sessionId, List<Map<String, dynamic>> teams, String token) =>
      request('/sessions/$sessionId/teams/manual', method: 'POST', body: {'teams': teams}, token: token);

  // AI 분석
  Future<dynamic> getAiAnalysis(int sessionId, String token) =>
      request('/sessions/$sessionId/ai-analysis', method: 'POST', token: token);

  // Me
  Future<dynamic> getMyStats(String token) =>
      request('/me/stats', token: token);

  // Stats
  Future<dynamic> getSeasonSummary(String token, {int? year}) =>
      request('/stats/season-summary${year != null ? '?year=$year' : ''}', token: token);

  // Subscriptions
  Future<dynamic> getSubscription(String token) =>
      request('/subscriptions/me', token: token);

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

  Future<dynamic> broadcastNotification({
    required String type,
    required String title,
    required String message,
    String? linkUrl,
    required String token,
  }) =>
      request('/notifications/broadcast', method: 'POST', body: {
        'type': type,
        'title': title,
        'message': message,
        if (linkUrl != null && linkUrl.isNotEmpty) 'linkUrl': linkUrl,
      }, token: token);

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

  Future<dynamic> getSessionSettlement(int sessionId, String token) =>
      request('/sessions/$sessionId/settlement', token: token);

  // Payments
  Future<dynamic> getSessionPayments(String token) =>
      request('/payments/sessions', token: token);

  Future<dynamic> getSessionPaymentDetail(int sessionId, String token) =>
      request('/payments/sessions/$sessionId', token: token);

  Future<dynamic> updatePaymentPaid(int paymentId, bool paid, String token, {String? depositorName}) =>
      request('/payments/$paymentId/paid', method: 'PUT', body: {
        'paid': paid,
        if (depositorName != null) 'depositorName': depositorName,
      }, token: token);

  Future<dynamic> updatePaymentExempt(int paymentId, bool exempt, String token) =>
      request('/payments/$paymentId/exempt', method: 'PUT', body: {'exempt': exempt}, token: token);

  Future<dynamic> sendSettlementRemind(int sessionId, String token) =>
      request('/sessions/$sessionId/settlement-remind', method: 'POST', token: token);

  Future<dynamic> getMembershipPayments(String token) =>
      request('/payments/membership', token: token);

  // 비용 기록
  Future<dynamic> getSessionExpenses(int sessionId, String token) =>
      request('/payments/sessions/$sessionId/expenses', token: token);

  Future<dynamic> addSessionExpense(int sessionId, String description, int amount, String token) =>
      request('/payments/sessions/$sessionId/expenses', method: 'POST', body: {
        'description': description,
        'amount': amount,
      }, token: token);

  Future<dynamic> deleteSessionExpense(int sessionId, int expenseId, String token) =>
      request('/payments/sessions/$sessionId/expenses/$expenseId', method: 'DELETE', token: token);

  // Announcements (공지)
  Future<dynamic> getAnnouncements(String token, {int? limit, int? offset}) {
    final params = <String>[];
    if (limit != null) params.add('limit=$limit');
    if (offset != null) params.add('offset=$offset');
    final qs = params.isNotEmpty ? '?${params.join('&')}' : '';
    return request('/announcements$qs', token: token);
  }

  Future<dynamic> getAnnouncement(int id, String token) =>
      request('/announcements/$id', token: token);

  Future<dynamic> getAnnouncementUnreadCount(String token) =>
      request('/announcements/unread-count', token: token);

  Future<dynamic> createAnnouncement(Map<String, dynamic> data, String token) =>
      request('/announcements', method: 'POST', body: data, token: token);

  Future<dynamic> updateAnnouncement(int id, Map<String, dynamic> data, String token) =>
      request('/announcements/$id', method: 'PUT', body: data, token: token);

  Future<dynamic> deleteAnnouncement(int id, String token) =>
      request('/announcements/$id', method: 'DELETE', token: token);

  // Posts (게시판)
  Future<dynamic> getPosts(String token, {String? category, int? limit, int? offset}) {
    final params = <String>[];
    if (category != null) params.add('category=$category');
    if (limit != null) params.add('limit=$limit');
    if (offset != null) params.add('offset=$offset');
    final qs = params.isNotEmpty ? '?${params.join('&')}' : '';
    return request('/posts$qs', token: token);
  }

  Future<dynamic> getPost(int id, String token) =>
      request('/posts/$id', token: token);

  Future<dynamic> createPost(Map<String, dynamic> data, String token) =>
      request('/posts', method: 'POST', body: data, token: token);

  Future<dynamic> updatePost(int id, Map<String, dynamic> data, String token) =>
      request('/posts/$id', method: 'PUT', body: data, token: token);

  Future<dynamic> deletePost(int id, String token) =>
      request('/posts/$id', method: 'DELETE', token: token);

  Future<dynamic> addComment(int postId, String content, String token) =>
      request('/posts/$postId/comments', method: 'POST', body: {'content': content}, token: token);

  Future<dynamic> deleteComment(int postId, int commentId, String token) =>
      request('/posts/$postId/comments/$commentId', method: 'DELETE', token: token);

  // Community (전체 커뮤니티)
  Future<dynamic> getCommunityPosts(String token, {String? category, String? region, String? dayOfWeek, String? timeSlot, String? skillLevel, String? status, int? limit, int? offset}) {
    final params = <String>[];
    if (category != null) params.add('category=$category');
    if (region != null) params.add('region=$region');
    if (dayOfWeek != null) params.add('dayOfWeek=$dayOfWeek');
    if (timeSlot != null) params.add('timeSlot=$timeSlot');
    if (skillLevel != null) params.add('skillLevel=$skillLevel');
    if (status != null) params.add('status=$status');
    if (limit != null) params.add('limit=$limit');
    if (offset != null) params.add('offset=$offset');
    final qs = params.isNotEmpty ? '?${params.join('&')}' : '';
    return request('/community$qs', token: token);
  }

  Future<dynamic> getCommunityPost(int id, String token) =>
      request('/community/$id', token: token);

  Future<dynamic> createCommunityPost(Map<String, dynamic> data, String token) =>
      request('/community', method: 'POST', body: data, token: token);

  Future<dynamic> updateCommunityPost(int id, Map<String, dynamic> data, String token) =>
      request('/community/$id', method: 'PUT', body: data, token: token);

  Future<dynamic> deleteCommunityPost(int id, String token) =>
      request('/community/$id', method: 'DELETE', token: token);

  Future<dynamic> addCommunityComment(int postId, String content, String token) =>
      request('/community/$postId/comments', method: 'POST', body: {'content': content}, token: token);

  Future<dynamic> deleteCommunityComment(int postId, int commentId, String token) =>
      request('/community/$postId/comments/$commentId', method: 'DELETE', token: token);

  // Badges
  Future<List<dynamic>> getBadges({required String token}) =>
      request('/badges', token: token).then((r) => (r['data'] ?? r['badges'] ?? []) as List<dynamic>);

  Future<List<dynamic>> getPlayerBadges(int playerId, {required String token}) =>
      request('/badges/player/$playerId', token: token).then((r) => (r['data'] ?? r['badges'] ?? []) as List<dynamic>);

  // Streaks (home용)
  Future<Map<String, dynamic>> getPlayerStreaks(int playerId, {required String token}) =>
      request('/stats/streaks/$playerId', token: token).then((r) => (r['streaks'] ?? r) as Map<String, dynamic>);

  // Season Awards
  Future<dynamic> getSeasonAwards({int? year, required String token}) =>
      request('/awards${year != null ? '?year=$year' : ''}', token: token);

  // Reactions
  Future<dynamic> addReaction(int postId, String emoji, String token) =>
      request('/posts/$postId/reactions', method: 'POST', body: {'emoji': emoji}, token: token);

  Future<dynamic> removeReaction(int postId, String emoji, String token) =>
      request('/posts/$postId/reactions', method: 'DELETE', body: {'emoji': emoji}, token: token);

  // Comment edit
  Future<dynamic> editComment(int postId, int commentId, String content, String token) =>
      request('/posts/$postId/comments/$commentId', method: 'PUT', body: {'content': content}, token: token);

  // Community reactions & comment edit
  Future<dynamic> addCommunityReaction(int postId, String emoji, String token) =>
      request('/community/$postId/reactions', method: 'POST', body: {'emoji': emoji}, token: token);

  Future<dynamic> removeCommunityReaction(int postId, String emoji, String token) =>
      request('/community/$postId/reactions', method: 'DELETE', body: {'emoji': emoji}, token: token);

  Future<dynamic> editCommunityComment(int postId, int commentId, String content, String token) =>
      request('/community/$postId/comments/$commentId', method: 'PUT', body: {'content': content}, token: token);

  // 이미지 업로드 (범용 multipart)
  Future<dynamic> uploadImage(File file, String prefix, String token) async {
    final url = Uri.parse('${ApiConfig.baseUrl}/uploads');
    final req = http.MultipartRequest('POST', url);
    req.headers['Authorization'] = 'Bearer $token';
    if (activeClubId != null) {
      req.headers['X-Club-Id'] = activeClubId.toString();
    }
    req.fields['prefix'] = prefix;
    req.files.add(await http.MultipartFile.fromPath('file', file.path));
    final streamed = await req.send();
    final body = await streamed.stream.bytesToString();
    final data = jsonDecode(body);
    if (streamed.statusCode >= 400) {
      throw ApiException(data['error'] ?? '업로드 실패', streamed.statusCode);
    }
    return data;
  }
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  ApiException(this.message, this.statusCode);

  @override
  String toString() => message;
}
