import { PrintOrder } from './print-order';

export const metadata = { title: 'Print copies' };

export default function Page({ params }: { params: { id: string } }) {
  return <PrintOrder bookId={params.id} />;
}
