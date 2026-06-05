# App (Flutter) — CLAUDE.md

## Edit 도구 제한
- `${...}` (Dart string interpolation) 포함 파일은 Edit 도구 실패
- → Write 도구로 전체 파일 재작성할 것

## API 통신
- `api_service.dart`가 `X-Club-Id` 헤더 자동 추가 — 직접 넣지 말 것
- `auth_service.dart`에서 토큰/유저/클럽 상태 관리

## 디자인 토큰
- 색상은 `app_colors.dart` 토큰만 사용, 하드코딩 금지
- 브랜드 그린: `kBrandGreen = Color(0xFF2ECC71)` — 다른 초록 쓰지 말 것
- `ThemeMode.system` — 다크/라이트 **모두** 확인 필수
- 다크: scaffoldBg `#0F172A`, surface `#1E293B`
- 라이트: scaffoldBg `#F8FAFC`

## 스크린 규칙
- 파일명: `*_screen.dart`
- 위젯 재사용: `widgets/` 디렉토리
- 새 스크린 추가 시 `main_shell.dart` 네비게이션 연동 확인

## 검증
```bash
flutter analyze --no-fatal-infos
```
