import { BookList } from '@/components/book-list';
export const metadata = { title: 'Writing' };
export default function Page() {
  return <BookList title="Writing" intro="Choose a book to keep writing." link={(id) => `/dashboard/books/${id}/write`} action="Write" />;
}
