'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import {
  ArrowLeft,
  User,
  AtSign,
  Check,
  Copy,
  CheckCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'

export default function NewPlayerPage() {
  const router = useRouter()
  const { token, isAdmin } = useAuthStore()

  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [createdPlayer, setCreatedPlayer] = useState<{ id: number; playerCode: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const createMutation = useMutation({
    mutationFn: (data: { name: string; nickname?: string }) =>
      api('/players', { method: 'POST', body: data, token: token! }),
    onSuccess: (data) => {
      setCreatedPlayer({
        id: data.id,
        playerCode: data.playerCode,
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    createMutation.mutate({
      name: name.trim(),
      nickname: nickname.trim() || undefined,
    })
  }

  const handleCopyCode = () => {
    if (createdPlayer?.playerCode) {
      navigator.clipboard.writeText(createdPlayer.playerCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-500">관리자만 접근할 수 있습니다.</p>
      </div>
    )
  }

  // 생성 완료 화면
  if (createdPlayer) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-3xl p-8 border border-emerald-200 dark:border-emerald-500/30 text-center">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mb-2">
            선수 등록 완료!
          </h2>
          <p className="text-emerald-600 dark:text-emerald-300 mb-6">
            {name} 선수가 성공적으로 등록되었습니다.
          </p>

          {/* 선수 코드 */}
          <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 mb-6">
            <p className="text-sm text-slate-500 mb-2">선수 연동 코드</p>
            <div className="flex items-center justify-center gap-3">
              <code className="text-3xl font-mono font-bold text-slate-900 dark:text-white tracking-wider">
                {createdPlayer.playerCode}
              </code>
              <button
                onClick={handleCopyCode}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Copy className="w-5 h-5 text-slate-400" />
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              이 코드를 선수에게 전달하세요. 회원가입 시 입력하면 계정과 연동됩니다.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setCreatedPlayer(null)
                setName('')
                setNickname('')
              }}
            >
              선수 추가 등록
            </Button>
            <Button
              className="flex-1"
              onClick={() => router.push('/admin/players')}
            >
              선수 목록으로
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* 뒤로가기 */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        관리자 대시보드
      </Link>

      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/20 rounded-xl flex items-center justify-center">
            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          새 선수 등록
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          새로운 선수를 등록하고 연동 코드를 발급합니다
        </p>
      </div>

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 이름 */}
        <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50">
          <label className="block mb-4">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <User className="w-4 h-4" />
              선수 이름 *
            </span>
          </label>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="홍길동"
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            required
          />
        </div>

        {/* 닉네임 */}
        <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50">
          <label className="block mb-4">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <AtSign className="w-4 h-4" />
              닉네임 (선택)
            </span>
          </label>

          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="별명이나 줄임말"
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <p className="text-xs text-slate-500 mt-2">
            카카오톡 투표에서 사용하는 이름과 다를 경우 입력하세요
          </p>
        </div>

        {/* 에러 메시지 */}
        {createMutation.isError && (
          <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm">
            선수 등록에 실패했습니다. 다시 시도해주세요.
          </div>
        )}

        {/* 제출 버튼 */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => router.back()}
          >
            취소
          </Button>
          <Button
            type="submit"
            className="flex-1"
            loading={createMutation.isPending}
            disabled={!name.trim()}
          >
            <Check className="w-4 h-4" />
            선수 등록
          </Button>
        </div>
      </form>
    </div>
  )
}
