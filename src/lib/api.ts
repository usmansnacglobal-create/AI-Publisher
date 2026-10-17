import 'server-only';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from './supabase/server';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === 'number' ? { status: init } : init);
}

export async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new HttpError(401, 'Sign in to continue.');
  return { supabase, user: user as User };
}

/** Load a book the current user owns, or throw 404. */
export async function requireBook(supabase: ReturnType<typeof createClient>, bookId: string) {
  const { data: book } = await supabase.from('books').select('*').eq('id', bookId).single();
  if (!book) throw new HttpError(404, 'Book not found.');
  return book as Book;
}

export function handle<T extends unknown[]>(fn: (...args: T) => Promise<Response>) {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (e: unknown) {
      if (e instanceof HttpError) return json({ error: e.message, code: e.code }, e.status);
      console.error(e);
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      return json({ error: friendlyError(message) }, 500);
    }
  };
}

function friendlyError(message: string) {
  if (/overloaded|529/i.test(message)) return 'The AI service is busy right now. Try again in a minute.';
  if (/rate.?limit|429/i.test(message)) return 'Too many AI requests at once. Wait a moment and try again.';
  if (/content.?policy|safety/i.test(message)) return 'The AI declined this request. Try rewording it.';
  return 'Something went wrong. Try again, and contact support if it keeps happening.';
}

export interface Book {
  id: string;
  user_id: string;
  title: string;
  subtitle: string;
  book_type: 'fiction' | 'nonfiction';
  genre: string;
  audience: string;
  style: string;
  tone: string;
  summary: string;
  target_words: number;
  target_chapters: number;
  status: 'draft' | 'in_review' | 'published';
  trim_size: string;
  paper: 'white' | 'cream';
  page_count: number | null;
  blurb: string;
  keywords: string[];
  categories: string[];
  author_bio: string;
  dedication: string;
  copyright_holder: string;
  author_name: string;
  reader_outcome: string;
  key_message: string;
  pov: string;
  pacing: string;
  themes: string[];
  dialect: string;
  writing_mode: 'full' | 'assist' | 'outline';
  writing_sample: string;
  layout: Record<string, unknown>;
  layout_approved_at: string | null;
  content_updated_at: string;
  language: string;
  edition: string;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: string;
  book_id: string;
  user_id: string;
  position: number;
  title: string;
  synopsis: string;
  content: string;
  word_count: number;
  status: 'planned' | 'drafted';
  generated_at: string | null;
  updated_at: string;
  settings: ChapterSettings;
  admin_note: string;
}

export interface ChapterSettings {
  mode?: 'full' | 'assist' | 'outline';
  length?: 'short' | 'standard' | 'long' | 'custom';
  words?: number;
  tone?: string;
  formality?: 'casual' | 'neutral' | 'formal';
  sentences?: 'short' | 'varied' | 'long';
  style?: string;
  instructions?: string;
  includeSummary?: boolean;
  includeReflection?: boolean;
  useSample?: boolean;
}
