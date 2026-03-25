'use client'

import Link from 'next/link'
import { Calendar, Users, Trophy, CreditCard, ChevronRight, Shield, BarChart3, Zap, Check } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* 히어로 섹션 */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-100/50 via-slate-50 to-teal-100/50 dark:from-emerald-900/20 dark:via-slate-900 dark:to-teal-900/20" />
        <div className="absolute inset-0">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-teal-500/10 dark:bg-teal-500/20 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-16">
            {/* 왼쪽: 텍스트 */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-slate-800/50 backdrop-blur rounded-full text-sm text-slate-600 dark:text-slate-300 mb-8 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                <span className="w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse" />
                풋살/축구 동호회 관리 앱
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight text-slate-900 dark:text-white">
                동호회 운영,{' '}
                <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400 bg-clip-text text-transparent">
                  코너킥스
                </span>
                로<br />
                한번에 해결하세요
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 max-w-xl mx-auto lg:mx-0">
                일정 관리, 출석, 팀 편성, 경기 기록, 랭킹, 참가비 정산까지.
                동호회 운영에 필요한 모든 것을 하나의 앱에서.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-2xl font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 active:scale-[0.98]"
                >
                  무료로 시작하기
                  <ChevronRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl font-semibold text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 transition-all shadow-sm"
                >
                  로그인
                </Link>
              </div>
            </div>

            {/* 오른쪽: 스크린샷 */}
            <div className="w-full max-w-md">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-3xl blur-2xl" />
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700">
                  <img
                    src="/screenshot-home.png"
                    alt="코너킥스 대시보드"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 주요 기능 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            동호회 운영에 필요한 모든 기능
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            종이 명부, 카톡 투표, 엑셀 정산은 이제 그만. 코너킥스 하나면 충분합니다.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            icon={<Calendar className="w-6 h-6" />}
            title="세션 & 출석 관리"
            description="일정 생성, RSVP 선착순 마감, 출석 체크를 한곳에서 관리하세요."
            color="emerald"
          />
          <FeatureCard
            icon={<Users className="w-6 h-6" />}
            title="자동 팀 편성"
            description="실력 기반 밸런스 팀 편성. 매번 공평한 경기를 만들어줍니다."
            color="blue"
          />
          <FeatureCard
            icon={<Trophy className="w-6 h-6" />}
            title="랭킹 & 통계"
            description="득점, 도움, 수비 기록을 자동 집계. 시즌별 랭킹과 명예의 전당."
            color="amber"
          />
          <FeatureCard
            icon={<CreditCard className="w-6 h-6" />}
            title="참가비 정산"
            description="순위별 차등 참가비 자동 계산. 미납자 리마인드까지."
            color="purple"
          />
        </div>
      </section>

      {/* 추가 기능 하이라이트 */}
      <section className="bg-slate-50 dark:bg-slate-800/30 border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">
                멀티 클럽 지원
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
                여러 동호회에 동시 가입 가능. 클럽별로 독립된 기록과 랭킹이 관리됩니다.
              </p>
              <div className="space-y-4">
                <HighlightItem icon={<Shield className="w-5 h-5" />} text="클럽별 관리자 권한 분리" />
                <HighlightItem icon={<Zap className="w-5 h-5" />} text="초대 코드로 간편 가입" />
                <HighlightItem icon={<BarChart3 className="w-5 h-5" />} text="클럽별 독립 시즌 & 랭킹" />
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-3xl blur-2xl" />
              <div className="relative rounded-2xl overflow-hidden shadow-xl border border-slate-200 dark:border-slate-700 max-w-sm mx-auto">
                <img
                  src="/screenshot-login.png"
                  alt="코너킥스 로그인"
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 요금제 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            요금제
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            기본 기능은 무료. PRO로 업그레이드하면 더 강력한 기능을 사용할 수 있습니다.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* 무료 */}
          <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-8 border border-slate-200 dark:border-slate-800/50 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">무료</h3>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mb-6">0<span className="text-base font-normal text-slate-500">원</span></p>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <PlanFeature text="세션 & 출석 관리" />
              <PlanFeature text="RSVP 선착순 마감" />
              <PlanFeature text="팀 편성" />
              <PlanFeature text="경기 기록 & 랭킹" />
              <PlanFeature text="참가비 정산" />
            </ul>
          </div>

          {/* PRO */}
          <div className="relative bg-white dark:bg-slate-900/50 rounded-2xl p-8 border-2 border-emerald-500 shadow-lg shadow-emerald-500/10">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full text-xs font-semibold text-white">
              추천
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">PRO</h3>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
              4,900<span className="text-base font-normal text-slate-500">원/월</span>
            </p>
            <p className="text-sm text-slate-500 mb-6">연 결제 시 39,000원/년</p>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <PlanFeature text="무료 플랜의 모든 기능" />
              <PlanFeature text="AI 기반 밸런스 팀 편성" />
              <PlanFeature text="선수 능력치 분석" />
              <PlanFeature text="고급 통계 & 리포트" />
              <PlanFeature text="우선 고객 지원" />
            </ul>
          </div>
        </div>
      </section>

      {/* 하단 CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-500 p-12 md:p-16 text-center">
          <div className="absolute inset-0">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          </div>
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              지금 바로 시작하세요
            </h2>
            <p className="text-lg text-emerald-100 mb-8 max-w-xl mx-auto">
              회원가입 후 클럽을 만들거나, 초대 코드로 기존 클럽에 합류하세요.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white hover:bg-slate-50 rounded-2xl font-semibold text-emerald-600 shadow-lg transition-all active:scale-[0.98]"
            >
              무료 회원가입
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3">코너킥스</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                풋살/축구 동호회를 위한<br />올인원 관리 플랫폼
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3">서비스</h4>
              <div className="space-y-2 text-sm">
                <Link href="/login" className="block text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">로그인</Link>
                <Link href="/register" className="block text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">회원가입</Link>
                <Link href="/upgrade" className="block text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">PRO 구독</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3">약관 및 정책</h4>
              <div className="space-y-2 text-sm">
                <Link href="/terms" className="block text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">이용약관</Link>
                <Link href="/privacy" className="block text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">개인정보처리방침</Link>
                <Link href="/refund" className="block text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">환불 정책</Link>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 space-y-1">
            <p>세인샵 | 대표: 이상훈 | 사업자등록번호: 219-20-34591</p>
            <p>주소: 대구광역시 남구 효성중앙길 38, 효성타운 208동 205호</p>
            <p>이메일: dlehdeod1@gmail.com | 전화: 010-3910-3404</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  color,
}: {
  icon: React.ReactNode
  title: string
  description: string
  color: 'emerald' | 'blue' | 'amber' | 'purple'
}) {
  const colorClasses = {
    emerald: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    amber: 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    purple: 'bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
  }

  return (
    <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800/50 shadow-sm hover:shadow-md transition-shadow">
      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 ${colorClasses[color]}`}>
        {icon}
      </div>
      <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
    </div>
  )
}

function PlanFeature({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2">
      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
      {text}
    </li>
  )
}

function HighlightItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
        {icon}
      </div>
      <span className="text-slate-700 dark:text-slate-300">{text}</span>
    </div>
  )
}
