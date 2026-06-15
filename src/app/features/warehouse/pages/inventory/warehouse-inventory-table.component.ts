import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Eye, Edit, Trash2, Download, Upload } from 'lucide-angular';
import { CardComponent } from '@components/card/card.component';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { trackById } from '@utils/trackby.utils';
import { InventoryDetailDto } from '@models/inventory.model';
import { AssetDto } from '@models/asset.model';
import { BatchSummaryDto, BatchAssetItemCountDto } from '@models/batch.model';
import {
  BatchTableComponent,
  BatchTableSortColumn
} from './components/batch-table/batch-table.component';
import {
  InventoryTableComponent,
  WarehouseInventoryTableSortColumn
} from './components/inventory-table/inventory-table.component';
import { defaultPageSize } from '@constants/app.constants';
import { AppNumberPipe } from '@shared/pipes/app-number.pipe';

@Component({
  selector: 'app-warehouse-inventory-table',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    LucideAngularModule,
    CardComponent,
    HasPermissionDirective,
    PaginationComponent,
    RowsPerPageComponent,
    BatchTableComponent,
    InventoryTableComponent,
    AppNumberPipe
  ],
  template: `
    <app-card *ngIf="!loading && !error" [shadow]="true">
      <div *ngIf="activeTab === 'batch'" class="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        <div
          *ngFor="let batch of paginatedBatches; trackBy: trackById"
          (click)="rowClick.emit(batch)"
          class="bg-[var(--color-background)] rounded-xl p-4 shadow-sm border border-[var(--color-border)] flex flex-col gap-3 hover:shadow-md transition-all cursor-pointer">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <h4 class="font-bold text-[var(--color-brand)] text-sm md:text-base">{{ batch.batchNumber }}</h4>
              <p class="text-xs text-[var(--color-text-muted)] mt-1">
                {{ 'warehouseInventory.quantity' | translate }}: {{ batch.quantity }}
              </p>
            </div>
            <div class="flex items-center justify-end gap-1 flex-shrink-0" (click)="$event.stopPropagation()">
              <button
                (click)="rowClick.emit(batch)"
                class="p-1.5 text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10 rounded-lg"
                [title]="'warehouseInventory.viewAssets' | translate">
                <lucide-angular [img]="Eye" class="h-4 w-4"></lucide-angular>
              </button>
              <button
                (click)="$event.stopPropagation(); editBatch.emit(batch)"
                class="p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 rounded-lg"
                [title]="'warehouseInventory.edit' | translate">
                <lucide-angular [img]="Edit" class="h-4 w-4"></lucide-angular>
              </button>
              <button
                (click)="deleteBatch.emit(batch)"
                class="p-1.5 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 rounded-lg"
                [title]="'common.delete' | translate">
                <lucide-angular [img]="Trash2" class="h-4 w-4"></lucide-angular>
              </button>
            </div>
          </div>

          <div *ngIf="expandedBatchId === batch.id" class="border-t border-[var(--color-border-muted)] pt-3 mt-2">
            <div *ngIf="loadingBatchAssets" class="py-4 text-center text-[var(--color-text-muted)] text-sm">
              {{ 'common.loading' | translate }}
            </div>
            <div *ngIf="!loadingBatchAssets" class="space-y-3">
              <div class="flex flex-wrap gap-2 justify-end" (click)="$event.stopPropagation()">
                <button
                  type="button"
                  *appHasPermission="batchAssetExcelExportPerms"
                  appPermissionMode="any"
                  (click)="exportBatchAssetsExcel.emit(batch)"
                  class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white bg-[var(--color-success)] hover:opacity-90 transition-colors">
                  <lucide-angular [img]="Download" class="h-3.5 w-3.5 shrink-0"></lucide-angular>
                  {{ 'warehouseInventory.exportBatchAssetsExcel' | translate }}
                </button>
                <button
                  type="button"
                  *appHasPermission="batchAssetExcelImportPerms"
                  appPermissionMode="any"
                  (click)="importBatchAssetsExcel.emit(batch)"
                  class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                  <lucide-angular [img]="Upload" class="h-3.5 w-3.5 shrink-0"></lucide-angular>
                  {{ 'warehouseInventory.importBatchAssetsExcel' | translate }}
                </button>
              </div>
              <div *ngIf="batchAssetsTotalCount === 0" class="py-2 text-[var(--color-text-muted)] text-sm">
                {{ 'editBatch.noAssets' | translate }}
              </div>
              <div
                *ngFor="let asset of expandedBatchAssets; trackBy: trackById"
                class="text-xs py-2 border-b border-[var(--color-border-muted)] last:border-0 space-y-1">
                <div class="font-medium text-[var(--color-text)]">{{ getAssetItemName(asset) }}</div>
                <div class="text-[var(--color-text-muted)] space-y-0.5 break-words">
                  <div>
                    <span class="font-medium text-[var(--color-text)]">{{ 'warehouseInventory.serialNumber' | translate }}:</span>
                    {{ asset.serialNumber || '-' }}
                  </div>
                  <div>
                    <span class="font-medium text-[var(--color-text)]">{{ 'warehouseInventory.rfidTag' | translate }}:</span>
                    {{ asset.rfid || '-' }}
                  </div>
                  <div>
                    <span class="font-medium text-[var(--color-text)]">{{ 'warehouseInventory.status' | translate }}:</span>
                    {{ getAssetStatusLabel(asset) }}
                  </div>
                  <div>
                    <span class="font-medium text-[var(--color-text)]">{{ 'warehouseInventory.purchaseDate' | translate }}:</span>
                    {{ formatDate(asset.purchaseDate) }}
                  </div>
                  <div>
                    <span class="font-medium text-[var(--color-text)]">{{ 'warehouseInventory.warrantyExpiry' | translate }}:</span>
                    {{ formatDate(asset.warrantyExpiryDate) }}
                  </div>
                  <div>
                    <span class="font-medium text-[var(--color-text)]">{{ 'warehouseInventory.purchasePrice' | translate }}:</span>
                    {{ formatAssetPurchasePrice(asset.purchasePrice) }}
                  </div>
                  <div>
                    <span class="font-medium text-[var(--color-text)]">{{ 'warehouseInventory.department' | translate }}:</span>
                    {{ getAssetDepartmentLabel(asset) }}
                  </div>
                  <div>
                    <span class="font-medium text-[var(--color-text)]">{{ 'warehouseInventory.assignee' | translate }}:</span>
                    {{ getAssetCustodianLabel(asset) }}
                  </div>
                  <div>
                    <span class="font-medium text-[var(--color-text)]">{{ 'assetDetails.supplier' | translate }}:</span>
                    {{ getAssetSupplierLabel(asset) }}
                  </div>
                  <div>
                    <span class="font-medium text-[var(--color-text)]">{{ 'assetDetails.manufacturer' | translate }}:</span>
                    {{ getAssetManufacturerLabel(asset) }}
                  </div>
                  <div>
                    <span class="font-medium text-[var(--color-text)]">{{ 'assetDetails.primaryPurpose' | translate }}:</span>
                    {{ getAssetPrimaryPurposeLabel(asset) }}
                  </div>
                  <div *ngIf="asset.notes" class="pt-1">
                    <span class="font-medium text-[var(--color-text)]">{{ 'warehouseInventory.assetNotes' | translate }}:</span>
                    {{ asset.notes }}
                  </div>
                </div>
              </div>
            </div>
            <div
              *ngIf="!loadingBatchAssets && batchAssetsTotalCount > 0"
              class="mt-3 border-t border-[var(--color-border)] bg-[var(--color-background-muted)] px-4 py-4 sm:px-6">
              <div class="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
                <div class="w-full md:w-auto flex justify-center md:justify-start">
                  <app-rows-per-page
                    [rowsPerPage]="batchAssetsPageSize"
                    [totalItems]="batchAssetsTotalCount"
                    [visibleItems]="expandedBatchAssets.length"
                    (rowsPerPageChange)="batchAssetsPageSizeChange.emit($event)">
                  </app-rows-per-page>
                </div>
                <div
                  *ngIf="batchAssetsTotalPages > 1"
                  class="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto justify-center md:justify-end">
                  <app-pagination
                    [currentPage]="batchAssetsPage"
                    [totalPages]="batchAssetsTotalPages"
                    (pageChange)="batchAssetsPageChange.emit($event)">
                  </app-pagination>
                  <span class="text-xs sm:text-sm text-[var(--color-text-muted)] whitespace-nowrap mt-2 sm:mt-0 text-center">
                    {{ batchAssetsPage }} {{ 'common.of' | translate }} {{ batchAssetsTotalPages }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="activeTab !== 'batch'" class="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        <div
          *ngFor="let item of paginatedItems; trackBy: trackById"
          class="bg-[var(--color-background)] rounded-xl p-4 shadow-sm border border-[var(--color-border)] flex flex-col gap-3 hover:shadow-md transition-all">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <span class="inline-flex px-2 py-0.5 rounded text-[10px] font-mono bg-gray-100 text-gray-600 border border-gray-200">
                {{ getItemNo(item) }}
              </span>
              <a
                *ngIf="getItemMasterRouterLink(item) as lm; else masterNameBtn"
                [routerLink]="lm.commands"
                [queryParams]="lm.queryParams"
                class="font-bold text-[var(--color-brand)] text-sm md:text-base mb-1 mt-1 break-words min-w-0 inline-block hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
                [attr.aria-label]="('warehouseInventory.viewCatalogItemDetails' | translate) + ': ' + getItemName(item)">
                {{ getItemName(item) }}
              </a>
              <ng-template #masterNameBtn>
                <button
                  type="button"
                  class="font-bold text-[var(--color-brand)] text-sm md:text-base mb-1 mt-1 break-words min-w-0 text-start hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
                  [attr.aria-label]="('warehouseInventory.viewCatalogItemDetails' | translate) + ': ' + getItemName(item)"
                  (click)="openItemMaster.emit(item)">
                  {{ getItemName(item) }}
                </button>
              </ng-template>
              <span class="inline-flex px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600 border border-gray-200 gap-1">
                <span class="font-semibold">{{ 'warehouseInventory.lot' | translate }}:</span>
                {{ item.lot }}
              </span>
            </div>
            <div class="flex items-center justify-end gap-1 flex-shrink-0">
              <button
                (click)="viewItem.emit(item)"
                class="p-1.5 text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10 rounded-lg">
                <lucide-angular [img]="Eye" class="h-4 w-4"></lucide-angular>
              </button>
              <button
                (click)="editItem.emit(item)"
                class="p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 rounded-lg">
                <lucide-angular [img]="Edit" class="h-4 w-4"></lucide-angular>
              </button>
              <button
                (click)="deleteItem.emit(item)"
                class="p-1.5 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 rounded-lg">
                <lucide-angular [img]="Trash2" class="h-4 w-4"></lucide-angular>
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 text-xs border-t border-[var(--color-border-muted)] pt-3">
            <div *ngIf="showPrimaryPurposeColumn" class="col-span-2">
              <span class="text-[var(--color-text-muted)] block mb-1 text-xs md:text-sm">
                {{ 'warehouseInventory.primaryPurpose' | translate }}
              </span>
              <span class="font-medium text-[var(--color-text)] text-sm md:text-base block truncate">
                {{ getPrimaryPurposeName(item) }}
              </span>
            </div>
            <div>
              <span class="text-[var(--color-text-muted)] block mb-1 text-xs md:text-sm">
                {{ 'addInventory.quantity' | translate }}
              </span>
              <span class="font-bold text-[var(--color-text)] text-sm md:text-base block truncate">
                {{ item.originalQuantity | appNumber }}
              </span>
            </div>
            <div>
              <span class="text-[var(--color-text-muted)] block mb-1 text-xs md:text-sm">
                {{ 'addInventory.expiryDate' | translate }}
              </span>
              <span
                class="font-bold text-[var(--color-text)] text-sm md:text-base block truncate"
                [class.text-red-600]="isItemExpired(item)">
                {{ formatDate(item.expiryDate) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="overflow-x-auto hidden lg:block">
        <app-batch-table
          *ngIf="activeTab === 'batch'"
          [batches]="paginatedBatches"
          [expandedBatchId]="expandedBatchId"
          [expandedBatchAssets]="expandedBatchAssets"
          [expandedBatchAssetItemCounts]="expandedBatchAssetItemCounts"
          [expandedBatchDetailItemId]="expandedBatchDetailItemId"
          [loadingBatchAssets]="loadingBatchAssets"
          [batchAssetsPage]="batchAssetsPage"
          [batchAssetsPageSize]="batchAssetsPageSize"
          [batchAssetsTotalPages]="batchAssetsTotalPages"
          [batchAssetsTotalCount]="batchAssetsTotalCount"
          [getAssetItemName]="getAssetItemName"
          [getAssetStatusLabel]="getAssetStatusLabel"
          [formatDate]="formatDate"
          [getAssetDepartmentLabel]="getAssetDepartmentLabel"
          [getAssetCustodianLabel]="getAssetCustodianLabel"
          [getAssetSupplierLabel]="getAssetSupplierLabel"
          [getAssetManufacturerLabel]="getAssetManufacturerLabel"
          [getAssetPrimaryPurposeLabel]="getAssetPrimaryPurposeLabel"
          [formatAssetPurchasePrice]="formatAssetPurchasePrice"
          [truncateAssetNotes]="truncateAssetNotes"
          [batchAssetExcelExportPerms]="batchAssetExcelExportPerms"
          [batchAssetExcelImportPerms]="batchAssetExcelImportPerms"
          [sortColumn]="batchSortColumn"
          [sortDirection]="batchSortDirection"
          (rowClick)="rowClick.emit($event)"
          (editBatch)="editBatch.emit($event)"
          (deleteBatch)="deleteBatch.emit($event)"
          (exportBatchAssetsExcel)="exportBatchAssetsExcel.emit($event)"
          (importBatchAssetsExcel)="importBatchAssetsExcel.emit($event)"
          (sortChange)="batchSortChange.emit($event)"
          (batchAssetsPageChange)="batchAssetsPageChange.emit($event)"
          (batchAssetsPageSizeChange)="batchAssetsPageSizeChange.emit($event)"
          (batchAssetsDetailItemChange)="batchAssetsDetailItemChange.emit($event)">
        </app-batch-table>

        <app-inventory-table
          *ngIf="activeTab !== 'batch'"
          [items]="paginatedItems"
          [isStaticItem]="isStaticItem"
          [getItemName]="getItemName"
          [getItemNo]="getItemNo"
          [getSupplierName]="getSupplierName"
          [getManufacturerName]="getManufacturerName"
          [showPrimaryPurposeColumn]="showPrimaryPurposeColumn"
          [getPrimaryPurposeName]="getPrimaryPurposeName"
          [formatDate]="formatDate"
          [getItemMasterRouterLink]="getItemMasterRouterLink"
          [sortColumn]="inventorySortColumn"
          [sortDirection]="inventorySortDirection"
          (editItem)="editItem.emit($event)"
          (deleteItem)="deleteItem.emit($event)"
          (viewItem)="viewItem.emit($event)"
          (openItemMaster)="openItemMaster.emit($event)"
          (sortChange)="inventorySortChange.emit($event)">
        </app-inventory-table>
      </div>
    </app-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WarehouseInventoryTableComponent {
  @Input() activeTab: 'ammunition' | 'explosive' | 'batch' = 'ammunition';
  @Input() loading = false;
  @Input() error: string | null = null;

  @Input() paginatedItems: InventoryDetailDto[] = [];
  @Input() paginatedBatches: BatchSummaryDto[] = [];

  @Input() expandedBatchId: number | null = null;
  @Input() expandedBatchAssets: AssetDto[] = [];
  @Input() expandedBatchAssetItemCounts: BatchAssetItemCountDto[] = [];
  @Input() expandedBatchDetailItemId: number | null = null;
  @Input() loadingBatchAssets = false;
  @Input() batchAssetsPage = 1;
  @Input() batchAssetsPageSize = defaultPageSize;
  @Input() batchAssetsTotalPages = 1;
  @Input() batchAssetsTotalCount = 0;

  @Input() batchAssetExcelExportPerms: string[] = [];
  @Input() batchAssetExcelImportPerms: string[] = [];

  @Input() showPrimaryPurposeColumn = false;

  @Input() inventorySortColumn: WarehouseInventoryTableSortColumn = 'itemName';
  @Input() inventorySortDirection: 'asc' | 'desc' = 'asc';
  @Input() batchSortColumn: BatchTableSortColumn = 'batchNumber';
  @Input() batchSortDirection: 'asc' | 'desc' = 'asc';

  @Input() isStaticItem: (detail: InventoryDetailDto) => boolean = () => false;
  @Input() isItemExpired: (detail: InventoryDetailDto) => boolean = () => false;
  @Input() getItemName: (detail: InventoryDetailDto) => string = () => '';
  @Input() getItemNo: (detail: InventoryDetailDto) => string = () => '';
  @Input() getSupplierName: (detail: InventoryDetailDto) => string = () => '';
  @Input() getManufacturerName: (detail: InventoryDetailDto) => string = () => '';
  @Input() getPrimaryPurposeName: (detail: InventoryDetailDto) => string = () => '';
  @Input() formatDate: (date?: Date | string) => string = () => '';
  @Input() getItemMasterRouterLink: (detail: InventoryDetailDto) => {
    commands: readonly (string | number)[];
    queryParams: Record<string, string>;
  } | null = () => null;

  @Input() getAssetItemName: (asset: AssetDto) => string = () => '';
  @Input() getAssetStatusLabel: (asset: AssetDto) => string = () => '';
  @Input() getAssetDepartmentLabel: (asset: AssetDto) => string = () => '';
  @Input() getAssetCustodianLabel: (asset: AssetDto) => string = () => '';
  @Input() getAssetSupplierLabel: (asset: AssetDto) => string = () => '';
  @Input() getAssetManufacturerLabel: (asset: AssetDto) => string = () => '';
  @Input() getAssetPrimaryPurposeLabel: (asset: AssetDto) => string = () => '';
  @Input() formatAssetPurchasePrice: (price?: number | null) => string = () => '';
  @Input() truncateAssetNotes: (asset: AssetDto) => string = () => '';

  @Output() rowClick = new EventEmitter<BatchSummaryDto>();
  @Output() editBatch = new EventEmitter<BatchSummaryDto>();
  @Output() deleteBatch = new EventEmitter<BatchSummaryDto>();
  @Output() exportBatchAssetsExcel = new EventEmitter<BatchSummaryDto>();
  @Output() importBatchAssetsExcel = new EventEmitter<BatchSummaryDto>();
  @Output() batchSortChange = new EventEmitter<BatchTableSortColumn>();
  @Output() batchAssetsPageChange = new EventEmitter<number>();
  @Output() batchAssetsPageSizeChange = new EventEmitter<number>();
  @Output() batchAssetsDetailItemChange = new EventEmitter<number | null>();

  @Output() editItem = new EventEmitter<InventoryDetailDto>();
  @Output() deleteItem = new EventEmitter<InventoryDetailDto>();
  @Output() viewItem = new EventEmitter<InventoryDetailDto>();
  @Output() openItemMaster = new EventEmitter<InventoryDetailDto>();
  @Output() inventorySortChange = new EventEmitter<WarehouseInventoryTableSortColumn>();

  readonly Eye = Eye;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;
  readonly Download = Download;
  readonly Upload = Upload;
  readonly trackById = trackById;
}
