import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'api_service.dart';

class AuthService extends ChangeNotifier {
  final ApiService _api = ApiService();

  String? _token;
  Map<String, dynamic>? _user;
  Map<String, dynamic>? _player;
  Map<String, dynamic>? _club;
  bool _isLoading = true;

  String? get token => _token;
  Map<String, dynamic>? get user => _user;
  Map<String, dynamic>? get player => _player;
  Map<String, dynamic>? get club => _club;
  bool get isLoggedIn => _token != null;
  bool get isLoading => _isLoading;
  bool get isAdmin => _user?['role'] == 'ADMIN' || _club?['myRole'] == 'admin' || _club?['myRole'] == 'owner';
  bool get hasClub => _club != null;
  bool get isPro => _club?['isPro'] == true || _club?['planType'] == 'pro' || _club?['planType'] == 'developer';

  int get seasonStartMonth => (_club?['seasonStartMonth'] as int?) ?? 1;

  List<String> get enabledEvents {
    final events = _club?['enabledEvents'];
    if (events is List) return events.cast<String>();
    return ['GOAL', 'SAVE'];
  }

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('token');

    if (_token != null) {
      try {
        final data = await _api.me(_token!);
        _user = data['user'];
        _player = data['player'];
        _club = data['club'];
      } catch (e) {
        _token = null;
        await prefs.remove('token');
      }
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<bool> login(String identifier, String password) async {
    try {
      final data = await _api.login(identifier, password);
      _token = data['token'];
      _user = data['user'];
      _player = data['player'];
      _club = data['club'];

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', _token!);

      notifyListeners();
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<void> refreshClub() async {
    if (_token == null) return;
    try {
      final data = await _api.me(_token!);
      _club = data['club'];
      _player = data['player'];
      notifyListeners();
    } catch (_) {}
  }

  String? _lastGoogleError;
  String? get lastGoogleError => _lastGoogleError;

  Future<bool> loginWithGoogle() async {
    _lastGoogleError = null;
    try {
      final googleSignIn = GoogleSignIn(scopes: ['email', 'profile']);
      final account = await googleSignIn.signIn();
      if (account == null) {
        _lastGoogleError = '로그인이 취소됐습니다.';
        return false;
      }

      final auth = await account.authentication;
      final idToken = auth.idToken;
      if (idToken == null) {
        _lastGoogleError = 'Google 인증 토큰을 가져올 수 없습니다. (SHA-1 미등록 또는 에뮬레이터 계정 없음)';
        return false;
      }

      final data = await _api.loginWithGoogle(idToken);
      _token = data['token'];
      _user = data['user'];
      _player = data['player'];
      _club = data['club'];

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', _token!);

      notifyListeners();
      return true;
    } catch (e) {
      _lastGoogleError = e.toString();
      return false;
    }
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    _player = null;
    _club = null;

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');

    notifyListeners();
  }
}
