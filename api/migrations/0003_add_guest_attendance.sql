-- 용병 참석자 지원을 위한 컬럼 추가
ALTER TABLE attendance ADD COLUMN guest_name TEXT;

-- player_id를 nullable로 변경은 SQLite에서 직접 불가능하므로
-- 새 레코드 삽입 시 player_id가 null이고 guest_name이 있는 경우를 허용
