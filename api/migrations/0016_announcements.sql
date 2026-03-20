-- 0016_announcements.sql

-- 기존 notices 테이블 제거 (사용하지 않음)
DROP TABLE IF EXISTS notices;

-- 공지 테이블
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER REFERENCES clubs(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  is_pinned INTEGER DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_announcements_club ON announcements(club_id, created_at DESC);
CREATE INDEX idx_announcements_system ON announcements(created_at DESC) WHERE club_id IS NULL;

-- 읽음 추적
CREATE TABLE IF NOT EXISTS announcement_reads (
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  read_at INTEGER NOT NULL,
  PRIMARY KEY (announcement_id, user_id)
);
