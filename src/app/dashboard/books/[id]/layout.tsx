import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getViewer } from '@/lib/data';
import { BookTabs } from '@/components/book-tabs';

export default async function BookLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const { supabase } = await getViewer();
  const { data: book } = await supabase.from('books').select('id,title').eq('id', params.id).maybeSingle();
  if (!book) notFound();
  return (
    <div className="mx-auto max-w-[1240px]">
      <div className="mb-5">
        <Link href="/dashboard/books" className="text-[13px] text-ink-muted hover:text-ink">My books</Link>
        <p className="mt-0.5 truncate font-serif text-[1.5rem] leading-tight">{book.title}</p>
      </div>
      <BookTabs id={book.id} />
      <div className="pt-6">{children}</div>
    </div>
  );
}
