# API — CLAUDE.md

Hono/TypeScript API on Cloudflare Workers + D1 SQLite.

## 멀티테넌시 (최우선)
- **모든 쿼리에 `club_id` 조건 필수** — 빠뜨리면 다른 클럽 데이터 노출
- 컨텍스트 접근: `(c as any).userId`, `(c as any).clubId`, `(c as any).clubRole`
- 타입 없음 — 오타 주의

## 인증 미들웨어
- `authMiddleware('ADMIN')` = 시스템 ADMIN **또는** 클럽 owner/admin (둘 다 통과)
- `optionalAuthMiddleware` = public 엔드포인트용, 토큰 없어도 next() 진행
- 역할값 반드시 소문자: `'admin'`, `'member'`, `'owner'`

## 응답 규칙
- 성공: `{ data: T }` — 클라이언트가 `r.data`로 접근
- 에러: `{ error: string }` + HTTP status (401/403/404/500)
- 에러 메시지는 **한국어** — 클라이언트에서 그대로 표시됨

## 입력 검증
- 모든 POST/PUT body는 Zod 스키마로 검증
- 검증 실패 시 400 + 한국어 에러 메시지

## D1 주의사항
- DB 이름: `conerkicks-db` (오타 아님, 실제 등록명)
- DB ID: `7108af93-707b-46cf-8a70-9be933810001`
- `env.DB.prepare(sql).bind(...params).first()` 또는 `.all()`

## 마이그레이션
- 새 마이그레이션 작성 전 `docs/migration-manifest.md` 확인 (중복 방지)
- 작성 후 manifest도 업데이트

## 검증
```bash
node test_realistic.js    # 현실적 시나리오 테스트
npx wrangler dev          # 로컬 실행
```
