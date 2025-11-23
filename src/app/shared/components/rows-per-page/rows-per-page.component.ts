import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DropdownComponent } from '@components/dropdown/dropdown.component';

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
  @Input() rowsPerPage: number = 5;
  @Input() totalItems: number = 20;
  @Input() visibleItems?: number;
  @Output() rowsPerPageChange = new EventEmitter<number>();

  options: number[] = [5, 10, 20, 50];

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

