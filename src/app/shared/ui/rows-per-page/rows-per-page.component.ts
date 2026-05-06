import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { APP_CONSTANTS } from '@constants/app.constants';

/**
 * Rows per page selector component
 * Allows users to select how many items to display per page
 */
@Component({
  selector: 'app-rows-per-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, DropdownComponent],
  templateUrl: './rows-per-page.component.html',
  styleUrls: ['./rows-per-page.component.css']
})
export class RowsPerPageComponent {
  @Input() rowsPerPage: number = APP_CONSTANTS.DEFAULT_PAGE_SIZE;
  @Input() totalItems: number = 20;
  @Input() visibleItems?: number;
  /** When set (non-empty), replaces the default page-size choices from `APP_CONSTANTS.PAGE_SIZE_OPTIONS`. */
  @Input() optionValues: number[] | null = null;
  @Output() rowsPerPageChange = new EventEmitter<number>();

  private readonly defaultOptions: number[] = [...APP_CONSTANTS.PAGE_SIZE_OPTIONS];

  get options(): number[] {
    return this.optionValues && this.optionValues.length > 0 ? this.optionValues : this.defaultOptions;
  }

  onRowsPerPageChange(value: number | null): void {
    if (!value) {
      return;
    }
    this.rowsPerPageChange.emit(value);
  }

  get displayCount(): number {
    if (this.visibleItems !== undefined && this.visibleItems !== null) {
      return this.visibleItems;
    }
    return Math.min(this.rowsPerPage, this.totalItems);
  }
}

