-- 정산 테이블
CREATE TABLE IF NOT EXISTS settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  base_fee INTEGER NOT NULL DEFAULT 6000,
  total_pot INTEGER NOT NULL,
  operation_fee INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at INTEGER NOT NULL
);

-- 팀 정산 테이블
CREATE TABLE IF NOT EXISTS team_settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  settlement_id INTEGER NOT NULL REFERENCES settlements(id),
  team_id INTEGER NOT NULL REFERENCES teams(id),
  rank INTEGER NOT NULL,
  prize_amount INTEGER NOT NULL,
  per_person INTEGER NOT NULL
);

-- 선수 정산 테이블 (MVP 등)
CREATE TABLE IF NOT EXISTS player_settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  settlement_id INTEGER NOT NULL REFERENCES settlements(id),
  player_id INTEGER NOT NULL REFERENCES players(id),
  prize_type TEXT NOT NULL,
  prize_amount INTEGER NOT NULL
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_settlements_session ON settlements(session_id);
CREATE INDEX IF NOT EXISTS idx_team_settlements_settlement ON team_settlements(settlement_id);
CREATE INDEX IF NOT EXISTS idx_player_settlements_settlement ON player_settlements(settlement_id);
CREATE INDEX IF NOT EXISTS idx_player_settlements_player ON player_settlements(player_id);

-- 알림 테이블
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_url TEXT,
  is_read INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- 알림 인덱스
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
