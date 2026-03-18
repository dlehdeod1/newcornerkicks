import 'package:shared_preferences/shared_preferences.dart';

class TipService {
  static const _prefix = 'tip_dismissed_';

  static Future<bool> isTipDismissed(String tipId) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('$_prefix$tipId') ?? false;
  }

  static Future<void> dismissTip(String tipId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('$_prefix$tipId', true);
  }

  static Future<void> resetAll() async {
    final prefs = await SharedPreferences.getInstance();
    final keys = prefs.getKeys().where((k) => k.startsWith(_prefix));
    for (final key in keys) {
      await prefs.remove(key);
    }
  }
}
