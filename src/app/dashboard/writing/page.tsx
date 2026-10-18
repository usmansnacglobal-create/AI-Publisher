import { BookList } from '@/components/book-list';
export const metadata = { title: 'Document Editor' };
export default function Page() {
  return <BookList title="Document Editor" intro="Choose a book to open in the editor." link={(id) => `/dashboard/books/${id}/write`} action="Write" />;
}
