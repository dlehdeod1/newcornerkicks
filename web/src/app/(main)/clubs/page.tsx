'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { authApi, clubsApi } from '@/lib/api'
import { Crown, Plus, Check, Users, ChevronRight, X } from 'lucide-react'

const CLUB_GRADIENTS = [
  'from-emerald-500 to-teal-600',
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-red-600',
  'from-cyan-500 to-blue-600',
]

function getGradient(index: number) {
  return CLUB_GRADIENTS[index % CLUB_GRADIENTS.length]
}

function getRoleLabel(role: string) {
  if (role === 'owner') return '오너'
  if (role === 'admin') return '관리자'
  return '멤버'
}

function getRoleBadgeStyle(role: string) {
  if (role === 'owner') return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  if (role === 'admin') return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
}

export default function ClubsPage() {
  const router = useRouter()
  const { clubs, club: activeClub, token, setActiveClub, login, user } = useAuthStore()
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const handleSelectClub = (selectedClub: any) => {
    setActiveClub(selectedClub)
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">내 클럽</h1>
          <p className="text-slate-400 text-sm">활성 클럽을 선택하거나 새 클럽에 참여하세요</p>
        </div>

        {/* 클럽 목록 */}
        <div className="space-y-3 mb-6">
          {clubs.map((club, index) => {
            const isActive = activeClub?.id === club.id
            return (
              <button
                key={club.id}
                onClick={() => handleSelectClub(club)}
                className={`w-full text-left rounded-2xl p-5 border transition-all duration-200 ${
                  isActive
                    ? 'border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                    : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* 아바타 */}
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getGradient(index)} flex items-center justify-center shadow-lg flex-shrink-0`}>
                    <span className="text-2xl font-bold text-white">
                      {club.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white truncate">{club.name}</span>
                      {club.isPro && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 flex-shrink-0">
                          <Crown className="w-3 h-3" />
                          PRO
                        </span>
                      )}
                      {isActive && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
                          <Check className="w-3 h-3" />
                          현재
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${getRoleBadgeStyle(club.myRole)}`}>
                        {getRoleLabel(club.myRole)}
                      </span>
                      <span className="text-xs text-slate-500">{club.slug}</span>
                      {club.player && (
                        <span className="text-xs text-slate-400 truncate">
                          · {club.player.nickname || club.player.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0" />
                </div>
              </button>
            )
          })}
        </div>

        {/* 클럽 추가 버튼들 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowJoinModal(true)}
            className="flex flex-col items-center gap-2 p-5 rounded-2xl border border-dashed border-slate-600 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center">
              <Users className="w-5 h-5 text-slate-300" />
            </div>
            <span className="text-sm font-medium text-slate-300">클럽 참여</span>
            <span className="text-xs text-slate-500">초대 코드로 가입</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex flex-col items-center gap-2 p-5 rounded-2xl border border-dashed border-slate-600 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm font-medium text-slate-300">클럽 만들기</span>
            <span className="text-xs text-slate-500">새 클럽 생성</span>
          </button>
        </div>
      </div>

      {/* 클럽 참여 모달 */}
      {showJoinModal && (
        <JoinClubModal
          token={token!}
          onClose={() => setShowJoinModal(false)}
          onSuccess={async () => {
            setShowJoinModal(false)
            // me 다시 조회해서 clubs 갱신
            try {
              const data = await authApi.me(token!)
              const updatedClubs = data.clubs ?? (data.club ? [data.club] : [])
              if (user) login(token!, user, updatedClubs)
            } catch {}
          }}
        />
      )}

      {/* 클럽 만들기 모달 */}
      {showCreateModal && (
        <CreateClubModal
          token={token!}
          onClose={() => setShowCreateModal(false)}
          onSuccess={async (newClub) => {
            setShowCreateModal(false)
            try {
              const data = await authApi.me(token!)
              const updatedClubs = data.clubs ?? (data.club ? [data.club] : [])
              if (user) {
                login(token!, user, updatedClubs)
                const created = updatedClubs.find((c: any) => c.id === newClub.id)
                if (created) setActiveClub(created)
              }
            } catch {}
            router.push('/')
          }}
        />
      )}
    </div>
  )
}

// ─── 클럽 참여 모달 ───

function JoinClubModal({ token, onClose, onSuccess }: {
  token: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) { setError('초대 코드를 입력해주세요.'); return }
    setLoading(true)
    setError('')
    try {
      await clubsApi.join(trimmed, token)
      onSuccess()
    } catch (e: any) {
      setError(e.message || '가입에 실패했습니다.')
      setLoading(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-white mb-4">클럽 참여</h2>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
        placeholder="초대 코드 입력 (예: CK2025)"
        className="w-full px-4 py-3 rounded-xl bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 mb-3 text-center tracking-widest font-mono text-lg"
        maxLength={8}
      />
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      <button
        onClick={handleJoin}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 transition-all"
      >
        {loading ? '처리 중...' : '참여하기'}
      </button>
    </ModalOverlay>
  )
}

// ─── 클럽 만들기 모달 ───

function CreateClubModal({ token, onClose, onSuccess }: {
  token: string
  onClose: () => void
  onSuccess: (club: any) => void
}) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugStatus, setSlugStatus] = useState<null | 'checking' | 'available' | 'taken'>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const checkSlug = async (value: string) => {
    if (value.length < 2) { setSlugStatus(null); return }
    setSlugStatus('checking')
    try {
      const res = await clubsApi.checkSlug(value)
      setSlugStatus(res.available ? 'available' : 'taken')
    } catch {
      setSlugStatus(null)
    }
  }

  const handleCreate = async () => {
    if (!name.trim() || !slug.trim()) { setError('클럽 이름과 ID를 입력해주세요.'); return }
    if (slugStatus !== 'available') { setError('사용 가능한 클럽 ID를 입력해주세요.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await clubsApi.create({ slug, name: name.trim() }, token)
      onSuccess(res.club)
    } catch (e: any) {
      setError(e.message || '생성에 실패했습니다.')
      setLoading(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-white mb-4">클럽 만들기</h2>
      <div className="space-y-3 mb-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="클럽 이름 (예: 코너킥스 FC)"
          className="w-full px-4 py-3 rounded-xl bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
        />
        <div className="relative">
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              const cleaned = e.target.value.toLowerCase().replace(/[^a-z0-9\-_]/g, '')
              setSlug(cleaned)
              checkSlug(cleaned)
            }}
            placeholder="클럽 ID (예: cornerkicks)"
            className={`w-full px-4 py-3 rounded-xl bg-slate-700 border text-white placeholder-slate-400 focus:outline-none pr-10 ${
              slugStatus === 'available' ? 'border-emerald-500' : slugStatus === 'taken' ? 'border-red-500' : 'border-slate-600 focus:border-emerald-500'
            }`}
          />
          {slugStatus === 'available' && <Check className="absolute right-3 top-3.5 w-5 h-5 text-emerald-400" />}
          {slugStatus === 'taken' && <X className="absolute right-3 top-3.5 w-5 h-5 text-red-400" />}
        </div>
        <p className="text-xs text-slate-500">영문 소문자, 숫자, -, _ 만 사용 가능</p>
      </div>
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      <button
        onClick={handleCreate}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 transition-all"
      >
        {loading ? '처리 중...' : '클럽 만들기'}
      </button>
    </ModalOverlay>
  )
}

// ─── 공통 모달 오버레이 ───

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  )
}
