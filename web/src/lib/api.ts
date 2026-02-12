const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: any
  token?: string
}

export async function api<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || '요청에 실패했습니다.')
  }

  return data
}

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api('/auth/login', { method: 'POST', body: { email, password } }),

  register: (email: string, username: string, password: string, playerCode?: string) =>
    api('/auth/register', { method: 'POST', body: { email, username, password, playerCode } }),

  me: (token: string) =>
    api('/auth/me', { token }),

  updateProfile: (data: { username?: string; nickname?: string }, token: string) =>
    api('/auth/profile', { method: 'PUT', body: data, token }),

  changePassword: (oldPassword: string, newPassword: string, token: string) =>
    api('/auth/password', { method: 'PUT', body: { oldPassword, newPassword }, token }),
}

// Sessions API
export const sessionsApi = {
  list: (status?: string) =>
    api(`/sessions${status ? `?status=${status}` : ''}`),

  get: (id: number) =>
    api(`/sessions/${id}`),

  create: (data: { sessionDate: string; title?: string }, token: string) =>
    api('/sessions', { method: 'POST', body: data, token }),

  update: (id: number, data: any, token: string) =>
    api(`/sessions/${id}`, { method: 'PUT', body: data, token }),

  parse: (id: number, text: string, token: string) =>
    api(`/sessions/${id}/parse`, { method: 'POST', body: { text }, token }),

  saveAttendance: (id: number, attendees: any[], token: string) =>
    api(`/sessions/${id}/attendance`, { method: 'POST', body: { attendees }, token }),

  createTeams: (id: number, attendees: any[], token: string) =>
    api(`/sessions/${id}/teams`, { method: 'POST', body: { attendees }, token }),
}

// Players API
export const playersApi = {
  list: (token?: string | null) =>
    api('/players', token ? { token } : {}),

  get: (id: number) =>
    api(`/players/${id}`),

  rate: (id: number, ratings: any, token: string) =>
    api(`/players/${id}/ratings`, { method: 'POST', body: ratings, token }),

  approveLink: (id: number, token: string) =>
    api(`/players/${id}/approve-link`, { method: 'POST', token }),

  delete: (id: number, token: string) =>
    api(`/players/${id}`, { method: 'DELETE', token }),
}

// Matches API
export const matchesApi = {
  get: (id: number) =>
    api(`/matches/${id}`),

  create: (data: { sessionId: number; team1Id: number; team2Id: number; matchNo?: number }, token?: string) =>
    api('/matches', { method: 'POST', body: data, token }),

  createRoundRobin: (data: { sessionId: number; teamIds: number[]; rounds?: number }, token?: string) =>
    api('/matches/round-robin', { method: 'POST', body: data, token }),

  update: (id: number, data: any, token?: string) =>
    api(`/matches/${id}`, { method: 'PUT', body: data, token }),

  delete: (id: number, token?: string) =>
    api(`/matches/${id}`, { method: 'DELETE', token }),

  addEvent: (id: number, event: any, token?: string) =>
    api(`/matches/${id}/events`, { method: 'POST', body: event, token }),

  deleteEvent: (matchId: number, eventId: number, token?: string) =>
    api(`/matches/${matchId}/events/${eventId}`, { method: 'DELETE', token }),
}

// Settlements API (정산)
export const settlementsApi = {
  // 세션별 정산 조회
  getBySession: (sessionId: number) =>
    api(`/sessions/${sessionId}/settlement`),

  // 정산 생성/완료
  complete: (sessionId: number, data: any, token: string) =>
    api(`/sessions/${sessionId}/settlement`, { method: 'POST', body: data, token }),

  // 내 정산 내역 조회
  myHistory: (token: string) =>
    api('/settlements/me', { token }),

  // 전체 정산 요약
  summary: (year?: number) =>
    api(`/settlements/summary${year ? `?year=${year}` : ''}`),
}

// Rankings API
export const rankingsApi = {
  get: (year?: number) =>
    api(`/rankings${year ? `?year=${year}` : ''}`),

  refresh: (year: number, token: string) =>
    api(`/rankings/refresh?year=${year}`, { method: 'POST', token }),

  hallOfFame: () =>
    api('/rankings/hall-of-fame'),
}

// Notifications API (알림)
export const notificationsApi = {
  // 내 알림 목록
  list: (token: string, options?: { limit?: number; unread?: boolean }) => {
    const params = new URLSearchParams()
    if (options?.limit) params.set('limit', String(options.limit))
    if (options?.unread) params.set('unread', 'true')
    return api(`/notifications${params.toString() ? `?${params}` : ''}`, { token })
  },

  // 알림 읽음 처리
  markAsRead: (id: number, token: string) =>
    api(`/notifications/${id}/read`, { method: 'PUT', token }),

  // 모든 알림 읽음 처리
  markAllAsRead: (token: string) =>
    api('/notifications/read-all', { method: 'PUT', token }),

  // 알림 삭제
  delete: (id: number, token: string) =>
    api(`/notifications/${id}`, { method: 'DELETE', token }),
}

// Admin API (관리자)
export const adminApi = {
  // 선수 연동 승인
  approvePlayerLink: (playerId: number, token: string) =>
    api(`/players/${playerId}/approve-link`, { method: 'POST', token }),

  // 선수 비밀번호 초기화
  resetPlayerPassword: (playerId: number, token: string) =>
    api(`/players/${playerId}/reset-password`, { method: 'POST', token }),

  // 선수 정보 수정
  updatePlayer: (playerId: number, data: any, token: string) =>
    api(`/players/${playerId}`, { method: 'PUT', body: data, token }),

  // 새 선수 등록
  createPlayer: (data: { name: string; nickname?: string }, token: string) =>
    api('/players', { method: 'POST', body: data, token }),

  // 전체 선수 능력치 재계산
  recalculateAllStats: (token: string) =>
    api('/players/recalculate-all', { method: 'POST', token }),
}

// Teams API
export const teamsApi = {
  // 팀 조끼 색상 변경
  updateColor: (teamId: number, vestColor: string, token: string) =>
    api(`/teams/${teamId}/color`, { method: 'PUT', body: { vestColor }, token }),

  // 팀 순위 업데이트
  updateRank: (teamId: number, rank: number, token: string) =>
    api(`/teams/${teamId}/rank`, { method: 'PUT', body: { rank }, token }),
}

// Me API (내 정보)
export const meApi = {
  // 내 통계 조회
  getStats: (token: string) =>
    api('/me/stats', { token }),
}
