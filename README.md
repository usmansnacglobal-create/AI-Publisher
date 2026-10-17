# AI Publisher

A subscription web app where authors write, edit, proofread, format, design covers for and publish their books, with AI help at every step.

- **Claude (Anthropic)** writes and edits: chapter drafts, tracked-change suggestions, proofreading, continuity checks, story bible, publishing copy.
- **ChatGPT's image model (OpenAI)** paints cover artwork.
- **Next.js** on **Vercel** for the app, **Supabase** for sign-in, database and private file storage, **PayPal** for subscriptions.

## What authors get

| Area | Features |
|---|---|
| Write | Plan chapters from an idea, AI chapter drafts that stream in live, "continue writing", Word/text/Markdown import, autosave, version history with restore, "rewrite the whole book" |
| Edit | Every AI change is a tracked suggestion to accept or reject: quick edits, line edits, paragraph edits, dialogue polish, show-don't-tell, your own instruction. "Ask AI anything" chat |
| Story bible | Characters, places, events and rules the AI always follows; build it automatically from the manuscript |
| Proofread | Full-book report by chapter (US or UK spelling) with one-click fixes; continuity check across chapters |
| Format | Print-ready PDF interior (embedded fonts, mirrored margins, chapters on right-hand pages, contents with page numbers), EPUB ebook, Word, Markdown, plain text. Page count is measured and fed into the cover spine |
| Cover | Brief, then ChatGPT concepts, then live typography design, then export: 1600 × 2560 ebook cover plus a print-ready wrap PDF (back, spine, front, bleed, barcode area) |
| Publish | AI-written store description, 7 keywords, 3 categories, author bio, launch posts; readiness checklist; submission tracker |
| Account | Real token dashboard (per day, per feature, per book), PayPal billing with history, activity log, notifications (in-app, email, webhook), two-factor sign-in, account deletion |
| Your team | A publishing queue at `/admin` to review submissions, request changes, add the ISBN and mark books live; authors are notified at each step |

Plans (edit in `src/lib/plans.ts`): **Free** 1 book and 30k tokens; **Pro** $29, 10 books, 500k tokens and all tools; **Agency** $79, unlimited books, 2M tokens and automations.

## Setting it up

You need accounts with GitHub, Vercel, Supabase, Anthropic, OpenAI and (before charging customers) PayPal. Never paste API keys into chat or into code; they only go into Vercel's environment variables.

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com). Choose a region near your authors (for example London).
2. Open **SQL Editor → New query**, paste everything from `supabase/migrations/0001_init.sql`, and click **Run**. Then do the same with `0002_old_tool_features.sql` (safe to run more than once).
3. **Authentication → URL Configuration**: set **Site URL** to your site's address (for example `https://aipublisher.com`) and add `https://aipublisher.com/**` under **Redirect URLs**.
4. **Project Settings → API**: copy the **Project URL**, the **anon public** key and the **service_role** key for step 3.

### 2. PayPal (can wait until you're ready to charge)
1. At [developer.paypal.com](https://developer.paypal.com), create an app and copy its **Client ID** and **Secret**.
2. Create a product and two monthly plans: Pro ($29) and Agency ($79). Copy each **Plan ID** (it starts with `P-`).
3. Add a webhook pointing to `https://YOUR-SITE/api/billing/paypal/webhook` with these events: `PAYMENT.SALE.COMPLETED`, `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.UPDATED`, `BILLING.SUBSCRIPTION.CANCELLED`, `BILLING.SUBSCRIPTION.EXPIRED`, `BILLING.SUBSCRIPTION.SUSPENDED`, `BILLING.SUBSCRIPTION.PAYMENT.FAILED`. Copy the **Webhook ID**.
4. Use sandbox values first. When you go live, switch `PAYPAL_ENV` to `live` and use the live values.

### 3. Vercel
1. **Add New → Project**, then import this GitHub repository.
2. Before deploying, open **Environment Variables** and add every variable from `.env.example`:

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase step 4 |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API keys |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) → API keys. Used for cover art and audiobook narration |
| `ANTHROPIC_MODEL`, `ANTHROPIC_FAST_MODEL`, `OPENAI_IMAGE_MODEL` | Optional. Defaults are `claude-sonnet-5-5`, `claude-haiku-5-5` and `gpt-image-2` (plus `OPENAI_TTS_MODEL`, default `gpt-4o-mini-tts`). Change these to switch models without touching code |
| `PAYPAL_ENV`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `NEXT_PUBLIC_PAYPAL_PLAN_PRO`, `NEXT_PUBLIC_PAYPAL_PLAN_AGENCY`, `PAYPAL_WEBHOOK_ID` | PayPal steps 1 to 3 |
| `NEXT_PUBLIC_SITE_URL` | Your site's address |
| `CRON_SECRET` | Any long random text (for the Sunday progress email) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional, from [resend.com](https://resend.com), for notification emails |

3. Click **Deploy**. Chapter writing can take a minute or two, so a Vercel **Pro** plan is recommended (it allows the 5-minute function time this app asks for).
4. Add your domain under **Settings → Domains**, then update the Supabase Site URL to match.

### 4. Make yourself an admin
Sign up on your site, then run this in Supabase's SQL Editor (with your email):
```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```
You'll see **Publishing queue** in the sidebar.

## Security
- Every table has row-level security: authors can only see and change their own books, chapters, covers and files. Plan, role and billing fields can only be changed by the server.
- All files are in private storage and shown through links that expire after an hour.
- AI keys live only on the server; the browser never talks to Anthropic or OpenAI.
- Book limits are enforced in the database, and paid tools are checked on the server, not just hidden in the interface.
- Manuscripts are sent to Anthropic and OpenAI only to fulfil the author's request. Both providers' API terms say API data isn't used to train their models by default; check them for your own privacy policy.

## For developers
```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # http://localhost:3000
npm test                     # unit tests
npm run typecheck && npm run lint && npm run build
```
Key places: `src/lib/ai/` (Claude and OpenAI calls and prompts), `src/lib/tokens.ts` (metering and limits), `src/lib/plans.ts` (plans), `src/lib/export/` (PDF, EPUB, Word), `src/lib/canvas.ts` (cover rendering), `supabase/migrations/` (database).

The print interior uses EB Garamond (SIL Open Font License), bundled in `src/assets/fonts`.
