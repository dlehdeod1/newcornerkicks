-- 능력치 평가 데이터 마이그레이션: 0~10 범위 -> 0~100 범위
-- 실행 전 반드시 백업하세요!

-- player_ratings 테이블의 값들을 10배로 변환
-- 이미 100점 범위인 데이터는 건너뜀 (shooting > 10 조건으로 체크)
UPDATE player_ratings SET
  shooting = shooting * 10,
  offball_run = offball_run * 10,
  ball_keeping = ball_keeping * 10,
  passing = passing * 10,
  linkup = linkup * 10,
  intercept = intercept * 10,
  marking = marking * 10,
  stamina = stamina * 10,
  speed = speed * 10,
  physical = physical * 10,
  overall = overall * 10
WHERE shooting <= 10 AND shooting > 0;

-- players 테이블의 능력치도 변환 (관리자가 직접 입력한 값이 있을 경우)
UPDATE players SET
  shooting = shooting * 10,
  offball_run = offball_run * 10,
  ball_keeping = ball_keeping * 10,
  passing = passing * 10,
  linkup = linkup * 10,
  intercept = intercept * 10,
  marking = marking * 10,
  stamina = stamina * 10,
  speed = speed * 10,
  physical = physical * 10
WHERE shooting <= 10 AND shooting > 0;
