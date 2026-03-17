export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">개인정보처리방침</h1>
      <div className="prose dark:prose-invert prose-slate max-w-none space-y-6 text-slate-700 dark:text-slate-300">

        <p>세인샵(이하 &quot;회사&quot;)은 개인정보 보호법에 따라 이용자의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보처리방침을 수립·공개합니다.</p>

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제1조 (수집하는 개인정보 항목)</h2>
        <p>회사는 서비스 제공을 위해 다음의 개인정보를 수집합니다.</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>필수항목:</strong> 이메일, 아이디(username), 비밀번호</li>
          <li><strong>선택항목:</strong> 이름, 닉네임, 전화번호, 키, 몸무게, 출생연도</li>
          <li><strong>자동수집:</strong> 서비스 이용 기록, 접속 로그</li>
          <li><strong>결제 시:</strong> 결제 정보 (포트원을 통해 처리되며, 회사는 카드번호 등 민감정보를 직접 저장하지 않습니다)</li>
        </ul>

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제2조 (개인정보의 수집 및 이용 목적)</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>회원 가입 및 관리</li>
          <li>서비스 제공 및 운영 (세션 관리, 팀 편성, 랭킹 등)</li>
          <li>유료 서비스 결제 및 정산</li>
          <li>서비스 개선 및 통계 분석</li>
          <li>고객 문의 대응</li>
        </ul>

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제3조 (개인정보의 보유 및 이용 기간)</h2>
        <p>1. 회원 탈퇴 시 지체 없이 파기합니다.</p>
        <p>2. 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>계약 또는 청약철회 등에 관한 기록: 5년</li>
          <li>대금결제 및 재화 등의 공급에 관한 기록: 5년</li>
          <li>소비자 불만 또는 분쟁 처리에 관한 기록: 3년</li>
        </ul>

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제4조 (개인정보의 제3자 제공)</h2>
        <p>회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만, 법령에 의한 경우는 예외로 합니다.</p>

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제5조 (개인정보 처리 위탁)</h2>
        <p>회사는 서비스 운영을 위해 다음과 같이 개인정보 처리를 위탁합니다.</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>포트원(PortOne):</strong> 결제 처리</li>
          <li><strong>Cloudflare:</strong> 서비스 호스팅 및 데이터 저장</li>
        </ul>

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제6조 (개인정보의 파기)</h2>
        <p>회사는 개인정보 보유 기간의 경과, 처리 목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체 없이 해당 개인정보를 파기합니다.</p>

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제7조 (이용자의 권리)</h2>
        <p>이용자는 언제든지 자신의 개인정보를 조회, 수정, 삭제, 처리 정지를 요청할 수 있습니다. 서비스 내 프로필 설정에서 직접 처리하거나 아래 연락처로 요청할 수 있습니다.</p>

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제8조 (개인정보 보호책임자)</h2>
        <ul className="list-none space-y-1">
          <li>성명: 이상훈</li>
          <li>이메일: dlehdeod1@gmail.com</li>
          <li>전화: 010-3910-3404</li>
        </ul>

        <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-500">
          <p>시행일: 2026년 3월 17일</p>
        </div>
      </div>
    </div>
  )
}
