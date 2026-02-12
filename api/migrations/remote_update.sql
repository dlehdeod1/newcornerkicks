-- 1. attendance 테이블에 guest_name 컬럼 추가 (이미 있으면 무시됨)
ALTER TABLE attendance ADD COLUMN guest_name TEXT;

-- 2. sessions 테이블에 추가 컬럼들
ALTER TABLE sessions ADD COLUMN location TEXT;
ALTER TABLE sessions ADD COLUMN start_time TEXT;
ALTER TABLE sessions ADD COLUMN end_time TEXT;
ALTER TABLE sessions ADD COLUMN updated_at INTEGER;

-- 3. 정산 테이블들
CREATE TABLE IF NOT EXISTS settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL UNIQUE,
  base_fee INTEGER DEFAULT 6000,
  total_pot INTEGER DEFAULT 0,
  operation_fee INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS team_settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  settlement_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  rank INTEGER,
  prize_amount INTEGER DEFAULT 0,
  per_person INTEGER DEFAULT 0,
  FOREIGN KEY (settlement_id) REFERENCES settlements(id),
  FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE TABLE IF NOT EXISTS player_settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  settlement_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  prize_type TEXT,
  prize_amount INTEGER DEFAULT 0,
  FOREIGN KEY (settlement_id) REFERENCES settlements(id),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

-- 4. MVP 투표 테이블들
CREATE TABLE IF NOT EXISTS session_mvp_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  voter_user_id TEXT NOT NULL,
  voted_player_id INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (voted_player_id) REFERENCES players(id),
  UNIQUE(session_id, voter_user_id)
);

CREATE TABLE IF NOT EXISTS session_mvp_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL UNIQUE,
  player_id INTEGER NOT NULL,
  vote_count INTEGER DEFAULT 0,
  decided_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

-- 5. 알림 테이블
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 6. 인덱스
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_mvp_votes_session ON session_mvp_votes(session_id);
CREATE INDEX IF NOT EXISTS idx_settlements_session ON settlements(session_id);
