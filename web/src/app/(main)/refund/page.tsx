export default function RefundPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">환불 정책</h1>
      <div className="prose dark:prose-invert prose-slate max-w-none space-y-6 text-slate-700 dark:text-slate-300">

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제1조 (적용 범위)</h2>
        <p>본 환불 정책은 코너킥스의 유료 서비스(PRO 구독)에 적용됩니다.</p>

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제2조 (청약철회 및 환불)</h2>
        <p>1. 이용자는 결제일로부터 7일 이내에 청약철회를 요청할 수 있으며, 서비스를 이용하지 않은 경우 전액 환불됩니다.</p>
        <p>2. 결제일로부터 7일이 경과하였거나 서비스를 이용한 경우, 이용 기간에 해당하는 금액을 차감한 후 잔여 금액을 환불합니다.</p>
        <p>3. 환불 금액 산정 기준:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>월 구독:</strong> (잔여일수 / 30일) × 결제 금액</li>
          <li><strong>연 구독:</strong> (잔여일수 / 365일) × 결제 금액</li>
        </ul>

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제3조 (환불 절차)</h2>
        <p>1. 환불 요청은 아래 연락처로 접수해주세요.</p>
        <ul className="list-none space-y-1 pl-2">
          <li>이메일: dlehdeod1@gmail.com</li>
          <li>전화: 010-3910-3404</li>
        </ul>
        <p>2. 환불 요청 접수 후 영업일 기준 3일 이내에 처리됩니다.</p>
        <p>3. 환불은 원결제 수단으로 진행됩니다.</p>

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제4조 (구독 해지)</h2>
        <p>1. 이용자는 언제든지 구독을 해지할 수 있습니다.</p>
        <p>2. 구독 해지 시 현재 결제 기간 종료일까지 서비스를 이용할 수 있으며, 다음 결제일부터 자동 결제가 중단됩니다.</p>
        <p>3. 구독 해지는 서비스 내 설정에서 직접 처리하거나 고객센터로 요청할 수 있습니다.</p>

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">제5조 (환불 불가 사유)</h2>
        <p>다음의 경우 환불이 제한될 수 있습니다.</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>이용자의 귀책사유로 서비스 이용이 제한된 경우</li>
          <li>이용약관 위반으로 계정이 정지된 경우</li>
        </ul>

        <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-500">
          <p>시행일: 2026년 3월 17일</p>
        </div>
      </div>
    </div>
  )
}
