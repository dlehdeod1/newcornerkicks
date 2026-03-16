-- ============================================
-- 클럽 멀티테넌시 마이그레이션
-- ============================================

-- 클럽 테이블
CREATE TABLE IF NOT EXISTS clubs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,           -- 공개 ID (예: "cornerkicks")
  name TEXT NOT NULL,                  -- 클럽 이름 (예: "코너킥스 FC")
  description TEXT,
  invite_code TEXT NOT NULL UNIQUE,    -- 초대 코드 (예: "CK2025")
  enabled_events TEXT DEFAULT '["GOAL","SAVE"]', -- 활성화된 이벤트 타입 JSON
  plan_type TEXT DEFAULT 'free',       -- free / pro
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 클럽 멤버 테이블
CREATE TABLE IF NOT EXISTS club_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES clubs(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member', -- admin | member
  joined_at INTEGER NOT NULL,
  UNIQUE(club_id, user_id)
);

-- sessions, players에 club_id 추가
ALTER TABLE sessions ADD COLUMN club_id INTEGER REFERENCES clubs(id);
ALTER TABLE players ADD COLUMN club_id INTEGER REFERENCES clubs(id);
ALTER TABLE rankings_cache ADD COLUMN club_id INTEGER REFERENCES clubs(id);

-- 기본 클럽 생성 (기존 데이터 마이그레이션용)
INSERT INTO clubs (slug, name, description, invite_code, enabled_events, plan_type, created_at, updated_at)
VALUES ('cornerkicks', '코너킥스', '코너킥스 풋살 동호회', 'CK2025', '["GOAL","SAVE"]', 'free', unixepoch(), unixepoch());

-- 기존 데이터 전부 기본 클럽(id=1)으로 배정
UPDATE sessions SET club_id = 1 WHERE club_id IS NULL;
UPDATE players SET club_id = 1 WHERE club_id IS NULL;
UPDATE rankings_cache SET club_id = 1 WHERE club_id IS NULL;

-- 기존 유저 전부 기본 클럽 멤버로 배정 (role 그대로 유지)
INSERT INTO club_members (club_id, user_id, role, joined_at)
SELECT 1, id, role, created_at FROM users;
