import { handle, requireUser, HttpError } from '@/lib/api';
import { getVoice } from '@/lib/voice-library';

export const dynamic = 'force-dynamic';

/**
 * Plays a voice's sample. The sample comes from ElevenLabs (free, no credits used) and is
 * passed through our server, so the address is always one ElevenLabs gave us.
 */
export const GET = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  await requireUser();
  const v = await getVoice(params.id);
  if (!v?.preview_url) throw new HttpError(404, 'This voice has no sample.');
  const url = new URL(v.preview_url);
  if (url.protocol !== 'https:') throw new HttpError(404, 'This voice has no sample.');
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok || !res.body) throw new HttpError(502, 'The sample couldn’t be loaded. Try another voice.');
  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type')?.startsWith('audio/') ? res.headers.get('content-type')! : 'audio/mpeg',
      'Cache-Control': 'private, max-age=86400',
    },
  });
});
