import { getArticle } from '@/lib/help';
import { createClient } from '@/lib/supabase/server';
import { HelpArticleView } from '@/components/help/centre';

export const generateMetadata = ({ params }: { params: { slug: string } }) => {
  const a = getArticle(params.slug);
  return { title: a?.title ?? 'Help', description: a?.summary };
};

export default async function Page({ params }: { params: { slug: string } }) {
  const { data } = await createClient().auth.getUser();
  return <HelpArticleView base="/help" slug={params.slug} signedIn={!!data.user} />;
}
