'use client';
import { api } from './client';
import { createClient } from './supabase/client';

export const IMPORT_MAX_MB = 40;

/**
 * Imports a manuscript. The file goes straight to private storage first, so
 * large Word files with pictures aren't limited by the server's upload size.
 */
export async function importManuscript(bookId: string, file: File, replace = false) {
  if (file.size > IMPORT_MAX_MB * 1024 * 1024) throw new Error(`That file is over ${IMPORT_MAX_MB} MB. Save a copy with smaller pictures and try again.`);
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  if (!['docx', 'pdf', 'txt', 'md'].includes(ext)) throw new Error('Import a .docx, .pdf, .txt or .md file. For Pages or Google Docs, download as Word first.');
  const sb = createClient();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) throw new Error('Please sign in again.');
  const path = `${u.user.id}/${bookId}/imports/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('manuscripts').upload(path, file, { contentType: file.type || 'application/octet-stream' });
  if (error) throw error;
  return api<{ chapters: number; words: number; images: number }>(`/api/books/${bookId}/import`, { body: { path, replace } });
}
