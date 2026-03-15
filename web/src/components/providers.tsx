'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/lib/api'

// 앱 시작 시 /auth/me를 호출해서 player 데이터를 최신으로 동기화
function AuthSync() {
  const { token, isLoggedIn, setPlayer, setClub, logout } = useAuthStore()

  useEffect(() => {
    if (!isLoggedIn || !token) return

    authApi.me(token)
      .then((data: any) => {
        if (data.player) {
          setPlayer({
            id: data.player.id,
            name: data.player.name,
            nickname: data.player.nickname,
          })
        }
        if (data.club) {
          setClub({
            id: data.club.id,
            slug: data.club.slug,
            name: data.club.name,
            enabledEvents: data.club.enabledEvents ?? [],
            myRole: data.club.myRole,
            isPro: data.club.isPro,
            planType: data.club.planType,
            seasonStartMonth: data.club.seasonStartMonth ?? 1,
          })
        }
      })
      .catch(() => {
        logout()
      })
  }, [isLoggedIn, token])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1분
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AuthSync />
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  )
}
