-- 선수 교체 기록 테이블
CREATE TABLE IF NOT EXISTS player_substitutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches(id),
  player_id INTEGER REFERENCES players(id),
  guest_name TEXT,
  from_team_id INTEGER NOT NULL REFERENCES teams(id),
  to_team_id INTEGER NOT NULL REFERENCES teams(id),
  minute INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_substitutions_match ON player_substitutions(match_id);
