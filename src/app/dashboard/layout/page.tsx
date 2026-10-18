import { BookList } from '@/components/book-list';
export const metadata = { title: 'Layout Typographer' };
export default function Page() {
  return <BookList title="Layout Typographer" intro="Choose a book to design its interior: trim size, colour, fonts, chapter headings and print-ready files." link={(id) => `/dashboard/books/${id}/format`} action="Design layout" />;
}
