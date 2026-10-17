import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PLANS } from '@/lib/plans';

const STAGES = [
  ['Write', 'Plan chapters from your idea, draft with Claude, or import the manuscript you already have. Every AI change is a suggestion you accept or reject.'],
  ['Edit', 'Line edits, paragraph edits, dialogue polish and a full proofreading report. A story bible keeps names, dates and facts consistent across chapters.'],
  ['Format', 'Print-ready PDF interiors for KDP and IngramSpark, plus EPUB ebooks and Word files. Fonts embedded, chapters on the right-hand page.'],
  ['Design', 'Cover artwork painted by ChatGPT from your brief, lettered with real fonts, with a spine sized to your exact page count.'],
  ['Publish', 'Store description, keywords and categories written for you. Submit once and follow your book through review to the stores.'],
];

export default function Landing({ searchParams }: { searchParams: { error_code?: string; code?: string } }) {
  // Expired or reused email links land here; send people somewhere that explains what to do.
  if (searchParams.error_code) redirect(`/login?error=${searchParams.error_code === 'otp_expired' ? 'expired' : 'link'}`);
  if (searchParams.code) redirect(`/auth/callback?code=${encodeURIComponent(searchParams.code)}`);
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-[1100px] items-center justify-between px-4 py-5 sm:px-8">
        <span className="font-serif text-[1.35rem]">AI Publisher</span>
        <nav className="flex items-center gap-4 text-[14px]">
          <Link href="/login" className="text-ink-soft hover:text-ink">Sign in</Link>
          <Link href="/signup" className="rounded bg-cloth px-4 py-2 font-medium text-white hover:bg-cloth-dark">Start free</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1100px] items-center gap-12 px-4 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div>
            <h1 className="text-[2.6rem] leading-[1.08] sm:text-[3.4rem]">From first sentence to bookshop shelf.</h1>
            <p className="mt-5 max-w-[46ch] text-[1.1rem] text-ink-soft">
              Write, edit, format, design the cover and publish your book in one place, with AI help at every step and you in charge of every word.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="rounded bg-cloth px-5 py-3 font-medium text-white hover:bg-cloth-dark">Start your book free</Link>
              <a href="#pricing" className="rounded border border-line-strong bg-sheet px-5 py-3 font-medium hover:border-ink-faint">See pricing</a>
            </div>
            <p className="mt-4 text-[13px] text-ink-muted">Your manuscripts stay private and are never used to train AI.</p>
          </div>
          {/* The product's own manuscript page, as the hero image. */}
          <div className="rounded-sm border border-line bg-sheet px-8 py-10 shadow-[0_24px_60px_-30px_rgba(28,34,48,.45)] sm:px-12" aria-hidden>
            <p className="text-center text-[11px] tracking-[0.2em] text-ink-faint">CHAPTER 1</p>
            <p className="mt-2 text-center font-serif text-[1.6rem] italic">The Boy from Mogi</p>
            <p className="manuscript mt-6 text-[17px]">
              The heat settled over the town like a heavy blanket, the kind that made the asphalt shimmer and the dust rise whenever a ball skidded across the{' '}
              <span className="rounded-sm bg-removed-bg px-0.5 text-removed line-through">broken</span>{' '}
              <span className="rounded-sm bg-added-bg px-0.5 text-added">cracked</span> pavement.
            </p>
            <div className="mt-5 flex items-center gap-2 border-t border-line pt-4 text-[13px] text-ink-muted">
              <span className="rounded-sm bg-cloth px-2 py-0.5 font-medium text-white">Accept</span>
              <span className="rounded-sm border border-line px-2 py-0.5">Reject</span>
              <span>“Cracked” is more specific.</span>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-sheet">
          <ol className="mx-auto grid max-w-[1100px] gap-px px-4 sm:px-8 md:grid-cols-5">
            {STAGES.map(([t, d], i) => (
              <li key={t} className="py-8 md:pr-6">
                <p className="text-[13px] text-gilt">Step {i + 1}</p>
                <h2 className="mt-1 text-[1.3rem]">{t}</h2>
                <p className="mt-2 text-[14px] text-ink-muted">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="pricing" className="mx-auto max-w-[1100px] px-4 py-20 sm:px-8">
          <h2 className="text-[2rem]">Pricing</h2>
          <p className="mt-2 text-ink-muted">Monthly, cancel any time. Your books are always yours to download.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {Object.values(PLANS).map((p) => (
              <div key={p.id} className="panel flex flex-col p-6">
                <h3 className="text-[1.3rem]">{p.name}</h3>
                <p className="mt-2 font-serif text-[2.2rem] leading-none">${p.priceMonthly}<span className="ml-1 font-sans text-[14px] text-ink-muted">/ month</span></p>
                <ul className="mt-4 flex-1 space-y-1.5 text-[14px] text-ink-soft">{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
                <Link href="/signup" className="mt-6 rounded border border-line-strong py-2 text-center font-medium hover:border-ink-faint">{p.priceMonthly ? `Choose ${p.name}` : 'Start free'}</Link>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-line px-4 py-8 text-center text-[13px] text-ink-muted">© {new Date().getFullYear()} AI Publisher</footer>
    </div>
  );
}
