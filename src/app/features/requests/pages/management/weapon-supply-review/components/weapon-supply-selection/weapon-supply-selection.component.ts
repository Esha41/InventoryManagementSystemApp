import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight, CheckCircle, AlertTriangle, Warehouse, Building2, Layers, Check, X, Package } from 'lucide-angular';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AssetSupplyService, BatchForOrderDepotDto, BatchItemDto } from '@requests/services/asset-supply.service';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { OrderService } from '@requests/services/order.service';
import { OrderDto } from '@models/order.model';
import { ToastService } from '@services/toast.service';
import { ConfigService } from '@services/config.service';
import { TranslationService } from '@services/translation.service';
import { WeaponSupplyLookupService } from '../../services/weapon-supply-lookup.service';
import { WeaponSupplyDisplayService } from '../../services/weapon-supply-display.service';
import { WeaponSupplySelectionService } from '../../services/weapon-supply-selection.service';
import { LoadingStateComponent } from '@components/loading-state/loading-state.component';

@Component({
  selector: 'app-weapon-supply-selection',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    LoadingStateComponent
  ],
  providers: [WeaponSupplyLookupService, WeaponSupplyDisplayService],
  templateUrl: './weapon-supply-selection.component.html',
  styleUrls: ['./weapon-supply-selection.component.css']
})
export class WeaponSupplySelectionComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly CheckCircle = CheckCircle;
  readonly AlertTriangle = AlertTriangle;
  readonly Warehouse = Warehouse;
  readonly Building2 = Building2;
  readonly Layers = Layers;
  readonly Check = Check;
  readonly X = X;
  readonly Package = Package;

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }
  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  orderId: number = 0;
  orderData: OrderDto | null = null;
  loading: boolean = true;

  selectedDepotIds: number[] = [];
  depotsConfirmed: boolean = false;
  batchOptions: BatchForOrderDepotDto[] = [];
  selectedBatchIds: number[] = [];
  /** Quantity per (batch, item). Key: batchId_itemId. Required for each item in selected batches. */
  itemQuantities: Map<string, number> = new Map();
  batchesConfirmed: boolean = false;
  loadingBatches: boolean = false;
  savingSelection: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private assetSupplyService: AssetSupplyService,
    private orderService: OrderService,
    private translationService: TranslationService,
    private toastService: ToastService,
    public translate: TranslateService,
    private config: ConfigService,
    public lookupService: WeaponSupplyLookupService,
    public displayService: WeaponSupplyDisplayService,
    private selectionService: WeaponSupplySelectionService,
    private cdr: ChangeDetectorRef
  ) { }

  get depotDropdownOptions() {
    return this.lookupService.depotDropdownOptions;
  }
  get loadingDepots(): boolean {
    return this.loading;
  }

  get requestItems() {
    return this.orderData?.requestItems || [];
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.params['id'];
    this.orderId = parseInt(idParam, 10);
    if (isNaN(this.orderId)) {
      this.toastService.error(
        this.translate.instant('weaponSupplyReview.invalidOrderId'),
        this.translate.instant('toast.error')
      );
      this.router.navigate(['/requests/requests-management']);
      return;
    }
    this.loadAllData();
    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.lookupService.refreshDepotOptionsOnLangChange();
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadAllData(): void {
    this.loading = true;
    forkJoin({
      order: this.orderService.getOrderById(this.orderId),
      depots: this.lookupService.loadDepots(),
      savedSelection: this.assetSupplyService.getWeaponSupplySelection(this.orderId).pipe(
        catchError(() => of([]))
      )
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ order, savedSelection }) => {
        this.orderData = order;
        this.loading = false;
        if (savedSelection && savedSelection.length > 0) {
          this.selectedDepotIds = [...new Set(savedSelection.map(s => s.depotId))];
          this.depotsConfirmed = true;
          const savedBatchIds = [...new Set(savedSelection.map(s => s.batchId))];
          const savedItemQuantities = new Map<string, number>();
          savedSelection.forEach(s => {
            savedItemQuantities.set(`${s.batchId}_${s.itemId}`, s.quantity);
          });
          this.loadBatchesWithSavedSelection(savedBatchIds, savedItemQuantities);
        }
      },
      error: (error) => {
        this.config.logError('Failed to load data', error);
        this.toastService.error(
          error?.error?.message || error?.message || this.translate.instant('weaponSupplyReview.failedToLoadOrderDetails'),
          this.translate.instant('toast.error')
        );
        this.loading = false;
        this.goBack();
      }
    });
  }

  toggleDepotSelection(depotId: number): void {
    const index = this.selectedDepotIds.indexOf(depotId);
    if (index > -1) {
      this.selectedDepotIds.splice(index, 1);
    } else {
      this.selectedDepotIds.push(depotId);
    }
    if (this.depotsConfirmed) this.resetDepotConfirmation();
  }

  confirmDepotSelection(): void {
    if (this.selectedDepotIds.length === 0) {
      this.toastService.warning(
        this.translate.instant('weaponSupplyReview.selectAtLeastOneDepot'),
        this.translate.instant('toast.warning')
      );
      return;
    }
    this.depotsConfirmed = true;
    this.loadBatches();
  }

  clearDepotSelection(): void {
    // Keep selected depots checked, but enable all to modify selection
    this.resetDepotConfirmation();
  }

  private resetDepotConfirmation(): void {
    this.depotsConfirmed = false;
    this.batchOptions = [];
    this.selectedBatchIds = [];
    this.itemQuantities.clear();
    this.batchesConfirmed = false;
  }

  private loadBatches(): void {
    this.loadBatchesWithSavedSelection([]);
  }

  private loadBatchesWithSavedSelection(savedBatchIds: number[], savedItemQuantities?: Map<string, number>): void {
    if (!this.orderId || this.selectedDepotIds.length === 0) return;
    this.loadingBatches = true;
    this.batchOptions = [];
    this.selectedBatchIds = [];
    this.itemQuantities.clear();
    this.batchesConfirmed = false;
    this.assetSupplyService.getBatchesForOrderDepots(this.orderId, this.selectedDepotIds)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (batches) => {
          this.batchOptions = batches ?? [];
          this.loadingBatches = false;
          if (savedBatchIds.length > 0) {
            const batchIdsFromOptions = new Set(this.batchOptions.map(b => b.id));
            this.selectedBatchIds = savedBatchIds.filter(id => batchIdsFromOptions.has(id));
            if (savedItemQuantities) {
              savedItemQuantities.forEach((qty, key) => {
                const [batchIdStr, itemIdStr] = key.split('_');
                const batchId = parseInt(batchIdStr, 10);
                const _itemId = parseInt(itemIdStr, 10);
                if (batchIdsFromOptions.has(batchId)) {
                  this.itemQuantities.set(key, qty);
                }
              });
            }
            this.batchesConfirmed = this.selectedBatchIds.length > 0;
          }
        },
        error: (error) => {
          this.config.logError('Failed to load batches', error);
          this.toastService.error(
            this.translate.instant('weaponSupplyReview.failedToLoadBatches'),
            this.translate.instant('toast.error')
          );
          this.loadingBatches = false;
        }
      });
  }

  toggleBatchSelection(batchId: number): void {
    const index = this.selectedBatchIds.indexOf(batchId);
    const batch = this.batchOptions.find(b => b.id === batchId);
    const items = batch?.items ?? [];

    if (index > -1) {
      this.selectedBatchIds.splice(index, 1);
      items.forEach(item => this.itemQuantities.delete(`${batchId}_${item.itemId}`));
    } else {
      this.selectedBatchIds.push(batchId);
      items.forEach(item => {
        const maxQty = this.getMaxQuantityForBatchItem(batchId, item);
        const initialQty = maxQty >= 1 ? Math.min(item.quantity, maxQty) : 0;
        this.itemQuantities.set(`${batchId}_${item.itemId}`, initialQty);
      });
    }
  }

  saveBatchSelection(): void {
    if (this.selectedBatchIds.length === 0) {
      this.toastService.warning(
        this.translate.instant('weaponSupplyReview.selectAtLeastOneBatch'),
        this.translate.instant('toast.warning')
      );
      return;
    }
    if (!this.validateItemQuantities()) return;

    const selections: { depotId: number; batchId: number; itemId: number; quantity: number }[] = [];
    for (const depotId of this.selectedDepotIds) {
      const selectedBatchesFromDepot = this.batchOptions.filter(
        b => b.depotId === depotId && this.selectedBatchIds.includes(b.id)
      );
      for (const batch of selectedBatchesFromDepot) {
        const items = batch.items ?? [];
        for (const item of items) {
          const qty = this.itemQuantities.get(`${batch.id}_${item.itemId}`);
          if (qty != null && qty > 0) {
            selections.push({ depotId, batchId: batch.id, itemId: item.itemId, quantity: qty });
          }
        }
      }
    }
    this.savingSelection = true;
    this.assetSupplyService.saveWeaponSupplySelection(this.orderId, selections)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.savingSelection = false;
          this.batchesConfirmed = true;
          this.toastService.success(
            this.translate.instant('weaponSupplyReview.selectionSaved'),
            this.translate.instant('toast.success')
          );
          this.router.navigate(['/requests/requests-management', this.orderId, 'workflow-approval']);
        },
        error: (error) => {
          this.config.logError('Failed to save batch selection', error);
          this.toastService.error(
            error?.error?.message || error?.message || this.translate.instant('weaponSupplyReview.failedToSaveSelection'),
            this.translate.instant('toast.error')
          );
          this.savingSelection = false;
        }
      });
  }

  onItemQuantityChange(batchId: number, item: BatchItemDto, value: string | number | null): void {
    const key = `${batchId}_${item.itemId}`;
    if (value === null || value === undefined || value === '') {
      this.itemQuantities.delete(key);
      this.cdr.markForCheck();
      return;
    }
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (isNaN(num) || num < 0) {
      this.itemQuantities.delete(key);
      this.cdr.markForCheck();
      return;
    }
    this.itemQuantities.set(key, num);
    this.cdr.markForCheck();
  }

  onItemQuantityBlur(batchId: number, item: BatchItemDto): void {
    const key = `${batchId}_${item.itemId}`;
    const val = this.itemQuantities.get(key);
    if (val == null) return;
    const maxQty = this.getMaxQuantityForBatchItem(batchId, item);
    if (val > maxQty) {
      const clamped = maxQty >= 1 ? maxQty : 0;
      if (clamped >= 1) {
        this.itemQuantities.set(key, clamped);
      } else {
        this.itemQuantities.delete(key);
      }
      this.cdr.markForCheck();
    }
  }

  /** Get requested quantity for an item from the order */
  private getRequestedQuantityForItem(itemId: number): number {
    const items = this.orderData?.requestItems ?? [];
    return items
      .filter((ri: { itemId?: number }) => ri.itemId === itemId)
      .reduce((sum: number, ri: { quantity?: number }) => sum + (ri.quantity ?? 0), 0);
  }

  getItemQuantity(batchId: number, itemId: number): number | null {
    return this.itemQuantities.get(`${batchId}_${itemId}`) ?? null;
  }

  /** Max quantity allowed for this batch+item (capped by batch available and order requested) */
  getMaxQuantityForBatchItem(batchId: number, item: BatchItemDto): number {
    const requestedQty = this.getRequestedQuantityForItem(item.itemId);
    const otherBatchesTotal = this.selectedBatchIds
      .filter((bid) => bid !== batchId)
      .reduce((sum, bid) => sum + (this.itemQuantities.get(`${bid}_${item.itemId}`) ?? 0), 0);
    return Math.min(item.quantity, Math.max(0, requestedQty - otherBatchesTotal));
  }

  isItemQuantityMissing(batchId: number, itemId: number): boolean {
    return this.selectedBatchIds.includes(batchId) && !this.itemQuantities.has(`${batchId}_${itemId}`);
  }

  /** True when the entered quantity exceeds the max allowed (requested - other batches, batch available) */
  isItemQuantityExceeded(batchId: number, item: BatchItemDto): boolean {
    const qty = this.itemQuantities.get(`${batchId}_${item.itemId}`);
    if (qty == null) return false;
    const maxQty = this.getMaxQuantityForBatchItem(batchId, item);
    return qty > maxQty;
  }

  private validateItemQuantities(): boolean {
    for (const batchId of this.selectedBatchIds) {
      const batch = this.batchOptions.find(b => b.id === batchId);
      const items = batch?.items ?? [];

      for (const item of items) {
        const qty = this.itemQuantities.get(`${batchId}_${item.itemId}`);

        if (qty == null) {
          this.toastService.warning(
            this.translate.instant('weaponSupplyReview.quantityRequired', {
              batchNumber: batch?.batchNumber ?? batchId,
              itemName: item.itemName ?? item.itemNo ?? item.itemId
            }),
            this.translate.instant('toast.warning')
          );
          return false;
        }
        if (qty < 0) {
          this.toastService.warning(
            this.translate.instant('weaponSupplyReview.quantityMustBePositive'),
            this.translate.instant('toast.warning')
          );
          return false;
        }
        if (qty > item.quantity) {
          this.toastService.warning(
            this.translate.instant('weaponSupplyReview.quantityExceedsAvailable', {
              batchNumber: batch?.batchNumber ?? batchId,
              itemName: item.itemName ?? item.itemNo ?? item.itemId,
              max: item.quantity
            }),
            this.translate.instant('toast.warning')
          );
          return false;
        }
      }
    }

    // Validate total quantity per item <= requested
    const requestedByItem = new Map<number, number>();
    (this.orderData?.requestItems ?? []).forEach((ri: { itemId?: number; quantity?: number }) => {
      if (ri.itemId != null) {
        requestedByItem.set(ri.itemId, (requestedByItem.get(ri.itemId) ?? 0) + (ri.quantity ?? 0));
      }
    });
    const selectedByItem = new Map<number, number>();
    for (const batchId of this.selectedBatchIds) {
      const batch = this.batchOptions.find(b => b.id === batchId);
      for (const item of batch?.items ?? []) {
        const qty = this.itemQuantities.get(`${batchId}_${item.itemId}`) ?? 0;
        selectedByItem.set(item.itemId, (selectedByItem.get(item.itemId) ?? 0) + qty);
      }
    }
    for (const [itemId, totalSelected] of selectedByItem) {
      const requested = requestedByItem.get(itemId) ?? 0;
      if (totalSelected > requested) {
        const itemName =
          this.orderData?.requestItems?.find((r: { itemId?: number }) => r.itemId === itemId)?.itemName ?? itemId;
        this.toastService.warning(
          this.translate.instant('weaponSupplyReview.quantityExceedsRequested', {
            itemName,
            total: totalSelected,
            max: requested
          }),
          this.translate.instant('toast.warning')
        );
        return false;
      }
    }
    return true;
  }

  clearBatchSelection(): void {
    this.selectedBatchIds = [];
    this.itemQuantities.clear();
    this.batchesConfirmed = false;
  }

  goBack(): void {
    this.router.navigate(['/requests/requests-management', this.orderId, 'workflow-approval']);
  }

  getDepartmentName(): string {
    return this.displayService.getDepartmentName(this.orderData);
  }
  getRequesterName(): string {
    return this.displayService.getRequesterName(this.orderData);
  }
  getCurrentLang(): string {
    return this.displayService.getCurrentLang();
  }

  hasBatchItems(batch: BatchForOrderDepotDto): boolean {
    return !!(batch.items && batch.items.length > 0);
  }

  /** Get localized depot name from batch (uses depot DTO when available for language-aware display) */
  getDepotDisplayName(batch: BatchForOrderDepotDto): string {
    const fallback = this.translate.instant('weaponSupplyReview.depot');
    if (batch.depot) {
      return getLocalizedName(batch.depot, getCurrentLang(this.translate)) || batch.depotName || fallback;
    }
    return batch.depotName || fallback;
  }
}
