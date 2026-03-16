-- 세션 참석 투표 (RSVP)
CREATE TABLE IF NOT EXISTS session_rsvp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  player_id INTEGER REFERENCES players(id),
  status TEXT NOT NULL DEFAULT 'going', -- going | not_going
  created_at INTEGER NOT NULL,
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_session_rsvp_session ON session_rsvp(session_id);
CREATE INDEX IF NOT EXISTS idx_session_rsvp_user ON session_rsvp(user_id);
