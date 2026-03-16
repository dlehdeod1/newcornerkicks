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

export interface Club {
  id: number
  slug: string
  name: string
  enabledEvents: string[]
  myRole: 'owner' | 'admin' | 'member'
  seasonStartMonth?: number
  isPro?: boolean
  planType?: string
  inviteCode?: string
  player?: Player | null
}

interface AuthState {
  token: string | null
  user: User | null
  player: Player | null
  club: Club | null      // = activeClub (하위 호환성)
  clubs: Club[]          // 전체 클럽 목록
  isAdmin: boolean
  isLoggedIn: boolean

  login: (token: string, user: User, clubs: Club[]) => void
  logout: () => void
  setPlayer: (player: Player) => void
  setClub: (club: Club) => void
  setActiveClub: (club: Club) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      player: null,
      club: null,
      clubs: [],
      isAdmin: false,
      isLoggedIn: false,

      login: (token, user, clubs) => {
        const activeClub = clubs.length === 1 ? clubs[0] : null
        set({
          token,
          user,
          clubs,
          club: activeClub,
          player: activeClub?.player ?? null,
          isAdmin: user.role === 'ADMIN' || activeClub?.myRole === 'admin' || activeClub?.myRole === 'owner',
          isLoggedIn: true,
        })
      },

      logout: () =>
        set({
          token: null,
          user: null,
          player: null,
          club: null,
          clubs: [],
          isAdmin: false,
          isLoggedIn: false,
        }),

      setPlayer: (player) =>
        set({ player }),

      setClub: (club) =>
        set({ club }),

      setActiveClub: (club) =>
        set((state) => ({
          club,
          player: club.player ?? null,
          isAdmin: state.user?.role === 'ADMIN' || club.myRole === 'admin' || club.myRole === 'owner',
        })),
    }),
    {
      name: 'cornerkicks-auth',
    }
  )
)
