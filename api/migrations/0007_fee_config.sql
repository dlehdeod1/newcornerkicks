-- 클럽 회비 설정 및 개인별 정산 추적

-- 클럽에 회비 설정 JSON 추가
ALTER TABLE clubs ADD COLUMN fee_config TEXT DEFAULT '{"sessionFee":{"enabled":true,"model":"result_based","baseAmount":6000,"winDiscount":1500,"place2Discount":500},"membershipFee":{"enabled":false,"type":"monthly","amount":0},"joiningFee":{"enabled":false,"amount":0}}';

-- 클럽 멤버 면제/납부 상태
ALTER TABLE club_members ADD COLUMN session_fee_exempt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE club_members ADD COLUMN membership_fee_exempt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE club_members ADD COLUMN joining_fee_paid INTEGER NOT NULL DEFAULT 0;
ALTER TABLE club_members ADD COLUMN exempt_reason TEXT;

-- 세션별 개인 납부 추적 테이블
CREATE TABLE IF NOT EXISTS session_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  settlement_id INTEGER NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  player_id INTEGER REFERENCES players(id),
  user_id TEXT REFERENCES users(id),
  player_name TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  team_rank INTEGER,
  paid INTEGER NOT NULL DEFAULT 0,
  paid_at INTEGER,
  exempt INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- 정기 회비 납부 추적 테이블
CREATE TABLE IF NOT EXISTS membership_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES clubs(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  player_name TEXT,
  fee_type TEXT NOT NULL DEFAULT 'monthly',  -- monthly | annual | joining
  amount INTEGER NOT NULL,
  period TEXT,          -- '2026-03' (월회비) | '2026' (연회비) | null (입단비)
  paid INTEGER NOT NULL DEFAULT 0,
  paid_at INTEGER,
  created_at INTEGER NOT NULL
);
