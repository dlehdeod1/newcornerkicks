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

interface AuthState {
  token: string | null
  user: User | null
  player: Player | null
  isAdmin: boolean
  isLoggedIn: boolean

  login: (token: string, user: User, player: Player | null) => void
  logout: () => void
  setPlayer: (player: Player) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      player: null,
      isAdmin: false,
      isLoggedIn: false,

      login: (token, user, player) =>
        set({
          token,
          user,
          player,
          isAdmin: user.role === 'ADMIN',
          isLoggedIn: true,
        }),

      logout: () =>
        set({
          token: null,
          user: null,
          player: null,
          isAdmin: false,
          isLoggedIn: false,
        }),

      setPlayer: (player) =>
        set({ player }),
    }),
    {
      name: 'cornerkicks-auth',
    }
  )
)
