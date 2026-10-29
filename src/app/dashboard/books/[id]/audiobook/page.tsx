import { Audiobook } from './audiobook';

export const metadata = { title: 'Audiobook' };

/** Premium narration works on any plan with the narration add-on; basic voices come with Pro and Agency. */
export default function AudiobookPage({ params }: { params: { id: string } }) {
  return <Audiobook bookId={params.id} />;
}
