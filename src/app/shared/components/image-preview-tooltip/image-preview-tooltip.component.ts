import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { fromEvent, Subject } from 'rxjs';
import { takeUntil, throttleTime, debounceTime } from 'rxjs/operators';
import { TranslationService } from '@services/translation.service';

/**
 * Data interface for image preview tooltip
 */
export interface ImagePreviewData {
  /** URL of the image to preview */
  imageUrl: string;
  /** Alternative text for accessibility */
  altText: string;
}

/**
 * Reusable image preview tooltip component that displays a larger preview
 * of an image when hovering over a thumbnail.
 * 
 * Features:
 * - Fixed positioning to escape container overflow
 * - Automatic positioning (above/below based on available space)
 * - RTL support
 * - Scroll and resize handling
 * - Smooth animations
 */
@Component({
  selector: 'app-image-preview-tooltip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-preview-tooltip.component.html',
  styleUrls: ['./image-preview-tooltip.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImagePreviewTooltipComponent implements OnInit, OnDestroy {
  /** Width of the tooltip in pixels */
  @Input() tooltipWidth = 320;
  
  /** Height of the tooltip in pixels */
  @Input() tooltipHeight = 320;
  
  /** Delay in milliseconds before hiding the tooltip */
  @Input() delay = 150;

  // Preview state
  show = false;
  imageUrl: string | null = null;
  altText = '';
  left = 0;
  top = 0;
  arrowLeft = 0;
  arrowPosition: 'top' | 'bottom' = 'bottom';

  private previewTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentImageElement: HTMLElement | null = null;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private cdr: ChangeDetectorRef,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.setupTooltipPositionListeners();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearPreviewTimeout();
    this.hide();
  }

  /**
   * Shows the preview tooltip for the given image data
   * @param event Mouse event from the hovered image element
   * @param data Image preview data containing URL and alt text
   */
  showPreview(event: MouseEvent, data: ImagePreviewData): void {
    if (!data?.imageUrl) {
      this.hide();
      return;
    }

    this.clearPreviewTimeout();
    this.currentImageElement = event.target as HTMLElement;
    this.calculateAndSetPosition(event, data);
  }

  /**
   * Hides the preview tooltip with a delay to prevent flickering
   */
  hide(): void {
    this.clearPreviewTimeout();
    this.previewTimeout = setTimeout(() => {
      if (this.show) {
        this.show = false;
        this.imageUrl = null;
        this.altText = '';
        this.currentImageElement = null;
        this.cdr.markForCheck();
      }
      this.previewTimeout = null;
    }, this.delay);
  }

  /**
   * Keeps the preview visible (cancels hide timeout)
   * Used when hovering over the tooltip itself
   */
  keepVisible(): void {
    this.clearPreviewTimeout();
  }

  /**
   * Gets whether the current language is RTL
   */
  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  private clearPreviewTimeout(): void {
    if (this.previewTimeout !== null) {
      clearTimeout(this.previewTimeout);
      this.previewTimeout = null;
    }
  }

  private setupTooltipPositionListeners(): void {
    // Update tooltip position on scroll
    fromEvent(window, 'scroll', { passive: true })
      .pipe(
        throttleTime(50),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        if (this.show && this.currentImageElement) {
          this.updateTooltipPosition();
        }
      });

    // Hide tooltip on resize to prevent positioning issues
    fromEvent(window, 'resize', { passive: true })
      .pipe(
        debounceTime(100),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        if (this.show) {
          this.hide();
        }
      });
  }

  private updateTooltipPosition(): void {
    if (!this.currentImageElement || !this.imageUrl) {
      this.hide();
      return;
    }

    // Verify element is still in DOM and visible
    const rect = this.currentImageElement.getBoundingClientRect();
    const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight &&
                     rect.left >= 0 && rect.right <= window.innerWidth;

    if (!isVisible || this.currentImageElement.getAttribute('src') !== this.imageUrl) {
      this.hide();
      return;
    }

    // Create synthetic event for recalculation
    const syntheticEvent = {
      target: this.currentImageElement,
      currentTarget: this.currentImageElement,
      ...({} as Partial<MouseEvent>)
    } as unknown as MouseEvent;

    this.calculateAndSetPosition(syntheticEvent, {
      imageUrl: this.imageUrl,
      altText: this.altText
    });
  }

  private calculateAndSetPosition(event: MouseEvent, data: ImagePreviewData): void {
    const padding = 16;
    const arrowSize = 10;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    // Get image element position
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const imageCenterX = rect.left + rect.width / 2;
    const imageTop = rect.top;
    const imageBottom = rect.bottom;

    // Calculate tooltip position (prefer above, fallback to below)
    let left = imageCenterX - this.tooltipWidth / 2;
    let top = imageTop - this.tooltipHeight - padding - arrowSize;
    let arrowPosition: 'top' | 'bottom' = 'bottom';
    let arrowLeft = this.tooltipWidth / 2;

    // Adjust if tooltip goes off-screen horizontally
    const minLeft = padding;
    const maxLeft = viewportWidth - this.tooltipWidth - padding;
    
    if (left < minLeft) {
      const adjustment = minLeft - left;
      left = minLeft;
      arrowLeft = this.tooltipWidth / 2 - adjustment;
    } else if (left > maxLeft) {
      const adjustment = left - maxLeft;
      left = maxLeft;
      arrowLeft = this.tooltipWidth / 2 + adjustment;
    }

    // Clamp arrow position within tooltip bounds
    arrowLeft = Math.max(20, Math.min(this.tooltipWidth - 20, arrowLeft));

    // If not enough space above, show below
    if (top < scrollY + padding) {
      top = imageBottom + padding + arrowSize;
      arrowPosition = 'top';
    }

    // Ensure tooltip doesn't go off-screen vertically
    if (top + this.tooltipHeight > scrollY + viewportHeight - padding) {
      top = scrollY + viewportHeight - this.tooltipHeight - padding;
      if (arrowPosition === 'bottom' && top < imageTop - this.tooltipHeight - padding - arrowSize) {
        arrowPosition = 'top';
        top = imageBottom + padding + arrowSize;
      }
    }

    // Calculate arrow position relative to image center
    arrowLeft = imageCenterX - left;

    // RTL adjustment
    if (this.isRTL) {
      left = viewportWidth - left - this.tooltipWidth;
      arrowLeft = this.tooltipWidth - arrowLeft;
    }

    // Update state
    this.show = true;
    this.imageUrl = data.imageUrl;
    this.altText = data.altText;
    this.left = left + scrollX;
    this.top = top;
    this.arrowLeft = arrowLeft;
    this.arrowPosition = arrowPosition;

    this.cdr.markForCheck();
  }
}

