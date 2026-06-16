/**
 * Asset Table Component
 * Displays assets in table (desktop) and card (mobile) views
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { PERMISSIONS } from '@constants/permissions.constants';

import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Eye, Edit, Trash2, RotateCcw, ArrowUp, ArrowDown, ArrowUpDown, Link2 } from 'lucide-angular';
import { CardComponent } from '@components/card/card.component';
import { LoadingStateComponent } from '@components/loading-state/loading-state.component';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { Asset, AssetType, AssetSortState, AssetPaginationState } from '@models/asset-list.model';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-asset-table',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    CardComponent,
    LoadingStateComponent,
    PaginationComponent,
    RowsPerPageComponent,
    HasPermissionDirective
  ],
  templateUrl: './asset-table.component.html',
  styleUrls: ['./asset-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetTableComponent implements OnInit, OnDestroy {
  readonly PERMISSIONS = PERMISSIONS;

  private readonly destroy$ = new Subject<void>();

  @Input() assets: Asset[] = [];
  @Input() activeTab: AssetType = 'ammunition';
  @Input() loading = false;
  @Input() sortState!: AssetSortState;
  @Input() paginationState!: AssetPaginationState;
  @Input() totalPages = 1;
  @Input() totalItems = 0;
  @Input() ammunitionViewMode: 'available' | 'deleted' = 'available';
  @Input() explosivesViewMode: 'available' | 'deleted' = 'available';
  @Input() weaponsViewMode: 'available' | 'deleted' = 'available';
  @Input() accessoriesViewMode: 'available' | 'deleted' = 'available';
  /** When false, hides Edit and Delete action buttons (e.g. when viewing deleted ammunition) */
  @Input() showEditDelete = true;
  /** When true, shows Restore action button (e.g. when viewing deleted ammunition) */
  @Input() showRestore = false;
  /** When true, shows Permanent Delete action button (e.g. when viewing deleted ammunition) */
  @Input() showPermanentDelete = false;
  @Input() getAssetName!: (asset: Asset | AmmunitionReadDto | WeaponDto | ExplosiveDto | null) => string;

  @Output() view = new EventEmitter<string>();
  @Output() edit = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();
  @Output() restore = new EventEmitter<string>();
  @Output() permanentDelete = new EventEmitter<string>();
  @Output() sort = new EventEmitter<string>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() rowsPerPageChange = new EventEmitter<number>();
  @Output() ammunitionViewModeChange = new EventEmitter<'available' | 'deleted'>();
  @Output() explosivesViewModeChange = new EventEmitter<'available' | 'deleted'>();
  @Output() weaponsViewModeChange = new EventEmitter<'available' | 'deleted'>();
  @Output() accessoriesViewModeChange = new EventEmitter<'available' | 'deleted'>();
  @Output() linkAccessories = new EventEmitter<string>();

  constructor(
    private readonly translate: TranslateService,
    private readonly cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  readonly Eye = Eye;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;
  readonly RotateCcw = RotateCcw;
  readonly ArrowUp = ArrowUp;
  readonly ArrowDown = ArrowDown;
  readonly ArrowUpDown = ArrowUpDown;
  readonly Link2 = Link2;

  get editPermission(): string {
    switch (this.activeTab) {
      case 'weapon': return PERMISSIONS.ASSETS.WEAPON.EDIT;
      case 'explosive': return PERMISSIONS.ASSETS.EXPLOSIVE.EDIT;
      case 'accessory': return PERMISSIONS.ASSETS.ACCESSORY.EDIT;
      default: return PERMISSIONS.ASSETS.AMMUNITION.EDIT;
    }
  }

  get deletePermission(): string {
    switch (this.activeTab) {
      case 'weapon': return PERMISSIONS.ASSETS.WEAPON.DELETE;
      case 'explosive': return PERMISSIONS.ASSETS.EXPLOSIVE.DELETE;
      case 'accessory': return PERMISSIONS.ASSETS.ACCESSORY.DELETE;
      default: return PERMISSIONS.ASSETS.AMMUNITION.DELETE;
    }
  }

  get filteredAssets(): Asset[] {
    return this.assets;
  }

  get paginatedAssets(): Asset[] {
    return this.assets;
  }

  trackByAssetId(_index: number, asset: Asset): string {
    return asset.id;
  }

  /** Matches thead column count for empty-state row. HTML colspan must be an integer (not %). */
  get desktopTableColumnCount(): number {
    const base = 3; // itemNo, name, nsn
    const tail = 3; // minimumQuantity, criticalQuantity, actions
    switch (this.activeTab) {
      case 'ammunition':
        return base + 2 + tail; // caliber, primaryPurpose
      case 'weapon':
        return base + 3 + tail; // weaponType, primaryPurpose, caliber
      case 'explosive':
        return base + 3 + tail; // armNumber, primaryPurpose, unNumber
      case 'accessory':
        return 5; // image, itemNo, name, nameAr, actions
      default:
        return base + tail;
    }
  }

  formatQuantity(value: number | null | undefined): string {
    return value != null ? String(value) : '-';
  }

  onView(assetId: string): void {
    this.view.emit(assetId);
  }

  onEdit(assetId: string): void {
    this.edit.emit(assetId);
  }

  onDelete(assetId: string): void {
    this.delete.emit(assetId);
  }

  onRestore(assetId: string): void {
    this.restore.emit(assetId);
  }

  onPermanentDelete(assetId: string): void {
    this.permanentDelete.emit(assetId);
  }

  onSort(column: string): void {
    this.sort.emit(column);
  }

  onPageChange(page: number): void {
    this.pageChange.emit(page);
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPageChange.emit(rows);
  }

  onAmmunitionViewModeChange(mode: 'available' | 'deleted'): void {
    this.ammunitionViewModeChange.emit(mode);
  }

  onExplosivesViewModeChange(mode: 'available' | 'deleted'): void {
    this.explosivesViewModeChange.emit(mode);
  }

  onWeaponsViewModeChange(mode: 'available' | 'deleted'): void {
    this.weaponsViewModeChange.emit(mode);
  }

  onAccessoriesViewModeChange(mode: 'available' | 'deleted'): void {
    this.accessoriesViewModeChange.emit(mode);
  }

  onLinkAccessories(assetId: string): void {
    this.linkAccessories.emit(assetId);
  }
}
