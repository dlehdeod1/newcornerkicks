-- 수비 상세 이벤트 지원: TACKLE, INTERCEPTION, CLEARANCE
-- player_match_stats에 tackles, interceptions 칼럼 추가 (clearances는 이미 존재)
ALTER TABLE player_match_stats ADD COLUMN tackles INTEGER DEFAULT 0;
ALTER TABLE player_match_stats ADD COLUMN interceptions INTEGER DEFAULT 0;
