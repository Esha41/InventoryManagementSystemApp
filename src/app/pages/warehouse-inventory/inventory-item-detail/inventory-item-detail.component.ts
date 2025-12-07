import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, ArrowLeft, ArrowRight } from 'lucide-angular';
import { InventoryService } from '@services/inventory.service';
import { LookupService } from '@services/lookup.service';
import { InventoryDetailDto } from '@models/inventory.model';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from '@services/translation.service';

type TabType = 'overview' | 'stock';

@Component({
  selector: 'app-inventory-item-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, TranslateModule, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './inventory-item-detail.component.html',
  styleUrls: ['./inventory-item-detail.component.css']
})
export class InventoryItemDetailComponent implements OnInit, OnDestroy {
  inventoryDetailId: number = 0;
  warehouseId: number = 0;
  inventoryDetail: InventoryDetailDto | null = null;
  activeTab: TabType = 'overview';
  loading = true;
  error: string | null = null;

  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  private destroy$ = new Subject<void>();

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private inventoryService: InventoryService,
    private lookupService: LookupService,
    private translateService: TranslateService,
    private translationService: TranslationService
  ) { }

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.warehouseId = parseInt(params['warehouseId'], 10);
      this.inventoryDetailId = parseInt(params['itemId'], 10);

      if (this.warehouseId && this.inventoryDetailId) {
        this.loadItemDetails();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadItemDetails(): void {
    this.loading = true;
    this.error = null;

    // Fetch all inventory details for the warehouse and find the specific item
    this.inventoryService.getWarehouseInventoryItems(this.warehouseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (details) => {
          this.inventoryDetail = details.find(d => d.id === this.inventoryDetailId) || null;

          if (!this.inventoryDetail) {
            this.translateService.get('warehouseInventory.itemNotFound').subscribe(text => {
              this.error = text;
            });
          }

          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading inventory item:', error);
          this.translateService.get('warehouseInventory.failedToLoadItem').subscribe(text => {
            this.error = text;
          });
          this.loading = false;
        }
      });
  }

  setActiveTab(tab: TabType): void {
    this.activeTab = tab;
  }

  onBack(): void {
    this.router.navigate(['/warehouse', this.warehouseId, 'inventory']);
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
   * Format date for display
   */
  formatDate(date?: Date | string): string {
    if (!date) return '-';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
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
      case 'New': return 'bg-green-50 text-green-700 border border-green-200';
      case 'Good': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'Used': return 'bg-gray-50 text-gray-700 border border-gray-200';
      default: return 'bg-gray-50 text-gray-700 border border-gray-200';
    }
  }
}
