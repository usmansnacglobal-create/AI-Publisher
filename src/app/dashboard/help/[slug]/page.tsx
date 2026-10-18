import { getArticle } from '@/lib/help';
import { HelpArticleView } from '@/components/help/centre';

export const generateMetadata = ({ params }: { params: { slug: string } }) => ({ title: getArticle(params.slug)?.title ?? 'Help' });

export default function Page({ params }: { params: { slug: string } }) {
  return <HelpArticleView base="/dashboard/help" slug={params.slug} signedIn />;
}
