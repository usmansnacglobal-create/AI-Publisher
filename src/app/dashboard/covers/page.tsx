import { BookList } from '@/components/book-list';
export const metadata = { title: 'Media & Cover Designer' };
export default function Page() {
  return <BookList title="Media & Cover Designer" intro="Choose a book to design its cover, from AI artwork to print-ready paperback and hardcover files." link={(id) => `/dashboard/books/${id}/cover`} action="Design cover" />;
}
