import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useState, useEffect } from 'react'

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
  logoUrl?: string | null
  mvpWeights?: Record<string, number>
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

// SSR 하이드레이션 완료 여부를 반환하는 훅
// Zustand persist는 localStorage에서 동기적으로 복원하지만,
// 서버는 localStorage를 모르므로 첫 렌더에서 isLoggedIn=false로 시작한다.
// useEffect가 실행되는 시점(클라이언트 마운트)에는 이미 복원 완료 → 안전하게 권한 체크 가능.
export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setHydrated(true)
  }, [])
  return hydrated
}
