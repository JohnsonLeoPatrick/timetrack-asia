'use client';

export default function RefundPolicyPage() {
  return (
    <div className="pt-36 pb-24 px-6">
      <div className="article-card max-w-3xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-display font-semibold normal-case tracking-tight mb-8">
          REFUND <span className="text-[#4e6500]">POLICY</span>
        </h1>

        <div className="space-y-8 text-sm text-slate-600 font-bold normal-case tracking-normal leading-relaxed">
          <section>
            <h2 className="text-base font-display font-semibold tracking-tight text-slate-900 mb-4">INTRODUCTION</h2>
            <p>We offer a 30-day satisfaction guarantee on our platform services. If you are not satisfied, we will work to make it right.</p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold tracking-tight text-slate-900 mb-4">CANCELLATION RIGHTS</h2>
            <p>Registrations can be cancelled within 12 hours of purchase for a full refund. After this period, refunds are subject to the event organizer&apos;s specific cancellation policy.</p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold tracking-tight text-slate-900 mb-4">EXERCISE OF RIGHT</h2>
            <p>To exercise your cancellation right, you must notify us via email with your registration details. We will confirm receipt within 24 hours.</p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold tracking-tight text-slate-900 mb-4">REIMBURSEMENT PROCESS</h2>
            <p>Refunds will be processed within 30 days using the same payment method used for the original transaction. We will notify you once the refund has been initiated.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
