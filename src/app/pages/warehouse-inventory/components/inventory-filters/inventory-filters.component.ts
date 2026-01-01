import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Search } from 'lucide-angular';

@Component({
  selector: 'app-inventory-filters',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    LucideAngularModule
  ],
  templateUrl: './inventory-filters.component.html',
  styleUrls: ['./inventory-filters.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryFiltersComponent {
  @Input() searchControl: FormControl<string> = new FormControl<string>('', { nonNullable: true });

  @Output() searchChange = new EventEmitter<string>();

  readonly Search = Search;

  onSearchChange(): void {
    this.searchChange.emit(this.searchControl.value);
  }
}

