-- 세션별 MVP 투표 테이블
CREATE TABLE IF NOT EXISTS session_mvp_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  voter_user_id INTEGER NOT NULL,  -- 투표한 사용자
  voted_player_id INTEGER NOT NULL, -- 투표받은 선수
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (voter_user_id) REFERENCES users(id),
  FOREIGN KEY (voted_player_id) REFERENCES players(id),
  UNIQUE(session_id, voter_user_id) -- 한 세션에서 한 번만 투표 가능
);

-- 세션별 MVP 결과 테이블 (투표 종료 후 집계)
CREATE TABLE IF NOT EXISTS session_mvp_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL UNIQUE,
  player_id INTEGER NOT NULL,
  vote_count INTEGER DEFAULT 0,
  decided_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_mvp_votes_session ON session_mvp_votes(session_id);
CREATE INDEX IF NOT EXISTS idx_mvp_votes_player ON session_mvp_votes(voted_player_id);
CREATE INDEX IF NOT EXISTS idx_mvp_results_player ON session_mvp_results(player_id);
