import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Edit2, Trash2, Eye, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-angular';
import { InventoryDetailDto } from '@models/inventory.model';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { trackById } from '@utils/trackby.utils';

/** Sortable columns for warehouse inventory (ammo / explosives); maps to API sort fields in parent */
export type WarehouseInventoryTableSortColumn =
  | 'itemName'
  | 'supplier'
  | 'manufacturer'
  | 'lot'
  | 'quantity'
  | 'readyForIssue'
  | 'expiryDate'
  | 'invoiceNumber';

@Component({
  selector: 'app-inventory-table',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    HasPermissionDirective
  ],
  templateUrl: './inventory-table.component.html',
  styleUrls: ['./inventory-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryTableComponent {
  @Input() items: InventoryDetailDto[] = [];
  @Input() isStaticItem: (detail: InventoryDetailDto) => boolean = () => false;
  @Input() getItemName: (detail: InventoryDetailDto) => string = () => '';
  @Input() getSupplierName: (detail: InventoryDetailDto) => string = () => '';
  @Input() getManufacturerName: (detail: InventoryDetailDto) => string = () => '';
  /** When true, show primary purpose column (ammunition tab). */
  @Input() showPrimaryPurposeColumn = false;
  @Input() getPrimaryPurposeName: (detail: InventoryDetailDto) => string = () => '';
  @Input() formatNumber: (num: number) => string = () => '';
  @Input() formatDate: (date?: Date | string) => string = () => '';

  /** Colspan for empty state: base 9 + optional primary purpose column */
  get tableColspan(): number {
    return this.showPrimaryPurposeColumn ? 10 : 9;
  }

  @Output() editItem = new EventEmitter<InventoryDetailDto>();
  @Output() deleteItem = new EventEmitter<InventoryDetailDto>();
  @Output() viewItem = new EventEmitter<InventoryDetailDto>();
  @Output() filterByInvoice = new EventEmitter<string>();
  @Output() sortChange = new EventEmitter<WarehouseInventoryTableSortColumn>();

  @Input() sortColumn: WarehouseInventoryTableSortColumn = 'itemName';
  @Input() sortDirection: 'asc' | 'desc' = 'asc';

  readonly Edit2 = Edit2;
  readonly Trash2 = Trash2;
  readonly Eye = Eye;
  readonly ArrowUp = ArrowUp;
  readonly ArrowDown = ArrowDown;
  readonly ArrowUpDown = ArrowUpDown;
  readonly trackById = trackById;

  toggleSort(column: WarehouseInventoryTableSortColumn): void {
    this.sortChange.emit(column);
  }

  sortIcon(column: WarehouseInventoryTableSortColumn): typeof ArrowUp | typeof ArrowDown | typeof ArrowUpDown {
    if (this.sortColumn !== column) {
      return ArrowUpDown;
    }
    return this.sortDirection === 'asc' ? ArrowUp : ArrowDown;
  }
}

