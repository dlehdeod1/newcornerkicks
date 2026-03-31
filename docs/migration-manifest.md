# 마이그레이션 매니페스트

새 마이그레이션 작성 전 반드시 확인 — 이미 존재하는 테이블/컬럼 중복 생성 방지.

```
0000_init_schema.sql
0001_add_clubs.sql
0006_session_rsvp.sql
0007_fee_config.sql          ← session_payments, membership_payments
0008_session_auto_status.sql
0009_season_config.sql
0010_google_id.sql           ← users.google_id
0011_fix_session_payments.sql ← guest_name 추가, settlement_id nullable
0012_subscriptions.sql       ← subscriptions 테이블, clubs.owner_user_id
0013_bm_redesign.sql         ← tags, chemistry_cache, AI 카운터, MVP vote_bonus
0014_club_logo.sql           ← clubs.logo_url
0015_fee_system_v2.sql       ← 정산 시스템 v2
0016_announcements.sql       ← 공지사항
0017_posts.sql               ← 클럽 게시판
0018_community.sql           ← 전체 커뮤니티
0019_post_polls.sql          ← 게시글 투표
0020_club_reviews.sql        ← 클럽 리뷰
0021_defense_detail_events.sql ← TACKLE/INTERCEPTION/CLEARANCE 컬럼
0022_attack_gk_events.sql    ← DRIBBLE/SHOT_ON/SHOT_OFF 컬럼
0023_rankings_expansion.sql  ← clubs.mvp_weights
0025_phase2_gamification.sql ← 배지/시즌어워드/반응/댓글수정/라이브공유/출석UNIQUE
0026_player_substitutions.sql ← 선수 교체 기록
```
