-- Phase 2: 게이미피케이션 + 소셜 + 안정성
-- 배지 시드 데이터, 시즌 어워드, 이모지 반응, 출석 UNIQUE 제약

-- 1. 배지 시드 데이터 (badges 테이블은 0000에서 생성됨)
INSERT OR IGNORE INTO badges (code, name, description, condition_type, threshold) VALUES
  ('FIRST_GOAL', '첫 골', '첫 번째 골을 기록했습니다', 'GOAL', 1),
  ('HAT_TRICK', '해트트릭', '한 경기에서 3골을 기록했습니다', 'GOAL', 3),
  ('DEFENSE_KING', '수비왕', '한 경기에서 수비 5회 이상', 'DEFENSE', 5),
  ('ATTENDANCE_90', '출석왕', '시즌 출석률 90% 이상', 'ATTENDANCE', 90),
  ('MATCH_100', '100경기', '누적 100경기 참여', 'MATCH_COUNT', 100),
  ('MATCH_50', '50경기', '누적 50경기 참여', 'MATCH_COUNT', 50),
  ('MATCH_10', '10경기', '10경기 참여', 'MATCH_COUNT', 10),
  ('WIN_STREAK_3', '3연승', '3연승을 달성했습니다', 'WIN_STREAK', 3),
  ('WIN_STREAK_5', '5연승', '5연승을 달성했습니다', 'WIN_STREAK', 5),
  ('ALL_ROUNDER', '올라운더', '한 세션에서 골+어시+수비 모두 기록', 'ALL_ROUND', 1),
  ('MVP', 'MVP', '세션 MVP로 선정되었습니다', 'MVP', 1),
  ('MVP_3', 'MVP 3회', 'MVP 3회 달성', 'MVP', 3),
  ('FIRST_ASSIST', '첫 어시스트', '첫 어시스트를 기록했습니다', 'ASSIST', 1),
  ('SCORING_STREAK_3', '3경기 연속골', '3경기 연속 골을 기록했습니다', 'SCORING_STREAK', 3);

-- 2. 시즌 어워드 테이블
CREATE TABLE IF NOT EXISTS season_awards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES clubs(id),
  season_year INTEGER NOT NULL,
  award_type TEXT NOT NULL,  -- 'top_scorer', 'top_assist', 'top_defense', 'top_attendance', 'mvp', 'rookie'
  player_id INTEGER NOT NULL REFERENCES players(id),
  stat_value REAL,           -- 수치 (골 수, 출석률 등)
  created_at INTEGER NOT NULL,
  UNIQUE(club_id, season_year, award_type)
);

-- 3. 이모지 반응 테이블 (게시글 + 커뮤니티 공용)
CREATE TABLE IF NOT EXISTS post_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  emoji TEXT NOT NULL,  -- '👍', '❤️', '😂', '🔥', '👏', '😢'
  created_at INTEGER NOT NULL,
  UNIQUE(post_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS community_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(post_id, user_id, emoji)
);

-- 4. 댓글 수정 지원 (updated_at 컬럼)
ALTER TABLE post_comments ADD COLUMN updated_at INTEGER;
ALTER TABLE community_comments ADD COLUMN updated_at INTEGER;

-- 5. 출석 UNIQUE 제약 (중복 방지)
-- SQLite는 ALTER TABLE로 UNIQUE 추가 불가 → 인덱스로 대체
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique
  ON attendance(session_id, player_id)
  WHERE player_id IS NOT NULL;

-- 6. 라이브 스코어 공유 토큰
ALTER TABLE sessions ADD COLUMN share_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_share_token
  ON sessions(share_token)
  WHERE share_token IS NOT NULL;
