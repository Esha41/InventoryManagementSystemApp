import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Search } from 'lucide-angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { TranslationService } from '@core/services/translation.service';

/**
 * User Filters Component
 * Handles user search/filter UI
 */
@Component({
  selector: 'app-user-filters',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    TranslateModule
  ],
  templateUrl: './user-filters.component.html',
  styleUrls: ['./user-filters.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserFiltersComponent implements OnInit, OnDestroy {
  readonly Search = Search;
  private readonly translationService = inject(TranslationService, { optional: true });
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() searchTerm: string = '';
  @Input() statusFilter: 'all' | 'active' | 'inactive' | 'deleted' = 'all';
  @Input() useSearchButton: boolean = false;
  @Output() searchChange = new EventEmitter<string>();
  @Output() searchTriggered = new EventEmitter<string>();
  @Output() statusFilterChange = new EventEmitter<'all' | 'active' | 'inactive' | 'deleted'>();

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      if (!this.useSearchButton) {
        this.searchChange.emit(term);
      }
    });

    // Subscribe to language changes to update RTL/LTR layout
    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(): void {
    if (!this.useSearchButton) {
      this.searchSubject.next(this.searchTerm);
    }
  }

  onSearchClick(): void {
    this.searchTriggered.emit(this.searchTerm);
  }

  onStatusFilterChange(status: 'all' | 'active' | 'inactive' | 'deleted'): void {
    this.statusFilter = status;
    this.statusFilterChange.emit(this.statusFilter);
    // Also trigger search with current search term when status changes
    if (this.useSearchButton) {
      this.searchTriggered.emit(this.searchTerm);
    }
  }
}
