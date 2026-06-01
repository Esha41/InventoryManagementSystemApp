/** Arabic and related scripts used in help-center rich text. */
const ARABIC_SCRIPT_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const LATIN_LETTER_RE = /[A-Za-z]/;

const BLOCK_TAGS = new Set([
  'P',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'TD',
  'TH',
  'BLOCKQUOTE',
  'DIV'
]);

export type RichHtmlDirection = 'rtl' | 'ltr' | 'auto';

export function stripHtmlToPlainText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function containsArabicScript(text: string): boolean {
  return ARABIC_SCRIPT_RE.test(text);
}

/**
 * Pick container `dir` for rich HTML independent of the app UI language.
 * Fully Arabic content → rtl; mixed Arabic/Latin → auto; otherwise ltr.
 */
export function resolveRichHtmlContainerDir(html: string): RichHtmlDirection {
  const text = stripHtmlToPlainText(html);
  if (!text) {
    return 'ltr';
  }

  const hasArabic = containsArabicScript(text);
  if (!hasArabic) {
    return 'ltr';
  }

  return LATIN_LETTER_RE.test(text) ? 'auto' : 'rtl';
}

/**
 * Ensure Quill RTL blocks and Arabic paragraphs carry a `dir` attribute after sanitization.
 */
export function applyBidirectionalAttributes(html: string): string {
  const trimmed = html.trim();
  if (!trimmed || typeof DOMParser === 'undefined') {
    return html;
  }

  const doc = new DOMParser().parseFromString(trimmed, 'text/html');

  const applyOnBlock = (el: Element): void => {
    if (!BLOCK_TAGS.has(el.tagName)) {
      Array.from(el.children).forEach(applyOnBlock);
      return;
    }

    const text = el.textContent ?? '';
    const hasDir = el.hasAttribute('dir');
    const isQuillRtl = el.classList.contains('ql-direction-rtl');
    const isQuillLtr = el.classList.contains('ql-direction-ltr');

    if (!hasDir) {
      if (isQuillRtl) {
        el.setAttribute('dir', 'rtl');
      } else if (isQuillLtr) {
        el.setAttribute('dir', 'ltr');
      } else if (containsArabicScript(text)) {
        el.setAttribute('dir', 'auto');
      }
    }

    Array.from(el.children).forEach(applyOnBlock);
  };

  Array.from(doc.body.children).forEach(applyOnBlock);
  return doc.body.innerHTML;
}
