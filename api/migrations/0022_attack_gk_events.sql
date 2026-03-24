-- 공격 상세 + 골키퍼 이벤트 지원
-- saves, key_passes 칼럼은 이미 존재
ALTER TABLE player_match_stats ADD COLUMN dribbles INTEGER DEFAULT 0;
ALTER TABLE player_match_stats ADD COLUMN shots_on INTEGER DEFAULT 0;
ALTER TABLE player_match_stats ADD COLUMN shots_off INTEGER DEFAULT 0;
