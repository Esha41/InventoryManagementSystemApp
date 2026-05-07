import {
  Directive,
  ElementRef,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  afterNextRender,
  inject
} from '@angular/core';

/**
 * Clamps text with `-webkit-line-clamp` (inline styles) and sets native `title` for hover.
 * Default: 1 line + ellipsis. Use `[clampLines]="2"` or `3` for more rows.
 *
 * **Layout:** Parent `<td>` / flex child should use `min-w-0` so the cell can shrink (tables / flex).
 *
 * **Tooltip:** Uses `title` (plain text only — do not pass HTML). Simple and dependency-free;
 * not ideal for keyboard/screen-reader parity; use CDK overlay if you need strict a11y later.
 */
@Directive({
  selector: '[appTableClampTooltip]',
  standalone: true
})
export class TableClampTooltipDirective implements OnChanges, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private rafId: number | null = null;

  /** Tooltip text; if empty, uses host `textContent`. */
  @Input('appTableClampTooltip') fullText: string | null | undefined;

  @Input() clampLines: 1 | 2 | 3 = 1;

  @HostBinding('class')
  protected readonly hostLayoutClasses = 'min-w-0 max-w-full';

  constructor() {
    this.applyClamp();
    afterNextRender(() => {
      this.applyClamp();
      this.queueTitle();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fullText'] || changes['clampLines']) {
      this.applyClamp();
      this.queueTitle();
    }
  }

  ngOnDestroy(): void {
    this.cancelRaf();
  }

  private applyClamp(): void {
    const el = this.el.nativeElement;
    const n = Math.max(1, Math.min(3, Number(this.clampLines) || 1));
    el.style.setProperty('display', '-webkit-box');
    el.style.setProperty('-webkit-box-orient', 'vertical');
    el.style.setProperty('overflow', 'hidden');
    el.style.setProperty('-webkit-line-clamp', String(n));
    el.style.setProperty('word-break', 'break-word');
    el.style.setProperty('overflow-wrap', 'break-word');
    el.style.setProperty('min-width', '0');
    el.style.setProperty('max-width', '100%');
  }

  /** Defer `title` sync to after layout so `textContent` matches rendered text when not using `fullText`. */
  private queueTitle(): void {
    this.cancelRaf();
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.syncTitle();
    });
  }

  private cancelRaf(): void {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private syncTitle(): void {
    const el = this.el.nativeElement;
    const text = this.fullText?.trim() || el.textContent?.trim() || '';
    if (text) {
      el.setAttribute('title', text);
    } else {
      el.removeAttribute('title');
    }
  }
}
