-- rankings_cache에 기간(period) 추가: 'full'(연간) | 'h1'(상반기) | 'h2'(하반기)
ALTER TABLE rankings_cache ADD COLUMN period TEXT NOT NULL DEFAULT 'full';
CREATE UNIQUE INDEX IF NOT EXISTS idx_rankings_cache_club_year_period
  ON rankings_cache(club_id, year, period);
