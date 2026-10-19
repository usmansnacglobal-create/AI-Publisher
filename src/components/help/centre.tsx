import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, AudioLines, BookOpenCheck, ChevronRight, CreditCard, LifeBuoy, Palette, PenLine, Rocket, Send, Settings, SpellCheck, Wrench } from 'lucide-react';
import { ARTICLES, CATEGORIES, articlesIn, getArticle, getCategory, type HelpCategory } from '@/lib/help';
import { ButtonLink } from '@/components/ui';
import { RichText, Inline } from './rich-text';
import { HelpSearch, ArticleFeedback, AskButtons } from './centre-client';
import { getBrand } from '@/lib/brand-server';
import { brandify } from '@/lib/brand';

const ICONS: Record<HelpCategory['icon'], typeof Rocket> = {
  start: Rocket, write: PenLine, check: SpellCheck, layout: BookOpenCheck, cover: Palette,
  audio: AudioLines, publish: Send, billing: CreditCard, account: Settings, fix: Wrench,
};

const POPULAR = ['create-book-wizard', 'writing-modes', 'cover-overview', 'publish-overview', 'tokens-explained', 'plans-compared'];

function Crumbs({ base, items }: { base: string; items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-[13px] text-ink-muted">
      <Link href={base} className="hover:text-ink">Help Centre</Link>
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          {it.href ? <Link href={it.href} className="hover:text-ink">{it.label}</Link> : <span className="text-ink-soft">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

function StillStuck() {
  return (
    <section className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-md border border-line bg-cloth-light px-5 py-4">
      <div className="flex items-center gap-3">
        <LifeBuoy className="h-6 w-6 shrink-0 text-cloth" aria-hidden />
        <div>
          <p className="font-medium text-ink">Still need help?</p>
          <p className="text-[14px] text-ink-muted">Ask the help assistant, or send a message to our support team.</p>
        </div>
      </div>
      <AskButtons />
    </section>
  );
}

export async function HelpHome({ base }: { base: string }) {
  const b = (t: string) => brandify(t, brand);
  const brand = (await getBrand()).name;
  return (
    <div className="mx-auto max-w-[980px]">
      <header className="mb-8 text-center">
        <h1 className="text-[2.1rem]">How can we help?</h1>
        <p className="mt-2 text-ink-muted">Guides for every step, from your first chapter to publishing.</p>
        <div className="mx-auto mt-5 max-w-[620px]">
          <HelpSearch base={base} />
        </div>
      </header>

      <section aria-labelledby="popular" className="mb-10">
        <h2 id="popular" className="mb-3 text-[1.1rem]">Popular guides</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {POPULAR.map((s) => getArticle(s)!).map((a) => (
            <Link key={a.slug} href={`${base}/${a.slug}`} className="panel flex items-center justify-between gap-2 px-4 py-3 text-[14px] hover:border-line-strong">
              <span className="text-ink">{b(a.title)}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="topics">
        <h2 id="topics" className="mb-3 text-[1.1rem]">Browse by topic</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => {
            const Icon = ICONS[c.icon];
            const list = articlesIn(c.id);
            return (
              <div key={c.id} className="panel flex flex-col p-4">
                <Link href={`${base}/c/${c.id}`} className="group flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-cloth-light text-cloth"><Icon className="h-5 w-5" aria-hidden /></span>
                  <span>
                    <span className="block font-medium text-ink group-hover:underline">{c.title}</span>
                    <span className="block text-[13px] text-ink-muted">{c.description}</span>
                  </span>
                </Link>
                <ul className="mt-3 space-y-1 border-t border-line pt-3 text-[14px]">
                  {list.slice(0, 3).map((a) => (
                    <li key={a.slug}><Link href={`${base}/${a.slug}`} className="text-ink-soft hover:text-cloth hover:underline">{b(a.title)}</Link></li>
                  ))}
                </ul>
                <Link href={`${base}/c/${c.id}`} className="mt-auto pt-3 text-[13px] text-cloth underline">All {list.length} guides</Link>
              </div>
            );
          })}
        </div>
      </section>
      <StillStuck />
    </div>
  );
}

export async function HelpCategoryView({ base, id }: { base: string; id: string }) {
  const b = (t: string) => brandify(t, brand);
  const brand = (await getBrand()).name;
  const c = getCategory(id);
  if (!c) notFound();
  const Icon = ICONS[c.icon];
  return (
    <div className="mx-auto max-w-[780px]">
      <Crumbs base={base} items={[{ label: c.title }]} />
      <header className="mb-6 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-md bg-cloth-light text-cloth"><Icon className="h-6 w-6" aria-hidden /></span>
        <div>
          <h1>{c.title}</h1>
          <p className="text-ink-muted">{c.description}</p>
        </div>
      </header>
      <ul className="panel divide-y divide-line">
        {articlesIn(c.id).map((a) => (
          <li key={a.slug}>
            <Link href={`${base}/${a.slug}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-ink/[.03]">
              <span>
                <span className="block font-medium text-ink">{b(a.title)}</span>
                <span className="block text-[14px] text-ink-muted">{b(a.summary)}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <StillStuck />
    </div>
  );
}

export async function HelpArticleView({ base, slug, signedIn }: { base: string; slug: string; signedIn: boolean }) {
  const b = (t: string) => brandify(t, brand);
  const brand = (await getBrand()).name;
  const a = getArticle(slug);
  if (!a) notFound();
  const c = getCategory(a.category)!;
  const related = (a.related ?? []).map((s) => getArticle(s)!).filter(Boolean);
  const siblings = articlesIn(c.id).filter((x) => x.slug !== a.slug);
  const action = a.action && (signedIn || !a.action.href.startsWith('/dashboard')) ? a.action : a.action ? { label: `Sign in: ${a.action.label.toLowerCase()}`, href: `/login?next=${encodeURIComponent(a.action.href)}` } : undefined;
  return (
    <div className="mx-auto grid max-w-[1060px] gap-10 lg:grid-cols-[1fr_260px]">
      <article>
        <Crumbs base={base} items={[{ label: c.title, href: `${base}/c/${c.id}` }, { label: b(a.title) }]} />
        <h1>{b(a.title)}</h1>
        <div className="mt-4 rounded-md border border-line bg-sheet px-4 py-3 text-[15px] text-ink">
          <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">In short</p>
          <Inline text={b(a.answer)} />
        </div>
        {action && (
          <div className="mt-4">
            <ButtonLink href={action.href} size="sm">{action.label}<ArrowRight className="h-4 w-4" aria-hidden /></ButtonLink>
          </div>
        )}
        <div className="mt-6">
          <RichText body={b(a.body)} />
        </div>
        <ArticleFeedback slug={a.slug} signedIn={signedIn} />
        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-[1.1rem]">Related guides</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {related.map((r) => (
                <Link key={r.slug} href={`${base}/${r.slug}`} className="panel px-4 py-3 hover:border-line-strong">
                  <span className="block text-[14px] font-medium text-ink">{b(r.title)}</span>
                  <span className="block text-[13px] text-ink-muted">{r.summary}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
        <StillStuck />
      </article>
      <aside className="hidden lg:block">
        <div className="sticky top-8">
          <p className="mb-2 text-[13px] font-semibold text-ink-soft">More in {c.title}</p>
          <ul className="space-y-1.5 text-[14px]">
            {siblings.map((s) => (
              <li key={s.slug}><Link href={`${base}/${s.slug}`} className="text-ink-muted hover:text-cloth hover:underline">{b(s.title)}</Link></li>
            ))}
          </ul>
          <p className="mb-2 mt-6 text-[13px] font-semibold text-ink-soft">Other topics</p>
          <ul className="space-y-1.5 text-[14px]">
            {CATEGORIES.filter((x) => x.id !== c.id).map((x) => (
              <li key={x.id}><Link href={`${base}/c/${x.id}`} className="text-ink-muted hover:text-cloth hover:underline">{x.title}</Link></li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

export const helpStaticSlugs = () => ARTICLES.map((a) => ({ slug: a.slug }));
export const helpStaticCategories = () => CATEGORIES.map((c) => ({ id: c.id }));
