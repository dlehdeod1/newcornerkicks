-- 구독 테이블 (토스페이먼츠 빌링키 기반)
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  club_id INTEGER NOT NULL REFERENCES clubs(id),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',  -- monthly | yearly
  status TEXT NOT NULL DEFAULT 'active',          -- active | cancelled | expired
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  toss_customer_key TEXT,
  toss_billing_key TEXT,
  last_order_id TEXT,
  amount INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 클럽 소유자 추적 컬럼
ALTER TABLE clubs ADD COLUMN owner_user_id TEXT REFERENCES users(id);

-- 기존 admin 멤버를 owner로 마이그레이션 (클럽당 첫 번째 admin)
UPDATE club_members
SET role = 'owner'
WHERE role = 'admin'
  AND id IN (
    SELECT MIN(id) FROM club_members WHERE role = 'admin' GROUP BY club_id
  );

-- clubs.owner_user_id 채우기
UPDATE clubs
SET owner_user_id = (
  SELECT user_id FROM club_members
  WHERE club_id = clubs.id AND role = 'owner'
  LIMIT 1
)
WHERE owner_user_id IS NULL;
