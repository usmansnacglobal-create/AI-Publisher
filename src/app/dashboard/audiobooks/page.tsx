import { BookList } from '@/components/book-list';
export const metadata = { title: 'Audiobook Narration' };
export default function Page() {
  return <BookList title="Audiobook Narration" intro="Choose a book to turn into an audiobook: pick a narrator, listen to samples and narrate it chapter by chapter." link={(id) => `/dashboard/books/${id}/audiobook`} action="Narrate audiobook" />;
}
