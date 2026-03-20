-- 전체 커뮤니티 게시글 (클럽 간)
CREATE TABLE IF NOT EXISTS community_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id TEXT NOT NULL REFERENCES users(id),
  club_id INTEGER REFERENCES clubs(id),
  category TEXT NOT NULL DEFAULT 'free',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  region TEXT,
  day_of_week TEXT,
  time_slot TEXT,
  skill_level TEXT,
  headcount INTEGER,
  status TEXT DEFAULT 'open',
  comment_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_community_posts_cat ON community_posts(category, created_at DESC);
CREATE INDEX idx_community_posts_region ON community_posts(region, category) WHERE region IS NOT NULL;
CREATE INDEX idx_community_posts_status ON community_posts(status, category) WHERE status = 'open';

-- 커뮤니티 댓글
CREATE TABLE IF NOT EXISTS community_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_community_comments_post ON community_comments(post_id, created_at);
