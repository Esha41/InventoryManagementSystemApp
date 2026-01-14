import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Search } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';

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
export class UserFiltersComponent {
  readonly Search = Search;

  @Input() searchTerm: string = '';
  @Input() statusFilter: 'all' | 'active' | 'inactive' = 'all';
  @Output() searchChange = new EventEmitter<string>();
  @Output() statusFilterChange = new EventEmitter<'all' | 'active' | 'inactive'>();

  onSearchChange(): void {
    this.searchChange.emit(this.searchTerm);
  }

  onStatusFilterChange(status: 'all' | 'active' | 'inactive'): void {
    this.statusFilter = status;
    this.statusFilterChange.emit(this.statusFilter);
  }
}

