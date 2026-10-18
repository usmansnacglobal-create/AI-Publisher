import { getCategory } from '@/lib/help';
import { HelpCategoryView, helpStaticCategories } from '@/components/help/centre';

export const generateStaticParams = helpStaticCategories;
export const generateMetadata = ({ params }: { params: { id: string } }) => ({ title: getCategory(params.id)?.title ?? 'Help' });

export default function Page({ params }: { params: { id: string } }) {
  return <HelpCategoryView base="/help" id={params.id} />;
}
