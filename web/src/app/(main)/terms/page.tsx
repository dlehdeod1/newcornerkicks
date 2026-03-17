export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">이용약관</h1>
      <div className="prose dark:prose-invert prose-slate max-w-none space-y-6 text-slate-700 dark:text-slate-300">

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제1조 (목적)</h2>
        <p>본 약관은 세인샵(이하 &quot;회사&quot;)이 제공하는 코너킥스 서비스(이하 &quot;서비스&quot;)의 이용에 관한 조건 및 절차, 회사와 이용자의 권리, 의무 및 기타 필요한 사항을 규정함을 목적으로 합니다.</p>

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제2조 (정의)</h2>
        <p>1. &quot;서비스&quot;란 회사가 제공하는 풋살/축구 동호회 관리 플랫폼을 의미합니다.</p>
        <p>2. &quot;이용자&quot;란 본 약관에 따라 서비스를 이용하는 자를 의미합니다.</p>
        <p>3. &quot;유료 서비스&quot;란 PRO 구독 등 회사가 유료로 제공하는 서비스를 의미합니다.</p>

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제3조 (약관의 효력 및 변경)</h2>
        <p>1. 본 약관은 서비스 화면에 게시하거나 기타 방법으로 이용자에게 공지함으로써 효력이 발생합니다.</p>
        <p>2. 회사는 관련 법령을 위반하지 않는 범위에서 본 약관을 변경할 수 있으며, 변경 시 적용일자 및 변경사유를 명시하여 최소 7일 전에 공지합니다.</p>

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제4조 (서비스의 제공)</h2>
        <p>회사는 다음의 서비스를 제공합니다.</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>동호회 세션(일정) 관리 및 출석 관리</li>
          <li>팀 편성 및 경기 기록 관리</li>
          <li>선수 랭킹 및 통계</li>
          <li>참가비 정산 관리</li>
          <li>PRO 구독을 통한 프리미엄 기능</li>
        </ul>

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제5조 (회원가입 및 탈퇴)</h2>
        <p>1. 이용자는 회사가 정한 양식에 따라 회원정보를 기입한 후 본 약관에 동의함으로써 회원가입을 신청합니다.</p>
        <p>2. 회원은 언제든지 탈퇴를 요청할 수 있으며, 회사는 즉시 처리합니다.</p>

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제6조 (유료 서비스 및 결제)</h2>
        <p>1. 유료 서비스의 이용 요금 및 결제 방법은 서비스 내 안내 페이지에 게시합니다.</p>
        <p>2. 유료 서비스는 결제 완료 즉시 이용 가능합니다.</p>
        <p>3. 구독형 서비스는 구독 기간 종료 시 자동 갱신될 수 있으며, 이용자는 갱신일 전에 구독을 해지할 수 있습니다.</p>

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제7조 (이용자의 의무)</h2>
        <p>1. 이용자는 타인의 개인정보를 도용하거나 허위 정보를 등록해서는 안 됩니다.</p>
        <p>2. 이용자는 서비스를 이용하여 법령 또는 공서양속에 반하는 행위를 해서는 안 됩니다.</p>

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제8조 (면책조항)</h2>
        <p>1. 회사는 천재지변, 전쟁 등 불가항력적 사유로 서비스를 제공할 수 없는 경우 책임이 면제됩니다.</p>
        <p>2. 회사는 이용자의 귀책사유로 인한 서비스 이용 장애에 대해 책임을 지지 않습니다.</p>

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제9조 (분쟁해결)</h2>
        <p>서비스 이용과 관련하여 발생한 분쟁에 대해서는 대한민국 법을 적용하며, 회사의 본사 소재지를 관할하는 법원을 전속적 합의 관할로 합니다.</p>

        <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-500">
          <p>시행일: 2026년 3월 17일</p>
        </div>
      </div>
    </div>
  )
}
