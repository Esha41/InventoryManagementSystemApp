import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Search } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';
import { CardComponent } from '@components/card/card.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { LookupTableConfig } from '@models/lookup.model';

/**
 * Lookup Filters Component
 * Handles lookup table selection and search/filter UI
 */
@Component({
  selector: 'app-lookup-filters',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    TranslateModule,
    CardComponent,
    DropdownComponent
  ],
  templateUrl: './lookup-filters.component.html',
  styleUrls: ['./lookup-filters.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LookupFiltersComponent {
  readonly Search = Search;

  @Input() lookupTables: LookupTableConfig[] = [];
  @Input() selectedTable?: LookupTableConfig;
  @Input() searchTerm: string = '';
  @Input() isLoading: boolean = false;

  @Output() tableSelect = new EventEmitter<LookupTableConfig | undefined>();
  @Output() searchChange = new EventEmitter<string>();

  onTableSelect(table: LookupTableConfig | undefined): void {
    this.tableSelect.emit(table);
  }

  onSearchChange(): void {
    this.searchChange.emit(this.searchTerm);
  }
}
