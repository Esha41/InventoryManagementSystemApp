import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';

import { AssetService } from '@services/asset.service';
import { ToastService } from '@services/toast.service';
import { AssetDto, AssetStatus, getAssetStatusLabel } from '@models/asset.model';
import { AssetDetailsComponent as SharedAssetDetailsComponent } from '@shared/components/asset-details/asset-details.component';
import { WarehouseDetailLayoutComponent } from '@shared/components/warehouse-detail-layout/warehouse-detail-layout.component';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { formatDateShort } from '@utils/format.utils';

type TabType = 'overview' | 'stock';

@Component({
  selector: 'app-warehouse-asset-details',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    SharedAssetDetailsComponent,
    WarehouseDetailLayoutComponent
  ],
  templateUrl: './asset-details.component.html',
  styleUrl: './asset-details.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetDetailsComponent implements OnInit, OnDestroy {
  asset: AssetDto | null = null;
  loading = true;
  error: string | null = null;
  warehouseId = 0;

  activeTab: TabType = 'overview';

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private assetService: AssetService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const assetId = Number(this.route.snapshot.paramMap.get('id'));
    this.warehouseId = Number(this.route.snapshot.paramMap.get('warehouseId'));

    if (assetId) {
      this.loadAssetDetails(assetId);
    } else {
      this.loading = false;
      this.error = 'Invalid asset ID';
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadAssetDetails(id: number): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.assetService.getById<AssetDto>(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (asset) => {
          this.asset = asset;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading asset:', error);
          this.error = this.translateService.instant('assetDetails.failedToLoad') || 'Failed to load asset details';
          this.translateService.get(['toast.error', 'assetDetails.failedToLoad']).subscribe(translations => {
            this.toastService.error(
              translations['assetDetails.failedToLoad'] || 'Failed to load asset details',
              translations['toast.error']
            );
          });
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  setActiveTab(tab: TabType): void {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  getItemName(): string {
    if (!this.asset?.item) return '-';
    const lang = getCurrentLang(this.translateService);
    return getLocalizedName(this.asset.item, lang) || this.asset.item.name || '-';
  }

  getStatusLabel(): string {
    return getAssetStatusLabel(this.asset?.status);
  }

  getStatusColorClass(): string {
    const status = this.asset?.status as AssetStatus | string | undefined;
    switch (status) {
      case AssetStatus.ReadyToIssue:
      case 'ReadyToIssue': return 'bg-[var(--color-success)]/20 text-[var(--color-success)]';
      case AssetStatus.InMaintenance:
      case 'InMaintenance':
      case AssetStatus.UnserviceableRepairable:
      case 'UnserviceableRepairable': return 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]';
      case AssetStatus.UnserviceableUnrepairable:
      case 'UnserviceableUnrepairable':
      case AssetStatus.AwaitingDisposal:
      case 'AwaitingDisposal':
      case AssetStatus.Disposed:
      case 'Disposed': return 'bg-[var(--color-error)]/20 text-[var(--color-error)]';
      default: return 'bg-[var(--color-background-active)] text-[var(--color-text)]';
    }
  }

  formatDate(date?: Date | string): string {
    if (!date) return '-';
    const formatted = formatDateShort(date);
    return formatted === 'N/A' ? '-' : formatted;
  }

  getDepotName(): string {
    if (!this.asset?.depot) return '-';
    const lang = getCurrentLang(this.translateService);
    return getLocalizedName(this.asset.depot, lang) || '-';
  }

  getItemIdForAssetDetails(): number | undefined {
    // Use item.id if populated, otherwise itemId (backend may not include item navigation)
    return this.asset?.item?.id ?? this.asset?.itemId;
  }

  onBack(): void {
    const tabParam = this.route.snapshot.queryParams['tab'];
    const queryParams = tabParam ? { tab: tabParam } : {};

    this.router.navigate(['/warehouse', this.warehouseId, 'inventory'], {
      queryParams
    });
  }

  onMapView(): void {
    this.router.navigate(['/warehouse', this.warehouseId, 'assets', this.asset?.id, 'map'], {
      queryParams: { from: 'assets' }
    });
  }
}
