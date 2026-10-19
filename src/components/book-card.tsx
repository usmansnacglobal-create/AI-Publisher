import Link from 'next/link';
import type { BookWithProgress } from '@/lib/data';
import { formatNumber } from '@/lib/text';
import { Badge, Progress } from './ui';

const STATUS = { draft: ['Draft', 'neutral'], in_review: ['In review', 'gilt'], published: ['Published', 'cloth'] } as const;

/** A typographic stand-in for books without a cover yet: a cloth-bound spine look. */
export function CoverThumb({ title, url, className = '' }: { title: string; url?: string | null; className?: string }) {
  if (url)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`aspect-[2/3] w-full rounded-sm object-cover shadow-sm ${className}`} />;
  return (
    <div className={`relative flex aspect-[2/3] w-full items-end overflow-hidden rounded-sm bg-[#2760B1] p-3 shadow-sm ${className}`}>
      <div className="absolute inset-y-0 left-2 w-px bg-[#E16E1D]/70" />
      <span className="line-clamp-4 font-serif text-[15px] leading-tight text-white">{title}</span>
    </div>
  );
}

export function BookCard({ book, coverUrl, href, action }: { book: BookWithProgress; coverUrl?: string | null; href: string; action: string }) {
  const [label, tone] = STATUS[book.status];
  const p = book.progress;
  return (
    <Link href={href} className="panel group flex gap-4 p-3 hover:border-line-strong">
      <div className="w-[72px] shrink-0">
        <CoverThumb title={book.title} url={coverUrl} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-[1.05rem]">{book.title}</h3>
          <Badge tone={tone}>{label}</Badge>
        </div>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          {book.genre || (book.book_type === 'fiction' ? 'Fiction' : 'Non-fiction')} · {formatNumber(p.words)} words
        </p>
        <div className="mt-auto pt-3">
          <div className="mb-1 flex justify-between text-[12px] text-ink-muted">
            <span>
              {p.chaptersDone} of {p.chaptersTotal} chapters written
            </span>
            <span>{p.chapterPercent}%</span>
          </div>
          <Progress value={p.chapterPercent} label={`${book.title} progress`} />
          <span className="mt-2 inline-block text-[13px] font-medium text-cloth group-hover:underline">{action}</span>
        </div>
      </div>
    </Link>
  );
}
