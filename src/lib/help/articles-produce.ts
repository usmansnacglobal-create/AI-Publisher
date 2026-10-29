import type { HelpArticle } from './types';

export const PRODUCE: HelpArticle[] = [
  // ───────────── Story bible and proofreading ─────────────
  {
    slug: 'story-bible',
    category: 'check',
    title: 'The story bible',
    summary: 'Keep characters, places, events and facts consistent.',
    answer:
      'The **Story bible** tab records who people are, what places look like and when things happen. The AI follows it whenever it writes, and the continuity check flags anything that contradicts it. Click **Build from manuscript** to let Claude fill it from your chapters, or **Add entry** to add one yourself. Pro and Agency plans.',
    questions: ['what is the story bible', 'keep characters consistent', 'add a character', 'character list', 'how do i add places', 'world building', 'track characters'],
    keywords: ['bible', 'story', 'character', 'characters', 'places', 'locations', 'events', 'facts', 'world', 'rules', 'consistent', 'consistency', 'continuity'],
    related: ['continuity-check', 'create-book-wizard'],
    pages: ['bible'],
    body: `The story bible holds the facts of your book in four groups: **characters and people**, **places**, **key events and dates**, and **world rules and facts**.

### Fill it in
- **Build from manuscript**: Claude reads your chapters and records every character, place and key fact. Run it again later to add anything new.
- **Add entry**: choose the type, the name and the details (appearance, age, relationships, dates, rules: anything the book must keep consistent).
- Characters you add in the new-book wizard are added automatically.

### How it's used
- The AI reads the story bible every time it writes or edits, so names and facts stay right.
- The **continuity check** on the Proofread tab compares your chapters against it.

The story bible is part of the Pro and Agency plans.`,
  },
  {
    slug: 'proofread',
    category: 'check',
    title: 'Proofreading your book',
    summary: 'Find spelling, grammar, punctuation and consistency errors.',
    answer:
      'Open the **Proofread** tab, choose American or British English and click **Check the whole book** (or check one chapter). Each issue shows the error and a fix; apply fixes one by one or all at once, or dismiss the ones you want to keep. Style is left alone. Pro and Agency plans.',
    questions: ['how do i proofread', 'check spelling', 'check grammar', 'find typos', 'spell check', 'fix mistakes in my book', 'grammar check', 'proofreading report'],
    keywords: ['proofread', 'proofreading', 'spelling', 'grammar', 'punctuation', 'typos', 'mistakes', 'errors', 'check', 'spell'],
    related: ['continuity-check', 'ai-panel', 'publish-checklist'],
    pages: ['proofread'],
    body: `1. Open the book's **Proofread** tab.
2. Choose **American English** or **British English**.
3. Click **Check the whole book**, or check a single chapter.
4. Review the issues chapter by chapter. Apply a single fix, click **Fix all** for a chapter, or dismiss an issue you want to keep.

Proofreading looks for spelling, grammar, punctuation and consistency errors. It doesn't rewrite your style.

> Before you can publish, you need a proofreading run with no open issues left. Applying a fix or dismissing an issue both count.

If you've changed a sentence since the check, its fix may no longer match. Those are skipped and you're told how many.`,
  },
  {
    slug: 'continuity-check',
    category: 'check',
    title: 'The continuity check',
    summary: 'Catch contradictions across chapters: names, ages, dates, places, timeline.',
    answer:
      'On the **Proofread** tab, open **Continuity check** and run it. It looks for contradictions across chapters, such as a character’s eye colour or age changing, dates that don’t add up or places that move, checked against your story bible.',
    questions: ['continuity check', 'find plot holes', 'check for contradictions', 'timeline errors', 'character details inconsistent', 'did i get the facts right'],
    keywords: ['continuity', 'contradictions', 'plot', 'holes', 'timeline', 'consistency', 'inconsistent', 'facts'],
    related: ['story-bible', 'proofread'],
    pages: ['proofread'],
    body: `1. Open the **Proofread** tab and switch to **Continuity check**.
2. Run it for the whole book.
3. Each finding tells you which chapter it's in and what contradicts what. Click **Open chapter** to fix it.

It works best when your story bible is filled in, so run **Build from manuscript** on the Story bible tab first.`,
  },

  // ───────────── Layout and export ─────────────
  {
    slug: 'layout-typographer',
    category: 'layout',
    title: 'Designing your book’s interior',
    summary: 'Fonts, chapter headings, margins, page numbers and a live preview.',
    answer:
      'Open the **Layout** tab. Choose the trim size and paper, body font and size, chapter heading style, paragraph style, line spacing, drop caps, page numbers and running heads, plus front and back matter. The live preview updates as you go and your choices save automatically. The live preview and print PDF are part of Pro.',
    questions: ['how do i format my book', 'change the font', 'change the font size', 'interior design', 'typesetting', 'chapter heading style', 'page numbers', 'drop caps', 'margins', 'formatting for print', 'make it look like a real book'],
    keywords: ['layout', 'format', 'formatting', 'interior', 'typeset', 'typesetting', 'font', 'fonts', 'size', 'heading', 'headings', 'margins', 'page', 'numbers', 'running', 'heads', 'header', 'drop', 'caps', 'spacing', 'indent', 'dedication', 'copyright', 'preview'],
    action: { label: 'Open My Library', href: '/dashboard/books' },
    related: ['trim-sizes', 'approve-layout', 'downloads'],
    pages: ['format'],
    body: `Open your book and click **Layout**. The preview on the right updates as you make changes, and every change saves automatically.

### What you can set
- **Trim size and paper**: see *Choosing a trim size*.
- **Body font**: Garamond (classic novel face), Baskerville (crisp, good for non-fiction), a Minion-style serif, a Georgia-style serif or a Palatino-style serif, and the font size.
- **Chapter heading style**: *Classic* ("CHAPTER ONE" in small capitals above an italic title), *Modern / Minimalist* (a large number and plain title), or *Decorative* (with an ornament).
- **Paragraphs**: indented (usual for fiction) or block with space between (usual for non-fiction); standard or relaxed line spacing.
- **Drop caps**: a large first letter on each chapter's opening paragraph.
- **Page numbers**: bottom centre, top outer corner, alternating outer corners, or hidden on chapter openers.
- **Running heads**: author name on left pages, chapter title on right pages.
- **Front and back matter**: dedication, copyright holder and about the author.

The inside (gutter) margin is set automatically from your page count to meet printer minimums. Each chapter starts on a right-hand page, as in printed books.

The preview shows the first two chapters. Click **Refresh** if it hasn't updated.`,
  },
  {
    slug: 'trim-sizes',
    category: 'layout',
    title: 'Choosing a trim size',
    summary: 'The page size of your paperback.',
    answer:
      'On the **Layout** tab, pick one of Amazon’s 16 standard trim sizes (from 5″×8″ to 8.5″×11″, including 7″×10″, 8″×10″ and square sizes) and white or cream paper. **6″×9″** is the most common size for non-fiction, and 5.5″×8.5″ or 5″×8″ suit most novels. Each size has Amazon’s page limits, and the tool warns you if your book is outside them.',
    questions: ['what size should my book be', 'trim size', 'page size', 'book dimensions', '6x9', '7x10', '8x10', 'paper colour', 'cream or white paper', 'maximum number of pages', 'page limit', 'my book is too long for amazon'],
    keywords: ['trim', 'size', 'sizes', 'dimensions', 'page', '6x9', '5x8', '7x10', '8x10', 'a4', 'paperback', 'paper', 'cream', 'white', 'limit', 'limits', 'maximum', 'minimum', 'pages'],
    related: ['layout-typographer', 'spine'],
    pages: ['format', 'cover'],
    body: `### Amazon's standard sizes
5″ × 8″, 5.06″ × 7.81″, 5.25″ × 8″, 5.5″ × 8.5″, 6″ × 9″, 6.14″ × 9.21″, 6.69″ × 9.61″, 7″ × 10″, 7.44″ × 9.69″, 7.5″ × 9.25″, 8″ × 10″, 8.25″ × 6″ (landscape), 8.25″ × 8.25″, 8.5″ × 8.5″, 8.5″ × 11″ and 8.27″ × 11.69″ (A4). Two custom sizes are also available: 4.25″ × 7″ (pocket) and 8.25″ × 11″.

- Novels: 5″ × 8″, 5.06″ × 7.81″, 5.25″ × 8″ or 5.5″ × 8.5″.
- Non-fiction and memoir: 6″ × 9″ or 5.5″ × 8.5″.
- Textbooks and illustrated guides: 7″ × 10″ or 7.5″ × 9.25″.
- Photo books, cookbooks and children's books: 8″ × 10″, 8.25″ × 8.25″ or 8.5″ × 8.5″.
- Workbooks and manuals: 8.5″ × 11″ or A4.
- Cream paper is traditional for fiction; white suits non-fiction and anything with pictures. Colour is always printed on white paper.

Sizes wider than 6.12″ or taller than 9″ count as "large" on Amazon and cost a little more to print.

### Page limits
Amazon prints paperbacks of 24 to 828 pages on white paper (776 on cream). Standard colour needs 72 to 600 pages. The square and letter-size books have lower maximums (for example 590 pages for 8.5″ × 11″). The Layout tab, the cover designer and the publishing checklist all warn you if your book is outside the limits for its size.

Changing the trim size or paper changes your page count and spine width. Approve the layout again and re-export your cover afterwards.`,
  },
  {
    slug: 'approve-layout',
    category: 'layout',
    title: 'Approving the layout and creating the print PDF',
    summary: 'Mark the interior as ready and get the exact page count.',
    answer:
      'When you’re happy with the preview on the **Layout** tab, click **Approve layout**, then download **Print interior (PDF)**. The PDF gives your exact page count, which the cover uses for the spine. If you change the text afterwards, the layout shows **Outdated**: check the preview and approve again.',
    questions: ['approve layout', 'create print pdf', 'print ready pdf', 'layout says outdated', 'why is my layout outdated', 'page count', 'get the print file'],
    keywords: ['approve', 'approval', 'approved', 'outdated', 'print', 'pdf', 'interior', 'page', 'count', 'kdp', 'ingramspark'],
    related: ['layout-typographer', 'downloads', 'spine', 'publish-checklist'],
    pages: ['format'],
    body: `1. Check the preview on the **Layout** tab.
2. Click **Approve layout**. The badge changes from **Draft** to **Approved**.
3. Under downloads, click **Download** next to **Print interior (PDF)**.

Creating the print PDF records your exact page count. The cover designer uses it to size the spine.

### "Outdated: text changed since approval"
If you edit any chapter after approving, the layout is marked outdated. Look over the preview and click **Approve layout** again, then download a fresh print PDF. Publishing a paperback needs an up-to-date approval.`,
  },
  {
    slug: 'downloads',
    category: 'layout',
    title: 'Downloading your book: PDF, EPUB, Word and more',
    summary: 'Every file format you can export and what each is for.',
    answer:
      'Downloads are on the **Layout** tab and under **Export** in the editor: **Print interior (PDF)** for paperbacks on KDP and IngramSpark (Pro), **EPUB ebook** for Kindle, Apple Books, Kobo and Google Play, **Word (DOCX)** for editors and agents, and **Markdown** or **plain text**.',
    questions: ['get my manuscript as a word file', 'save my manuscript as a word file', 'how do i download my book', 'export my book', 'download as pdf', 'download epub', 'download word document', 'export to kindle', 'get a copy of my book', 'save my book to my computer', 'backup my book'],
    keywords: ['manuscript', 'download', 'downloads', 'export', 'pdf', 'epub', 'ebook', 'kindle', 'word', 'docx', 'markdown', 'text', 'txt', 'file', 'backup', 'copy'],
    related: ['approve-layout', 'layout-typographer'],
    pages: ['format', 'write'],
    body: `You'll find downloads on the **Layout** tab, and under **Export** above the page in the editor.

- **Print interior (PDF)**: for paperbacks and hardcovers on Amazon KDP and IngramSpark. Uses your layout settings and includes your images (in greyscale for black-and-white books). Pro and Agency.
- **EPUB ebook**: for Kindle, Apple Books, Kobo and Google Play. Includes your cover once it's finished.
- **Word manuscript (DOCX)**: for editors, agents or other tools.
- **Markdown** and **plain text**: simple text with headings and emphasis.

> Download a Word or EPUB copy from time to time as your own backup.`,
  },

  // ───────────── Cover ─────────────
  {
    slug: 'cover-overview',
    category: 'cover',
    title: 'Designing your cover: the four steps',
    summary: 'Brief, create, design, then finalise and export.',
    answer:
      'Open the **Cover** tab. **1. Brief**: describe the book, mood and style, and write the back cover. **2. Create**: generate artwork with AI, pick a template or upload your own image. **3. Design**: add the title and your name with real fonts, plus the spine and back. **4. Finalize and export**: check the preflight list and export ebook, social and print files. Pro and Agency.',
    questions: ['how do i make a cover', 'design a cover', 'create book cover', 'cover designer', 'how does the cover tool work', 'i need a cover'],
    keywords: ['cover', 'covers', 'design', 'designer', 'artwork', 'front', 'brief', 'studio'],
    action: { label: 'Open My Library', href: '/dashboard/books' },
    related: ['cover-brief', 'cover-ai', 'cover-own-image', 'cover-design', 'cover-export'],
    pages: ['cover'],
    body: `The cover designer has four steps along the top. You can move back and forth between them.

1. **Brief**: the book's details, mood, cover style, imagery, things to avoid, and the back cover text (description, tagline, author bio, review quotes).
2. **Create**: get artwork three ways: **AI generate** (Claude turns your brief into art direction and ChatGPT paints it), **Templates**, or **Upload** your own artwork or an existing finished cover.
3. **Design**: set the title and your name with real fonts so they're always sharp and spelled right, then design the spine and back cover.
4. **Finalize and export**: check the preflight list, save a version, mark it final and export the files.

The cover designer is part of the Pro and Agency plans.`,
  },
  {
    slug: 'cover-brief',
    category: 'cover',
    title: 'Writing the cover brief',
    summary: 'Tell the designer about the mood, style and back-cover text.',
    answer:
      'In the **Brief** step, set the mood (up to 3), cover style, imagery you’d like, inspiration titles, things to avoid and special instructions. Add your own reference images if you have the rights to them. The back cover section holds the description (you can **Write it with AI**), tagline, author bio, review quotes and publisher. Click **Save and continue**.',
    questions: ['cover brief', 'what should i put in the brief', 'back cover description', 'write my blurb', 'add review quotes to cover', 'cover mood', 'cover style'],
    keywords: ['brief', 'mood', 'style', 'imagery', 'inspiration', 'avoid', 'blurb', 'description', 'tagline', 'bio', 'quotes', 'reviews', 'publisher', 'imprint'],
    related: ['cover-ai', 'cover-design'],
    pages: ['cover'],
    body: `### The front
- **Mood**: pick up to three.
- **Cover style** and **imagery and themes**: objects, settings or symbols you'd like.
- **Inspiration**: up to 3 book titles. Used for mood only, never copied.
- **Things to avoid** and **special instructions**.
- **Your own images**: up to 3 JPG, PNG or WebP images, at least 512 px, for ChatGPT to work from. Tick that you own them or have the rights to use them.
- **Ebook only** or **Paperback and ebook**, and an optional page-count override.

### The back
- **Back-cover description**: click **Write it with AI** for a draft. It's saved to your book, so the publishing step reuses it.
- Tagline, series, author bio, review quotes (up to 3, real reviews only), publisher or imprint, and website.`,
  },
  {
    slug: 'cover-ai',
    category: 'cover',
    title: 'Generating cover artwork with AI',
    summary: 'How AI cover runs work and how many you get.',
    answer:
      'In the **Create** step, choose **AI generate**, optionally adjust this run (imagery, things to avoid, what should change) and click **Generate with AI**. It takes about a minute. Each click is one run: Pro includes **3 AI cover runs per book** and Agency **10**. Templates and uploads don’t use runs.',
    questions: ['generate cover with ai', 'ai cover', 'how many covers can i generate', 'cover runs', 'i used all my cover runs', 'more cover options', 'chatgpt cover', 'regenerate cover'],
    keywords: ['ai', 'generate', 'generation', 'cover', 'runs', 'chatgpt', 'artwork', 'image', 'images', 'concepts', 'limit', 'paint'],
    related: ['cover-own-image', 'cover-design', 'tokens-explained', 'upgrade'],
    pages: ['cover'],
    body: `1. Finish the **Brief** step.
2. In **Create**, open **AI generate**.
3. Optionally adjust this run: imagery, things to avoid, what should change, and how many images.
4. Click **Generate with AI**. Painting takes about a minute; new concepts appear in the gallery.
5. Click **Use this** on the one you like.

### Runs
Each generation counts as one run for the book: **3 per book on Pro**, **10 on Agency**. The counter shows how many you've used. Generating also uses AI tokens (images count three times their size in tokens).

When you've used your runs you can still use templates, upload artwork, or upgrade to Agency for more.

> AI artwork never includes your title or name. You add the lettering in the Design step, so it's always sharp and spelled right.`,
  },
  {
    slug: 'cover-own-image',
    category: 'cover',
    title: 'Using a template, your own artwork or an existing cover',
    summary: 'Cover options that don’t use AI runs.',
    answer:
      'In the **Create** step: **Templates** gives clean typographic backgrounds; **Upload** lets you add your own artwork (a photo or illustration without lettering) or **Import your existing cover** if you already have a finished design. None of these use AI cover runs.',
    questions: ['upload my own cover', 'use my own image', 'i already have a cover', 'cover templates', 'import existing cover', 'use a photo for the cover', 'cover without ai'],
    keywords: ['template', 'templates', 'upload', 'own', 'image', 'photo', 'artwork', 'import', 'existing', 'finished'],
    related: ['cover-design', 'cover-blurry'],
    pages: ['cover'],
    body: `### Templates
Clean typographic backgrounds. Pick one, then add your title and name in the Design step.

### Upload your own artwork
A photo or illustration **without lettering**. JPG, PNG or WebP, up to 15 MB. For print, 1,600 × 2,400 pixels or more is best.

### Import your existing cover
If you already have a finished front cover with the title on it, import it. It's used as-is, without added lettering (you can still choose **Add lettering anyway**).

You can delete any artwork from the gallery with the bin icon.`,
  },
  {
    slug: 'cover-design',
    category: 'cover',
    title: 'Front, spine and back cover design',
    summary: 'Fonts, colours, positions, the back-cover layout and your photo.',
    answer:
      'In the **Design** step, use the **Front**, **Spine** and **Back** panels. On the front: title font, sizes, colours, alignment, positions, art zoom and backdrop shading. On the spine: text colour and font. On the back: background (solid, matching, blurred, faded or your own image), blurb size and alignment, author photo and publisher logo. Click **Save design and continue**.',
    questions: ['change the title font on the cover', 'move the title', 'change cover colours', 'add my photo to the back cover', 'add a logo', 'back cover background', 'design the spine', 'make the title bigger'],
    keywords: ['design', 'front', 'back', 'spine', 'title', 'font', 'colour', 'color', 'size', 'position', 'align', 'photo', 'logo', 'background', 'blur', 'zoom', 'lettering'],
    related: ['spine', 'cover-export', 'cover-brief'],
    pages: ['cover'],
    body: `### Front
Title font and size, author name size and position, alignment (left, centre or right), title colour, title in capital letters, art zoom and position, and a shaded backdrop behind the text (top, bottom, both or all over) so the lettering stands out.

### Spine
Shows the title and your name when the book has enough pages (see *Spine width and spine text*). Choose the text colour and font.

### Back
- **Background**: solid colour, match the front, blurred artwork, faded artwork, or upload a back-cover image.
- **Blurb**: size and alignment (including justified).
- **Author photo**: shown beside your author bio (round or square).
- **Publisher logo**: a PNG with a transparent background works best.

The text itself (blurb, quotes, tagline, bio) comes from the **Brief** step. If it doesn't all fit, you'll see a warning: shorten the blurb or bio, or reduce the blurb size.

The white box on the back is where the printer adds the ISBN barcode. Edges extend 0.125″ past the trim for bleed.`,
  },
  {
    slug: 'spine',
    category: 'cover',
    title: 'Spine width and spine text',
    summary: 'Why the spine changes size and when it can show text.',
    answer:
      'The spine width comes from your page count, trim size and paper. For an exact width, create the print PDF on the **Layout** tab first. Under 79 pages, printers don’t allow text on the spine, so it’s colour only.',
    questions: ['why is there no text on my spine', 'spine width', 'spine too thin', 'how wide is the spine', 'spine text missing', 'page count for cover'],
    keywords: ['spine', 'width', 'text', 'pages', 'page', 'count', 'thin', '79'],
    related: ['approve-layout', 'cover-design', 'trim-sizes'],
    pages: ['cover'],
    body: `- The spine width is calculated from the page count, trim size and paper colour.
- Until you create the print PDF, the page count is **estimated** from your word count. Create **Print interior (PDF)** on the Layout tab for the exact count, then re-export your cover.
- **Under 79 pages** printers don't allow text on the spine, so it's colour only. Above that, it shows the title and your name.

If you change the trim size or the text after exporting the cover, the cover version is marked **Outdated**. Open it and export again.`,
  },
  {
    slug: 'cover-export',
    category: 'cover',
    title: 'Exporting cover files and the preflight check',
    summary: 'Ebook JPEG, front PNG, print PDF, social image and versions.',
    answer:
      'In **Finalize and export**, read the preflight list (resolution, page count, spine, blurb, barcode area, final version), then click **Export files**. You get an **ebook cover (JPEG)**, a **front cover (PNG)**, a **print cover PDF** with spine and bleed at 300 dpi, and a **social media image**. Save a version and **Mark final** so you can always get back to it.',
    questions: ['export my cover', 'download my cover', 'print cover pdf', 'cover for kdp', 'social media image', 'preflight', 'mark cover final', 'cover versions', 'save cover version'],
    keywords: ['export', 'download', 'cover', 'pdf', 'jpeg', 'png', 'print', 'social', 'preflight', 'version', 'versions', 'final', 'kdp', '300', 'dpi'],
    related: ['spine', 'cover-blurry', 'publish-checklist'],
    pages: ['cover'],
    body: `### Preflight
Before exporting, check the list:
- **Artwork resolution**: warns if the image may look soft in print.
- **Page count**: estimated, or measured from your print PDF.
- **Spine text**: title and name, or colour only under 79 pages.
- **Back-cover blurb**: present or missing.
- **Barcode area**: kept clear for the ISBN barcode.
- **Final version**: whether a version is marked final.

### Export
Click **Export files** to create:
- **Ebook cover (JPEG)**, 1600 × 2560
- **Front cover (PNG)**
- **Print cover (PDF)**: the full wrap (back, spine, front) at 300 dpi with bleed
- **Social image**, 1200 × 630, for sharing your book online

### Versions
Click **Save current design as a version** to keep a copy. You can open, duplicate, rename or delete versions, and **Mark final** the one that is your book's cover.`,
  },
  {
    slug: 'cover-blurry',
    category: 'cover',
    title: 'My cover looks blurry or low resolution',
    summary: 'Fixing the “artwork resolution” warning.',
    answer:
      'The preflight warns when the artwork has too few pixels for the print size. Use an image of at least 1,600 × 2,400 pixels (bigger for large trim sizes), or zoom the art less in the Design step. Ebook covers are usually fine even with the warning.',
    questions: ['cover is blurry', 'low resolution cover', 'artwork resolution warning', 'image looks pixelated', 'cover quality'],
    keywords: ['blurry', 'resolution', 'pixelated', 'quality', 'dpi', 'soft', 'small', 'image'],
    related: ['cover-own-image', 'cover-export'],
    pages: ['cover'],
    body: `Printers need about 300 pixels per inch. A 6″ × 9″ front cover therefore needs roughly 1,800 × 2,700 pixels.

- Upload a larger original image if you have one.
- Reduce **Art zoom** in the Design step: zooming in lowers the effective resolution.
- AI artwork is generated at high resolution and is usually fine for the common sizes.

If the warning says "fine for ebooks, may look slightly soft in print", the ebook is fine; consider a larger image only for the paperback.`,
  },

  // ───────────── Audiobook ─────────────
  {
    slug: 'audiobook',
    category: 'audio',
    title: 'Creating an audiobook',
    summary: 'Choose a narrator and narrate every chapter as MP3 files.',
    answer:
      'Open the **Audiobook** tab and choose **Premium voices** (hundreds of ElevenLabs voices, using narration credits from a narration add-on, on any plan) or **Basic voices** (five voices included with Pro and Agency, using AI tokens). Pick a narrator, then click **Narrate the whole book** or narrate chapters one by one.',
    questions: ['how do i make an audiobook', 'create audiobook', 'narrate my book', 'text to speech', 'audio version of my book', 'can ai read my book', 'audiobook voice'],
    keywords: ['audiobook', 'audio', 'narrate', 'narration', 'narrator', 'voice', 'mp3', 'listen', 'speech', 'tts', 'read', 'aloud'],
    related: ['audiobook-voices', 'narration-addon', 'audiobook-outdated', 'audiobook-stores'],
    pages: ['audiobook'],
    body: `1. Open your book and click **Audiobook**.
2. Choose the kind of narrator:
   - **Premium voices**: natural, expressive voices from the ElevenLabs library. Narration uses **narration credits** from a narration add-on (any plan can add one on **Billing & Subscriptions**).
   - **Basic voices**: five voices included with the Pro and Agency plans. Narration uses AI tokens.
3. For premium voices, click **Browse the voice library**, listen to samples and click **Use this voice**. Choose **Turbo** or, with Narration Pro, **Standard** quality.
4. Click **Narrate the whole book**, or use **Narrate** next to a single chapter. Keep the page open while it works.
5. Play each chapter on the page, or click **Download all** to get the MP3 files.

The panel shows how many chapters are narrated, the total length and roughly how many credits (or tokens) the rest will use. If a chapter fails to narrate, its credits are given back.`,
  },
  {
    slug: 'audiobook-voices',
    category: 'audio',
    title: 'Narrator voices',
    summary: 'The premium voice library, the five basic voices, and changing narrator.',
    answer:
      'Premium voices come from the ElevenLabs library: browse by group (such as narration and stories), filter by accent, gender, age and language, and play free samples. Basic voices are **American male (formal)**, **American female (warm)**, **British male**, **British female** and **Neutral**. If you change narrator later, chapters narrated in the old voice show **Outdated**.',
    questions: ['what voices are available', 'which voices can narrate', 'what voices are there', 'change narrator voice', 'british accent', 'american accent', 'male or female voice', 'hear a sample voice', 'voice library', 'scottish voice', 'more voices'],
    keywords: ['voice', 'voices', 'narrator', 'accent', 'british', 'american', 'male', 'female', 'neutral', 'sample', 'library', 'elevenlabs', 'premium'],
    related: ['audiobook', 'narration-addon', 'audiobook-outdated'],
    pages: ['audiobook'],
    body: `### Premium voices (narration add-on)
- Click **Browse the voice library** (or **Change voice**) on the Audiobook tab.
- The library is grouped, for example **Narration & stories** and **Informative & educational**. Search for words like "warm" or "Scottish", or filter by accent, gender, age and language.
- Click **Sample** to listen. Samples are free and don't use credits.
- Click **Use this voice** to make it this book's narrator.

### Basic voices (Pro and Agency)
- **American male (formal)**: clear, authoritative, suits non-fiction.
- **American female (warm)**: engaging and approachable, great for self-help.
- **British male**: distinguished, ideal for literary fiction.
- **British female**: elegant and expressive, suits most genres.
- **Neutral**: accent-neutral, works for any genre.

The narrator is saved for the book and used for the audiobook format when you publish.`,
  },
  {
    slug: 'narration-addon',
    category: 'audio',
    title: 'Premium narration: add-ons, Turbo or Standard, and top-ups',
    summary: 'How premium narration is paid for, Turbo vs Standard, and buying more.',
    answer:
      'Premium narration uses **narration credits**: **Turbo** uses 1 credit per character and **Standard** uses 2. A narration add-on gives a monthly allowance (Starter 100,000, Author 300,000, Pro 600,000); Standard quality is part of **Narration Pro**. Monthly credits reset with each payment; **top-ups** add 100,000 credits that never expire.',
    questions: ['what are narration credits', 'how many narration credits does a chapter need', 'turbo or standard', 'difference between turbo and standard', 'buy more narration credits', 'extra narration credits', 'ran out of narration credits', 'narration add on', 'how much is narration', 'premium narration price'],
    keywords: ['narration', 'turbo', 'standard', 'topup', 'add-on', 'addon', 'elevenlabs', 'premium', 'quality', 'hours'],
    action: { label: 'See narration add-ons', href: '/dashboard/billing' },
    related: ['audiobook', 'audiobook-voices', 'upgrade'],
    pages: ['audiobook', 'billing', 'usage'],
    body: `### How credits are used
- **Turbo**: 1 credit per character of your chapter. Natural and expressive.
- **Standard**: 2 credits per character. Studio quality with the richest emotion. Part of **Narration Pro**.
- About 900 characters make a minute of audio, so 100,000 credits are roughly 2 hours in Turbo.

### Narration add-ons (monthly, on any plan)
- **Narration Starter**: 100,000 credits a month, Turbo.
- **Narration Author**: 300,000 credits a month (about a full novel), Turbo.
- **Narration Pro**: 600,000 credits a month, Turbo or Standard.

Monthly credits reset each time the add-on renews and don't carry over. Prices are shown in pounds or dollars on **Billing & Subscriptions**.

### Top-ups
A top-up adds 100,000 credits for a one-off payment. Top-up credits are used after your monthly credits and **never expire**. Without an add-on, top-up credits narrate in Turbo.

### If something goes wrong
Credits are taken only when a chapter's audio is saved. If narration fails, the credits are given back automatically. You'll get a notification at 80% and 100% of your monthly credits.`,
  },
  {
    slug: 'audiobook-outdated',
    category: 'audio',
    title: 'Why a chapter says “Outdated”',
    summary: 'Re-narrate chapters after editing the text or changing voice.',
    answer:
      '“Outdated” means the chapter text, the narrator or the quality changed after it was narrated. Click **Re-narrate** on that chapter, or **Narrate the N remaining** to update all of them.',
    questions: ['audiobook outdated', 'chapter says outdated', 'update audiobook after editing', 're narrate chapter'],
    keywords: ['outdated', 'renarrate', 're-narrate', 'update', 'audio', 'changed'],
    related: ['audiobook', 'audiobook-voices'],
    pages: ['audiobook'],
    body: `When you edit a chapter or switch voice, the existing audio no longer matches. The chapter is marked **Outdated**.

- Click **Re-narrate** next to the chapter, or
- Click **Narrate the N remaining** to redo every outdated or missing chapter.

To publish an audiobook, every chapter must be narrated and up to date.`,
  },
  {
    slug: 'audiobook-stores',
    category: 'audio',
    title: 'Where can AI-narrated audiobooks be sold?',
    summary: 'Store rules for AI narration.',
    answer:
      'Stores have different rules for AI-narrated audiobooks, and some don’t accept them. When you submit, our publishing team confirms which of the stores you chose can take your audiobook.',
    questions: ['can i sell my ai audiobook on audible', 'does audible accept ai narration', 'where can i sell audiobook', 'audiobook stores', 'spotify audiobook', 'acx'],
    keywords: ['audible', 'acx', 'spotify', 'apple', 'audiobook', 'stores', 'sell', 'accept', 'rules', 'ai'],
    related: ['audiobook', 'publish-formats-stores'],
    pages: ['audiobook', 'publish'],
    body: `The audiobook stores in the publishing flow are **Audible / ACX**, **Spotify** and **Apple Books audiobooks**. Their rules on AI narration differ and change over time, and some don't accept it.

When you submit, our publishing team checks your audiobook against the current rules of each store you selected and lets you know if any can't take it.`,
  },
  {
    slug: 'colour-printing',
    category: 'layout',
    title: 'Black and white or colour printing',
    summary: 'Choose black and white, standard colour or premium colour.',
    answer:
      'On the **Layout** tab under **Interior printing**, choose **Black and white** (cheapest; pictures print in greyscale), **Standard colour** (colour on lighter paper, 72 pages or more) or **Premium colour** (rich colour on heavier paper, best for photo books, cookbooks and children’s books). Each option shows about what a copy costs to print.',
    questions: ['can i print in colour', 'colour printing', 'color interior', 'print my photos in colour', 'premium colour', 'standard colour', 'black and white or colour', 'why are my pictures grey', 'how much does colour printing cost'],
    keywords: ['colour', 'color', 'ink', 'premium', 'standard', 'black', 'white', 'greyscale', 'grayscale', 'grey', 'print', 'cost', 'interior'],
    related: ['images', 'trim-sizes', 'publish-details'],
    pages: ['format'],
    body: `Open the **Layout** tab and choose under **Interior printing**:

- **Black and white**: text, line art and greyscale photos. The most affordable to print. Pictures are converted to greyscale in the print PDF so what you see is what prints.
- **Standard colour**: colour on lighter paper, good for books with occasional colour pictures. Needs 72 to 600 pages and isn't available for hardcovers or A4.
- **Premium colour**: rich colour on heavier paper. Best for photo books, cookbooks and children's books.

Colour is always printed on white paper. Each option shows roughly what one copy costs to print for your page count and size, using Amazon's US printing prices.

### What it costs (Amazon US, per copy)
- Black and white: $2.30 up to 108 pages, then $1.00 plus about 1.2¢ a page (a little more for large sizes).
- Standard colour: $1.00 plus about 2.6¢ a page (4¢ for large sizes).
- Premium colour: $1.00 plus 6.5¢ a page (8¢ for large sizes).

Colour makes the book cost more to print, so the minimum price goes up too. The Publish tab works this out for you.`,
  },
  {
    slug: 'hardcover',
    category: 'cover',
    title: 'Hardcover books',
    summary: 'Sizes, page counts, the hardcover cover and publishing a hardcover.',
    answer:
      'Amazon prints hardcovers in 5.5″×8.5″, 6″×9″, 6.14″×9.21″, 7″×10″ and 8.25″×11″, with 75 to 550 pages, in black and white or premium colour. Choose one of those sizes on the **Layout** tab, tick **Also make a hardcover cover** in the cover brief, export your cover files, then choose **Hardcover** when you publish.',
    questions: ['can i make a hardcover', 'hardcover book', 'hardback', 'hard cover version', 'hardcover cover size', 'case laminate', 'why is hardcover greyed out', 'how much is a hardcover to print'],
    keywords: ['hardcover', 'hardback', 'hard', 'case', 'laminate', 'boards', 'hinge', 'wrap', 'binding'],
    related: ['cover-export', 'trim-sizes', 'publish-formats-stores'],
    pages: ['cover', 'publish'],
    body: `### What Amazon offers
- **Sizes**: 5.5″ × 8.5″, 6″ × 9″, 6.14″ × 9.21″, 7″ × 10″ and 8.25″ × 11″.
- **Length**: 75 to 550 pages.
- **Printing**: black and white or premium colour (not standard colour).
- **Cover**: a case-laminate cover printed and wrapped around the boards.

### Make one
1. On the **Layout** tab, choose one of the hardcover sizes. You'll see "Also available as a hardcover" under the trim size.
2. In the **Cover** tab's Brief step, choose **Paperback and ebook** and tick **Also make a hardcover cover**.
3. Design the cover as usual. The Design step shows the full hardcover cover too: the outer 0.591″ on each side wraps around the boards, and the strips beside the spine are the hinges, so lettering is kept well inside them.
4. In **Finalize and export**, click **Export files**. You get a print-ready hardcover cover PDF as well as the paperback one.
5. On the **Publish** tab, tick **Hardcover** in step 2 and set a hardcover price in step 4.

### Price
Hardcovers cost more to print: on Amazon US about $6.80 for up to 108 pages in black and white, then $5.65 plus about 1.2¢ a page. The Publish tab suggests a price that earns about $3 a copy.

> The hardcover cover is sized from Amazon's published measurements. Before uploading your first hardcover, compare the cover PDF with the template from Amazon's cover calculator, as Amazon recommends.`,
  },
];
