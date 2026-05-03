import { Injectable } from '@angular/core';
import { Observable, timer, switchMap, of } from 'rxjs';
import { take } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InventoryService } from '@inventory/services/inventory.service';
import { AssetService } from '@assets/services/asset.service';
import { InventoryDetailDto, UpdateInventoryDetailDto, UpdateInventoryDto, InventoryDto } from '@models/inventory.model';
import { AssetDto } from '@models/asset.model';
import { ToastService } from '@services/toast.service';
import { TranslateService } from '@ngx-translate/core';
import { ErrorHandler } from '@utils/error-handler.utils';
import { WarehouseInventoryStore } from '../../../services/warehouse-inventory.store';

export interface EditInventoryDetailResult {
  success: boolean;
  updatedInventory?: InventoryDto;
  error?: string;
}

export interface DeleteInventoryDetailResult {
  success: boolean;
  error?: string;
}

export interface EditAssetResult {
  success: boolean;
  updatedAsset?: AssetDto;
  error?: string;
}

export interface DeleteAssetResult {
  success: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WarehouseInventoryCrudService {

  constructor(
    private inventoryService: InventoryService,
    private assetService: AssetService,
    private toastService: ToastService,
    private translateService: TranslateService
  ) { }

  /**
   * Edit inventory detail
   * Returns an observable that emits the result after updating and reloading data
   */
  editInventoryDetail(
    detail: InventoryDetailDto,
    inventory: InventoryDto,
    updateDetailDto: UpdateInventoryDetailDto,
    updateInventoryDto?: UpdateInventoryDto,
    files?: File[],
    removedFileIds?: number[]
  ): Observable<EditInventoryDetailResult> {
    // Update the inventory with modified detail and invoice information
    const finalUpdateInventoryDto: UpdateInventoryDto = updateInventoryDto || {
      depoId: inventory.depoId,
      invoiceNumber: inventory.invoiceNumber,
      invoiceDate: inventory.invoiceDate,
      recievedDate: inventory.recievedDate,
      notes: inventory.notes,
      inventoryDetails: []
    };

    // Map all inventory details, updating the one being edited
    finalUpdateInventoryDto.inventoryDetails = (inventory.inventoryDetails || []).map((d: InventoryDetailDto) =>
      d.id === detail.id ? updateDetailDto : {
        id: d.id,
        itemId: d.itemId,
        lot: d.lot,
        supplierId: d.supplierId,
        manufacturerId: d.manufacturerId,
        countryId: d.countryId,
        originalQuantity: d.originalQuantity,
        batchNo: d.batchNo,
        expiryDate: d.expiryDate,
        readyForIssue: d.readyForIssue ?? true,
        primaryPurposId: d.primaryPurposId
      }
    );

    // Pass removed file ids to backend (deleted during Inventory update)
    finalUpdateInventoryDto.removedFileIds = removedFileIds && removedFileIds.length ? removedFileIds : undefined;

    const filesItemId = detail.itemId;
    return this.inventoryService.update(inventory.id, finalUpdateInventoryDto, files, filesItemId)
      .pipe(
        switchMap((_updatedInventory: InventoryDto) => {
          // Show success message
          this.showSuccessToastKeys('toast.inventoryUpdated', 'toast.success');

          // Wait a bit to ensure backend transaction is committed, then reload fresh data
          return timer(500).pipe(
            switchMap(() => {
              return this.inventoryService.getById(inventory.id);
            })
          );
        })
      )
      .pipe(
        switchMap((reloadedInventory: InventoryDto | null) => {
          if (reloadedInventory) {
            return of({
              success: true,
              updatedInventory: reloadedInventory
            } as EditInventoryDetailResult);
          }
          return of({
            success: false,
            error: 'Failed to reload inventory'
          } as EditInventoryDetailResult);
        })
      );
  }

  /**
   * Delete inventory detail
   * Handles both deleting a single detail and deleting the entire inventory if it's the last item
   */
  deleteInventoryDetail(detail: InventoryDetailDto): Observable<DeleteInventoryDetailResult> {
    return this.inventoryService.getById(detail.inventoryId)
      .pipe(
        switchMap((inventory) => {
          if (!inventory) {
            this.showErrorToastKeys('toast.inventoryNotFound', 'toast.error');
            return of({
              success: false,
              error: 'Inventory not found'
            } as DeleteInventoryDetailResult);
          }

          // Filter out the detail to delete
          const remainingDetails = inventory.inventoryDetails?.filter(d => d.id !== detail.id) || [];

          if (remainingDetails.length === 0) {
            // If no details left, delete the entire inventory
            return this.inventoryService.delete(inventory.id)
              .pipe(
                switchMap(() => {
                  this.showSuccessToastKeys('toast.inventoryDeleted', 'toast.success');
                  return of({
                    success: true
                  } as DeleteInventoryDetailResult);
                })
              );
          } else {
            // Update inventory without this detail
            const updateDto: UpdateInventoryDto = {
              depoId: inventory.depoId,
              invoiceNumber: inventory.invoiceNumber || undefined,
              invoiceDate: inventory.invoiceDate,
              recievedDate: inventory.recievedDate,
              notes: inventory.notes,
              inventoryDetails: remainingDetails.map(d => ({
                id: d.id,
                itemId: d.itemId,
                lot: d.lot,
                supplierId: d.supplierId,
                manufacturerId: d.manufacturerId,
                countryId: d.countryId,
                originalQuantity: d.originalQuantity,
                batchNo: d.batchNo,
                expiryDate: d.expiryDate,
                readyForIssue: d.readyForIssue ?? true,
                primaryPurposId: d.primaryPurposId
              }))
            };

            return this.inventoryService.update(inventory.id, updateDto)
              .pipe(
                switchMap(() => {
                  this.showSuccessToastKeys('toast.inventoryItemDeleted', 'toast.success');
                  return of({
                    success: true
                  } as DeleteInventoryDetailResult);
                })
              );
          }
        })
      );
  }

  /**
   * Load asset for editing
   */
  loadAssetForEdit(assetId: number): Observable<AssetDto | null> {
    return this.assetService.getById<AssetDto>(assetId);
  }

  /**
   * Delete asset
   */
  deleteAsset(assetId: number): Observable<DeleteAssetResult> {
    return this.assetService.delete(assetId)
      .pipe(
        switchMap(() => {
          this.showSuccessToastKeysWithFallback(
            'warehouseInventory.assetDeleted',
            'toast.success',
            'Asset deleted successfully'
          );
          return of({
            success: true
          } as DeleteAssetResult);
        })
      );
  }

  
  editInventoryDetailFlow(
    detail: InventoryDetailDto,
    inventory: InventoryDto,
    updateDetailDto: UpdateInventoryDetailDto,
    updateInventoryDto: UpdateInventoryDto | undefined,
    files: File[] | undefined,
    removedFileIds: number[] | undefined,
    store: WarehouseInventoryStore,
    onRefresh: () => void
  ): void {
    this.editInventoryDetail(detail, inventory, updateDetailDto, updateInventoryDto, files, removedFileIds)
      .pipe(takeUntilDestroyed(store.destroyRef))
      .subscribe({
        next: res => {
          if (res.success && res.updatedInventory) {
            onRefresh();
          } else {
            this.showToastFromKeys('toast.failedToUpdate', res.error);
          }
        },
        error: err => this.showToastFromKeys('toast.failedToUpdate', undefined, err)
      });
  }

  deleteInventoryDetailFlow(
    detail: InventoryDetailDto,
    store: WarehouseInventoryStore,
    onRefresh: () => void
  ): void {
    this.deleteInventoryDetail(detail)
      .pipe(takeUntilDestroyed(store.destroyRef))
      .subscribe({
        next: res => {
          if (res.success) {
            onRefresh();
          } else {
            this.showToastFromKeys('toast.failedToDelete', res.error);
          }
        },
        error: err => this.showToastFromKeys('toast.failedToDelete', undefined, err)
      });
  }

  loadAssetForEditFlow(asset: AssetDto, store: WarehouseInventoryStore): void {
    store.setLoadingAsset(true);
    store.setSelectedAsset(asset);
    this.loadAssetForEdit(asset.id)
      .pipe(takeUntilDestroyed(store.destroyRef))
      .subscribe({
        next: updated => {
          store.setSelectedAsset(updated || null);
          store.setLoadingAsset(false);
          store.setEditAssetModalOpen(true);
        },
        error: () => {
          store.setLoadingAsset(false);
        }
      });
  }

  deleteAssetFlow(assetId: number, store: WarehouseInventoryStore, onRefresh: () => void): void {
    this.deleteAsset(assetId)
      .pipe(takeUntilDestroyed(store.destroyRef))
      .subscribe({
        next: res => res.success ? onRefresh() : this.showDeleteAssetError(res.error),
        error: () => this.showDeleteAssetError()
      });
  }

  private showDeleteAssetError(error?: string): void {
    this.translateService
      .get(['toast.error', 'warehouseInventory.failedToDeleteAsset'])
      .pipe(take(1))
      .subscribe(t => {
        this.toastService.error(
          error || t['warehouseInventory.failedToDeleteAsset'] || 'Failed to delete asset',
          t['toast.error']
        );
      });
  }

  private showToastFromKeys(messageKey: string, overrideMessage?: string, error?: unknown): void {
    this.translateService
      .get([messageKey, 'toast.error'])
      .pipe(take(1))
      .subscribe(t => {
        const msg = overrideMessage
          || (error !== undefined
            ? ErrorHandler.extractAndTranslateErrorMessage(error, t[messageKey], this.translateService)
            : t[messageKey]);
        this.toastService.error(msg, t['toast.error']);
      });
  }

  private showSuccessToastKeys(messageKey: string, titleKey: string): void {
    this.translateService
      .get([messageKey, titleKey])
      .pipe(take(1))
      .subscribe(translations => {
        this.toastService.success(translations[messageKey], translations[titleKey]);
      });
  }

  private showErrorToastKeys(messageKey: string, titleKey: string): void {
    this.translateService
      .get([messageKey, titleKey])
      .pipe(take(1))
      .subscribe(translations => {
        this.toastService.error(translations[messageKey], translations[titleKey]);
      });
  }

  private showSuccessToastKeysWithFallback(messageKey: string, titleKey: string, fallbackBody: string): void {
    this.translateService
      .get([messageKey, titleKey])
      .pipe(take(1))
      .subscribe(translations => {
        this.toastService.success(translations[messageKey] || fallbackBody, translations[titleKey]);
      });
  }

  private showErrorToast(error: unknown, defaultMsg: string): void {
    const msg = ErrorHandler.extractAndTranslateErrorMessage(error, defaultMsg, this.translateService);
    this.translateService
      .get('toast.error')
      .pipe(take(1))
      .subscribe(translations => {
        this.toastService.error(msg, translations['toast.error']);
      });
  }
}

