import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { assertQuota, recordUsage } from '../tokens';

// Claude handles all writing, editing, proofreading and publishing copy.
// Change the models in Vercel → Settings → Environment Variables without touching code.
export const WRITING_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
export const FAST_MODEL = process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-5-5';

let client: Anthropic | null = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set.');
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
  return client;
}

interface Base {
  userId: string;
  bookId?: string | null;
  feature: string;
  system: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}

/** Plain text answer. */
export async function complete(o: Base): Promise<string> {
  await assertQuota(o.userId);
  const model = o.model ?? WRITING_MODEL;
  const msg = await anthropic().messages.create({
    model,
    max_tokens: o.maxTokens ?? 2000,
    system: o.system,
    messages: [{ role: 'user', content: o.prompt }],
  });
  await recordUsage({
    userId: o.userId, bookId: o.bookId, feature: o.feature, provider: 'anthropic', model,
    inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens,
  });
  return msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
}

/**
 * Structured answer: Claude must fill in the given JSON schema (via a forced
 * tool call), so results are always machine-readable.
 */
export async function completeStructured<T>(o: Base & { schema: Record<string, unknown>; toolName?: string }): Promise<T> {
  await assertQuota(o.userId);
  const model = o.model ?? WRITING_MODEL;
  const name = o.toolName ?? 'submit';
  const msg = await anthropic().messages.create({
    model,
    max_tokens: o.maxTokens ?? 4000,
    system: o.system,
    tools: [{ name, description: 'Submit the result.', input_schema: o.schema as Anthropic.Tool.InputSchema }],
    tool_choice: { type: 'tool', name },
    messages: [{ role: 'user', content: o.prompt }],
  });
  await recordUsage({
    userId: o.userId, bookId: o.bookId, feature: o.feature, provider: 'anthropic', model,
    inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens,
  });
  const block = msg.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') throw new Error('The AI returned an unexpected response.');
  return block.input as T;
}

/**
 * Streams text to the browser as it is written. Usage is recorded and
 * `onDone` runs with the full text when the stream finishes.
 */
export async function streamText(o: Base & { onDone?: (text: string) => Promise<void> }): Promise<ReadableStream<Uint8Array>> {
  await assertQuota(o.userId, 2000);
  const model = o.model ?? WRITING_MODEL;
  const stream = anthropic().messages.stream({
    model,
    max_tokens: o.maxTokens ?? 8000,
    system: o.system,
    messages: [{ role: 'user', content: o.prompt }],
  });
  const encoder = new TextEncoder();
  let full = '';
  let inTok = 0;
  let outTok = 0;
  let recorded = false;
  const record = async () => {
    if (recorded) return;
    recorded = true;
    await recordUsage({
      userId: o.userId, bookId: o.bookId, feature: o.feature, provider: 'anthropic', model,
      inputTokens: inTok, outputTokens: outTok,
    });
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'message_start') inTok = event.message.usage.input_tokens;
          if (event.type === 'message_delta') outTok = event.usage.output_tokens;
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            full += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        inTok = final.usage.input_tokens;
        outTok = final.usage.output_tokens;
        await record();
        if (o.onDone) await o.onDone(full.trim());
        controller.close();
      } catch (e) {
        console.error('stream failed', e);
        await record().catch(() => {});
        controller.enqueue(encoder.encode('\n\n[[ERROR: The AI stopped before finishing. Your text so far is kept; try again.]]'));
        controller.close();
      }
    },
    async cancel() {
      stream.abort();
      // The author closed the page mid-stream: still count what was generated.
      await record().catch(() => {});
    },
  });
}
