import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { InventoryService } from '@inventory/services/inventory.service';
import { WarehouseInventoryFormatterService } from '../services/warehouse-inventory-formatter.service';
import { InventoryDetailDto, ItemType } from '@models/inventory.model';
import { WarehouseDetailLayoutComponent } from '@components/warehouse-detail-layout/warehouse-detail-layout.component';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslateService } from '@ngx-translate/core';
import { formatDateShort } from '@utils/format.utils';
import { FileUploadService } from '@services/file-upload.service';
import { FileUploadDto } from '@models/file-upload.model';

@Component({
  selector: 'app-inventory-item-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, TranslateModule, WarehouseDetailLayoutComponent],
  templateUrl: './inventory-item-detail.component.html',
  styleUrls: ['./inventory-item-detail.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryItemDetailComponent implements OnInit, OnDestroy {
  inventoryDetailId: number = 0;
  warehouseId: number = 0;
  inventoryDetail: InventoryDetailDto | null = null;
  loading = true;
  error: string | null = null;

  itemId: number = 0;

  imageUrl: string | null = null;
  private blobUrls: Set<string> = new Set();

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private inventoryService: InventoryService,
    private translateService: TranslateService,
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

  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

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

  get invoiceSectionVisible(): boolean {
    const d = this.inventoryDetail;
    if (!d) return false;
    const inv = (d.invoiceNumber ?? '').toString().trim();
    const contract = (d.contractNumber ?? '').toString().trim();
    return !!(inv || contract || !!d.invoiceDate || !!d.recievedDate);
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
          setTimeout(() => {
            try { window.URL.revokeObjectURL(objectUrl); } catch { /* ignore revoke errors */ }
            this.blobUrls.delete(objectUrl);
          }, 60_000);
        },
        error: () => {
          this.translateService.get(['common.failedToLoadFile', 'toast.error']).pipe(takeUntil(this.destroy$)).subscribe(t => {
            console.error(t['common.failedToLoadFile'] || 'Failed to open file');
          });
        }
      });
  }

  private loadItemDetails(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

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
            this.itemId = this.inventoryDetail.itemId;
            if (this.itemId) {
              this.loadImage(this.itemId);
            }

            const hasFiles = Array.isArray(this.inventoryDetail.files) && this.inventoryDetail.files.length > 0;
            if (!hasFiles && this.inventoryDetail.inventoryId) {
              this.inventoryService.getById(this.inventoryDetail.inventoryId)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: (inv) => {
                    const enriched = inv?.inventoryDetails?.find(d => d.id === this.inventoryDetailId) || null;
                    if (enriched) {
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

  onBack(): void {
    const qp = this.route.snapshot.queryParams;
    const queryParams: Record<string, string | number> = {};
    if (qp['tab']) queryParams['tab'] = qp['tab'];
    if (qp['page'] != null && qp['page'] !== '') queryParams['page'] = qp['page'];
    this.router.navigate(['/warehouse', this.warehouseId, 'inventory'], {
      queryParams: Object.keys(queryParams).length ? queryParams : {}
    });
  }

  onMapView(): void {
    this.router.navigate(['/warehouse', this.warehouseId, 'inventory', this.inventoryDetailId, 'map']);
  }

  getItemName(): string {
    const lang = getCurrentLang(this.translateService);
    const localized = getLocalizedName(this.inventoryDetail?.item, lang);
    return localized || this.inventoryDetail?.item?.itemNo || 'Unknown Item';
  }

  getItemNo(): string {
    return this.inventoryDetail?.item?.itemNo || '-';
  }

  getSupplierName(): string {
    return getLocalizedName(this.inventoryDetail?.supplier, getCurrentLang(this.translateService)) || '-';
  }

  getManufacturerName(): string {
    return getLocalizedName(this.inventoryDetail?.manufacturer, getCurrentLang(this.translateService)) || '-';
  }

  getCountryName(): string {
    return getLocalizedName(this.inventoryDetail?.country, getCurrentLang(this.translateService)) || '-';
  }

  getPrimaryPurposeLine(): string {
    if (!this.inventoryDetail) return '-';
    return this.warehouseInventoryFormatter.getPrimaryPurposeName(this.inventoryDetail);
  }

  formatDate(date?: Date | string): string {
    if (!date) return '-';
    const formatted = formatDateShort(date);
    return formatted === 'N/A' ? '-' : formatted;
  }

  formatNumber(num: number): string {
    return num.toLocaleString();
  }

  getBatchNoLabelTranslationKey(): string {
    const kind = this.getNormalizedItemKind();
    if (kind === 'ammunition' || kind === 'explosive') {
      return 'warehouseInventory.batchNoLabelAmmoExplosive';
    }
    return 'warehouseInventory.batchNo';
  }

  getItemTypeDisplay(): string {
    const kind = this.getNormalizedItemKind();
    if (kind === 'ammunition') {
      return this.translateService.instant('warehouseInventory.tabs.ammunition');
    }
    if (kind === 'weapon') {
      return this.translateService.instant('warehouseInventory.tabs.weapon');
    }
    return this.translateService.instant('warehouseInventory.tabs.explosive');
  }

  private getNormalizedItemKind(): 'ammunition' | 'weapon' | 'explosive' {
    if (!this.inventoryDetail?.item?.itemType) {
      return 'explosive';
    }
    return this.normalizeItemTypeKind(this.inventoryDetail.item.itemType as unknown) ?? 'explosive';
  }

  private normalizeItemTypeKind(raw: unknown): 'ammunition' | 'weapon' | 'explosive' | null {
    if (raw === null || raw === undefined) {
      return 'explosive';
    }
    if (typeof raw === 'string') {
      const lowerType = raw.toLowerCase();
      if (lowerType === 'ammunition') return 'ammunition';
      if (lowerType === 'weapon') return 'weapon';
      if (lowerType === 'explosive') return 'explosive';
      return null;
    }
    const numericValue = typeof raw === 'number' ? raw : Number(raw);
    if (numericValue === ItemType.Ammunition || numericValue === 1) return 'ammunition';
    if (numericValue === ItemType.Weapon || numericValue === 2) return 'weapon';
    if (numericValue === ItemType.Explosive || numericValue === 3) return 'explosive';
    return null;
  }

  private loadImage(_itemId: number): void {
    if (!this.inventoryDetail?.item?.itemType) return;

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
