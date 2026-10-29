import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { CATALOG, NARRATION_TIERS, NARRATION_TIER_ORDER, QUALITIES, TOPUP, creditsFor, hoursFor, money, type Currency, type Quality } from '@/lib/pricing';
import { chunkText, isTrackOutdated, narratorLabel, type NarratorSettings } from '@/lib/audiobook';
import { PLANS } from '@/lib/plans';
import { NARRATION_MODELS, USD_PER_1K_CHARS, chunkLimitFor, costUsd, friendlyElevenLabsError, synthesize } from '@/lib/elevenlabs';

/**
 * The 10× rule: what we keep from a payment, after the payment service's fees and with
 * the pound at a weak rate, must be at least ten times the most ElevenLabs could charge
 * for the credits it buys. Fees are set high on purpose (PayPal's international rate
 * plus a currency-conversion allowance), so the rule holds on either payment service.
 */
const FEE_PERCENT = 0.08;
const FEE_FIXED = 0.3;
const WEAK_GBP_IN_USD = 1.25;

/** The most ElevenLabs can charge per credit, at whichever quality costs most per credit. */
const worstUsdPerCredit = Math.max(...(Object.keys(QUALITIES) as Quality[]).map((q) => USD_PER_1K_CHARS[q] / 1000 / QUALITIES[q].creditsPerChar));

function keptInUsd(price: number, currency: Currency) {
  const kept = price * (1 - FEE_PERCENT) - FEE_FIXED;
  return currency === 'GBP' ? kept * WEAK_GBP_IN_USD : kept;
}

describe('narration pricing keeps a 10× margin', () => {
  for (const id of NARRATION_TIER_ORDER) {
    for (const cur of ['GBP', 'USD'] as Currency[]) {
      it(`${NARRATION_TIERS[id].name} in ${cur}`, () => {
        const t = NARRATION_TIERS[id];
        const maxCost = t.credits * worstUsdPerCredit;
        expect(keptInUsd(t.prices[cur], cur)).toBeGreaterThanOrEqual(10 * maxCost);
      });
    }
  }
  for (const cur of ['GBP', 'USD'] as Currency[]) {
    it(`top-up in ${cur}`, () => {
      expect(keptInUsd(TOPUP.prices[cur], cur)).toBeGreaterThanOrEqual(10 * TOPUP.credits * worstUsdPerCredit);
    });
  }
  it('Standard costs twice the credits of Turbo, matching ElevenLabs charging twice as much', () => {
    expect(QUALITIES.standard.creditsPerChar / QUALITIES.turbo.creditsPerChar).toBe(USD_PER_1K_CHARS.standard / USD_PER_1K_CHARS.turbo);
  });
});

describe('plans and add-ons', () => {
  it('only the top add-on can choose Standard quality', () => {
    expect(NARRATION_TIERS.starter.qualities).toEqual(['turbo']);
    expect(NARRATION_TIERS.author.qualities).toEqual(['turbo']);
    expect(NARRATION_TIERS.pro.qualities).toEqual(['turbo', 'standard']);
  });
  it('every paid item has a price in both currencies', () => {
    for (const c of CATALOG) {
      expect(c.prices.GBP).toBeGreaterThan(0);
      expect(c.prices.USD).toBeGreaterThan(0);
    }
    expect(PLANS.free.prices).toEqual({ USD: 0, GBP: 0 });
    expect(PLANS.pro.prices.USD).toBe(29);
  });
  it('counts credits by quality', () => {
    expect(creditsFor(10_000, 'turbo')).toBe(10_000);
    expect(creditsFor(10_000, 'standard')).toBe(20_000);
  });
  it('describes credits as hours of audio', () => {
    expect(hoursFor(300_000, 'turbo')).toBe('about 5½ hours');
    expect(hoursFor(600_000, 'standard')).toBe('about 5½ hours');
    expect(hoursFor(100_000, 'turbo')).toBe('about 2 hours');
    expect(hoursFor(20_000, 'turbo')).toBe('about 20 minutes');
  });
  it('formats money in each currency', () => {
    expect(money(42, 'GBP')).toBe('£42');
    expect(money(59, 'USD')).toBe('$59');
    expect(money(12.5, 'GBP')).toBe('£12.50');
  });
  it('estimates our ElevenLabs cost', () => {
    expect(costUsd(250_000, 'turbo')).toBeCloseTo(250 * USD_PER_1K_CHARS.turbo);
    expect(costUsd(250_000, 'standard')).toBeCloseTo(250 * USD_PER_1K_CHARS.standard);
  });
});

