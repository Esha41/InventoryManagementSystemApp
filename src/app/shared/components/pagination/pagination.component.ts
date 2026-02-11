import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, ChevronLeft, ChevronRight } from 'lucide-angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TranslationService } from '@services/translation.service';

/**
 * Pagination component with smart page number display
 * Shows first, last, current, and nearby pages with ellipsis when needed
 * Example: 1 ... 4 5 [6] 7 8 ... 20
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule],
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.css']
})
export class PaginationComponent {
  @Input() currentPage: number = 1;
  @Input() totalPages: number = 1;
  @Output() pageChange = new EventEmitter<number>();

  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;

  constructor(
    private translationService: TranslationService,
    private translate: TranslateService
  ) {}

  /**
   * Validated current page - ensures it's within bounds
   */
  get validatedCurrentPage(): number {
    const validPage = Math.max(1, Math.min(this.currentPage, this.validatedTotalPages));
    return Math.max(1, validPage);
  }

  /**
   * Validated total pages - ensures it's at least 1
   */
  get validatedTotalPages(): number {
    return Math.max(1, this.totalPages);
  }

  /**
   * Checks if pagination should be displayed
   */
  get shouldDisplay(): boolean {
    return this.validatedTotalPages > 1;
  }

  /**
   * Smart page display - shows first, last, current, and nearby pages with ellipsis
   * Example: 1 ... 4 5 [6] 7 8 ... 20
   */
  get displayPages(): (number | 'ellipsis')[] {
    const total = this.validatedTotalPages;
    const current = this.validatedCurrentPage;

    // If 7 or fewer pages, show all
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [];

    // Always show first page
    pages.push(1);

    // Determine if we need ellipsis on left side
    const needsLeftEllipsis = current > 4;

    // Determine if we need ellipsis on right side
    const needsRightEllipsis = current < total - 3;

    if (needsLeftEllipsis) {
      pages.push('ellipsis');
    }

    // Calculate range of pages to show around current page
    const start = needsLeftEllipsis ? Math.max(2, current - 1) : 2;
    const end = needsRightEllipsis ? Math.min(total - 1, current + 1) : total - 1;

    // Add pages in the range
    for (let i = start; i <= end; i++) {
      if (i !== 1 && i !== total) {
        pages.push(i);
      }
    }

    if (needsRightEllipsis) {
      pages.push('ellipsis');
    }

    // Always show last page if not already included
    if (total > 1 && !pages.includes(total)) {
      pages.push(total);
    }

    return pages;
  }

  /**
   * Returns the correct icon for previous button based on RTL/LTR
   */
  get previousIcon() {
    return this.translationService.isRTL() ? ChevronRight : ChevronLeft;
  }

  /**
   * Returns the correct icon for next button based on RTL/LTR
   */
  get nextIcon() {
    return this.translationService.isRTL() ? ChevronLeft : ChevronRight;
  }

  /**
   * Checks if previous button should be disabled
   */
  get isPreviousDisabled(): boolean {
    return this.validatedCurrentPage <= 1;
  }

  /**
   * Checks if next button should be disabled
   */
  get isNextDisabled(): boolean {
    return this.validatedCurrentPage >= this.validatedTotalPages;
  }

  /**
   * Handles page number click
   */
  onPageClick(page: number | 'ellipsis'): void {
    if (page !== 'ellipsis' && this.isValidPage(page) && page !== this.validatedCurrentPage) {
      this.pageChange.emit(page);
    }
  }

  /**
   * Handles previous button click
   */
  onPrevious(): void {
    if (!this.isPreviousDisabled) {
      this.pageChange.emit(this.validatedCurrentPage - 1);
    }
  }

  /**
   * Handles next button click
   */
  onNext(): void {
    if (!this.isNextDisabled) {
      this.pageChange.emit(this.validatedCurrentPage + 1);
    }
  }

  /**
   * Validates if a page number is within valid range
   */
  private isValidPage(page: number): boolean {
    return Number.isInteger(page) && page >= 1 && page <= this.validatedTotalPages;
  }

  /**
   * Get translated aria-label for page button
   */
  getPageAriaLabel(page: number): string {
    const pageLabel = this.translate.instant('common.page');
    return `${pageLabel} ${page}`;
  }
}

