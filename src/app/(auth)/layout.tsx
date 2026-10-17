import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <Link href="/" className="mb-8 block font-serif text-[1.4rem] text-ink">
          AI Publisher
        </Link>
        <div className="panel p-6 sm:p-8">{children}</div>
      </div>
    </main>
  );
}
