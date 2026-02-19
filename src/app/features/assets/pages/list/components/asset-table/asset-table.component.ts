/**
 * Asset Table Component
 * Displays assets in table (desktop) and card (mobile) views
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Eye, Edit, Trash2, RotateCcw, ArrowUp, ArrowDown, ArrowUpDown, Image } from 'lucide-angular';
import { CardComponent } from '@components/card/card.component';
import { LoadingStateComponent } from '@components/loading-state/loading-state.component';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { ImagePreviewTooltipComponent } from '@components/image-preview-tooltip/image-preview-tooltip.component';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { Asset, AssetType, AssetSortState, AssetPaginationState } from '@models/asset-list.model';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';

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
    ImagePreviewTooltipComponent,
    HasPermissionDirective
  ],
  templateUrl: './asset-table.component.html',
  styleUrls: ['./asset-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetTableComponent {
  @Input() assets: Asset[] = [];
  @Input() activeTab: AssetType = 'ammunition';
  @Input() loading = false;
  @Input() sortState!: AssetSortState;
  @Input() paginationState!: AssetPaginationState;
  @Input() totalPages = 1;
  @Input() totalItems = 0;
  @Input() isRTL = false;
  @Input() ammunitionViewMode: 'available' | 'deleted' = 'available';
  @Input() explosivesViewMode: 'available' | 'deleted' = 'available';
  @Input() weaponsViewMode: 'available' | 'deleted' = 'available';
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
  @Output() imageError = new EventEmitter<Asset>();
  @Output() showImagePreview = new EventEmitter<{ event: MouseEvent; asset: Asset }>();
  @Output() hideImagePreview = new EventEmitter<void>();
  @Output() ammunitionViewModeChange = new EventEmitter<'available' | 'deleted'>();
  @Output() explosivesViewModeChange = new EventEmitter<'available' | 'deleted'>();
  @Output() weaponsViewModeChange = new EventEmitter<'available' | 'deleted'>();

  @ViewChild(ImagePreviewTooltipComponent) imagePreviewTooltip!: ImagePreviewTooltipComponent;

  readonly Eye = Eye;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;
  readonly RotateCcw = RotateCcw;
  readonly ArrowUp = ArrowUp;
  readonly ArrowDown = ArrowDown;
  readonly ArrowUpDown = ArrowUpDown;
  readonly Image = Image;

  get filteredAssets(): Asset[] {
    return this.assets;
  }

  get paginatedAssets(): Asset[] {
    return this.assets;
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

  onImageError(asset: Asset): void {
    this.imageError.emit(asset);
  }

  onShowImagePreview(event: MouseEvent, asset: Asset): void {
    this.showImagePreview.emit({ event, asset });
  }

  onHideImagePreview(): void {
    this.hideImagePreview.emit();
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
}
