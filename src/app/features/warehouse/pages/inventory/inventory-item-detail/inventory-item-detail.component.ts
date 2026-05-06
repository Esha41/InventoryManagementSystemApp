import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { InventoryService, LotDetailDto } from '@inventory/services/inventory.service';
import { WarehouseInventoryFormatterService } from '../services/warehouse-inventory-formatter.service';
import { LookupService } from '@services/lookup.service';
import { InventoryDetailDto, ItemType } from '@models/inventory.model';
import { AssetDetailsComponent } from '@assets/components/asset-details/asset-details.component';
import { WarehouseDetailLayoutComponent } from '@components/warehouse-detail-layout/warehouse-detail-layout.component';
import { TableClampTooltipDirective } from '@components/table-clamp-tooltip/table-clamp-tooltip.directive';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from '@services/translation.service';
import { formatDateShort } from '@utils/format.utils';
import { HttpClient } from '@angular/common/http';
import { trackByKey } from '@utils/trackby.utils';
import { FileUploadService } from '@services/file-upload.service';
import { FileUploadDto } from '@models/file-upload.model';

type TabType = 'overview' | 'stock';

@Component({
  selector: 'app-inventory-item-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, TranslateModule, AssetDetailsComponent, WarehouseDetailLayoutComponent, TableClampTooltipDirective],
  templateUrl: './inventory-item-detail.component.html',
  styleUrls: ['./inventory-item-detail.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryItemDetailComponent implements OnInit, OnDestroy {
  readonly trackByInventoryDetailId = trackByKey('inventoryDetailId');
  inventoryDetailId: number = 0;
  warehouseId: number = 0;
  inventoryDetail: InventoryDetailDto | null = null;
  activeTab: TabType = 'overview';
  loading = true;
  error: string | null = null;

  // Stock tab data
  lots: LotDetailDto[] = [];
  loadingLots = false;
  itemId: number = 0;

  // Image data
  imageUrl: string | null = null;
  private blobUrls: Set<string> = new Set();

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private inventoryService: InventoryService,
    private lookupService: LookupService,
    private translateService: TranslateService,
    private translationService: TranslationService,
    private http: HttpClient,
    private fileUploadService: FileUploadService,
    private cdr: ChangeDetectorRef,
    private warehouseInventoryFormatter: WarehouseInventoryFormatterService
  ) { }

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.warehouseId = parseInt(params['warehouseId'], 10);
      this.inventoryDetailId = parseInt(params['itemId'], 10);
      this.cdr.markForCheck();
      if (this.warehouseId && this.inventoryDetailId) {
        this.loadItemDetails();
      }
    });

    // Also check query params for tab (asset type) as fallback
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(queryParams => {
      const tabParam = queryParams['tab'];
      if (tabParam && (tabParam === 'ammunition' || tabParam === 'weapon' || tabParam === 'explosive')) {
        // Store tab for potential use if item.itemType is not available
        this.activeTab = queryParams['tab'] === 'ammunition' ? 'overview' : this.activeTab;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clean up blob URLs
    this.blobUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn('Error revoking blob URL:', e);
      }
    });
    this.blobUrls.clear();
  }

  get deliveryReceiptFiles(): FileUploadDto[] {
    return (this.inventoryDetail?.files ?? []) as FileUploadDto[];
  }

  openDeliveryReceiptFile(fileId: number): void {
    if (!fileId) return;
    this.fileUploadService.getFileBlob(fileId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob: Blob) => {
          const objectUrl = window.URL.createObjectURL(blob);
          this.blobUrls.add(objectUrl);
          window.open(objectUrl, '_blank', 'noopener');
          // Revoke after a minute; we also revoke all on destroy.
          setTimeout(() => {
            try { window.URL.revokeObjectURL(objectUrl); } catch { /* ignore revoke errors */ }
            this.blobUrls.delete(objectUrl);
          }, 60_000);
        },
        error: () => {
          this.translateService.get(['common.failedToLoadFile', 'toast.error']).pipe(takeUntil(this.destroy$)).subscribe(t => {
            // Reuse toast pattern? This component currently doesn't inject ToastService; keep it silent but log.
            console.error(t['common.failedToLoadFile'] || 'Failed to open file');
          });
        }
      });
  }

  private loadItemDetails(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    // Fetch all inventory details for the warehouse and find the specific item
    this.inventoryService.getWarehouseInventoryItems(this.warehouseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (details) => {
          this.inventoryDetail = details.find(d => d.id === this.inventoryDetailId) || null;

          if (!this.inventoryDetail) {
            this.translateService.get('warehouseInventory.itemNotFound').pipe(takeUntil(this.destroy$)).subscribe(text => {
              this.error = text;
              this.cdr.markForCheck();
            });
          } else {
            // Store itemId for loading lots
            this.itemId = this.inventoryDetail.itemId;
            // Load image for stock tab
            if (this.itemId) {
              this.loadImage(this.itemId);
            }

            // Some list endpoints may omit `files` for performance; if so, re-fetch the parent inventory by ID
            // and re-resolve this detail to ensure Delivery Receipt attachments are available.
            const hasFiles = Array.isArray(this.inventoryDetail.files) && this.inventoryDetail.files.length > 0;
            if (!hasFiles && this.inventoryDetail.inventoryId) {
              this.inventoryService.getById(this.inventoryDetail.inventoryId)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: (inv) => {
                    const enriched = inv?.inventoryDetails?.find(d => d.id === this.inventoryDetailId) || null;
                    if (enriched) {
                      // Replace with enriched detail so bindings (including `files`) are consistent with edit modal.
                      const normalizedFiles = Array.isArray(enriched.files) ? enriched.files : [];
                      this.inventoryDetail = {
                        ...this.inventoryDetail!,
                        ...enriched,
                        files: normalizedFiles
                      };
                      this.cdr.markForCheck();
                    }
                  },
                  error: () => { /* no-op: keep base detail */ }
                });
            }
            // Load lots if stock tab is active
            if (this.activeTab === 'stock') {
              this.loadLots();
            }
          }

          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.translateService.get('warehouseInventory.failedToLoadItem').pipe(takeUntil(this.destroy$)).subscribe(text => {
            this.error = text;
            this.cdr.markForCheck();
          });
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  setActiveTab(tab: TabType): void {
    this.activeTab = tab;
    // Load lots when switching to stock tab
    if (tab === 'stock' && this.itemId && this.lots.length === 0) {
      this.loadLots();
    }
  }

  /**
   * Load lot details for the current item
   */
  private loadLots(): void {
    if (!this.itemId) return;

    this.loadingLots = true;
    this.cdr.markForCheck();
    this.inventoryService.getLotsByItemId(this.itemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lots) => {
          this.lots = lots;
          this.loadingLots = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingLots = false;
          this.cdr.markForCheck();
        }
      });
  }

  onBack(): void {
    // Preserve tab query parameter when navigating back
    const tabParam = this.route.snapshot.queryParams['tab'];
    const queryParams = tabParam ? { tab: tabParam } : {};
    
    this.router.navigate(['/warehouse', this.warehouseId, 'inventory'], {
      queryParams
    });
  }

  onMapView(): void {
    this.router.navigate(['/warehouse', this.warehouseId, 'inventory', this.inventoryDetailId, 'map']);
  }

  /**
   * Get item name
   */
  getItemName(): string {
    const lang = getCurrentLang(this.translateService);
    const localized = getLocalizedName(this.inventoryDetail?.item, lang);
    return localized || this.inventoryDetail?.item?.itemNo || 'Unknown Item';
  }

  /**
   * Get item number / caliber
   */
  getItemNo(): string {
    return this.inventoryDetail?.item?.itemNo || '-';
  }

  /**
   * Get HCC name
   */
  getHccName(): string {
    return getLocalizedName(this.inventoryDetail?.item?.hcc, getCurrentLang(this.translateService)) || '-';
  }

  /**
   * Get supplier name
   */
  getSupplierName(): string {
    return getLocalizedName(this.inventoryDetail?.supplier, getCurrentLang(this.translateService)) || '-';
  }

  /**
   * Get manufacturer name
   */
  getManufacturerName(): string {
    return getLocalizedName(this.inventoryDetail?.manufacturer, getCurrentLang(this.translateService)) || '-';
  }

  /**
   * Get country name
   */
  getCountryName(): string {
    return getLocalizedName(this.inventoryDetail?.country, getCurrentLang(this.translateService)) || '-';
  }

  /**
   * Format date for display (delegates to shared dd/MM/yyyy helper)
   */
  formatDate(date?: Date | string): string {
    if (!date) return '-';
    const formatted = formatDateShort(date);
    return formatted === 'N/A' ? '-' : formatted;
  }

  /**
   * Format number with thousands separator
   */
  formatNumber(num: number): string {
    return num.toLocaleString();
  }

  /**
   * Calculate utilization percentage
   */
  getUtilizationPercentage(): number {
    if (!this.inventoryDetail) return 0;
    const total = this.inventoryDetail.originalQuantity;
    const current = this.inventoryDetail.currentQuantity;
    if (total === 0) return 0;
    return Math.round(((total - current) / total) * 100);
  }

  /**
   * Get stock status
   */
  getStockStatus(): string {
    const utilization = this.getUtilizationPercentage();
    if (utilization === 0) return this.translateService.instant('warehouseInventory.new');
    if (utilization < 50) return this.translateService.instant('warehouseInventory.good');
    return this.translateService.instant('warehouseInventory.used');
  }

  /**
   * Get stock status class
   */
  getStockStatusClass(): string {
    const status = this.getStockStatus();
    switch (status) {
      case 'New': return 'bg-[var(--color-success)]/20 text-[var(--color-success)] border-2 border-[var(--color-success)]/30';
      case 'Good': return 'bg-[var(--color-info)]/20 text-[var(--color-info)] border-2 border-[var(--color-info)]/30';
      case 'Used': return 'bg-[var(--color-background-active)] text-[var(--color-text)] border-2 border-[var(--color-border)]';
      default: return 'bg-[var(--color-background-active)] text-[var(--color-text)] border-2 border-[var(--color-border)]';
    }
  }

  /**
   * Calculate totals from lots, fallback to inventoryDetail if lots not loaded
   */
  getTotalQuantity(): number {
    if (this.lots.length > 0) {
      return this.lots.reduce((sum, lot) => sum + lot.originalQuantity, 0);
    }
    return this.inventoryDetail?.originalQuantity || 0;
  }

  getTotalUsedQuantity(): number {
    if (this.lots.length > 0) {
      return this.lots.reduce((sum, lot) => sum + lot.usedQuantity, 0);
    }
    return this.inventoryDetail?.usedQuantity || 0;
  }

  getTotalReservedQuantity(): number {
    if (this.lots.length > 0) {
      return this.lots.reduce((sum, lot) => sum + lot.reservedQuantityByOrdersOnProcessing, 0);
    }
    return this.inventoryDetail?.reservedQuantityByOrdersOnProcessing || 0;
  }

  getTotalRemainingQuantity(): number {
    if (this.lots.length > 0) {
      return this.lots.reduce((sum, lot) => sum + lot.remainingQuantity, 0);
    }
    return this.inventoryDetail?.remainingQuantity || 0;
  }

  /**
   * Get depot name for lot
   */
  getDepotName(lot: LotDetailDto): string {
    return lot.depot ? getLocalizedName(lot.depot, getCurrentLang(this.translateService)) || '-' : '-';
  }

  /**
   * Get supplier name for lot
   */
  getSupplierNameForLot(lot: LotDetailDto): string {
    return lot.supplier ? getLocalizedName(lot.supplier, getCurrentLang(this.translateService)) || '-' : '-';
  }

  /**
   * Get manufacturer name for lot
   */
  getManufacturerNameForLot(lot: LotDetailDto): string {
    return lot.manufacturer ? getLocalizedName(lot.manufacturer, getCurrentLang(this.translateService)) || '-' : '-';
  }

  /**
   * Get country name for lot
   */
  getCountryNameForLot(lot: LotDetailDto): string {
    return lot.country ? getLocalizedName(lot.country, getCurrentLang(this.translateService)) || '-' : '-';
  }

  /**
   * Primary purpose for this lot row (current detail row uses loaded inventory detail; other lots use API fields).
   */
  getPrimaryPurposeForLot(lot: LotDetailDto): string {
    if (this.inventoryDetail && lot.inventoryDetailId === this.inventoryDetail.id) {
      return this.warehouseInventoryFormatter.getPrimaryPurposeName(this.inventoryDetail);
    }
    const lang = getCurrentLang(this.translateService);
    if (lot.primaryPurpos) {
      return getLocalizedName(lot.primaryPurpos, lang) || '-';
    }
    const id = lot.primaryPurposId;
    if (id != null && lot.item?.primaryPurposes?.length) {
      const match = lot.item.primaryPurposes.find(p => p.id === id);
      if (match) {
        return getLocalizedName(match, lang) || '-';
      }
    }
    return '-';
  }

  /**
   * Get asset type from inventory detail item type or query param
   */
  getAssetType(): 'ammunition' | 'weapon' | 'explosive' | undefined {
    // First try to get from item.itemType
    if (this.inventoryDetail?.item?.itemType) {
      const itemType = this.inventoryDetail.item.itemType;
      if (itemType === ItemType.Ammunition) return 'ammunition';
      if (itemType === ItemType.Weapon) return 'weapon';
      if (itemType === ItemType.Explosive) return 'explosive';
    }
    
    // Fallback to query param if item is not populated
    const tabParam = this.route?.snapshot.queryParams['tab'];
    if (tabParam && (tabParam === 'ammunition' || tabParam === 'weapon' || tabParam === 'explosive')) {
      return tabParam as 'ammunition' | 'weapon' | 'explosive';
    }
    
    return undefined;
  }

  /**
   * Get item ID for asset details
   */
  getItemIdForAssetDetails(): number | undefined {
    return this.inventoryDetail?.itemId;
  }

  /**
   * Get item type display name
   */
  getItemTypeDisplay(): string {
    if (!this.inventoryDetail?.item?.itemType) {
      return this.translateService.instant('warehouseInventory.tabs.explosive');
    }

    // Backend may provide either numeric enum values or strings (e.g. "ammunition").
    // Cast to `unknown` so TypeScript allows runtime narrowing.
    const rawItemType = this.inventoryDetail.item.itemType as unknown;
    
    // Handle string values from backend
    if (typeof rawItemType === 'string') {
      const lowerType = rawItemType.toLowerCase();
      if (lowerType === 'ammunition') {
        return this.translateService.instant('warehouseInventory.tabs.ammunition');
      }
      if (lowerType === 'weapon') {
        return this.translateService.instant('warehouseInventory.tabs.weapon');
      }
      if (lowerType === 'explosive') {
        return this.translateService.instant('warehouseInventory.tabs.explosive');
      }
    }
    
    // Handle numeric/enum values
    const numericValue = typeof rawItemType === 'number' ? rawItemType : Number(rawItemType);
    if (numericValue === ItemType.Ammunition || numericValue === 1) {
      return this.translateService.instant('warehouseInventory.tabs.ammunition');
    }
    if (numericValue === ItemType.Weapon || numericValue === 2) {
      return this.translateService.instant('warehouseInventory.tabs.weapon');
    }
    if (numericValue === ItemType.Explosive || numericValue === 3) {
      return this.translateService.instant('warehouseInventory.tabs.explosive');
    }
    
    // Default fallback
    return this.translateService.instant('warehouseInventory.tabs.explosive');
  }

  /**
   * Load image for the item
   */
  private loadImage(_itemId: number): void {
    if (!this.inventoryDetail?.item?.itemType) return;

    // Clean up previous image URL
    if (this.imageUrl) {
      try {
        URL.revokeObjectURL(this.imageUrl);
        this.blobUrls.delete(this.imageUrl);
      } catch (e) {
        console.warn('Error revoking previous image blob URL:', e);
      }
    }
    this.imageUrl = null;
  }
}
