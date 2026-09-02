-- 성능 인덱스: D1 무료 티어 일일 read 한도 초과(2026-09-02 장애) 원인인 풀스캔 제거
-- 인사이트 근거: match_events(match_id=? 조회가 평균 1,057행 스캔), teams(session_id=? 147행),
-- team_members(IN 조회 744행) 등 전부 인덱스 없이 풀스캔 (queryEfficiency 0)

CREATE INDEX IF NOT EXISTS idx_match_events_match ON match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_match_events_player ON match_events(player_id);
CREATE INDEX IF NOT EXISTS idx_teams_session ON teams(session_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_player ON team_members(player_id);
CREATE INDEX IF NOT EXISTS idx_matches_session ON matches(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_player ON attendance(player_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_match ON player_match_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_player ON player_match_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_sessions_club ON sessions(club_id);
CREATE INDEX IF NOT EXISTS idx_players_club ON players(club_id);
