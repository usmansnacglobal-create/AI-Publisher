import { z } from 'zod';
import { handle, json, requireUser, HttpError } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLATFORM_IDS } from '@/lib/publishing';

/** Saves the links to a book's page in each store. */
export const PUT = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase } = await requireUser();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) throw new HttpError(403, 'Admins only.');
  const body = z.object({ links: z.record(z.string(), z.string().max(500)) }).safeParse(await req.json());
  if (!body.success) throw new HttpError(400, 'Invalid links.');
  const links: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.data.links)) {
    if (!(PLATFORM_IDS as readonly string[]).includes(k) || !v.trim()) continue;
    if (!/^https:\/\//.test(v.trim())) throw new HttpError(400, 'Store links must start with https://');
    links[k] = v.trim();
  }
  const { data, error } = await createAdminClient().from('submissions').update({ store_links: links }).eq('id', params.id).select('id,store_links').single();
  if (error) throw error;
  return json({ submission: data });
});
