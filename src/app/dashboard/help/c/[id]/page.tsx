import { getCategory } from '@/lib/help';
import { HelpCategoryView } from '@/components/help/centre';

export const generateMetadata = ({ params }: { params: { id: string } }) => ({ title: getCategory(params.id)?.title ?? 'Help' });

export default function Page({ params }: { params: { id: string } }) {
  return <HelpCategoryView base="/dashboard/help" id={params.id} />;
}
