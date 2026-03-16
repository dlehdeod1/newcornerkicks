-- 클럽 시즌 시작 월 설정 (기본값 1 = 1월)
ALTER TABLE clubs ADD COLUMN season_start_month INTEGER DEFAULT 1;
