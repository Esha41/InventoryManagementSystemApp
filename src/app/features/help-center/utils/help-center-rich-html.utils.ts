/** Arabic and related scripts used in help-center rich text. */
const ARABIC_LETTER_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;

const LATIN_LETTER_RE = /[A-Za-z]/g;

const ARABIC_SCRIPT_TEST_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

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

/** Minimum share of Arabic letters (of all letters) to treat content as RTL. */
const ARABIC_DOMINANCE_RATIO = 0.2;

export type RichHtmlDirection = 'rtl' | 'ltr';

export function stripHtmlToPlainText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function containsArabicScript(text: string): boolean {
  return ARABIC_SCRIPT_TEST_RE.test(text);
}

export function countArabicLetters(text: string): number {
  return (text.match(ARABIC_LETTER_RE) ?? []).length;
}

export function countLatinLetters(text: string): number {
  return (text.match(LATIN_LETTER_RE) ?? []).length;
}

/**
 * True when Arabic script is present and dominant enough to render as RTL
 * (independent of app UI language).
 */
export function isRichHtmlRtl(html: string): boolean {
  return resolveRichHtmlContainerDir(html) === 'rtl';
}

/**
 * Pick container `dir` for rich HTML independent of the app UI language.
 */
export function resolveRichHtmlContainerDir(html: string): RichHtmlDirection {
  const text = stripHtmlToPlainText(html);
  if (!text || !containsArabicScript(text)) {
    return 'ltr';
  }

  const arabicCount = countArabicLetters(text);
  const latinCount = countLatinLetters(text);
  const totalLetters = arabicCount + latinCount;

  if (arabicCount === 0) {
    return 'ltr';
  }

  if (latinCount === 0) {
    return 'rtl';
  }

  if (arabicCount >= latinCount) {
    return 'rtl';
  }

  if (totalLetters > 0 && arabicCount / totalLetters >= ARABIC_DOMINANCE_RATIO) {
    return 'rtl';
  }

  return 'ltr';
}

function stripConflictingDirectionFromStyle(style: string): string {
  const cleaned = style
    .replace(/\bdirection\s*:\s*(rtl|ltr|inherit|initial)\s*;?/gi, '')
    .replace(/\bunicode-bidi\s*:[^;]+;?/gi, '')
    .trim();
  return cleaned.replace(/;\s*;+/g, ';').replace(/^;|;$/g, '').trim();
}


function ensureBlockBidi(el: Element, containerRtl: boolean): void {
  const text = el.textContent ?? '';
  if (!text.trim()) {
    return;
  }

  const isQuillRtl = el.classList.contains('ql-direction-rtl');
  const isQuillLtr = el.classList.contains('ql-direction-ltr');
  const hasArabic = containsArabicScript(text);

  if (isQuillLtr) {
    if (!el.hasAttribute('dir')) {
      el.setAttribute('dir', 'ltr');
    }
    return;
  }

  if (isQuillRtl) {
    if (!el.hasAttribute('dir')) {
      el.setAttribute('dir', 'rtl');
    }
    return;
  }

  if (hasArabic && containerRtl) {
    if (!el.hasAttribute('dir')) {
      el.setAttribute('dir', 'rtl');
    }
    const style = el.getAttribute('style');
    if (style) {
      const cleaned = stripConflictingDirectionFromStyle(style);
      if (cleaned) {
        el.setAttribute('style', cleaned);
      } else {
        el.removeAttribute('style');
      }
    }
  }
}

/**
 * Ensure Arabic blocks have correct bidi without overriding Quill align/indent/formatting.
 */
export function applyBidirectionalAttributes(html: string): string {
  const trimmed = html.trim();
  if (!trimmed || typeof DOMParser === 'undefined') {
    return html;
  }

  const doc = new DOMParser().parseFromString(trimmed, 'text/html');
  const containerRtl = isRichHtmlRtl(trimmed);

  const walk = (el: Element): void => {
    if (BLOCK_TAGS.has(el.tagName)) {
      ensureBlockBidi(el, containerRtl);
    }
    Array.from(el.children).forEach(walk);
  };

  Array.from(doc.body.children).forEach(walk);
  return doc.body.innerHTML;
}
