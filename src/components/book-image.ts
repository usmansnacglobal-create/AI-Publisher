import Image from '@tiptap/extension-image';

export type ImageSize = 'small' | 'medium' | 'full';
export interface ImageAttrs {
  src: string;
  /** The caption, also used as the image's description for screen readers. */
  alt: string;
  /** How wide the image is printed: small (half the text width), medium (three quarters) or full. */
  title: ImageSize;
}

const esc = (s: string) => s.replace(/([\[\]\\])/g, '\\$1');

/**
 * A captioned book image. Stored in the chapter's Markdown as
 * ![caption](src "small|medium|full") on its own line.
 */
export const BookImage = Image.extend({
  draggable: true,
  addAttributes() {
    return {
      ...this.parent?.(),
      title: { default: 'full', parseHTML: (el) => (['small', 'medium', 'full'].includes(el.getAttribute('title') ?? '') ? el.getAttribute('title') : 'full') },
    };
  },
  renderHTML({ HTMLAttributes }) {
    const { src, alt, title } = HTMLAttributes as { src: string; alt?: string; title?: string };
    return ['figure', { class: 'book-figure', 'data-size': title || 'full' }, ['img', { src, alt: alt ?? '', title: title || 'full', loading: 'lazy' }], ['figcaption', {}, alt ?? '']];
  },
  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (s: string) => void; closeBlock: (n: unknown) => void }, node: { attrs: ImageAttrs }) {
          const { src, alt, title } = node.attrs;
          state.write(`![${esc(alt ?? '')}](${src} "${title || 'full'}")`);
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
}).configure({ inline: false, allowBase64: false });
