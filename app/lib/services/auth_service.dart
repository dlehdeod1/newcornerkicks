import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';

class AuthService extends ChangeNotifier {
  final ApiService _api = ApiService();

  String? _token;
  Map<String, dynamic>? _user;
  Map<String, dynamic>? _player;
  bool _isLoading = true;

  String? get token => _token;
  Map<String, dynamic>? get user => _user;
  Map<String, dynamic>? get player => _player;
  bool get isLoggedIn => _token != null;
  bool get isLoading => _isLoading;
  bool get isAdmin => _user?['role'] == 'admin';

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('token');

    if (_token != null) {
      try {
        final data = await _api.me(_token!);
        _user = data['user'];
        _player = data['player'];
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

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', _token!);

      notifyListeners();
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    _player = null;

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');

    notifyListeners();
  }
}
