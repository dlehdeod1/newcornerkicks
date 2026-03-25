-- 신규 선수 기본 능력치를 75로 변경
-- 기존에 rating이 없는 선수(능력치가 기본값 5인 선수)를 75로 업데이트

UPDATE players SET
  shooting = 75, offball_run = 75, ball_keeping = 75, passing = 75, linkup = 75,
  intercept = 75, marking = 75, stamina = 75, speed = 75, physical = 75
WHERE id NOT IN (SELECT DISTINCT player_id FROM player_ratings)
  AND shooting = 5 AND offball_run = 5 AND ball_keeping = 5 AND passing = 5
  AND linkup = 5 AND intercept = 5 AND marking = 5 AND stamina = 5
  AND speed = 5 AND physical = 5;
