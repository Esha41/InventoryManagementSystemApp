import { Injectable, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';

/**
 * Sanitizes help-center HTML (Quill output, Word paste, etc.) before binding with [innerHTML].
 */
@Injectable({ providedIn: 'root' })
export class HelpCenterHtmlSanitizerService {
  private readonly domSanitizer = inject(DomSanitizer);

  /** Rich text: headings, lists, tables, Quill classes, limited inline style. */
  sanitizeRichHtml(html: string | null | undefined): SafeHtml {
    const raw = html ?? '';
    const clean = DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: [
        'a',
        'b',
        'blockquote',
        'br',
        'code',
        'col',
        'colgroup',
        'div',
        'em',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'hr',
        'i',
        'img',
        'li',
        'ol',
        'p',
        'pre',
        's',
        'span',
        'strong',
        'sub',
        'sup',
        'table',
        'tbody',
        'td',
        'tfoot',
        'th',
        'thead',
        'tr',
        'u',
        'ul'
      ],
      ALLOWED_ATTR: [
        'href',
        'target',
        'rel',
        'class',
        'style',
        'start',
        'colspan',
        'rowspan',
        'scope',
        'src',
        'alt',
        'title',
        'width',
        'height',
        'loading',
        'decoding'
      ],
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false
    });
    return this.domSanitizer.bypassSecurityTrustHtml(clean);
  }
}
