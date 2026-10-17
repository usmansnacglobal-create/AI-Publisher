import { BookList } from '@/components/book-list';
export const metadata = { title: 'My books' };
export default function Page() {
  return <BookList title="My books" intro="Everything you’re writing and have published." link={(id) => `/dashboard/books/${id}`} action="Open book" />;
}
