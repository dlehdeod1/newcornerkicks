-- 사용자/인증 도메인
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  alias TEXT,
  phone TEXT,
  birth_date TEXT,
  height_cm INTEGER,
  weight_kg INTEGER,
  photo_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 선수 도메인
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  nickname TEXT,
  aliases_json TEXT DEFAULT '[]',
  join_date TEXT,
  birth_year INTEGER,
  height_cm INTEGER,
  weight_kg INTEGER,
  photo_url TEXT,
  shooting INTEGER DEFAULT 5,
  offball_run INTEGER DEFAULT 5,
  ball_keeping INTEGER DEFAULT 5,
  passing INTEGER DEFAULT 5,
  linkup INTEGER DEFAULT 5,
  intercept INTEGER DEFAULT 5,
  marking INTEGER DEFAULT 5,
  stamina INTEGER DEFAULT 5,
  speed INTEGER DEFAULT 5,
  physical INTEGER DEFAULT 5,
  player_code TEXT,
  link_status TEXT DEFAULT 'UNLINKED',
  pay_exempt INTEGER DEFAULT 0,
  stats_locked INTEGER DEFAULT 0,
  is_guest INTEGER DEFAULT 0,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS player_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id),
  rater_user_id TEXT NOT NULL REFERENCES users(id),
  session_id INTEGER REFERENCES sessions(id),
  shooting INTEGER,
  offball_run INTEGER,
  ball_keeping INTEGER,
  passing INTEGER,
  linkup INTEGER,
  intercept INTEGER,
  marking INTEGER,
  stamina INTEGER,
  speed INTEGER,
  physical INTEGER,
  overall INTEGER,
  comment TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 세션/경기 도메인
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_date TEXT NOT NULL,
  title TEXT,
  pot_total INTEGER DEFAULT 120000,
  base_fee INTEGER DEFAULT 6000,
  status TEXT DEFAULT 'recruiting',
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  name TEXT NOT NULL,
  rank INTEGER,
  vest_color TEXT,
  type TEXT DEFAULT '밸런스형',
  emoji TEXT DEFAULT '⚽',
  strategy TEXT,
  key_player TEXT,
  key_player_reason TEXT,
  score_stats TEXT
);

CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  player_id INTEGER REFERENCES players(id),
  guest_name TEXT
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  match_no INTEGER,
  team1_id INTEGER NOT NULL REFERENCES teams(id),
  team2_id INTEGER NOT NULL REFERENCES teams(id),
  team1_score INTEGER DEFAULT 0,
  team2_score INTEGER DEFAULT 0,
  duration_min INTEGER DEFAULT 10,
  played_at INTEGER,
  status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS match_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches(id),
  player_id INTEGER REFERENCES players(id),
  guest_name TEXT,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  event_type TEXT NOT NULL,
  assister_id INTEGER REFERENCES players(id),
  assister_guest_name TEXT,
  event_time INTEGER,
  created_at INTEGER NOT NULL
);

-- 배지/출석
CREATE TABLE IF NOT EXISTS badges (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  condition_type TEXT,
  threshold INTEGER
);

CREATE TABLE IF NOT EXISTS player_badges (
  player_id INTEGER NOT NULL REFERENCES players(id),
  badge_code TEXT NOT NULL REFERENCES badges(code),
  earned_at INTEGER,
  PRIMARY KEY (player_id, badge_code)
);

-- 랭킹 캐시
CREATE TABLE IF NOT EXISTS rankings_cache (
  id INTEGER PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  year INTEGER DEFAULT 2025
);

-- 공지사항
CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned INTEGER DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  created_at INTEGER,
  updated_at INTEGER
);
