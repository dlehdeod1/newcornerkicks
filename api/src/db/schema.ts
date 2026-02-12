import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// ============================================
// 사용자/인증 도메인
// ============================================

export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // UUID
  email: text('email').notNull().unique(),
  username: text('username').notNull(),
  password: text('password').notNull(), // bcrypt hash
  role: text('role').notNull().default('member'), // ADMIN | member
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const profiles = sqliteTable('profiles', {
  userId: text('user_id').primaryKey().references(() => users.id),
  alias: text('alias'),
  phone: text('phone'),
  birthDate: text('birth_date'),
  heightCm: integer('height_cm'),
  weightKg: integer('weight_kg'),
  photoUrl: text('photo_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const abilities = sqliteTable('abilities', {
  userId: text('user_id').primaryKey().references(() => users.id),
  baseAttack: integer('base_attack').default(20),
  basePlaymaker: integer('base_playmaker').default(20),
  baseCompetitiveness: integer('base_competitiveness').default(20),
  baseDiligence: integer('base_diligence').default(20),
  currAttack: integer('curr_attack').default(20),
  currPlaymaker: integer('curr_playmaker').default(20),
  currCompetitiveness: integer('curr_competitiveness').default(20),
  currDiligence: integer('curr_diligence').default(20),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
})

export const abilityLogs = sqliteTable('ability_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').references(() => users.id),
  statType: text('stat_type'), // attack/playmaker/competitiveness/diligence
  delta: integer('delta'),
  reason: text('reason'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
})

// ============================================
// 선수 도메인
// ============================================

export const players = sqliteTable('players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').references(() => users.id),
  name: text('name').notNull(),
  nickname: text('nickname'),
  aliasesJson: text('aliases_json').default('[]'),
  joinDate: text('join_date'),
  birthYear: integer('birth_year'),
  heightCm: integer('height_cm'),
  weightKg: integer('weight_kg'),
  photoUrl: text('photo_url'),

  // 능력치 (1-10)
  shooting: integer('shooting').default(5),
  offballRun: integer('offball_run').default(5),
  ballKeeping: integer('ball_keeping').default(5),
  passing: integer('passing').default(5),
  linkup: integer('linkup').default(5),
  intercept: integer('intercept').default(5),
  marking: integer('marking').default(5),
  stamina: integer('stamina').default(5),
  speed: integer('speed').default(5),
  physical: integer('physical').default(5),

  // 연동
  playerCode: text('player_code'),
  linkStatus: text('link_status').default('UNLINKED'), // UNLINKED/PENDING/ACTIVE

  // 기타
  payExempt: integer('pay_exempt').default(0),
  statsLocked: integer('stats_locked').default(0),
  isGuest: integer('is_guest').default(0),
  notes: text('notes'),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const playerPreferences = sqliteTable('player_preferences', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  playerId: integer('player_id').notNull().references(() => players.id),
  targetPlayerId: integer('target_player_id').notNull().references(() => players.id),
  rank: integer('rank').default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }),
})

export const playerRatings = sqliteTable('player_ratings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  playerId: integer('player_id').notNull().references(() => players.id),
  raterUserId: text('rater_user_id').notNull().references(() => users.id),
  sessionId: integer('session_id').references(() => sessions.id),

  shooting: integer('shooting'),
  offballRun: integer('offball_run'),
  ballKeeping: integer('ball_keeping'),
  passing: integer('passing'),
  linkup: integer('linkup'),
  intercept: integer('intercept'),
  marking: integer('marking'),
  stamina: integer('stamina'),
  speed: integer('speed'),
  physical: integer('physical'),
  overall: integer('overall'),

  comment: text('comment'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const statChanges = sqliteTable('stat_changes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  playerId: integer('player_id').notNull().references(() => players.id),
  stat: text('stat').notNull(),
  delta: real('delta').notNull(),
  reason: text('reason'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// ============================================
// 세션/경기 도메인
// ============================================

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionDate: text('session_date').notNull(), // YYYY-MM-DD
  title: text('title'),
  potTotal: integer('pot_total').default(120000),
  baseFee: integer('base_fee').default(6000),
  status: text('status').default('recruiting'), // recruiting/closed
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const teams = sqliteTable('teams', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => sessions.id),
  name: text('name').notNull(),
  rank: integer('rank'),
  vestColor: text('vest_color'),
  type: text('type').default('밸런스형'),
  emoji: text('emoji').default('⚽'),
  strategy: text('strategy'),
  keyPlayer: text('key_player'),
  keyPlayerReason: text('key_player_reason'),
  scoreStats: text('score_stats'), // JSON
})

export const teamMembers = sqliteTable('team_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  teamId: integer('team_id').notNull().references(() => teams.id),
  playerId: integer('player_id').references(() => players.id), // NULL for guests
  guestName: text('guest_name'), // 용병 이름
})

export const matches = sqliteTable('matches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => sessions.id),
  matchNo: integer('match_no'),
  team1Id: integer('team1_id').notNull().references(() => teams.id),
  team2Id: integer('team2_id').notNull().references(() => teams.id),
  team1Score: integer('team1_score').default(0),
  team2Score: integer('team2_score').default(0),
  durationMin: integer('duration_min').default(10),
  playedAt: integer('played_at', { mode: 'timestamp' }),
  status: text('status').default('pending'), // pending/playing/completed
})

