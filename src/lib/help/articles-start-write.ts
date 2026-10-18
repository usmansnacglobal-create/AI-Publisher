import type { HelpArticle } from './types';

export const START_AND_WRITE: HelpArticle[] = [
  // ───────────── Getting started ─────────────
  {
    slug: 'welcome',
    category: 'start',
    title: 'Welcome to AI Publisher',
    summary: 'What you can do here, from first idea to a published book.',
    answer:
      'AI Publisher takes your book from idea to the stores in one place: plan and write with AI, edit and proofread, design the interior and cover, create an audiobook, then submit it to our publishing team. Start with **My books → New book**.',
    questions: ['what is this', 'what can i do here', 'how does this work', 'where do i start', 'how do i use this tool', 'getting started', 'what does ai publisher do', 'give me a tour'],
    keywords: ['overview', 'introduction', 'start', 'begin', 'tour', 'features', 'help'],
    action: { label: 'Start a new book', href: '/dashboard/books/new' },
    related: ['create-book-wizard', 'import-manuscript', 'plans-compared', 'dashboard-tour'],
    pages: ['home', 'books'],
    body: `AI Publisher is your writing desk, editor, typesetter, cover studio and publisher in one place. Claude helps you write and edit, and ChatGPT paints cover artwork.

### The journey of a book
1. **Create the book.** Use the AI wizard to plan it, or upload a manuscript you've already written.
2. **Write.** Write yourself, let AI draft chapters, or mix the two. Everything saves automatically.
3. **Check it.** Keep characters and facts straight with the story bible, then run proofreading and the continuity check.
4. **Lay it out.** Choose fonts, chapter headings and trim size on the **Layout** tab and approve the print interior.
5. **Design the cover.** Generate artwork with AI, pick a template or upload your own, then add the lettering.
6. **Make an audiobook** (optional). Pick a narrator voice and narrate every chapter.
7. **Publish.** Choose formats and stores, set prices and submit. Our publishing team reviews it and keeps you updated.

Each book has tabs along the top for these steps: Overview, Write, Story bible, Proofread, Layout, Cover, Audiobook and Publish.

> Stuck at any point? Click the **Help** button in the bottom corner and type your question.`,
  },
  {
    slug: 'dashboard-tour',
    category: 'start',
    title: 'Finding your way around',
    summary: 'The sidebar, your home page and each book’s tabs.',
    answer:
      'The sidebar on the left takes you to **Home**, **My books**, **Writing**, **Publishing**, **AI usage**, **Plan and billing**, **Activity**, **Notifications**, **Settings** and **Help**. Inside a book, the tabs along the top take you through each step from writing to publishing.',
    questions: ['where is the menu', 'how do i navigate', 'where can i find my books', 'what is on the dashboard', 'where is the sidebar', 'where are my settings', 'how do i get back home'],
    keywords: ['navigate', 'navigation', 'menu', 'sidebar', 'home', 'dashboard', 'tabs', 'layout'],
    action: { label: 'Go to Home', href: '/dashboard' },
    related: ['welcome', 'book-tabs', 'themes'],
    pages: ['home'],
    body: `### The sidebar
- **Home**: your totals, the book you worked on last and recent activity.
- **My books**: every book you've started. Click one to open it.
- **Writing**: jump straight into the editor for any book.
- **Publishing**: the status of every book you've submitted.
- **AI usage**: how many AI tokens you've used this month and on what.
- **Plan and billing**: your plan, upgrades, cancellation and receipts.
- **Activity**: a record of everything on your account.
- **Notifications**: updates about your books, AI work and billing.
- **Settings**: profile, appearance, notifications, security, automations.
- **Help**: these guides and the help assistant.

At the bottom of the sidebar you'll see your plan and how many AI tokens you've used, plus buttons to switch light/dark theme and sign out.

On a phone, tap the menu icon at the top to open the sidebar.`,
  },
  {
    slug: 'book-tabs',
    category: 'start',
    title: 'The tabs inside a book',
    summary: 'Overview, Write, Story bible, Proofread, Layout, Cover, Audiobook and Publish.',
    answer:
      'Every book has eight tabs: **Overview** (chapters and book details), **Write** (the editor), **Story bible**, **Proofread**, **Layout** (the print interior and downloads), **Cover**, **Audiobook** and **Publish**.',
    questions: ['what are the tabs', 'what does each tab do', 'where is the overview', 'where are the book details', 'which tab do i use'],
    keywords: ['tabs', 'overview', 'write', 'bible', 'proofread', 'layout', 'cover', 'audiobook', 'publish', 'sections'],
    related: ['book-details', 'editor-basics', 'layout-typographer', 'cover-overview', 'publish-overview'],
    body: `- **Overview**: the chapter list, progress, and the book details the AI uses every time it writes (genre, audience, tone, writing sample). You can also import a manuscript, plan chapters with AI, or delete the book here.
- **Write**: the chapter editor, with AI tools in the panel on the right.
- **Story bible**: characters, places, events and facts that must stay consistent.
- **Proofread**: spelling and grammar checks, plus a continuity check across chapters.
- **Layout**: fonts, headings, margins and page numbers for the print book, a live preview and every download (PDF, EPUB, Word, Markdown, text).
- **Cover**: the cover designer, from brief to print-ready files.
- **Audiobook**: AI narration of each chapter.
- **Publish**: the five-step publishing flow and your submission's progress.

Some tabs are part of the Pro and Agency plans. On the Free plan they show what they do and how to upgrade.`,
  },
  {
    slug: 'sign-up-confirm',
    category: 'start',
    title: 'Creating your account and confirming your email',
    summary: 'Sign up, confirm your email address and sign in.',
    answer:
      'Sign up with your name, email and a password of at least 10 characters, then click the link in the confirmation email. If the link has expired, go to **Sign in** and use **Send a new confirmation link**.',
    questions: ['how do i sign up', 'how do i create an account', 'i did not get the confirmation email', 'confirmation link expired', 'email link not working', 'how do i confirm my email', 'verify my email', 'register'],
    keywords: ['signup', 'register', 'account', 'confirm', 'confirmation', 'verify', 'verification', 'email', 'link', 'expired', 'otp'],
    action: { label: 'Sign in', href: '/login' },
    related: ['forgot-password', 'two-factor', 'plans-compared'],
    pages: ['signup', 'login'],
    body: `1. Go to **Sign up** and enter your name, email and a password of at least 10 characters.
2. Open the email we send you and click the confirmation link.
3. You're signed in and taken to your dashboard. Every new account starts on the Free plan.

### The email didn't arrive
- Check your spam or junk folder.
- Wait a couple of minutes; some email providers are slow.
- On the **Sign in** page, click **Send a new confirmation link**.

### The link says it has expired
Links only work once and expire after a while. Try signing in first: if your email is already confirmed it will just work. Otherwise send yourself a new link from the Sign in page.`,
  },
  {
    slug: 'create-book-wizard',
    category: 'start',
    title: 'Creating a book with the AI wizard',
    summary: 'Answer a few questions and get a planned book, ready to write.',
    answer:
      'Go to **My books → New book** and choose **Start with the AI wizard**. You answer questions about the book, your readers, your voice and characters, plan the chapters (or let AI plan them), then choose how you want to write. Your answers are saved as you go.',
    questions: ['how do i create a book', 'how do i start a new book', 'new book', 'how does the wizard work', 'start writing a book', 'create my first book', 'add a book', 'set up a book'],
    keywords: ['wizard', 'new', 'create', 'start', 'book', 'setup', 'plan', 'genre', 'audience'],
    action: { label: 'Start a new book', href: '/dashboard/books/new' },
    related: ['writing-modes', 'import-manuscript', 'plan-chapters', 'book-details'],
    pages: ['home', 'books', 'new-book'],
    body: `1. Go to **My books** and click **New book**, then **Start with the AI wizard**.
2. **The basics**: title (a working title is fine), fiction or non-fiction, genre and niche.
3. **Who is it for?**: your target readers and what they should feel or gain.
4. **Your voice**: writing style, tone and spelling (US or UK English).
5. **Key message**: the one thing you want readers to remember (optional).
6. **Story architecture**: your summary or premise, point of view, pacing and themes.
7. **Characters**: your main characters (or real people, for non-fiction). They go into the story bible so the AI keeps them consistent.
8. **Chapter plan**: book length, number of chapters (3 to 40) and chapter length. Plan chapters yourself, or let AI plan the ones you leave empty.
9. **How do you want to write?**: choose one of three modes, then click **Create my book**.

### The three writing modes
- **Write it all with AI**: AI writes the whole first draft, chapter by chapter, while you watch. Best for a fast first draft.
- **AI helps me write**: AI drafts each chapter with [placeholders] for your own stories and details. Best for memoir and expertise books.
- **AI outlines, I write**: AI writes a detailed plan for each chapter and you write the text.

Before you create the book you'll see an estimate of the AI tokens it will use.

> Your answers are saved in this browser as you go. If you leave and come back, you'll be offered to resume where you left off.`,
  },
  {
    slug: 'import-manuscript',
    category: 'start',
    title: 'Importing a manuscript you’ve already written',
    summary: 'Upload a Word, PDF, text or Markdown file and it’s split into chapters.',
    answer:
      'Choose **My books → New book → Upload a manuscript**, or use **Import manuscript** on a book’s Overview tab. Word (.docx), PDF, text (.txt) and Markdown (.md) files up to 4 MB work. Chapters are split at headings like “Chapter 1” or “Prologue”.',
    questions: ['how do i upload my manuscript', 'import my book', 'upload a word document', 'can i upload a pdf', 'can i import a pdf manuscript', 'which file types can i import', 'import docx', 'i already wrote my book', 'bring my existing book in', 'upload file'],
    keywords: ['import', 'upload', 'manuscript', 'docx', 'word', 'pdf', 'txt', 'markdown', 'file', 'existing'],
    action: { label: 'Upload a manuscript', href: '/dashboard/books/new' },
    related: ['import-problems', 'editor-basics', 'chapters-manage'],
    pages: ['books', 'new-book'],
    body: `### Start a new book from a file
1. Go to **My books → New book** and choose **Upload a manuscript**.
2. Drag in your file or click to choose it.
3. Pick the book type and genre, then click **Import and open the editor**.

### Add a file to an existing book
1. Open the book's **Overview** tab and click **Import manuscript**.
2. Choose the file. Tick **Replace the existing chapters** if you want to start over; otherwise the new chapters are added at the end.

### What works best
- Word (.docx), PDF, text (.txt) or Markdown (.md), up to 4 MB.
- Put each chapter under a heading such as "Chapter 1", "Chapter One", "Prologue" or "Epilogue". That's where the book is split.
- Word files keep bold, italic, headings, lists and quotes. PDFs bring in the text only.

> Scanned PDFs (photos of pages) have no text to import. Use the original Word file instead.`,
  },
  {
    slug: 'plans-compared',
    category: 'start',
    title: 'Free, Pro and Agency plans compared',
    summary: 'What each plan includes and what it costs.',
    answer:
      '**Free** ($0): 1 book, 30,000 AI tokens a month, writing, AI assist and ebook export. **Pro** ($29/month): up to 10 books, 500,000 tokens, plus story bible, proofreading, print PDF, AI covers (3 runs per book), audiobook and publishing. **Agency** ($79/month): unlimited books, 2,000,000 tokens, 10 cover runs per book and automations.',
    questions: ['how many books can i have on pro', 'how many books can i write', 'what plans are there', 'how much does it cost', 'what is the price', 'what do i get with pro', 'difference between pro and agency', 'is there a free plan', 'pricing', 'which plan should i choose', 'what does free include'],
    keywords: ['plan', 'plans', 'price', 'pricing', 'cost', 'free', 'pro', 'agency', 'subscription', 'monthly', 'compare', 'features', 'limits'],
    action: { label: 'See plans', href: '/dashboard/billing' },
    related: ['upgrade', 'tokens-explained', 'cancel-plan', 'book-limit'],
    pages: ['billing'],
    body: `### Free: $0
- 1 book
- 30,000 AI tokens a month
- Writing and AI assist
- Ebook (EPUB), Word, Markdown and text downloads

### Pro: $29 a month
- Up to 10 books
- 500,000 AI tokens a month
- Story bible and continuity checks
- Proofreading reports
- Print-ready PDF interiors and the live layout preview
- AI cover designer, with 3 AI cover runs per book
- AI audiobook narration
- The publishing flow and submission to the stores

### Agency: $79 a month
- Unlimited books
- 2,000,000 AI tokens a month
- Everything in Pro
- 10 AI cover runs per book
- Zapier, Make and webhook automations

Prices are in US dollars. Payment is monthly through PayPal (PayPal account or card), and you can cancel any time.`,
  },

  // ───────────── Writing ─────────────
  {
    slug: 'editor-basics',
    category: 'write',
    title: 'Using the editor',
    summary: 'Typing, formatting, saving and the chapter list.',
    answer:
      'Open a book and click the **Write** tab. Chapters are listed on the left; type in the page in the middle; the AI panel is on the right. Use the toolbar for bold, italic, underline, headings, lists, quotes, links and scene breaks. Everything saves automatically.',
    questions: ['how do i write', 'where do i type', 'how do i use the editor', 'how do i format text', 'how do i make text bold', 'add a heading', 'add a scene break', 'does it save automatically', 'how do i save', 'undo'],
    keywords: ['editor', 'write', 'type', 'toolbar', 'bold', 'italic', 'underline', 'heading', 'list', 'quote', 'link', 'scene', 'break', 'save', 'autosave', 'undo', 'redo', 'format'],
    related: ['ai-panel', 'selection-actions', 'version-history', 'chapters-manage', 'keyboard-shortcuts'],
    pages: ['write'],
    body: `1. Open your book and click **Write**.
2. Pick a chapter on the left, or click **Add chapter**.
3. Type on the page. The toolbar above the text gives you bold, italic, underline, three heading sizes, normal text, bullet and numbered lists, block quotes, links, a scene break (shown as three centred stars), undo and redo.

### Saving
Your work saves automatically as you type. Above the page you'll see **All changes saved**, **Unsaved changes** or, if your connection drops, **Couldn't save. Retrying when you type.**

### The word count
Below the page you'll see the chapter's word count and reading time.

> A version of each chapter is saved every 15 minutes of writing and before any AI change, so you can always go back. See **Version history**.`,
  },
  {
    slug: 'keyboard-shortcuts',
    category: 'write',
    title: 'Keyboard shortcuts',
    summary: 'Faster formatting and showing or hiding the AI panel.',
    answer:
      'Press **Ctrl+Shift+A** (Cmd+Shift+A on a Mac) to show or hide the AI panel. Formatting works with the usual shortcuts: Ctrl/Cmd+B for bold, +I for italic, +U for underline, +Z to undo and +Shift+Z to redo. Press Esc to close the menu for selected text.',
    questions: ['keyboard shortcuts', 'hide the ai panel', 'show the ai panel', 'shortcut for bold', 'how do i close the panel', 'more space to write'],
    keywords: ['shortcut', 'shortcuts', 'keyboard', 'ctrl', 'cmd', 'hide', 'panel', 'focus'],
    related: ['editor-basics', 'ai-panel'],
    pages: ['write'],
    body: `- **Ctrl+Shift+A** (Mac: **Cmd+Shift+A**): show or hide the AI panel. You can also click **Hide AI** above the page.
- **Ctrl/Cmd+B**: bold
- **Ctrl/Cmd+I**: italic
- **Ctrl/Cmd+U**: underline
- **Ctrl/Cmd+Z**: undo
- **Ctrl/Cmd+Shift+Z**: redo
- **Esc**: close the menu that appears when you select text`,
  },
  {
    slug: 'writing-modes',
    category: 'write',
    title: 'Writing a chapter with AI',
    summary: 'Write, plan or redraft a chapter, and set its length, tone and style.',
    answer:
      'In the **Write** tab, open the **Controls** tab in the AI panel. Choose a writing mode (AI writes it all, AI drafts with placeholders for you, or outline only), the length, tone and any special instructions, then click **Write this chapter**. Add notes about what should happen first, so the AI follows your plan.',
    questions: ['how do i get ai to write a chapter', 'write this chapter with ai', 'ai write for me', 'generate a chapter', 'make the chapter longer', 'change chapter length', 'change the tone', 'write in my style', 'ai controls', 'what are placeholders'],
    keywords: ['ai', 'write', 'generate', 'chapter', 'draft', 'controls', 'mode', 'length', 'words', 'tone', 'formality', 'style', 'placeholders', 'outline', 'instructions'],
    related: ['continue-redraft', 'writing-sample', 'write-whole-book', 'tokens-explained'],
    pages: ['write'],
    body: `### Before you start
Open the chapter and add **Notes for this chapter**: what happens, key facts or quotes you have permission to use, a particular scene or ending. The AI follows these.

### Choose the settings
In the AI panel on the right, open **Controls**:
- **Writing mode**: *AI writes the complete chapter*; *AI drafts it and leaves [placeholders] for your own stories and details*; or *AI writes a detailed plan; you write the chapter*.
- **Length**: Short (500 to 800 words), Standard (800 to 1,500), Long (1,500 to 3,000), or a target word count.
- **Tone and formality**, and **sentence style** (Neutral, Short and punchy, or Long and flowing).
- **Special instructions** for this chapter only.
- **Include in the chapter**: a chapter summary, or reflection questions / a call to action.
- **Write in my style**: matches your voice using the writing sample in the book details.

Settings save automatically for each chapter.

### Write it
Click **Write this chapter** (or **Plan this chapter** in outline mode). The text appears as it's written. It uses AI tokens, roughly in proportion to the length.

> Placeholders look like [your story about your first job here]. Replace them with your own words before publishing.`,
  },
  {
    slug: 'continue-redraft',
    category: 'write',
    title: 'Continue writing and redrafting',
    summary: 'Let AI carry on from where you stopped, or replace a chapter with a fresh draft.',
    answer:
      'Below the page, **Continue writing** adds the next part of the chapter from where the text ends. **Redraft chapter** replaces the chapter with a fresh AI draft using its settings. The current text is saved in **History** first, so nothing is lost.',
    questions: ['continue writing', 'keep writing from here', 'ai continue the story', 'redraft a chapter', 'rewrite this chapter', 'start the chapter again', 'i do not like this chapter'],
    keywords: ['continue', 'redraft', 'rewrite', 'regenerate', 'again', 'replace', 'chapter'],
    related: ['writing-modes', 'version-history', 'rewrite-book'],
    pages: ['write'],
    body: `- **Continue writing** reads the chapter so far and writes the next part, matching the style. It's added to the end of the chapter.
- **Redraft chapter** replaces the whole chapter with a fresh draft using the settings in **Controls**. You can also click **Redraft with these settings** after changing them.

Both save the current text in **History** first, so you can restore it if you prefer the old version.`,
  },
  {
    slug: 'ai-panel',
    category: 'write',
    title: 'AI edits: suggestions you accept or reject',
    summary: 'Quick edits, deep edits and your own instructions.',
    answer:
      'In the **Edit** tab of the AI panel, pick a quick edit (improve the last paragraph, fix grammar, strengthen the hook or ending) or a deep edit (line edit, paragraph edit, polish dialogue, simplify, more vivid, show don’t tell), or type your own instruction. Changes appear as suggestions: accept or reject each one, or **Accept all**.',
    questions: ['how do i edit with ai', 'improve my writing', 'fix grammar', 'make it better', 'line edit', 'polish dialogue', 'show dont tell', 'accept suggestions', 'reject suggestions', 'ai edit'],
    keywords: ['edit', 'edits', 'suggestions', 'accept', 'reject', 'improve', 'grammar', 'line', 'paragraph', 'dialogue', 'vivid', 'simplify', 'formal', 'hook', 'ending', 'tighten', 'expand'],
    related: ['selection-actions', 'proofread', 'ask-ai'],
    pages: ['write'],
    body: `Open the **Edit** tab in the AI panel on the right of the editor.

### Quick edits
Improve the last paragraph, fix grammar and spelling, strengthen the opening hook, strengthen the chapter ending, and (with text selected) expand or tighten a passage.

### Deep edits
Line edit, paragraph edit, polish dialogue, make the tone more formal, simplify the language, more vivid and descriptive, fix grammar everywhere, and show, don't tell.

### Your own instruction
Type what you want, for example "make the argument in the second half clearer", and click **Suggest changes**.

### Reviewing suggestions
Each change shows the original and the suggestion. Click a suggestion to see where it is in the text, then accept or reject it, or use **Accept all** / **Reject all**. Nothing changes in your chapter until you accept.`,
  },
  {
    slug: 'selection-actions',
    category: 'write',
    title: 'Editing selected text',
    summary: 'Highlight a passage to improve, shorten, expand, rephrase or fix it.',
    answer:
      'Highlight some text in the editor and a small menu appears: **Improve**, **Shorten**, **Expand**, **Rephrase** or **Fix**. You can add an instruction such as “make it more formal”. You then see the original and the suggestion side by side and choose whether to accept it.',
    questions: ['edit selected text', 'rephrase this sentence', 'shorten this paragraph', 'expand this part', 'highlight text', 'change just one paragraph', 'rewrite a sentence'],
    keywords: ['select', 'selection', 'highlight', 'rephrase', 'shorten', 'expand', 'improve', 'fix', 'sentence', 'paragraph', 'passage'],
    related: ['ai-panel', 'editor-basics'],
    pages: ['write'],
    body: `1. Highlight a sentence or passage in the editor.
2. In the menu that appears, choose **Improve**, **Shorten**, **Expand**, **Rephrase** or **Fix**.
3. Optionally add an instruction, e.g. "keep the humour" or "make it more formal".
4. Compare the original and the suggestion, then accept or discard it. Your formatting is kept.

Press **Esc** or click elsewhere to close the menu.`,
  },
  {
    slug: 'ask-ai',
    category: 'write',
    title: 'Ask AI about your book',
    summary: 'Brainstorm, check facts or get feedback in a chat about your book.',
    answer:
      'Open the **Ask AI** tab in the editor’s AI panel to brainstorm a scene, check a fact, find a better word or get feedback on the current chapter. It knows your book details and story bible. It uses AI tokens.',
    questions: ['ask ai a question', 'brainstorm ideas', 'get feedback on my chapter', 'chat with ai about my book', 'find a better word', 'what happens next'],
    keywords: ['ask', 'chat', 'brainstorm', 'feedback', 'idea', 'ideas', 'word', 'question'],
    related: ['ai-panel', 'story-bible'],
    pages: ['write'],
    body: `In the editor, open **Ask AI** in the panel on the right and type a question, for example:
- "Give me three ways this chapter could end."
- "Is the pacing in this chapter too slow?"
- "What's a better word than 'walked' here?"

The AI knows your book details, story bible and the current chapter. Answers use AI tokens from your monthly allowance.

> This is different from the **Help** assistant (bottom corner), which answers questions about using AI Publisher and doesn't use tokens.`,
  },
  {
    slug: 'version-history',
    category: 'write',
    title: 'Version history: restoring an earlier draft',
    summary: 'Every chapter keeps saved versions you can restore.',
    answer:
      'Open the **History** tab in the editor’s AI panel. Versions are saved automatically every 15 minutes of writing and before any AI change, and you can click **Save version** to name one yourself. Click **Restore this version** to bring one back; the text it replaces is saved too.',
    questions: ['restore an old version', 'undo ai changes', 'i lost my text', 'get back my previous draft', 'version history', 'where did my writing go', 'recover deleted text', 'go back to earlier version'],
    keywords: ['history', 'version', 'versions', 'restore', 'undo', 'lost', 'recover', 'previous', 'backup', 'draft'],
    related: ['editor-basics', 'save-conflict', 'continue-redraft'],
    pages: ['write'],
    body: `1. Open the chapter in **Write**.
2. In the AI panel, click **History**.
3. You'll see the saved versions with their times. Click one to read it.
4. Click **Restore this version**. The text it replaces is saved in History first, so you can switch back.

### When versions are saved
- Automatically every 15 minutes of writing.
- Before any AI change (writing, redrafting, accepting edits, rewrites).
- Whenever you click **Save version** and give it a name.`,
  },
  {
    slug: 'chapters-manage',
    category: 'write',
    title: 'Adding, reordering, splitting and deleting chapters',
    summary: 'Organise your chapters from the Overview and Write tabs.',
    answer:
      'On the book’s **Overview** tab you can add chapters, move them up or down with the arrows, and click the pencil to rename, edit the chapter notes or delete. To split a chapter in two, open it in **Write**, click **Split chapter**, then click the paragraph that should start the new chapter.',
    questions: ['add a chapter', 'delete a chapter', 'reorder chapters', 'move a chapter', 'rename a chapter', 'split a chapter', 'merge chapters', 'change chapter order', 'change chapter title'],
    keywords: ['chapter', 'chapters', 'add', 'delete', 'remove', 'reorder', 'move', 'order', 'rename', 'title', 'split'],
    related: ['plan-chapters', 'editor-basics'],
    pages: ['write', 'overview'],
    body: `### On the Overview tab
- **Add chapter** adds a new one at the end.
- The **up and down arrows** move a chapter.
- The **pencil** opens the chapter details: title, "What happens in this chapter" (the AI follows this), and **Delete chapter**.

### Splitting a chapter
1. Open the chapter in **Write** and click **Split chapter**.
2. Click the paragraph that should start the new chapter.
3. Give the new chapter a title. Everything from that paragraph on moves into a new chapter straight after.

> Deleting a chapter can't be undone. If you might want the text later, copy it somewhere first.`,
  },
  {
    slug: 'plan-chapters',
    category: 'write',
    title: 'Planning or re-planning chapters with AI',
    summary: 'Let AI outline the book, or re-plan the chapters you haven’t written yet.',
    answer:
      'On the **Overview** tab, click **Plan chapters with AI** (or **Re-plan unwritten chapters** once you’ve started). You can add anything the plan should include. Chapters that already have text are left alone.',
    questions: ['plan my chapters', 'create an outline', 'outline my book', 'replan chapters', 'ai chapter plan', 'chapter outline'],
    keywords: ['plan', 'outline', 'replan', 'structure', 'chapters', 'synopsis'],
    related: ['create-book-wizard', 'chapters-manage', 'write-whole-book'],
    pages: ['overview'],
    body: `1. Open your book's **Overview** tab.
2. Click **Plan chapters with AI**, or **Re-plan unwritten chapters** if some are already written.
3. Optionally type anything the plan should include, then confirm. Planning takes about a minute.

The plan uses your book details (premise, audience, tone, chapter count and length). Each chapter gets a title and a summary of what happens, which the AI follows when it writes the chapter.`,
  },
  {
    slug: 'write-whole-book',
    category: 'write',
    title: 'Writing all the empty chapters at once',
    summary: 'Let AI write every empty chapter, one after another.',
    answer:
      'On the **Overview** tab, click **Write all chapters with AI** (or **Write the N empty chapters with AI**). A window shows each chapter as it’s written; keep the page open. You can **Stop after this chapter** at any time.',
    questions: ['write the whole book', 'write all chapters', 'ai write my entire book', 'generate the full book', 'write the rest of the book', 'how long does it take to write the book'],
    keywords: ['all', 'whole', 'entire', 'full', 'book', 'chapters', 'write', 'generate', 'empty', 'autowrite'],
    related: ['writing-modes', 'tokens-explained', 'rewrite-book'],
    pages: ['overview'],
    body: `1. Make sure your chapters have titles and notes (plan them with AI if not).
2. On the **Overview** tab, click **Write all chapters with AI**.
3. Keep the page open while it works. Each chapter takes a minute or two.
4. Click **Stop after this chapter** if you want to pause.

It uses AI tokens for each chapter. If your monthly tokens run out it stops, and the chapters already written are kept.`,
  },
  {
    slug: 'rewrite-book',
    category: 'write',
    title: 'Rewriting the whole book',
    summary: 'Apply one instruction to every written chapter.',
    answer:
      'In the **Write** tab, click **Rewrite whole book**, type an instruction (for example “switch to first person” or “use UK spelling”) and click **Start rewrite**. Each chapter’s earlier text is saved in its History.',
    questions: ['rewrite the whole book', 'change the whole book to first person', 'rewrite all chapters', 'change tense everywhere', 'apply change to all chapters'],
    keywords: ['rewrite', 'whole', 'book', 'all', 'chapters', 'tense', 'person', 'pov'],
    related: ['version-history', 'tokens-explained'],
    pages: ['write'],
    body: `1. In **Write**, click **Rewrite whole book** above the page.
2. Describe the change you want across the whole book.
3. Click **Start rewrite** and keep the page open. You can stop after any chapter.

This uses a lot of AI tokens: roughly the length of your book, twice. Each chapter's earlier text is saved in its **History**, so you can restore any chapter.`,
  },
  {
    slug: 'book-details',
    category: 'write',
    title: 'Book details the AI follows',
    summary: 'Title, author name, genre, audience, tone, themes and more.',
    answer:
      'On the book’s **Overview** tab, the **Book details** panel holds the title, subtitle, author name, genre, audience, style, tone, point of view, pacing, themes, key message and your writing sample. The AI uses these every time it writes or edits, so keep them up to date and click **Save details**.',
    questions: ['change my book title', 'change the genre', 'edit book details', 'change author name', 'use a pen name for this book', 'change the audience', 'change tone for the book', 'rename my book'],
    keywords: ['details', 'title', 'subtitle', 'author', 'pen', 'name', 'genre', 'audience', 'style', 'tone', 'pov', 'pacing', 'themes', 'message', 'rename'],
    related: ['writing-sample', 'profile', 'delete-book'],
    pages: ['overview'],
    body: `Open the book's **Overview** tab and scroll the **Book details** panel on the right. You can change:
- Title and subtitle
- **Author name for this book**: pen names are fine. Leave it empty to use your profile name.
- Genre, audience, style and tone
- Point of view, pacing, themes and keywords
- What readers should gain, and the one key message
- Your writing sample

Click **Save details**. The AI uses these every time it writes or edits.`,
  },
  {
    slug: 'writing-sample',
    category: 'write',
    title: 'Making AI write in your style',
    summary: 'Add a writing sample so AI drafts sound like you.',
    answer:
      'Paste a page or two of your own writing into **Your writing sample** in the book details on the **Overview** tab and save. Then, in the editor’s **Controls**, tick **Write in my style** and the AI matches your voice.',
    questions: ['write in my voice', 'make it sound like me', 'writing sample', 'match my style', 'ai does not sound like me', 'use my writing style'],
    keywords: ['style', 'voice', 'sample', 'sound', 'tone', 'match', 'mine'],
    related: ['book-details', 'writing-modes'],
    pages: ['write', 'overview'],
    body: `1. Open the book's **Overview** tab.
2. In **Book details**, paste a page or two of your own writing into **Your writing sample**. Pick something typical of how you want the book to sound.
3. Click **Save details**.
4. In **Write**, open **Controls** in the AI panel and tick **Write in my style (uses my writing sample)**.

The setting is per chapter, so you can turn it on where you want it.`,
  },
  {
    slug: 'team-notes',
    category: 'write',
    title: 'Notes from our publishing team',
    summary: 'Why a note appears at the top of a chapter.',
    answer:
      'If our publishing team needs a change in a chapter, you’ll see a **Note from our publishing team** above the text and get a notification. Make the change; the note stays as a reminder until the team clears it.',
    questions: ['note from publishing team', 'why is there a note on my chapter', 'admin note', 'the team left a comment'],
    keywords: ['note', 'team', 'admin', 'comment', 'feedback', 'publishing'],
    related: ['submission-status', 'changes-requested'],
    pages: ['write'],
    body: `When our team reviews your book, they may leave a note on a particular chapter. It appears in a box above the chapter text, and you get a notification.

Make the change they describe. If your submission was marked **Changes requested**, submit the book again from the **Publish** tab when you're done.`,
  },
];
