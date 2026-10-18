import type { HelpArticle } from './types';

export const PUBLISH_AND_ACCOUNT: HelpArticle[] = [
  // ───────────── Publishing ─────────────
  {
    slug: 'publish-overview',
    category: 'publish',
    title: 'Publishing your book: the five steps',
    summary: 'Checklist, formats, stores, details and review.',
    answer:
      'Open the **Publish** tab and work through five steps: **1. Checklist** (is the book ready?), **2. Formats** (ebook, paperback, audiobook), **3. Platforms** (the stores), **4. Details** (description, keywords, category, prices, date) and **5. Review**, then **Submit for review**. Our publishing team takes it from there and keeps you posted. Pro and Agency.',
    questions: ['how do i publish my book', 'publish to amazon', 'submit my book', 'get my book on kindle', 'sell my book', 'how does publishing work', 'publish', 'put my book in stores'],
    keywords: ['publish', 'publishing', 'submit', 'submission', 'stores', 'amazon', 'kindle', 'kdp', 'sell', 'release', 'launch'],
    action: { label: 'See publishing', href: '/dashboard/publishing' },
    related: ['publish-checklist', 'publish-formats-stores', 'publish-details', 'submission-status'],
    pages: ['books', 'publish', 'publishing'],
    body: `1. **Checklist**: shows what's done and what isn't. Each open item has a **Fix now** link.
2. **Formats**: ebook (EPUB and Kindle), print on demand paperback, and audiobook.
3. **Platforms**: choose the stores for each format, or **Select all available**.
4. **Details**: description, keywords, category, language, edition, ebook and paperback prices, and whether to publish as soon as it's approved or on a date. **Write description and keywords with AI** drafts them for you.
5. **Review**: check everything and click **Submit for review**.

Your progress is saved in this browser, so you can leave and resume.

After you submit, our publishing team reviews the book, prepares it for the stores and publishes it. Follow each stage in the status panel on the right of the Publish tab, and you'll get a notification at every step.

Publishing is part of the Pro and Agency plans.`,
  },
  {
    slug: 'publish-checklist',
    category: 'publish',
    title: 'The publishing checklist',
    summary: 'What must be finished before you can submit.',
    answer:
      'Before submitting you need: every chapter written, a proofreading run with no open issues, a finished front cover, and a description, keywords and category (done in step 4). A paperback also needs an approved, up-to-date layout, the print PDF and the full print cover; an audiobook needs every chapter narrated. Click **Fix now** next to any open item.',
    questions: ['why cant i submit my book', 'checklist not complete', 'what do i need before publishing', 'continue button disabled', 'publishing requirements', 'why is continue greyed out'],
    keywords: ['checklist', 'ready', 'requirements', 'submit', 'disabled', 'greyed', 'fix', 'missing', 'continue'],
    related: ['proofread', 'approve-layout', 'cover-export', 'audiobook-outdated'],
    pages: ['publish'],
    body: `### Always
- **Every chapter has text**
- **Proofreading run, no open issues**: run it on the Proofread tab, then apply or dismiss every issue.
- **Front cover finished**: export your cover on the Cover tab.
- **Book description written** and **keywords and categories chosen**: you do these in step 4, Details. The AI can write them for you.

### For a paperback
- **Interior layout approved**, and still up to date
- **Print interior created**: download the print PDF on the Layout tab
- **Full print cover (with spine) exported**

### For an audiobook
- **Every chapter narrated**, with no outdated chapters

The list changes with the formats you choose in step 2.`,
  },
  {
    slug: 'publish-formats-stores',
    category: 'publish',
    title: 'Formats and stores',
    summary: 'Ebook, paperback and audiobook, and the 12 stores you can choose.',
    answer:
      'Ebook stores: Amazon Kindle, Apple Books, Barnes & Noble, Kobo, Google Play Books, Draft2Digital and Smashwords. Paperback: Amazon KDP Print and IngramSpark (bookshops and libraries). Hardcover: Amazon KDP Hardcover and IngramSpark. Audiobook: Audible / ACX, Spotify and Apple Books audiobooks.',
    questions: ['put my book on kobo', 'can i publish on kobo', 'which stores can i publish to', 'can i publish on apple books', 'can i sell a paperback', 'print on demand', 'ingramspark', 'barnes and noble', 'what formats can i publish', 'kobo', 'google play'],
    keywords: ['stores', 'platforms', 'formats', 'ebook', 'paperback', 'print', 'demand', 'audiobook', 'amazon', 'kindle', 'apple', 'barnes', 'noble', 'kobo', 'google', 'draft2digital', 'smashwords', 'ingramspark', 'audible', 'acx', 'spotify'],
    related: ['publish-details', 'audiobook-stores'],
    pages: ['publish'],
    body: `### Ebook (EPUB and Kindle)
Amazon Kindle, Apple Books, Barnes & Noble, Kobo, Google Play Books, Draft2Digital (many smaller stores and libraries) and Smashwords.

### Paperback (print on demand)
A paperback printed and shipped as each copy is ordered: Amazon KDP Print and IngramSpark (bookshops and libraries).

### Hardcover (print on demand)
A case-laminate hardcover: Amazon KDP Hardcover and IngramSpark. Available in 5.5″ × 8.5″, 6″ × 9″, 6.14″ × 9.21″, 7″ × 10″ and 8.25″ × 11″, with 75 to 550 pages, in black and white or premium colour. See *Hardcover books*.

### Audiobook
Your AI-narrated audiobook from the Audiobook tab: Audible / ACX, Spotify and Apple Books audiobooks.

Choose as many formats and stores as you like.`,
  },
  {
    slug: 'publish-details',
    category: 'publish',
    title: 'Description, keywords, category and prices',
    summary: 'Step 4 of publishing, and how royalties are estimated.',
    answer:
      'In step 4, click **Write description and keywords with AI** or write your own: a description of 100 to 4,000 characters, up to 7 keywords and a category. The ebook price must be at least $0.99; between $2.99 and $9.99 Kindle pays about 70%, otherwise about 35%. Paperbacks and hardcovers earn about 60% minus printing at $9.99 and above, and 50% below. The page suggests a price that earns about $3 a copy and shows the minimum.',
    questions: ['how much should i charge', 'set the price', 'book price', 'royalties', 'how much will i earn', 'keywords for amazon', 'book description', 'choose a category', 'minimum paperback price', 'schedule publishing date'],
    keywords: ['price', 'pricing', 'royalty', 'royalties', 'earn', 'earnings', 'keywords', 'description', 'category', 'bisac', 'language', 'edition', 'schedule', 'date', 'minimum'],
    related: ['publish-overview', 'royalties-payouts'],
    pages: ['publish'],
    body: `### Description and keywords
- **Book description**: 100 to 4,000 characters. Hook readers in the first line. It's shared with the back-cover description.
- **Keywords**: type one and press Enter. Amazon allows up to 7.
- **Category**: the store category closest to your book.
- **Write description and keywords with AI** drafts all three from your book.

### Prices (US dollars)
- **Ebook**: at least $0.99. Kindle pays about **70%** for prices from $2.99 to $9.99 and about **35%** otherwise. The page shows what you'd earn per Kindle sale.
- **Paperback and hardcover**: Amazon pays about **60%** of the price at $9.99 and above, and **50%** below, minus the printing cost. Printing depends on page count, trim size, colour and binding. The price must at least cover printing; the page suggests a starting price that earns about $3 a copy, shows the minimum, and what you'd earn per sale.

These are estimates based on Amazon's US rates. Store fees and taxes can change the actual figure.

### Language, edition and date
Choose the language and edition, and either **Publish as soon as it's approved** or **Schedule for later** with a date.`,
  },
  {
    slug: 'submission-status',
    category: 'publish',
    title: 'Following your submission',
    summary: 'What each publishing status means.',
    answer:
      'After you submit, the **Publish** tab and the **Publishing** page show the status: **Submitted**, **In review**, **Formatting**, **Publishing**, then **Live**. If the team needs changes you’ll see **Changes requested** with their note. You get a notification at every step.',
    questions: ['how long until my book is on amazon', 'how long does it take to go live', 'what is the status of my book', 'when will my book be live', 'how long does publishing take', 'is my book published yet', 'track my submission', 'what does in review mean', 'what does formatting mean'],
    keywords: ['status', 'submitted', 'review', 'formatting', 'publishing', 'live', 'track', 'progress', 'how', 'long', 'when'],
    action: { label: 'See publishing', href: '/dashboard/publishing' },
    related: ['changes-requested', 'launch-posts'],
    pages: ['publish', 'publishing'],
    body: `- **Submitted**: we've received your book.
- **In review**: our team is checking the manuscript, cover and details.
- **Formatting**: we're preparing the files for each store.
- **Publishing**: it's been sent to the stores, which run their own checks.
- **Live**: on sale in the stores you chose.

Other statuses:
- **Changes requested**: the team needs something changed. Their note is shown on the Publish tab.
- **Not approved**: the book can't be published as it is. The reason is shown.
- **Problem at the stores**: a store raised an issue. The team's note explains what happens next.

How long it takes depends on our review and on each store's own checks. If you scheduled a date, the book goes live on that date once it's ready.`,
  },
  {
    slug: 'changes-requested',
    category: 'publish',
    title: 'Changes requested or not approved',
    summary: 'What to do when your submission comes back.',
    answer:
      'Read the team’s note on the **Publish** tab (and any note shown above a chapter in the editor), make the changes, then go through the publishing steps again and click **Submit for review**. If a submission was **Not approved**, the reason is shown; contact support if anything is unclear.',
    questions: ['changes requested', 'my book was rejected', 'not approved', 'what do i do after changes requested', 'resubmit my book', 'submit again'],
    keywords: ['changes', 'requested', 'rejected', 'not', 'approved', 'resubmit', 'again', 'note'],
    related: ['team-notes', 'submission-status', 'contact-support'],
    pages: ['publish'],
    body: `### Changes requested
1. Read the **Note from our team** on the Publish tab. There may also be notes above particular chapters in the editor.
2. Make the changes.
3. On the Publish tab, go through the steps again and click **Submit for review**.

### Not approved
The reason is shown on the Publish tab. If you can address it, make the changes and submit again. If you're not sure what to do, contact support.`,
  },
  {
    slug: 'launch-posts',
    category: 'publish',
    title: 'Sharing your book when it goes live',
    summary: 'Launch posts and the social media image.',
    answer:
      'When your book is **Live**, the Publish tab offers ready-made launch posts you can share, for example on X (Twitter). For an image to post, export the **Social image** (1200 × 630) on the Cover tab.',
    questions: ['share my book', 'announce my book', 'social media post', 'launch post', 'promote my book', 'marketing'],
    keywords: ['share', 'launch', 'social', 'post', 'twitter', 'promote', 'marketing', 'announce'],
    related: ['cover-export', 'submission-status'],
    pages: ['publish'],
    body: `Once your book is live:
- The **Publish** tab shows **Launch posts**, with a button to share on X (Twitter).
- On the **Cover** tab, **Finalize and export** creates a **Social image** sized for link previews and posts.`,
  },
  {
    slug: 'royalties-payouts',
    category: 'publish',
    title: 'Royalties, payouts and ISBNs',
    summary: 'Earnings estimates, and who to ask about payments and ISBNs.',
    answer:
      'The Publish tab shows estimated earnings per sale based on Amazon’s US rates. For questions about how royalties are paid to you, or about using your own ISBN, please **contact support** and our publishing team will answer.',
    questions: ['how do i get paid', 'when are royalties paid', 'royalty payments', 'do i need an isbn', 'can i use my own isbn', 'who owns the rights', 'payouts'],
    keywords: ['royalties', 'royalty', 'paid', 'payout', 'payouts', 'payment', 'isbn', 'rights', 'earnings', 'money'],
    related: ['publish-details', 'contact-support'],
    pages: ['publish'],
    body: `- **Estimates**: when you set prices in step 4, the page estimates what you'd earn per sale using Amazon's US rates.
- **ISBN**: the status panel shows when an ISBN has been registered for your book. If you want to use your own ISBN, tell our team.
- **Payouts and rights**: our publishing team handles these for each submission. Use **Contact support** for anything specific to your book.`,
  },

  // ───────────── Plans, billing and AI tokens ─────────────
  {
    slug: 'tokens-explained',
    category: 'billing',
    title: 'What AI tokens are and what uses them',
    summary: 'Your monthly AI allowance, explained.',
    answer:
      'AI tokens measure how much AI work you do. Writing, editing, proofreading, planning, cover artwork and narration all use them, roughly in proportion to the amount of text. Free includes 30,000 a month, Pro 500,000 and Agency 2,000,000. See exactly where they went on the **AI usage** page.',
    questions: ['how much ai do i have left', 'how many tokens are left', 'check my remaining tokens', 'what are tokens', 'how many tokens do i have', 'what uses tokens', 'how much does a chapter cost in tokens', 'token usage', 'ai credits', 'how many words can i write', 'where did my tokens go'],
    keywords: ['left', 'remaining', 'tokens', 'token', 'credits', 'allowance', 'usage', 'quota', 'limit', 'ai', 'words', 'monthly', 'consume', 'cost'],
    action: { label: 'See AI usage', href: '/dashboard/usage' },
    related: ['tokens-run-out', 'plans-compared', 'upgrade'],
    pages: ['home', 'usage'],
    body: `Every AI request uses tokens, both for what the AI reads (your notes, book details, story bible, the chapter) and for what it writes. As a rough guide, a 1,500-word chapter uses a few thousand tokens.

### Monthly allowance
- **Free**: 30,000 tokens
- **Pro**: 500,000 tokens
- **Agency**: 2,000,000 tokens

Unused tokens don't carry over. Your allowance resets each billing cycle; the date is shown at the bottom of the sidebar.

### What uses the most
- Writing whole chapters, writing the whole book and rewriting the whole book
- Cover artwork (image tokens count three times)
- Audiobook narration (counts twice)

### What doesn't use tokens
Typing and formatting, the layout preview and downloads, designing the cover lettering, publishing steps you fill in yourself, and this Help assistant.

The **AI usage** page shows tokens per day and by feature for this cycle.`,
  },
  {
    slug: 'tokens-run-out',
    category: 'billing',
    title: 'Running low on or out of AI tokens',
    summary: 'Warnings, what stops working and what to do.',
    answer:
      'You’ll get a warning at 80% and at 100% of your monthly tokens. When they run out, AI features pause until your allowance resets (the date is shown in the sidebar), but you can still write, edit, lay out and export. To keep using AI now, upgrade your plan on **Plan and billing**.',
    questions: ['i ran out of tokens', 'out of tokens', 'tokens used up', 'not enough tokens', 'when do my tokens reset', 'can i buy more tokens', 'ai stopped working tokens', 'token limit reached'],
    keywords: ['out', 'run', 'ran', 'exhausted', 'low', 'reset', 'renew', 'more', 'buy', 'extra', 'limit', 'tokens'],
    action: { label: 'Change plan', href: '/dashboard/billing' },
    related: ['tokens-explained', 'upgrade'],
    pages: ['usage', 'billing'],
    body: `- At **80%** and **100%** of your allowance you get a notification (and an email if you've turned those on).
- If a request needs more tokens than you have left, you'll see how many it needs and how many you have. Try a smaller request, such as a shorter chapter.
- When you've used them all, AI features pause until the reset date shown at the bottom of the sidebar.

Everything that doesn't use AI keeps working: writing, formatting, layout, downloads and cover lettering.

There aren't separate token top-ups. To get more now, upgrade: Pro has 500,000 a month and Agency 2,000,000.`,
  },
  {
    slug: 'upgrade',
    category: 'billing',
    title: 'Upgrading or changing your plan',
    summary: 'Pay with PayPal or a card.',
    answer:
      'Go to **Plan and billing**, choose the plan and pay with PayPal or a card through the PayPal button. The new plan starts straight away, with its full token allowance and tools.',
    questions: ['how do i upgrade', 'upgrade to pro', 'upgrade to agency', 'change my plan', 'switch plan', 'pay for a plan', 'how do i pay', 'can i pay by card', 'payment methods', 'buy pro'],
    keywords: ['upgrade', 'change', 'switch', 'plan', 'pay', 'payment', 'paypal', 'card', 'credit', 'debit', 'buy', 'subscribe', 'subscription'],
    action: { label: 'Go to Plan and billing', href: '/dashboard/billing' },
    related: ['plans-compared', 'cancel-plan', 'payment-failed', 'receipts'],
    pages: ['billing'],
    body: `1. Open **Plan and billing** in the sidebar.
2. Under the plan you want, click **Upgrade to Pro** or **Upgrade to Agency** (or **Switch to …**).
3. Pay with your PayPal account or a debit or credit card in the PayPal window.
4. You'll see **Welcome to Pro** (or Agency) when it's confirmed.

Payments are handled securely by PayPal; we never see your card details. Plans renew monthly until you cancel.`,
  },
  {
    slug: 'cancel-plan',
    category: 'billing',
    title: 'Cancelling your plan',
    summary: 'Cancel any time; you keep the plan until the end of the period.',
    answer:
      'On **Plan and billing**, click **Cancel plan** and confirm. You keep your plan until the end of the period you’ve paid for, then move to Free. Your books stay, but Free allows only 1 new book and the Pro tools lock.',
    questions: ['how do i cancel', 'cancel my subscription', 'stop paying', 'unsubscribe', 'cancel pro', 'downgrade to free', 'what happens when i cancel', 'refund'],
    keywords: ['cancel', 'cancellation', 'unsubscribe', 'stop', 'downgrade', 'free', 'refund', 'end', 'subscription'],
    action: { label: 'Go to Plan and billing', href: '/dashboard/billing' },
    related: ['upgrade', 'book-limit', 'delete-account'],
    pages: ['billing'],
    body: `1. Open **Plan and billing**.
2. Click **Cancel plan**, then confirm.
3. You'll see the date your plan runs until.

### After the end date
- You move to the **Free** plan: 30,000 AI tokens a month.
- Your books, chapters, covers and files all stay.
- Pro tools (story bible, proofreading, print PDF, cover designer, audiobook, publishing) are locked until you upgrade again.
- You can't create new books beyond the Free limit, but you can keep working on the ones you have.

For refund questions, please contact support.`,
  },
  {
    slug: 'payment-failed',
    category: 'billing',
    title: 'A payment didn’t go through',
    summary: 'Update your payment method in PayPal to keep your plan.',
    answer:
      'If a renewal fails you’ll see a notice on **Plan and billing** and get a notification. Update your payment method in your PayPal account so PayPal can retry; if it can’t, the plan moves to Free and you can upgrade again any time.',
    questions: ['payment failed', 'my payment did not go through', 'card declined', 'paypal error', 'update payment method', 'change my card'],
    keywords: ['payment', 'failed', 'declined', 'card', 'paypal', 'update', 'method', 'renewal', 'error'],
    action: { label: 'Go to Plan and billing', href: '/dashboard/billing' },
    related: ['upgrade', 'receipts'],
    pages: ['billing'],
    body: `- **At checkout**: if PayPal couldn't complete the payment, nothing was charged. Try again or use a different card.
- **At renewal**: you'll see "Your last payment didn't go through." Sign in to PayPal, go to your automatic payments and update the card or bank account linked to AI Publisher.

If the payment still can't be taken, your plan moves to Free. Your books are kept, and you can upgrade again whenever you like.`,
  },
  {
    slug: 'receipts',
    category: 'billing',
    title: 'Receipts and billing history',
    summary: 'Where to find past payments.',
    answer:
      'Your payments are listed under **Billing history** on the **Plan and billing** page. PayPal also emails you a receipt for every payment.',
    questions: ['where are my receipts', 'invoice', 'billing history', 'payment history', 'proof of payment', 'vat invoice'],
    keywords: ['receipt', 'receipts', 'invoice', 'invoices', 'billing', 'history', 'payments', 'vat'],
    action: { label: 'Go to Plan and billing', href: '/dashboard/billing' },
    related: ['upgrade', 'payment-failed'],
    pages: ['billing'],
    body: `- **Plan and billing → Billing history** lists every payment with its date, description and amount.
- PayPal sends a receipt by email for each payment, and keeps them in your PayPal account.

For a formal invoice, contact support.`,
  },
  {
    slug: 'book-limit',
    category: 'billing',
    title: 'I can’t create another book',
    summary: 'Book limits on each plan.',
    answer:
      'Each plan has a book limit: Free 1, Pro 10, Agency unlimited. When you reach it you’ll see a message offering an upgrade. You can also delete a book you no longer need (on its Overview tab) to make room.',
    questions: ['cant create a new book', 'book limit reached', 'how many books can i have', 'maximum books', 'it says i reached my limit'],
    keywords: ['limit', 'books', 'maximum', 'many', 'reached', 'new', 'create', 'cannot'],
    action: { label: 'See plans', href: '/dashboard/billing' },
    related: ['plans-compared', 'delete-book', 'upgrade'],
    pages: ['new-book', 'books'],
    body: `- **Free**: 1 book
- **Pro**: up to 10 books
- **Agency**: unlimited

When you reach your limit, upgrade on **Plan and billing**, or delete a book you no longer need. Deleting a book is permanent, so download a copy first if you want to keep it.`,
  },
  {
    slug: 'delete-book',
    category: 'billing',
    title: 'Deleting a book',
    summary: 'Permanently remove a book and everything in it.',
    answer:
      'Open the book’s **Overview** tab, scroll to **Delete this book**, click **Delete book** and type the book’s title to confirm. This permanently removes every chapter, saved version, story bible entry, report and cover, and can’t be undone.',
    questions: ['delete a book', 'remove a book', 'how do i delete my book', 'get rid of a book'],
    keywords: ['delete', 'remove', 'book', 'permanently', 'erase'],
    related: ['downloads', 'book-limit'],
    pages: ['overview'],
    body: `1. Download a copy first (Layout tab → Word or EPUB) if you might want it later.
2. Open the book's **Overview** tab and scroll to the bottom of the book details.
3. Click **Delete book**, type the book's title and click **Delete book permanently**.

This removes every chapter, saved version, story bible entry, report and cover. It can't be undone.`,
  },

  // ───────────── Account and settings ─────────────
  {
    slug: 'profile',
    category: 'account',
    title: 'Your profile and pen name',
    summary: 'Name, pen name, photo, bio, links and writing language.',
    answer:
      'Go to **Settings → Profile** to change your name, **pen name** (shown on covers and title pages instead of your full name), photo, bio, website and social links, and writing language. Click **Save changes**. Each book can also have its own author name in its book details.',
    questions: ['change my name', 'set a pen name', 'change profile picture', 'edit my bio', 'change my photo', 'author name on cover', 'change language'],
    keywords: ['profile', 'name', 'pen', 'pseudonym', 'photo', 'picture', 'avatar', 'bio', 'website', 'twitter', 'linkedin', 'language', 'location'],
    action: { label: 'Open Settings', href: '/dashboard/settings?tab=profile' },
    related: ['book-details', 'change-email'],
    pages: ['settings'],
    body: `Open **Settings → Profile**:
- **Full name**, and a **pen name** shown on covers and title pages instead of your full name.
- **Photo**: JPG or PNG up to 2 MB.
- **Bio**: used as a starting point when AI writes your author bio.
- **Website**, X (Twitter), LinkedIn and location.
- **Writing language**: sets spelling for proofreading and the language tag on your ebooks.

Click **Save changes**. To use a different author name on one book only, set **Author name for this book** in that book's details.`,
  },
  {
    slug: 'change-email',
    category: 'account',
    title: 'Changing your email address',
    summary: 'Contact support to change the email on your account.',
    answer:
      'For security, the email address can’t be changed from Settings. Use **Contact support** in the Help assistant, tell us the new address, and we’ll update it.',
    questions: ['change my email', 'update email address', 'wrong email on account', 'new email'],
    keywords: ['email', 'change', 'address', 'update'],
    related: ['contact-support', 'profile'],
    pages: ['settings'],
    body: `Your email address is how you sign in, so it's changed by our support team to keep your account safe.

Open the **Help** assistant, choose **Contact support** and tell us the new address. We'll confirm when it's done.`,
  },
  {
    slug: 'forgot-password',
    category: 'account',
    title: 'Forgotten or changing your password',
    summary: 'Reset a forgotten password or set a new one.',
    answer:
      'Forgotten it? On the **Sign in** page click **Forgot password?**, enter your email and follow the link we send. To change it while signed in, go to **Settings → Security → Change password**. Passwords need at least 10 characters.',
    questions: ['forgot my password', 'reset password', 'change my password', 'cant sign in', 'cant log in', 'locked out', 'password not working', 'new password'],
    keywords: ['password', 'forgot', 'forgotten', 'reset', 'change', 'login', 'log', 'sign', 'locked'],
    action: { label: 'Reset password', href: '/forgot-password' },
    related: ['two-factor', 'sign-up-confirm', 'devices'],
    pages: ['login', 'settings'],
    body: `### Forgotten password
1. On the **Sign in** page, click **Forgot password?**
2. Enter your email address.
3. Open the email and click the link, then choose a new password.

### Change your password
1. Go to **Settings → Security**.
2. Under **Change password**, enter and confirm your new password (at least 10 characters).
3. Click **Update password**.`,
  },
  {
    slug: 'two-factor',
    category: 'account',
    title: 'Two-factor sign-in',
    summary: 'Protect your account with a code from an authenticator app.',
    answer:
      'Go to **Settings → Security → Set up two-factor sign-in**, scan the QR code with an authenticator app (Google Authenticator, 1Password, Authy), enter the code and click **Turn on**. After that, you enter a code after your password each time you sign in.',
    questions: ['two factor authentication', 'set up 2fa', 'authenticator app', 'turn off two factor', 'lost my phone authenticator', 'code not working', 'extra security'],
    keywords: ['two-factor', '2fa', 'mfa', 'authenticator', 'code', 'qr', 'security', 'totp', 'google', 'authy'],
    action: { label: 'Open Security', href: '/dashboard/settings?tab=security' },
    related: ['forgot-password', 'devices'],
    pages: ['settings', 'login'],
    body: `### Turn it on
1. Go to **Settings → Security** and click **Set up two-factor sign-in**.
2. Scan the QR code with your authenticator app, or type the key shown under it.
3. Enter the 6-digit code from the app and click **Turn on**.

### Signing in
After your password, enter the current code from your app.

### Code not working?
Codes change every 30 seconds; use the newest one, and make sure your phone's clock is set automatically.

### Turn it off
Settings → Security → **Turn off**. If you've lost access to your authenticator app and can't sign in, contact support.`,
  },
  {
    slug: 'devices',
    category: 'account',
    title: 'Signing out other devices',
    summary: 'If you’re signed in somewhere you don’t recognise.',
    answer:
      'Go to **Settings → Security → Devices** and click **Sign out other devices**. Everywhere except this browser is signed out. If you think someone else used your account, change your password too.',
    questions: ['sign out everywhere', 'log out other devices', 'someone else is using my account', 'signed in on another computer', 'account hacked'],
    keywords: ['devices', 'sign', 'out', 'logout', 'everywhere', 'sessions', 'hacked', 'security'],
    action: { label: 'Open Security', href: '/dashboard/settings?tab=security' },
    related: ['forgot-password', 'two-factor', 'activity'],
    pages: ['settings'],
    body: `1. Go to **Settings → Security**.
2. Under **Devices**, click **Sign out other devices**.
3. Change your password, and consider turning on two-factor sign-in.

The **Activity** page lists security events on your account.`,
  },
  {
    slug: 'themes',
    category: 'account',
    title: 'Dark mode and other themes',
    summary: 'Light, Sepia, Dark, or match your device.',
    answer:
      'Go to **Settings → Appearance** and choose **Match my device**, **Light**, **Sepia** or **Dark**. Or click the sun/moon button at the bottom of the sidebar to switch between light and dark. The theme is saved on each device and doesn’t affect your book files.',
    questions: ['dark mode', 'night mode', 'change the theme', 'light mode', 'sepia', 'change colours of the app', 'screen too bright', 'appearance'],
    keywords: ['dark', 'light', 'theme', 'themes', 'sepia', 'night', 'mode', 'appearance', 'colours', 'colors', 'bright'],
    action: { label: 'Open Appearance', href: '/dashboard/settings?tab=appearance' },
    related: ['dashboard-tour'],
    pages: ['settings'],
    body: `Open **Settings → Appearance** and pick:
- **Match my device**: light by day, dark at night, following your device setting.
- **Light**: clean and bright.
- **Sepia**: warm paper tones, easier on the eyes for long writing sessions.
- **Dark**: light text on a dark background.

The sun/moon button at the bottom of the sidebar switches between light and dark in one click.

Your choice is remembered on this device. Covers, the print preview and exported files always look the same whatever theme you use.`,
  },
  {
    slug: 'notifications',
    category: 'account',
    title: 'Notifications and emails',
    summary: 'Choose what you’re told about and how often.',
    answer:
      'Go to **Settings → Notifications** to choose what you hear about (AI writing finished, book live, publishing updates, token warnings, weekly progress, billing, product news), whether to show them in the app, and whether emails come as it happens or as a weekly summary. In-app notifications are on the **Notifications** page.',
    questions: ['turn off emails', 'stop sending me emails', 'stop notifications', 'email preferences', 'too many emails', 'weekly summary', 'where are my notifications', 'mark notifications as read'],
    keywords: ['notifications', 'notification', 'emails', 'email', 'alerts', 'preferences', 'weekly', 'summary', 'unsubscribe', 'read'],
    action: { label: 'Open Notifications settings', href: '/dashboard/settings?tab=notifications' },
    related: ['activity', 'automations'],
    pages: ['settings', 'notifications'],
    body: `### Choose what you hear about
**Settings → Notifications → Email me about**:
- AI writing finished
- When your book goes live
- Publishing updates
- AI token warnings (at 80% and 100%)
- Weekly progress (every Sunday)
- Plan changes, renewals and payment problems
- Publishing advice and product updates

Also choose **Show notifications inside the app**, and **Email frequency**: as it happens, or a weekly summary only. Click **Save preferences**.

### Reading notifications
The **Notifications** page in the sidebar shows them all, with a count of unread ones. Click **Mark all as read** to clear the count.`,
  },
  {
    slug: 'activity',
    category: 'account',
    title: 'Your activity log',
    summary: 'A record of everything on your account.',
    answer:
      'The **Activity** page lists everything on your account: books created, AI work, exports, publishing, billing and security events, newest first.',
    questions: ['activity log', 'what happened on my account', 'history of my account', 'audit log', 'who changed my book'],
    keywords: ['activity', 'log', 'history', 'audit', 'record', 'events'],
    action: { label: 'Open Activity', href: '/dashboard/activity' },
    related: ['devices', 'notifications'],
    pages: ['activity'],
    body: `Open **Activity** in the sidebar to see a record of books, AI work, exports, publishing, billing and security events on your account, newest first.`,
  },
  {
    slug: 'automations',
    category: 'account',
    title: 'Automations with Zapier, Make and webhooks',
    summary: 'Connect AI Publisher to your other tools (Agency plan).',
    answer:
      'On the Agency plan, go to **Settings → Automations** and paste a webhook address from Zapier (“Webhooks by Zapier → Catch Hook”), Make or your own server, then click **Send a test event**. We send an event when a chapter finishes writing, a book is submitted, its publishing status changes and when it goes live.',
    questions: ['connect zapier', 'webhook', 'automations', 'integrate with google drive', 'send updates to slack', 'make integration', 'notion integration', 'backup to dropbox'],
    keywords: ['automations', 'automation', 'zapier', 'make', 'webhook', 'webhooks', 'integration', 'integrations', 'slack', 'drive', 'dropbox', 'notion', 'api'],
    action: { label: 'Open Automations', href: '/dashboard/settings?tab=integrations' },
    related: ['plans-compared', 'notifications'],
    pages: ['settings'],
    body: `Automations are part of the **Agency** plan.

1. In Zapier, create a Zap with **Webhooks by Zapier → Catch Hook** (or a webhook trigger in Make) and copy its address.
2. In AI Publisher, go to **Settings → Automations** and paste it into **Webhook address**. It must start with https://.
3. Click **Send a test event**, and check that it arrived.

Events are sent when a chapter finishes writing, a book is submitted, its publishing status changes, and when it goes live. From there you can update a spreadsheet, message your team in Slack, or back up to Google Drive, Dropbox or Notion.`,
  },
  {
    slug: 'delete-account',
    category: 'account',
    title: 'Deleting your account',
    summary: 'Permanently remove your account and all your books.',
    answer:
      'Go to **Settings → Delete account**, click **Delete account**, type DELETE and confirm. This permanently deletes your account, every book, chapter, cover and file, and cancels any paid plan. Download anything you want to keep first; it can’t be undone.',
    questions: ['delete my account', 'close my account', 'remove my data', 'delete everything', 'gdpr delete'],
    keywords: ['delete', 'account', 'close', 'remove', 'data', 'gdpr', 'erase', 'permanently'],
    action: { label: 'Open Settings', href: '/dashboard/settings?tab=danger' },
    related: ['cancel-plan', 'downloads'],
    pages: ['settings'],
    body: `1. Download any books you want to keep (Layout tab → Word or EPUB).
2. Go to **Settings → Delete account** and click **Delete account**.
3. Type **DELETE** and click **Delete everything permanently**.

Your account, books, chapters, covers and files are deleted and any paid plan is cancelled. This can't be undone.`,
  },

  // ───────────── Troubleshooting ─────────────
  {
    slug: 'contact-support',
    category: 'fix',
    title: 'Contacting support',
    summary: 'Send a message to our team.',
    answer:
      'Open the **Help** assistant (bottom corner) and choose **Contact support**, or use the **Contact support** button on any Help page. Describe what you need and send it; our team gets it straight away and replies by email or in your notifications.',
    questions: ['contact support', 'talk to a human', 'speak to someone', 'customer service', 'email support', 'i need help', 'report a bug', 'report a problem', 'send feedback', 'talk to an agent'],
    keywords: ['support', 'contact', 'human', 'person', 'agent', 'help', 'team', 'bug', 'problem', 'feedback', 'complaint'],
    related: ['ai-unavailable', 'save-conflict'],
    body: `1. Click **Help** in the bottom corner of any page (or open a Help article).
2. Choose **Contact support**.
3. Pick a topic, describe the problem or question, and click **Send**.

Our team is notified straight away. Include the book title and what you were doing when something went wrong; it helps us answer faster.`,
  },
  {
    slug: 'ai-unavailable',
    category: 'fix',
    title: 'AI isn’t working or shows an error',
    summary: 'What “AI writing isn’t switched on yet” and other errors mean.',
    answer:
      'If you see “AI writing and editing aren’t switched on yet” or “AI cover artwork isn’t switched on yet”, the AI service hasn’t been connected on our side; please contact support. If it says you’ve used your tokens, see *Running out of AI tokens*. For other errors, wait a minute and try again.',
    questions: ['ai is not working', 'ai error', 'ai is not switched on', 'write with ai does nothing', 'cover generation failed', 'ai not available', 'something went wrong with ai', 'generation failed'],
    keywords: ['ai', 'error', 'working', 'broken', 'failed', 'switched', 'configured', 'unavailable', 'not', 'nothing', 'happens'],
    related: ['tokens-run-out', 'contact-support'],
    body: `- **"AI writing and editing aren't switched on yet"** or **"AI cover artwork isn't switched on yet"**: the AI service isn't connected on our side yet. Please contact support.
- **"You've used your AI tokens for this month"** or **"This needs about N AI tokens"**: see *Running low on or out of AI tokens*.
- **A tool is locked with an upgrade message**: it's part of a paid plan. See *Free, Pro and Agency plans compared*.
- **Anything else**: wait a minute and try again. AI services are occasionally busy. If it keeps happening, contact support with the book title and what you clicked.`,
  },
  {
    slug: 'save-conflict',
    category: 'fix',
    title: '“This chapter changed somewhere else”',
    summary: 'When the same chapter is open in two places.',
    answer:
      'This appears when the chapter was changed in another tab or device after you opened it, so your latest typing wasn’t saved over it. Click **Load latest** to get the newest text. If you need what you just typed, copy it first, then paste it back after loading.',
    questions: ['chapter changed somewhere else', 'my changes were not saved', 'load latest', 'couldnt save', 'not saving', 'two tabs open', 'edited on another device'],
    keywords: ['changed', 'elsewhere', 'conflict', 'save', 'saving', 'saved', 'load', 'latest', 'tabs', 'device', 'couldnt'],
    related: ['version-history', 'editor-basics'],
    pages: ['write'],
    body: `To protect your work, a chapter is only saved if nobody else has changed it since you opened it. If it was edited in another browser tab or on another device, you'll see **This chapter changed somewhere else, so your latest typing wasn't saved.**

1. Copy anything you just typed that you want to keep.
2. Click **Load latest**.
3. Paste your text back in where you want it.

To avoid it, keep each book open in one tab at a time.

If you see **Couldn't save. Retrying when you type.**, your connection dropped. Keep the page open; it saves again as soon as you type with the connection back.`,
  },
  {
    slug: 'import-problems',
    category: 'fix',
    title: 'My manuscript didn’t import properly',
    summary: 'Chapters not split, text missing or file rejected.',
    answer:
      'Chapters are split at headings like “Chapter 1”, “Chapter One”, “Prologue” or “Epilogue”, so add those to your file if everything arrived as one chapter. Scanned PDFs have no text to import; use the Word file. Files must be .docx, .pdf, .txt or .md and under 40 MB.',
    questions: ['import did not work', 'all my text is in one chapter', 'chapters not split', 'pdf import empty', 'file too big', 'import failed', 'formatting lost on import'],
    keywords: ['import', 'failed', 'chapters', 'split', 'one', 'empty', 'scanned', 'pdf', 'size', 'big', 'formatting'],
    related: ['import-manuscript', 'chapters-manage'],
    pages: ['new-book', 'overview'],
    body: `- **Everything is in one chapter**: put a heading such as "Chapter 1", "Chapter One", "Prologue" or "Epilogue" at the start of each chapter in your file and import again (tick **Replace the existing chapters**). Or use **Split chapter** in the editor.
- **A PDF imported empty**: it's probably scanned images of pages. Import the original Word document instead.
- **The file was rejected**: use .docx, .pdf, .txt or .md, under 40 MB. If a Word file with many large photos is too big, use Word's Compress Pictures option first. Split a very long book into two files and import the second without replacing.
- **Formatting or pictures are missing**: Word files keep bold, italic, headings, lists, quotes and pictures; PDFs bring in plain text only, so add pictures afterwards with **Add image** in the editor.`,
  },
  {
    slug: 'locked-feature',
    category: 'fix',
    title: 'A tab says it’s part of Pro',
    summary: 'Why some tools are locked on the Free plan.',
    answer:
      'The story bible, proofreading, print PDF and live layout preview, cover designer, audiobook and publishing are part of the **Pro** and **Agency** plans. Upgrade on **Plan and billing** to unlock them straight away.',
    questions: ['why is this locked', 'feature locked', 'it says included in pro', 'upgrade to use this', 'cant use the cover designer', 'cant proofread'],
    keywords: ['locked', 'pro', 'upgrade', 'included', 'unavailable', 'feature', 'paid'],
    action: { label: 'See plans', href: '/dashboard/billing' },
    related: ['plans-compared', 'upgrade'],
    body: `On the Free plan you can write, use AI assist and download ebooks. These tools need **Pro** or **Agency**:
- Story bible and continuity checks
- Proofreading reports
- Print PDF interiors and the live layout preview
- The AI cover designer
- AI audiobook narration
- The publishing flow and submission

Automations need **Agency**.`,
  },
];