export const matchEvents = sqliteTable('match_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  matchId: integer('match_id').notNull().references(() => matches.id),
  playerId: integer('player_id').references(() => players.id), // NULL for guests
  guestName: text('guest_name'), // 용병 이름
  teamId: integer('team_id').notNull().references(() => teams.id),
  eventType: text('event_type').notNull(), // GOAL / DEFENSE
  assisterId: integer('assister_id').references(() => players.id),
  assisterGuestName: text('assister_guest_name'), // 용병 어시스트
  eventTime: integer('event_time'), // 초
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const playerMatchStats = sqliteTable('player_match_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  matchId: integer('match_id').notNull().references(() => matches.id),
  playerId: integer('player_id').notNull().references(() => players.id),
  goals: integer('goals').default(0),
  assists: integer('assists').default(0),
  saves: integer('saves').default(0),
  blocks: integer('blocks').default(0),
  keyPasses: integer('key_passes').default(0),
  clearances: integer('clearances').default(0),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
})

// ============================================
// 배지/출석 도메인
// ============================================

export const badges = sqliteTable('badges', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  conditionType: text('condition_type'), // GOAL/ASSIST/PLACEMENT/ATTENDANCE
  threshold: integer('threshold'),
})

export const playerBadges = sqliteTable('player_badges', {
  playerId: integer('player_id').notNull().references(() => players.id),
  badgeCode: text('badge_code').notNull().references(() => badges.code),
  earnedAt: integer('earned_at', { mode: 'timestamp' }),
})

export const attendance = sqliteTable('attendance', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => sessions.id),
  playerId: integer('player_id').references(() => players.id), // nullable for guests
  guestName: text('guest_name'), // 용병인 경우 이름 저장
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const sessionMvp = sqliteTable('session_mvp', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => sessions.id),
  playerId: integer('player_id').notNull().references(() => players.id),
  mvpScore: real('mvp_score'), // 골*2 + 어시*1 + 수비*0.5
  createdAt: integer('created_at', { mode: 'timestamp' }),
})

// ============================================
// 기타 도메인
// ============================================

export const notices = sqliteTable('notices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  isPinned: integer('is_pinned').default(0),
  createdBy: text('created_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
})

export const chemistryEdges = sqliteTable('chemistry_edges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  playerAId: integer('player_a_id').notNull().references(() => players.id),
  playerBId: integer('player_b_id').notNull().references(() => players.id),
  chemistryScore: integer('chemistry_score').notNull().default(0),
  note: text('note'),
})

export const rankingsCache = sqliteTable('rankings_cache', {
  id: integer('id').primaryKey(),
  data: text('data').notNull(), // JSON
  updatedAt: text('updated_at').notNull(),
  updatedBy: text('updated_by'),
  year: integer('year').default(2025),
})

// ============================================
// 정산 도메인
// ============================================

export const settlements = sqliteTable('settlements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => sessions.id),
  baseFee: integer('base_fee').notNull().default(6000),
  totalPot: integer('total_pot').notNull(),
  operationFee: integer('operation_fee').default(0),
  status: text('status').default('pending'), // pending/completed
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const teamSettlements = sqliteTable('team_settlements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  settlementId: integer('settlement_id').notNull().references(() => settlements.id),
  teamId: integer('team_id').notNull().references(() => teams.id),
  rank: integer('rank').notNull(),
  prizeAmount: integer('prize_amount').notNull(),
  perPerson: integer('per_person').notNull(),
})

export const playerSettlements = sqliteTable('player_settlements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  settlementId: integer('settlement_id').notNull().references(() => settlements.id),
  playerId: integer('player_id').notNull().references(() => players.id),
  prizeType: text('prize_type').notNull(), // mvp/bonus
  prizeAmount: integer('prize_amount').notNull(),
})

// ============================================
// 알림 도메인
// ============================================

export const notifications = sqliteTable('notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id),
  type: text('type').notNull(), // session_created, team_assigned, match_result, settlement, badge_earned
  title: text('title').notNull(),
  message: text('message').notNull(),
  linkUrl: text('link_url'),
  isRead: integer('is_read').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})
