import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, ChevronLeft, ChevronRight } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.css']
})
export class PaginationComponent {
  @Input() currentPage: number = 1;
  @Input() totalPages: number = 5;
  @Output() pageChange = new EventEmitter<number>();

  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;

  constructor(private translationService: TranslationService) {}

  /**
   * Smart page display - shows first, last, current, and nearby pages with ellipsis
   * Example: 1 ... 4 5 [6] 7 8 ... 20
   */
  get displayPages(): (number | 'ellipsis')[] {
    const total = this.totalPages;
    const current = this.currentPage;
    
    // If 7 or fewer pages, show all
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [];
    
    // Always show first page
    pages.push(1);

    // Determine range around current page
    const showLeft = current > 3;
    const showRight = current < total - 2;

    if (showLeft) {
      pages.push('ellipsis');
    }

    // Show pages around current
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (showRight) {
      pages.push('ellipsis');
    }

    // Always show last page if not already shown
    if (!pages.includes(total)) {
      pages.push(total);
    }

    return pages;
  }

  // Return correct icon for previous button based on RTL/LTR
  get previousIcon() {
    return this.translationService.isRTL() ? ChevronRight : ChevronLeft;
  }

  // Return correct icon for next button based on RTL/LTR
  get nextIcon() {
    return this.translationService.isRTL() ? ChevronLeft : ChevronRight;
  }

  onPageClick(page: number): void {
    if (page !== this.currentPage && page >= 1 && page <= this.totalPages) {
      this.pageChange.emit(page);
    }
  }

  onPrevious(): void {
    if (this.currentPage > 1) {
      this.pageChange.emit(this.currentPage - 1);
    }
  }

  onNext(): void {
    if (this.currentPage < this.totalPages) {
      this.pageChange.emit(this.currentPage + 1);
    }
  }
}
