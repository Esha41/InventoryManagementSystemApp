import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Search } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

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

  @Input() searchTerm: string = '';
  @Input() statusFilter: 'all' | 'active' | 'inactive' | 'deleted' = 'all';
  @Input() useSearchButton: boolean = false;
  @Output() searchChange = new EventEmitter<string>();
  @Output() searchTriggered = new EventEmitter<string>();
  @Output() statusFilterChange = new EventEmitter<'all' | 'active' | 'inactive' | 'deleted'>();

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

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
  }
}
