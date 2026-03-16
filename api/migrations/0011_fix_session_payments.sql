-- session_payments 테이블 재생성
-- 1) settlement_id를 nullable로 변경 (standalone 정산 지원)
-- 2) guest_name 컬럼 추가

DROP TABLE IF EXISTS session_payments;

CREATE TABLE session_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  settlement_id INTEGER REFERENCES settlements(id) ON DELETE CASCADE,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  player_id INTEGER REFERENCES players(id),
  guest_name TEXT,
  user_id TEXT REFERENCES users(id),
  player_name TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  team_rank INTEGER,
  paid INTEGER NOT NULL DEFAULT 0,
  paid_at INTEGER,
  exempt INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_payments_session ON session_payments(session_id);
CREATE INDEX IF NOT EXISTS idx_session_payments_player ON session_payments(player_id);
