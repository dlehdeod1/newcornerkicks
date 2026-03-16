-- 세션 목표 인원 수 (이 수에 도달하면 자동 마감)
ALTER TABLE sessions ADD COLUMN target_members INTEGER;
