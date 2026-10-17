import { BookList } from '@/components/book-list';
export const metadata = { title: 'Publishing' };
export default function Page() {
  return <BookList title="Publishing" intro="Get a book ready for the stores, submit it and follow its progress." link={(id) => `/dashboard/books/${id}/publish`} action="Publishing" />;
}
