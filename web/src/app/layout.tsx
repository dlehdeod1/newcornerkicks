import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'

export const metadata: Metadata = {
  title: '코너킥스 FC',
  description: '수요일의 열정을 기록하고 공유하세요',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white antialiased transition-colors">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
