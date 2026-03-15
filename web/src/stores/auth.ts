import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  username: string
  role: 'ADMIN' | 'member'
}

interface Player {
  id: number
  name: string
  nickname?: string
}

interface Club {
  id: number
  slug: string
  name: string
  enabledEvents: string[]
  myRole: 'owner' | 'admin' | 'member'
  seasonStartMonth?: number
  isPro?: boolean
  planType?: string
  inviteCode?: string
}

interface AuthState {
  token: string | null
  user: User | null
  player: Player | null
  club: Club | null
  isAdmin: boolean
  isLoggedIn: boolean

  login: (token: string, user: User, player: Player | null, club?: Club | null) => void
  logout: () => void
  setPlayer: (player: Player) => void
  setClub: (club: Club) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      player: null,
      club: null,
      isAdmin: false,
      isLoggedIn: false,

      login: (token, user, player, club = null) =>
        set({
          token,
          user,
          player,
          club,
          isAdmin: user.role === 'ADMIN',
          isLoggedIn: true,
        }),

      logout: () =>
        set({
          token: null,
          user: null,
          player: null,
          club: null,
          isAdmin: false,
          isLoggedIn: false,
        }),

      setPlayer: (player) =>
        set({ player }),

      setClub: (club) =>
        set({ club }),
    }),
    {
      name: 'cornerkicks-auth',
    }
  )
)
