import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

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

  Future<dynamic> register(String email, String username, String password, {String? playerCode}) =>
      request('/auth/register', method: 'POST', body: {'email': email, 'username': username, 'password': password, 'playerCode': playerCode});

  Future<dynamic> me(String token) =>
      request('/auth/me', token: token);

  // Sessions
  Future<dynamic> getSessions({String? status, int? limit}) {
    final params = <String>[];
    if (status != null) params.add('status=$status');
    if (limit != null) params.add('limit=$limit');
    final query = params.isNotEmpty ? '?${params.join('&')}' : '';
    return request('/sessions$query');
  }

  Future<dynamic> getSession(int id) => request('/sessions/$id');

  // Rankings
  Future<dynamic> getRankings({int? year}) =>
      request('/rankings${year != null ? '?year=$year' : ''}');

  Future<dynamic> getHallOfFame() => request('/rankings/hall-of-fame');

  // Players
  Future<dynamic> getPlayers({String? token}) =>
      request('/players', token: token);

  Future<dynamic> getPlayer(int id) => request('/players/$id');

  // Me
  Future<dynamic> getMyStats(String token) =>
      request('/me/stats', token: token);

  // Matches
  Future<dynamic> getMatch(int id) => request('/matches/$id');
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  ApiException(this.message, this.statusCode);

  @override
  String toString() => message;
}
