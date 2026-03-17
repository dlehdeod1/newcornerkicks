-- 0013_bm_redesign.sql
-- BM 재설계: 태그 투표, 케미 캐시, AI 카운터, MVP 설정

-- clubs: MVP 투표 on/off
ALTER TABLE clubs ADD COLUMN mvp_vote_enabled INTEGER NOT NULL DEFAULT 0;

-- sessions: AI 사용 횟수 추적
ALTER TABLE sessions ADD COLUMN ai_team_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN ai_analysis_count INTEGER NOT NULL DEFAULT 0;

-- player_preferences (코드에 존재하나 마이그레이션 누락 보완)
CREATE TABLE IF NOT EXISTS player_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  target_player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  UNIQUE(player_id, target_player_id)
);

-- session_mvp_results에 vote_bonus 컬럼 추가
ALTER TABLE session_mvp_results ADD COLUMN vote_bonus REAL DEFAULT 0;

-- 태그 투표
CREATE TABLE IF NOT EXISTS player_tag_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  voter_user_id TEXT NOT NULL REFERENCES users(id),
  tag TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(player_id, voter_user_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_tag_votes_player ON player_tag_votes(player_id);

-- 케미 캐시
CREATE TABLE IF NOT EXISTS player_chemistry_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  partner_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  games_together INTEGER NOT NULL DEFAULT 0,
  win_rate REAL NOT NULL DEFAULT 0,
  assist_link REAL NOT NULL DEFAULT 0,
  pref_bonus REAL NOT NULL DEFAULT 0,
  chem_score REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  UNIQUE(club_id, player_id, partner_id)
);
CREATE INDEX IF NOT EXISTS idx_chemistry_club ON player_chemistry_cache(club_id);
