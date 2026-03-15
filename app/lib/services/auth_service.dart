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
  List<Map<String, dynamic>> _clubs = [];
  bool _isLoading = true;

  String? get token => _token;
  Map<String, dynamic>? get user => _user;
  Map<String, dynamic>? get player => _player;
  Map<String, dynamic>? get club => _club;
  Map<String, dynamic>? get activeClub => _club;
  List<Map<String, dynamic>> get clubs => _clubs;
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

  /// clubs 응답에서 첫 번째 클럽(또는 저장된 activeClubId에 해당하는 클럽)을 활성 클럽으로 설정
  void _initClubsFromData(List<dynamic> rawClubs, {int? preferredClubId}) {
    _clubs = rawClubs.map((c) => Map<String, dynamic>.from(c as Map)).toList();

    if (_clubs.isEmpty) {
      _club = null;
      _player = null;
      ApiService().activeClubId = null;
      return;
    }

    // preferredClubId로 찾기, 없으면 첫 번째 클럽
    Map<String, dynamic>? chosen;
    if (preferredClubId != null) {
      try {
        chosen = _clubs.firstWhere((c) => c['id'] == preferredClubId);
      } catch (_) {}
    }
    chosen ??= _clubs.first;

    _setActiveClubInternal(chosen);
  }

  void _setActiveClubInternal(Map<String, dynamic> clubData) {
    _club = clubData;
    final playerData = clubData['player'];
    _player = playerData != null ? Map<String, dynamic>.from(playerData as Map) : null;
    ApiService().activeClubId = clubData['id'] as int?;
  }

  void setActiveClub(Map<String, dynamic> clubData) {
    _setActiveClubInternal(clubData);
    // activeClubId를 SharedPreferences에 저장
    SharedPreferences.getInstance().then((prefs) {
      final id = clubData['id'];
      if (id != null) prefs.setInt('activeClubId', id as int);
    });
    notifyListeners();
  }

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('token');
    final savedClubId = prefs.getInt('activeClubId');

    if (_token != null) {
      try {
        final data = await _api.me(_token!);
        _user = data['user'] != null ? Map<String, dynamic>.from(data['user'] as Map) : null;

        final rawClubs = data['clubs'] as List<dynamic>?;
        if (rawClubs != null && rawClubs.isNotEmpty) {
          _initClubsFromData(rawClubs, preferredClubId: savedClubId);
        } else if (data['club'] != null) {
          // 하위 호환성
          _clubs = [Map<String, dynamic>.from(data['club'] as Map)];
          _setActiveClubInternal(_clubs.first);
        }
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
      _user = data['user'] != null ? Map<String, dynamic>.from(data['user'] as Map) : null;

      final rawClubs = data['clubs'] as List<dynamic>?;
      if (rawClubs != null && rawClubs.isNotEmpty) {
        _initClubsFromData(rawClubs);
      } else if (data['club'] != null) {
        _clubs = [Map<String, dynamic>.from(data['club'] as Map)];
        _setActiveClubInternal(_clubs.first);
      }

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', _token!);
      if (_club != null) {
        final id = _club!['id'];
        if (id != null) await prefs.setInt('activeClubId', id as int);
      }

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
      final rawClubs = data['clubs'] as List<dynamic>?;
      final currentClubId = _club?['id'] as int?;

      if (rawClubs != null && rawClubs.isNotEmpty) {
        _initClubsFromData(rawClubs, preferredClubId: currentClubId);
      } else if (data['club'] != null) {
        _clubs = [Map<String, dynamic>.from(data['club'] as Map)];
        _setActiveClubInternal(_clubs.first);
      }
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
      _user = data['user'] != null ? Map<String, dynamic>.from(data['user'] as Map) : null;

      final rawClubs = data['clubs'] as List<dynamic>?;
      if (rawClubs != null && rawClubs.isNotEmpty) {
        _initClubsFromData(rawClubs);
      } else if (data['club'] != null) {
        _clubs = [Map<String, dynamic>.from(data['club'] as Map)];
        _setActiveClubInternal(_clubs.first);
      }

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', _token!);
      if (_club != null) {
        final id = _club!['id'];
        if (id != null) await prefs.setInt('activeClubId', id as int);
      }

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
    _clubs = [];
    ApiService().activeClubId = null;

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('activeClubId');

    notifyListeners();
  }
}
