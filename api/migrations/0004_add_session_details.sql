-- 세션에 장소, 시간 정보 추가
ALTER TABLE sessions ADD COLUMN location TEXT;
ALTER TABLE sessions ADD COLUMN start_time TEXT;  -- HH:MM 형식
ALTER TABLE sessions ADD COLUMN end_time TEXT;    -- HH:MM 형식
ALTER TABLE sessions ADD COLUMN updated_at INTEGER;
