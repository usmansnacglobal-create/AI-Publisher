import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="text-center">
        <h1>Page not found</h1>
        <p className="mt-2 text-ink-muted">It may have been moved or deleted.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-cloth underline">Go to your dashboard</Link>
      </div>
    </main>
  );
}
