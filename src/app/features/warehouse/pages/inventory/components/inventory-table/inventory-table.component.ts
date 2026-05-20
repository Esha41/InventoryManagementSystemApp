import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { PERMISSIONS } from '@constants/permissions.constants';

import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Edit2, Trash2, Eye, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-angular';
import { InventoryDetailDto } from '@models/inventory.model';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { TableClampTooltipDirective } from '@components/table-clamp-tooltip/table-clamp-tooltip.directive';
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
    RouterModule,
    TranslateModule,
    LucideAngularModule,
    HasPermissionDirective,
    TableClampTooltipDirective
  ],
  templateUrl: './inventory-table.component.html',
  styleUrls: ['./inventory-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryTableComponent {
  readonly PERMISSIONS = PERMISSIONS;

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
  /**
   * When set, item name renders as `<a routerLink>` so users can open catalog in a new tab.
   * When null for a row, falls back to button + {@link openItemMaster} (toast if no id).
   */
  @Input() getItemMasterRouterLink: (detail: InventoryDetailDto) => {
    commands: readonly (string | number)[];
    queryParams: Record<string, string>;
  } | null = () => null;

  /** Colspan for empty state: base 9 + optional primary purpose column */
  get tableColspan(): number {
    return this.showPrimaryPurposeColumn ? 10 : 9;
  }

  @Output() editItem = new EventEmitter<InventoryDetailDto>();
  @Output() deleteItem = new EventEmitter<InventoryDetailDto>();
  @Output() viewItem = new EventEmitter<InventoryDetailDto>();
  /** Navigate to full-page catalog asset details (/assets/asset-list/:id), same as workflow approval item links. */
  @Output() openItemMaster = new EventEmitter<InventoryDetailDto>();
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