describe('splitting chapters for ElevenLabs', () => {
  const para = 'The rain had not stopped for three days, and the river was rising. '.repeat(40);
  const chapter = Array.from({ length: 30 }, () => para).join('\n\n');
  for (const q of ['turbo', 'standard'] as Quality[]) {
    it(`keeps every piece under the ${NARRATION_MODELS[q]} limit and loses no text`, () => {
      const limit = chunkLimitFor(NARRATION_MODELS[q]);
      const chunks = chunkText(chapter, limit);
      expect(chunks.every((c) => c.length <= limit)).toBe(true);
      expect(chunks.join(' ').replace(/\s+/g, ' ').trim()).toBe(chapter.replace(/\s+/g, ' ').trim());
    });
  }
  it('uses a safe size for models it doesn’t know', () => {
    expect(chunkLimitFor('some_future_model')).toBe(4500);
  });
});

describe('ElevenLabs narration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function fakeElevenLabs(handler: (body: Record<string, unknown>, n: number) => Response) {
    const bodies: Record<string, unknown>[] = [];
    vi.stubEnv('ELEVENLABS_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      bodies.push(body);
      return handler(body, bodies.length);
    }));
    return bodies;
  }
  const audio = (n: number) => new Response(new Uint8Array([n, n, n]), { status: 200, headers: { 'request-id': `req-${n}` } });

  it('narrates pieces in order and links each to the ones before it', async () => {
    const bodies = fakeElevenLabs((_b, n) => audio(n));
    const out = await synthesize({ voiceId: 'v1', quality: 'standard', chunks: ['one', 'two', 'three'] });
    expect([...out]).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
    expect(bodies.map((b) => b.text)).toEqual(['one', 'two', 'three']);
    expect(bodies[0].previous_request_ids).toBeUndefined();
    expect(bodies[1].previous_request_ids).toEqual(['req-1']);
    expect(bodies[2].previous_request_ids).toEqual(['req-1', 'req-2']);
    expect(bodies[0].model_id).toBe(NARRATION_MODELS.standard);
  });

  it('carries on without linking if the model doesn’t support it', async () => {
    const bodies = fakeElevenLabs((b, n) =>
      b.previous_request_ids ? new Response(JSON.stringify({ detail: { status: 'invalid', message: 'previous_request_ids not supported for this model' } }), { status: 400 }) : audio(n),
    );
    const out = await synthesize({ voiceId: 'v1', quality: 'turbo', chunks: ['a', 'b', 'c'] });
    expect(out.length).toBe(9);
    // After the first refusal it stops asking.
    expect(bodies.filter((b) => b.previous_request_ids).length).toBe(1);
  });

  it('retries when ElevenLabs is busy', async () => {
    vi.useFakeTimers();
    fakeElevenLabs((_b, n) => (n === 1 ? new Response('busy', { status: 429 }) : audio(n)));
    const p = synthesize({ voiceId: 'v1', quality: 'turbo', chunks: ['only'] });
    await vi.runAllTimersAsync();
    expect((await p).length).toBe(3);
    vi.useRealTimers();
  });

  it('explains failures in plain words and says credits weren’t used', async () => {
    fakeElevenLabs(() => new Response(JSON.stringify({ detail: { status: 'quota_exceeded', message: 'You have run out of credits' } }), { status: 401 }));
    const err = await synthesize({ voiceId: 'v1', quality: 'turbo', chunks: ['x'] }).catch((e) => e);
    const f = friendlyElevenLabsError(err);
    expect(f.code).toBe('NARRATION_PROVIDER');
    expect(f.message).toMatch(/credits weren’t used/);
  });
});

describe('when a narrated chapter is out of date', () => {
  const at = '2026-10-01T10:00:00Z';
  const basic: NarratorSettings = { engine: 'basic', voice: 'british_female', premium_voice_id: null, quality: 'turbo' };
  const premium: NarratorSettings = { engine: 'premium', voice: 'british_female', premium_voice_id: 'v1', quality: 'turbo' };
  it('keeps chapters narrated before premium voices existed', () => {
    expect(isTrackOutdated({ generated_at: at, voice: 'british_female' }, '2026-09-30T00:00:00Z', basic)).toBe(false);
  });
  it('flags edited text, a new narrator, a switch of kind, or a change of quality', () => {
    const t = { generated_at: at, voice: 'v1', engine: 'premium' as const, quality: 'turbo' as const };
    expect(isTrackOutdated(t, '2026-09-30T00:00:00Z', premium)).toBe(false);
    expect(isTrackOutdated(t, '2026-10-02T00:00:00Z', premium)).toBe(true);
    expect(isTrackOutdated(t, '2026-09-30T00:00:00Z', { ...premium, premium_voice_id: 'v2' })).toBe(true);
    expect(isTrackOutdated(t, '2026-09-30T00:00:00Z', { ...premium, quality: 'standard' })).toBe(true);
    expect(isTrackOutdated(t, '2026-09-30T00:00:00Z', basic)).toBe(true);
  });
  it('describes the narrator for the publishing team', () => {
    expect(narratorLabel({ engine: 'premium', premium_voice_name: 'Rachel', quality: 'standard' })).toBe('Rachel (premium, Standard)');
    expect(narratorLabel({ engine: 'basic', voice: 'british_male' })).toBe('British male');
    expect(narratorLabel(null)).toBeNull();
  });
});
