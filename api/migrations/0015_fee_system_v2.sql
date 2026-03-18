-- 참가비 시스템 v2: 토글 기반 + 비용 기록 + 입금자명

-- 1) clubs: 계좌번호 + 새 fee_config (기존 fee_config 컬럼은 유지, 값만 업데이트)
ALTER TABLE clubs ADD COLUMN bank_account TEXT;
-- bank_account: JSON {"bankName":"국민은행","accountNumber":"801301-01-610282","holderName":"박재형"}

-- 2) session_payments: 입금자명
ALTER TABLE session_payments ADD COLUMN depositor_name TEXT;

-- 3) players: 기본 입금자명 (최신 값 유지)
ALTER TABLE players ADD COLUMN default_depositor_name TEXT;

-- 4) 세션 비용 기록 테이블
CREATE TABLE IF NOT EXISTS session_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  club_id INTEGER NOT NULL REFERENCES clubs(id),
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_expenses_session ON session_expenses(session_id);

-- 5) 알림 설정 (clubs 테이블)
ALTER TABLE clubs ADD COLUMN notification_config TEXT DEFAULT '{"sessionCreated":true,"sessionDayRemind":true,"settlementRemind":true}';
