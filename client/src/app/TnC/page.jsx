import Head from "next/head";
import Link from "next/link";

export default function TermsAndConditions() {
  return (
    <>
      <Head>
        <title>Terms & Conditions | TBS</title>
      </Head>
      <div className="relative min-h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-body px-6 py-12">
        <div className="absolute top-4 left-4">
          <Link href="/">
            <div className="w-12 h-12 cursor-pointer">
              <img
                src="/Logo-Lightmode.png"
                alt="The Book Shelves Logo"
                className="w-full h-full object-contain dark:hidden"
              />
              <img
                src="/Logo-Darkmode.png"
                alt="The Book Shelves Logo"
                className="w-full h-full object-contain hidden dark:block"
              />
            </div>
          </Link>
        </div>

        <main className="max-w-4xl mx-auto mt-20">
          <h1 className="text-4xl font-header font-bold mb-10 text-center">📜 Terms & Conditions for TBS Users</h1>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold font-header mb-4">1. Subscription</h2>
            <p>Subscription fee: ₹49 for 1 month.</p>
            <p className="mt-2">Security deposit: ₹300 (refundable upon completion of subscription, provided all books are returned in good condition).</p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold font-header mb-4">2. Book Borrowing Rules</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Users can borrow one book at a time.</li>
              <li>Books must be borrowed and returned through the TBS website and café staff (QR scanning is mandatory).</li>
              <li>Books can be returned at any TBS partner café, not necessarily the café from where it was borrowed.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold font-header mb-4">3. Book Condition</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Books must be returned in the same condition they were borrowed.</li>
              <li>Damage, loss, or failure to return the book may result in deduction from the security deposit.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold font-header mb-4">4. User Responsibilities</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Users are responsible for scanning the QR code of the book and verifying the borrowing/return status with café staff.</li>
              <li>Users must return the book within the active subscription period.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold font-header mb-4">5. Security Deposit Refund</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Refund of ₹300 will be processed within 7 working days after the subscription ends, subject to:</li>
              <ul className="list-[circle] list-inside ml-6 space-y-2">
                <li>Return of the borrowed book.</li>
                <li>No outstanding issues regarding damage or missing books.</li>
              </ul>
              <li>If the subscription period is over but the user continues to possess the books, the user will be given 7 days to return the book. Post that, the security deposit given by the user will be claimed by TBS and shall not be returned.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold font-header mb-4">6. Subscription Renewal</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>After 1 month, the subscription will be auto-renewed by TBS unless the user chooses to discontinue.</li>
              <li>If not renewed, users must return any borrowed book before the subscription expiry to claim the deposit refund.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold font-header mb-4">7. Account Usage</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>User accounts are personal and non-transferable.</li>
              <li>TBS reserves the right to suspend accounts in case of misuse or repeated violation of terms.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold font-header mb-4">8. Liability</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>TBS is not responsible for any personal belongings lost at café premises.</li>
              <li>Users must respect the café's individual rules and guidelines in addition to TBS rules.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold font-header mb-4">9. Privacy Policy</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>User data will be handled confidentially and only used to improve TBS services.</li>
              <li>TBS does not share personal data with third parties without user consent.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold font-header mb-4">10. Changes to Terms</h2>
            <p>TBS reserves the right to update these Terms & Conditions at any time. Users will be notified of significant changes via email or website updates.</p>
          </section>
        </main>
      </div>
    </>
  );
}
