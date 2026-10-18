import { BookList } from '@/components/book-list';
export const metadata = { title: 'My Library' };
export default function Page() {
  return <BookList title="My Library" intro="Everything you’re writing and have published." link={(id) => `/dashboard/books/${id}`} action="Open book" />;
}
