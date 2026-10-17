const LABELS: Record<string, (d: Record<string, unknown>) => string> = {
  'book.created': (d) => `Started “${d.title}”`,
  'book.deleted': (d) => `Deleted “${d.title}”`,
  'book.outlined': (d) => `Planned ${d.chapters} chapters`,
  'book.imported': (d) => `Imported a manuscript (${d.chapters} chapters, ${Number(d.words).toLocaleString('en-GB')} words)`,
  'book.exported': (d) => `Downloaded the book as ${String(d.format).toUpperCase()}`,
  'book.submitted': () => 'Submitted a book for publishing',
  'chapter.generated': (d) => `AI wrote chapter ${d.chapter}`,
  'cover.generated': (d) => `Generated ${d.count} cover concept${d.count === 1 ? '' : 's'}`,
  'cover.finalised': () => 'Finished a cover',
  'submission.status': (d) => `Publishing status changed to ${String(d.status).replace('_', ' ')}`,
  'billing.subscribed': (d) => `Moved to the ${String(d.plan)} plan`,
  'billing.cancelled': () => 'Cancelled plan renewal',
  'billing.payment': (d) => `Payment received ($${d.amount})`,
  'security.2fa_on': () => 'Turned on two-factor sign-in',
  'security.2fa_off': () => 'Turned off two-factor sign-in',
  'security.password': () => 'Changed password',
};

export function describeActivity(action: string, details: Record<string, unknown>) {
  return LABELS[action]?.(details) ?? action.replace(/[._]/g, ' ');
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
