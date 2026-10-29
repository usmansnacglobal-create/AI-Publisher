# AI Publisher

A subscription web app where authors write, edit, proofread, format, design covers for and publish their books, with AI help at every step.

- **Claude (Anthropic)** writes and edits: chapter drafts, tracked-change suggestions, proofreading, continuity checks, story bible, publishing copy.
- **ChatGPT's image model (OpenAI)** paints cover artwork and reads with the five basic narration voices.
- **ElevenLabs** narrates audiobooks with premium library voices (the narration add-on).
- **Next.js** on **Vercel** for the app, **Supabase** for sign-in, database and private file storage, **Stripe** (cards) and **PayPal** for payments in pounds and dollars.

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
| Audiobook | Premium ElevenLabs narrators (browse the voice library by group, filter, play samples) in Turbo or Standard quality using narration credits; five basic voices on Pro and Agency |
| Account | Real token dashboard (per day, per feature, per book), narration credits, Stripe and PayPal billing in GBP or USD with history, activity log, notifications (in-app, email, webhook), two-factor sign-in, account deletion |
| Your team | A publishing queue at `/admin` to review submissions, request changes, add the ISBN and mark books live; authors are notified at each step |

Plans (edit in `src/lib/plans.ts`; prices in `src/lib/pricing.ts`): **Free** 1 book and 30k tokens; **Pro** $29 / £24, 10 books, 500k tokens and all tools; **Agency** $79 / £64, unlimited books, 2M tokens and automations.

Narration add-on, on any plan (prices in `src/lib/pricing.ts`):

| Add-on | Credits a month | Quality | GBP | USD |
|---|---|---|---|---|
| Narration Starter | 100,000 (about 2 hours) | Turbo | £42 | $59 |
| Narration Author | 300,000 (about 5½ hours) | Turbo | £119 | $159 |
| Narration Pro | 600,000 | Turbo or Standard | £239 | $319 |
| Top-up (one-off, never expires) | 100,000 | | £42 | $59 |

Turbo uses 1 credit per character and Standard 2, because ElevenLabs charges twice as much for it. Every price is at least 10× the most ElevenLabs could charge for the credits, after card or PayPal fees; `tests/narration.test.ts` fails if a price change breaks that.

## Setting it up

You need accounts with GitHub, Vercel, Supabase, Anthropic, OpenAI and (before charging customers) PayPal. Never paste API keys into chat or into code; they only go into Vercel's environment variables.

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com). Choose a region near your authors (for example London).
2. Open **SQL Editor → New query**, paste everything from `supabase/migrations/0001_init.sql`, and click **Run**. Then do the same with `0002_old_tool_features.sql`, `0003_print_options.sql`, `0004_print_orders_and_analytics.sql` and `0005_narration_and_billing.sql` (each is safe to run more than once).
3. **Authentication → URL Configuration**: set **Site URL** to your site's address (for example `https://aipublisher.com`) and add `https://aipublisher.com/**` under **Redirect URLs**.
4. **Project Settings → API**: copy the **Project URL**, the **anon public** key and the **service_role** key for step 3.

### 2. Payments: Stripe and PayPal (can wait until you're ready to charge)
You can use either or both; authors see a button for each one that's set up.

