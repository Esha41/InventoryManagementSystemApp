import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  LucideAngularModule,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Package,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Shield
} from 'lucide-angular';
import { ItemInventorySummaryDto, ItemType } from '@models/inventory.model';
import { AssetDto, AssetStatus, getAssetStatusLabel } from '@models/asset.model';
import { LotDetailDto } from '@services/inventory.service';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

@Component({
  selector: 'app-inventory-item-summary-table',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    PaginationComponent,
    RowsPerPageComponent
  ],
  templateUrl: './inventory-item-summary-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        min-width: 0;
      }
    `
  ]
})
export class InventoryItemSummaryTableComponent {
  @Input({ required: true }) rows!: ItemInventorySummaryDto[];
  @Input() itemSortColumn: string | null = null;
  @Input() itemSortDirection: 'asc' | 'desc' = 'asc';
  @Input() expandedItemId: number | null = null;

  // ── Lot detail (ammunition / explosives) ──────────────────────────────────
  @Input() lotDetails: LotDetailDto[] = [];
  @Input() isLotsLoading = false;
  @Input() lotSortColumn: string | null = null;
  @Input() lotSortDirection: 'asc' | 'desc' = 'asc';
  @Input() paginatedLotDetails: LotDetailDto[] = [];
  @Input() lotTotalPages = 1;
  @Input() lotCurrentPage = 1;
  @Input() lotRowsPerPage = 10;

  // ── Asset detail (weapons) ────────────────────────────────────────────────
  @Input() assetDetails: AssetDto[] = [];
  @Input() isAssetsLoading = false;
  @Input() assetSortColumn: string | null = null;
  @Input() assetSortDirection: 'asc' | 'desc' = 'asc';
  @Input() paginatedAssetDetails: AssetDto[] = [];
  @Input() assetTotalPages = 1;
  @Input() assetCurrentPage = 1;
  @Input() assetRowsPerPage = 10;

  @Input() selectedDepotId: number | null = null;
  @Input() selectedDepotLabel = '';
  @Input() singleItemTotalsSubtitle: string | null = null;
  @Input() sumTotalQtyFiltered = 0;
  @Input() sumUsedQtyFiltered = 0;
  @Input() sumReservedQtyFiltered = 0;
  @Input() sumRemainingQtyFiltered = 0;
  @Input() sumLotsFiltered = 0;

  @Output() readonly itemSort = new EventEmitter<string>();
  @Output() readonly rowToggle = new EventEmitter<ItemInventorySummaryDto>();
  @Output() readonly lotSort = new EventEmitter<string>();
  @Output() readonly lotPageChange = new EventEmitter<number>();
  @Output() readonly lotRowsPerPageChange = new EventEmitter<number>();
  @Output() readonly assetSort = new EventEmitter<string>();
  @Output() readonly assetPageChange = new EventEmitter<number>();
  @Output() readonly assetRowsPerPageChange = new EventEmitter<number>();

  readonly ArrowUp = ArrowUp;
  readonly ArrowDown = ArrowDown;
  readonly ArrowUpDown = ArrowUpDown;
  readonly Package = Package;
  readonly RefreshCw = RefreshCw;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;
  readonly Shield = Shield;
  readonly ItemType = ItemType;

  constructor(private readonly translate: TranslateService) {}

  onItemSort(column: string): void { this.itemSort.emit(column); }
  onLotSort(column: string): void { this.lotSort.emit(column); }
  onRowToggle(item: ItemInventorySummaryDto): void { this.rowToggle.emit(item); }
  onLotPageChanged(page: number): void { this.lotPageChange.emit(page); }
  onLotRppChange(rows: number): void { this.lotRowsPerPageChange.emit(rows); }
  onAssetSort(column: string): void { this.assetSort.emit(column); }
  onAssetPageChanged(page: number): void { this.assetPageChange.emit(page); }
  onAssetRppChange(rows: number): void { this.assetRowsPerPageChange.emit(rows); }

  isItemExpanded(itemId: number): boolean {
    return this.expandedItemId === itemId;
  }

  isWeaponItem(item: ItemInventorySummaryDto): boolean {
    return item.itemType === ItemType.Weapon;
  }

  isExpandedLoading(item: ItemInventorySummaryDto): boolean {
    return this.isWeaponItem(item) ? this.isAssetsLoading : this.isLotsLoading;
  }

  isExpandedEmpty(item: ItemInventorySummaryDto): boolean {
    if (this.isWeaponItem(item)) return !this.isAssetsLoading && this.assetDetails.length === 0;
    return !this.isLotsLoading && this.lotDetails.length === 0;
  }

  getItemTypeLabelKey(type: number): string {
    switch (type) {
      case ItemType.Ammunition: return 'inventoryDashboard.itemType.ammunition';
      case ItemType.Weapon:     return 'inventoryDashboard.itemType.weapon';
      case ItemType.Explosive:  return 'inventoryDashboard.itemType.explosive';
      default:                  return 'common.unknown';
    }
  }

  getItemTypeBadgeClass(type: number): string {
    const base =
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-[var(--color-border)] bg-[var(--color-background-soft)]';
    switch (type) {
      case ItemType.Ammunition: return `${base} text-[var(--color-info)]`;
      case ItemType.Weapon:     return `${base} text-[var(--color-error)]`;
      case ItemType.Explosive:  return `${base} text-[var(--color-warning)]`;
      default:                  return `${base} text-[var(--color-text-muted)]`;
    }
  }

  getLotStatusBadgeClass(kind: 'empty' | 'expired' | 'ready' | 'notReady'): string {
    const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border';
    switch (kind) {
      case 'empty':
        return `${base} border-[var(--color-border)] bg-[var(--color-background-soft)] text-[var(--color-text-muted)]`;
      case 'expired':
        return `${base} border-[color-mix(in_srgb,var(--color-error)_35%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-error)_14%,var(--color-background))] text-[var(--color-error)]`;
      case 'ready':
        return `${base} border-[color-mix(in_srgb,var(--color-success)_35%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-success)_14%,var(--color-background))] text-[var(--color-success)]`;
      case 'notReady':
        return `${base} border-[color-mix(in_srgb,var(--color-warning)_35%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-warning)_14%,var(--color-background))] text-[var(--color-warning)]`;
    }
  }

  getAssetStatusBadgeClass(status?: AssetStatus): string {
    const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border';
    switch (status) {
      case AssetStatus.ReadyToIssue:
        return `${base} border-[color-mix(in_srgb,var(--color-success)_35%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-success)_14%,var(--color-background))] text-[var(--color-success)]`;
      case AssetStatus.Assigned:
        return `${base} border-[color-mix(in_srgb,var(--color-info)_35%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-info)_14%,var(--color-background))] text-[var(--color-info)]`;
      case AssetStatus.InMaintenance:
        return `${base} border-[color-mix(in_srgb,var(--color-warning)_35%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-warning)_14%,var(--color-background))] text-[var(--color-warning)]`;
      case AssetStatus.UnserviceableRepairable:
      case AssetStatus.UnserviceableUnrepairable:
      case AssetStatus.AwaitingDisposal:
      case AssetStatus.Disposed:
        return `${base} border-[color-mix(in_srgb,var(--color-error)_35%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-error)_14%,var(--color-background))] text-[var(--color-error)]`;
      default:
        return `${base} border-[var(--color-border)] bg-[var(--color-background-soft)] text-[var(--color-text-muted)]`;
    }
  }

  getAssetStatusLabel(status?: AssetStatus): string {
    return getAssetStatusLabel(status);
  }

  getAssetDepotName(asset: AssetDto): string {
    if (!asset.depot) return '—';
    return getLocalizedName(asset.depot, getCurrentLang(this.translate)) || asset.depot.nameEn || asset.depot.nameAr || '—';
  }

  getRemainingQtyClass(remaining: number, total: number): string {
    if (remaining === 0) return 'text-[var(--color-error)] font-bold';
    if (total > 0 && remaining / total < 0.2) return 'text-[var(--color-warning)] font-semibold';
    return 'text-[var(--color-success)]';
  }

  formatCaliberDisplay(item: ItemInventorySummaryDto): string {
    const c = (item.caliber || '').trim();
    if (!c) return '—';
    const u = (item.caliberUnitName || '').trim();
    return u ? `${c} (${u})` : c;
  }

  formatExpiryDate(date?: Date | string): string {
    if (!date) return '—';
    try {
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return '—';
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch { return '—'; }
  }

  formatDate(date?: Date | string): string {
    return this.formatExpiryDate(date);
  }

  getExpiryClass(date?: Date | string): string {
    if (!date) return '';
    try {
      const d = date instanceof Date ? date : new Date(date);
      const diffDays = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (diffDays < 0) return 'text-[var(--color-error)] font-bold';
      if (diffDays <= 30) return 'text-[var(--color-warning)] font-semibold';
      return '';
    } catch { return ''; }
  }

  getLotDepotName(lot: LotDetailDto): string {
    if (!lot.depot) return '—';
    return getLocalizedName(lot.depot, getCurrentLang(this.translate)) || lot.depot.nameEn || lot.depot.nameAr || '—';
  }

  getExpandedCount(item: ItemInventorySummaryDto): number {
    return this.isWeaponItem(item) ? this.assetDetails.length : this.lotDetails.length;
  }

  getExpandedLabel(item: ItemInventorySummaryDto): string {
    return this.isWeaponItem(item)
      ? this.translate.instant('inventoryDashboard.assetDetail.assets')
      : this.translate.instant('inventoryDashboard.lotDetail.lots');
  }

  getExpandedTitle(item: ItemInventorySummaryDto): string {
    return this.isWeaponItem(item)
      ? this.translate.instant('inventoryDashboard.assetDetail.title')
      : this.translate.instant('inventoryDashboard.lotDetail.title');
  }
}
