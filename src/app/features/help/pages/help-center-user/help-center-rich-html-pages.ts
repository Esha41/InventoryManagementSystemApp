/** Target size per “page” of rich HTML (client-side only). */
const CHARS_PER_PAGE = 5200;

/**
 * Splits Quill/HTML into multiple strings for pagination without breaking mid-tag when possible
 * (splits on block-level tags; falls back to length chunks).
 */
export function splitRichHtmlIntoPages(html: string | null | undefined): string[] {
  const raw = (html ?? '').trim();
  if (!raw) {
    return [''];
  }
  if (raw.length <= CHARS_PER_PAGE) {
    return [raw];
  }

  const segments = raw
    .split(/(?=<(?:p|div|h[1-6]|ul|ol|table|blockquote|pre|section)\b[^>]*>)/i)
    .filter(s => s.length > 0);

  if (segments.length <= 1) {
    return chunkByChar(raw, CHARS_PER_PAGE);
  }

  const pages: string[] = [];
  let buf = '';
  for (const seg of segments) {
    if (buf.length + seg.length > CHARS_PER_PAGE && buf.length > 80) {
      pages.push(buf);
      buf = seg;
    } else {
      buf += seg;
    }
  }
  if (buf.trim()) {
    pages.push(buf);
  }
  return pages.length ? pages : [raw];
}

function chunkByChar(s: string, max: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += max) {
    out.push(s.slice(i, i + max));
  }
  return out.length ? out : [s];
}
