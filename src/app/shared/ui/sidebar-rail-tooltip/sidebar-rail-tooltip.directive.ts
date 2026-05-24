import {
  Directive,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  Renderer2,
  SimpleChanges,
  inject,
} from '@angular/core';
import { TranslationService } from '@services/translation.service';

/**
 * Styled hover tooltip for collapsed sidebar icon rails.
 * Matches the main sidebar `.menu-tooltip` behavior (RTL-aware, design-system styling).
 *
 * Usage:
 * ```html
 * <div
 *   appSidebarRailTooltip
 *   [sidebarRailCollapsed]="isCollapsed"
 *   [appSidebarRailTooltip]="label | translate">
 *   <a routerLink="...">...</a>
 * </div>
 * ```
 */
@Directive({
  selector: '[appSidebarRailTooltip]',
  standalone: true,
  host: {
    class: 'relative group',
    '(mouseenter)': 'onMouseEnter($event)',
    '(mouseleave)': 'onMouseLeave()',
  },
})
export class SidebarRailTooltipDirective implements OnChanges, OnDestroy {
  /** Tooltip label text (shown when the rail is collapsed). */
  @Input('appSidebarRailTooltip') label: string | null = null;

  /** When true, tooltip appears on hover (icon rail mode). */
  @Input() sidebarRailCollapsed = false;

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private readonly translationService = inject(TranslationService);

  private tooltipEl: HTMLElement | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sidebarRailCollapsed'] || changes['label']) {
      this.syncTooltip();
    }
  }

  ngOnDestroy(): void {
    this.removeTooltip();
  }

  onMouseEnter(event: MouseEvent): void {
    if (!this.sidebarRailCollapsed) {
      return;
    }
    this.positionTooltip(event.currentTarget as HTMLElement);
  }

  onMouseLeave(): void {
    // Tooltip hides automatically via CSS `.group:hover`.
  }

  private syncTooltip(): void {
    if (!this.sidebarRailCollapsed || !this.label?.trim()) {
      this.removeTooltip();
      return;
    }

    if (!this.tooltipEl) {
      this.tooltipEl = this.renderer.createElement('div');
      this.renderer.addClass(this.tooltipEl, 'menu-tooltip');
      this.renderer.appendChild(this.host.nativeElement, this.tooltipEl);
    }

    this.renderer.setProperty(this.tooltipEl, 'textContent', this.label.trim());
  }

  private positionTooltip(host: HTMLElement): void {
    const tooltip = this.tooltipEl;
    if (!tooltip) {
      return;
    }

    const rect = host.getBoundingClientRect();
    const isRTL = this.translationService.isRTL();
    const aside = host.closest('aside');
    const offset = this.getFixedPositionOffset(aside);
    const centerY = rect.top + rect.height / 2 - offset.top;

    if (isRTL) {
      tooltip.style.left = `${rect.left - offset.left}px`;
      tooltip.style.right = 'auto';
      tooltip.style.transform = 'translate(-100%, -50%)';
      tooltip.classList.add('rtl-tooltip');
      tooltip.classList.remove('ltr-tooltip');
    } else {
      tooltip.style.left = `${rect.right - offset.left + 8}px`;
      tooltip.style.right = 'auto';
      tooltip.style.transform = 'translateY(-50%)';
      tooltip.classList.add('ltr-tooltip');
      tooltip.classList.remove('rtl-tooltip');
    }
    tooltip.style.top = `${centerY}px`;
  }

  /**
   * `position: fixed` is relative to a transformed ancestor (e.g. main sidebar `will-change-transform`).
   * When no such ancestor exists, coordinates are viewport-relative.
   */
  private getFixedPositionOffset(aside: HTMLElement | null): { left: number; top: number } {
    if (!aside) {
      return { left: 0, top: 0 };
    }

    const style = getComputedStyle(aside);
    const createsContainingBlock =
      style.transform !== 'none' ||
      style.willChange.split(',').some(value => value.trim() === 'transform') ||
      style.filter !== 'none' ||
      style.perspective !== 'none';

    if (!createsContainingBlock) {
      return { left: 0, top: 0 };
    }

    const asideRect = aside.getBoundingClientRect();
    return { left: asideRect.left, top: asideRect.top };
  }

  private removeTooltip(): void {
    if (!this.tooltipEl) {
      return;
    }
    this.renderer.removeChild(this.host.nativeElement, this.tooltipEl);
    this.tooltipEl = null;
  }
}