**Stripe (cards)**
1. At [dashboard.stripe.com](https://dashboard.stripe.com) → **Developers → API keys**, copy the **Secret key** (`sk_test_…` while testing).
2. **Developers → Webhooks → Add endpoint**: `https://YOUR-SITE/api/billing/stripe/webhook`, with the events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy its **Signing secret** (`whsec_…`).
3. Turn on the **Customer portal** (Settings → Billing → Customer portal) so authors can update their card and download invoices.

**PayPal**
1. At [developer.paypal.com](https://developer.paypal.com), create an app and copy its **Client ID** and **Secret**.
2. Add a webhook pointing to `https://YOUR-SITE/api/billing/paypal/webhook` with these events: `PAYMENT.SALE.COMPLETED`, `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.UPDATED`, `BILLING.SUBSCRIPTION.CANCELLED`, `BILLING.SUBSCRIPTION.EXPIRED`, `BILLING.SUBSCRIPTION.SUSPENDED`, `BILLING.SUBSCRIPTION.PAYMENT.FAILED`. Copy the **Webhook ID**.
3. Use sandbox values first. When you go live, switch `PAYPAL_ENV` to `live` and use the live values.

You don't create plans by hand in either service: after deploying, open **Admin → Billing setup** and click **Set up missing prices**. It creates every plan, narration add-on and top-up in both currencies.

### ElevenLabs (premium narration)
1. At [elevenlabs.io](https://elevenlabs.io), choose a paid plan (Starter is enough) and turn on **Pay As You Go** with **Auto Top Up**, so narration never stops for lack of balance. Library voices aren't available through the API on the free plan.
2. **Developers → API keys**: create a key and add it as `ELEVENLABS_API_KEY`.
3. The voice library loads the first time an author opens it and refreshes itself daily. **Admin → Billing setup** shows the connection, refreshes the library on demand and reports what narration earns against what ElevenLabs charges.

### 3. Vercel
1. **Add New → Project**, then import this GitHub repository.
2. Before deploying, open **Environment Variables** and add every variable from `.env.example`:

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase step 4 |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API keys |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) → API keys. Used for cover art and the five basic narration voices |
| `ANTHROPIC_MODEL`, `ANTHROPIC_FAST_MODEL`, `OPENAI_IMAGE_MODEL` | Optional. Defaults are `claude-sonnet-5-5`, `claude-haiku-5-5` and `gpt-image-2` (plus `OPENAI_TTS_MODEL`, default `gpt-4o-mini-tts`). Change these to switch models without touching code |
| `ELEVENLABS_API_KEY` | ElevenLabs step 2. Optional: `ELEVENLABS_TURBO_MODEL` (default `eleven_v4_turbo`), `ELEVENLABS_STANDARD_MODEL` (default `eleven_v4`) and their prices, to switch models without touching code |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe steps 1 and 2 |
| `PAYPAL_ENV`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` | PayPal steps 1 to 3 |
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
- AI keys live only on the server; the browser never talks to Anthropic, OpenAI or ElevenLabs. Voice samples are passed through the site's own server.
- Narration credits move only inside database functions that run as one transaction and only the server may call, so two narrations at once can't spend the same credits, and a payment can't add credits twice.
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
Key places: `src/lib/ai/` (Claude and OpenAI calls and prompts), `src/lib/tokens.ts` (metering and limits), `src/lib/plans.ts` (plans), `src/lib/pricing.ts` (prices in both currencies, narration add-ons and credits), `src/lib/billing.ts` (Stripe and PayPal checkout, webhooks' shared logic), `src/lib/narration.ts` (narration credits), `src/lib/elevenlabs.ts` and `src/lib/voice-library.ts` (ElevenLabs), `src/lib/export/` (PDF, EPUB, Word), `src/lib/canvas.ts` (cover rendering), `supabase/migrations/` (database).

The print interior uses EB Garamond (SIL Open Font License), bundled in `src/assets/fonts`.

## Help Centre and help assistant

- Guides live in `src/lib/help/articles-*.ts`. Each guide has a short answer (what the assistant says), example questions, keywords and the full step-by-step text. Edit or add guides there and redeploy.
- The help assistant (the **Help** button) answers from these guides only. It runs in the browser with no AI calls, so it costs nothing and uses no tokens.
- Messages sent with **Contact support** appear in **Support inbox** (`/admin/support`) and as notifications for admins. The inbox also lists questions the assistant couldn't answer and guide ratings, so you can see which guides to improve.
- `npm test` checks the assistant against a list of real-world questions (`tests/help.test.ts`). Add new phrasings there when you add guides.

## Print orders

- Authors order printed copies from a book's **Print copies** tab once the layout is approved, the print PDF downloaded and the cover exported. **Print Orders** in the sidebar lists their orders and has a price calculator.
- Price per copy = IngramSpark's printing cost × the markup (2 by default). Set IngramSpark's rates, the markup and shipping by destination at **Admin → Print orders → Print pricing**. Paperback black-and-white starts from IngramSpark's published February 2026 rate ($1.33 a copy + $0.0146 a page); the other rates are estimates to replace with figures from IngramSpark's Print & Ship calculator.
- With PayPal keys set (`NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_ENV=live` for real payments), authors pay by PayPal or card at checkout. Without them, orders arrive as "Awaiting payment" and admins get a notification to send a payment request.
- Admins place each paid order with IngramSpark (Print & Ship), then update the status and tracking on the admin page; authors are notified at each step.

## Sales figures and store links

- **Admin → Sales data**: add monthly sales and royalties per book and store (one at a time or by pasting a report). Authors see them in **Performance Analytics** and the **Dashboard Overview**.
- **Admin → Publishing queue → Store links**: add the link to each store page once a book is live; authors see them in **Distribution Channels**.
