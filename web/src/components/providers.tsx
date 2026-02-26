'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/lib/api'

// 앱 시작 시 /auth/me를 호출해서 player 데이터를 최신으로 동기화
function AuthSync() {
  const { token, isLoggedIn, setPlayer, logout } = useAuthStore()

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
      })
      .catch(() => {
        // 토큰 만료 등 인증 오류 시 자동 로그아웃
        logout()
      })
  }, [isLoggedIn, token]) // 로그인 상태 변경 시 재실행

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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <AuthSync />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  )
}
