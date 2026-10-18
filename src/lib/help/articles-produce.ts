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
    action: { label: 'Open My books', href: '/dashboard/books' },
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
      'On the **Layout** tab, pick a trim size: 5″×8″, 5.25″×8″, 5.5″×8.5″, 6″×9″, 4.25″×7″, 8.5″×8.5″ or 8.5″×11″, plus white or cream paper. **6″×9″** is the most common size for non-fiction, and 5.5″×8.5″ or 5″×8″ suit most novels.',
    questions: ['what size should my book be', 'trim size', 'page size', 'book dimensions', '6x9', 'paper colour', 'cream or white paper'],
    keywords: ['trim', 'size', 'dimensions', 'page', '6x9', '5x8', 'paperback', 'paper', 'cream', 'white'],
    related: ['layout-typographer', 'spine'],
    pages: ['format', 'cover'],
    body: `Available sizes: **5″ × 8″**, **5.25″ × 8″**, **5.5″ × 8.5″**, **6″ × 9″**, **4.25″ × 7″** (mass-market paperback), **8.5″ × 8.5″** (square, for picture or photo books) and **8.5″ × 11″** (workbooks and manuals).

- Novels: 5″ × 8″, 5.25″ × 8″ or 5.5″ × 8.5″.
- Non-fiction and memoir: 6″ × 9″ or 5.5″ × 8.5″.
- Cream paper is traditional for fiction; white suits non-fiction and anything with pictures.

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

- **Print interior (PDF)**: for paperbacks on Amazon KDP and IngramSpark. Uses your layout settings. Pro and Agency.
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
    action: { label: 'Open My books', href: '/dashboard/books' },
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
    summary: 'Choose a narrator voice and narrate every chapter as MP3 files.',
    answer:
      'Open the **Audiobook** tab, choose a narrator voice (click the speaker icon to hear a sample), then click **Narrate the whole book** or narrate chapters one by one. Each chapter becomes an MP3 you can play or **Download all**. Narration uses AI tokens. Pro and Agency plans.',
    questions: ['how do i make an audiobook', 'create audiobook', 'narrate my book', 'text to speech', 'audio version of my book', 'can ai read my book', 'audiobook voice'],
    keywords: ['audiobook', 'audio', 'narrate', 'narration', 'narrator', 'voice', 'mp3', 'listen', 'speech', 'tts', 'read', 'aloud'],
    related: ['audiobook-voices', 'audiobook-outdated', 'audiobook-stores'],
    pages: ['audiobook'],
    body: `1. Open your book and click **Audiobook**.
2. Choose a **narrator voice**. Click the speaker icon next to a voice to hear it read the opening of your first chapter (this uses a few AI tokens).
3. Click **Narrate the whole book**, or use **Narrate** next to a single chapter. Keep the page open while it works.
4. Play each chapter on the page, or click **Download all** to get the MP3 files.

The panel shows how many chapters are narrated, the total length and roughly how many tokens the rest will use.

The audiobook is part of the Pro and Agency plans.`,
  },
  {
    slug: 'audiobook-voices',
    category: 'audio',
    title: 'Narrator voices',
    summary: 'The five voices and how to change them.',
    answer:
      'There are five voices: **American male (formal)**, **American female (warm)**, **British male**, **British female** and **Neutral**. Click the speaker icon to hear a sample. If you change voice later, chapters narrated in the old voice show **Outdated** and can be re-narrated.',
    questions: ['what voices are available', 'which voices can narrate', 'what voices are there', 'change narrator voice', 'british accent', 'american accent', 'male or female voice', 'hear a sample voice'],
    keywords: ['voice', 'voices', 'narrator', 'accent', 'british', 'american', 'male', 'female', 'neutral', 'sample'],
    related: ['audiobook', 'audiobook-outdated'],
    pages: ['audiobook'],
    body: `- **American male (formal)**: clear, authoritative, suits non-fiction.
- **American female (warm)**: engaging and approachable, great for self-help.
- **British male**: distinguished, ideal for literary fiction.
- **British female**: elegant and expressive, suits most genres.
- **Neutral**: accent-neutral, works for any genre.

The voice is saved for the book and used for the audiobook format when you publish.`,
  },
  {
    slug: 'audiobook-outdated',
    category: 'audio',
    title: 'Why a chapter says “Outdated”',
    summary: 'Re-narrate chapters after editing the text or changing voice.',
    answer:
      '“Outdated” means the chapter text or the narrator voice changed after it was narrated. Click **Re-narrate** on that chapter, or **Narrate the N remaining** to update all of them.',
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
];
