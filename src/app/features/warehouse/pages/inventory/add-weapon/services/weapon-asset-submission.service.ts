import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Observable, firstValueFrom } from 'rxjs';
import { ToastService } from '@services/toast.service';
import { StorageService } from '@services/storage.service';
import { ConfigService } from '@services/config.service';
import { AssetService } from '@assets/services/asset.service';
import {
  CreateAssetDto,
  CreateBulkAssetsFromTemplateDto,
  type BulkCreateFromTemplateResultDto
} from '@models/asset.model';
import type { BulkFormValue } from '../utils/weapon-asset-dto.mapper';

/** Session key for bulk identifier flow (matches legacy add-weapon-asset). */
export const WEAPON_ASSET_BULK_SESSION_KEY = 'bulkAssetData';

@Injectable({ providedIn: 'root' })
export class WeaponAssetSubmissionService {
  constructor(
    private readonly assetService: AssetService,
    private readonly router: Router,
    private readonly translateService: TranslateService,
    private readonly toastService: ToastService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Single create (multipart). Legacy behavior submits only the first row DTO despite multi-row validation UI.
   */
  createWeaponAssetSingle(dto: CreateAssetDto, files: File[]): Observable<unknown> {
    return this.assetService.create(dto, files);
  }

  createWeaponAssetsBulkMultipart(
    dtos: CreateAssetDto[],
    files: File[]
  ): Observable<unknown> {
    return this.assetService.createBulk(dtos, files);
  }

  createWeaponAssetsBulkFromTemplate(
    dto: CreateBulkAssetsFromTemplateDto
  ): Observable<BulkCreateFromTemplateResultDto> {
    return this.assetService.createBulkFromTemplate(dto);
  }

  /**
   * Success toast plus delayed navigation — same timing as legacy (~500 ms).
   */
  async finalizeSuccessNavigation(warehouseId: number): Promise<void> {
    try {
      const translations = await firstValueFrom(
        this.translateService.get(['toast.success', 'addWeaponAsset.successMessage'])
      );
      const message =
        translations['addWeaponAsset.successMessage'] ||
        'Weapon assets created successfully!';
      const title = translations['toast.success'];
      this.toastService.success(message, title);
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      await this.router.navigate(['/warehouse', warehouseId, 'inventory'], {
        queryParams: { tab: 'weapon' },
        queryParamsHandling: 'merge'
      });
    } catch (err: unknown) {
      if (this.configService.isDebugMode) {
        this.configService.log('finalizeSuccessNavigation failed', err);
      }
    }
  }

  async showErrorToast(errorMsg: string): Promise<void> {
    const translations = await firstValueFrom(
      this.translateService.get(['toast.error'])
    );
    this.toastService.error(errorMsg, translations['toast.error']);
  }

  storeBulkAssetHandoff(warehouseId: number, bulkData: BulkFormValue): void {
    this.storageService.set(WEAPON_ASSET_BULK_SESSION_KEY, {
      warehouseId,
      itemId: bulkData.itemId,
      batchNumber: bulkData.batchNumber,
      quantity: bulkData.quantity,
      purchaseDate: bulkData.purchaseDate,
      warrantyExpiryDate: bulkData.warrantyExpiryDate,
      purchasePrice: bulkData.purchasePrice,
      notes: bulkData.notes,
      assignMode: bulkData.assignMode ?? 'none',
      assignToEmployeeId: bulkData.assignToEmployeeId ?? undefined,
      assignToDepartmentId: bulkData.assignToDepartmentId ?? undefined,
      assignmentNotes: bulkData.assignmentNotes ?? undefined,
      deliveryReceipt: bulkData.deliveryReceipt,
      supplierId: bulkData.supplierId ?? undefined,
      manufacturerId: bulkData.manufacturerId ?? undefined,
      primaryPurposId: bulkData.primaryPurposId ?? undefined
    });
  }

  navigateToBulkEntry(warehouseId: number): Promise<boolean> {
    return this.router.navigate([
      '/warehouse',
      warehouseId,
      'assets',
      'add',
      'bulk-entry'
    ]);
  }

  /**
   * Persists bulk form for bulk-entry page then navigates (legacy behavior).
   */
  async goToBulkIdentifierEntry(warehouseId: number, bulk: BulkFormValue): Promise<boolean> {
    this.storeBulkAssetHandoff(warehouseId, bulk);
    return this.navigateToBulkEntry(warehouseId);
  }

  navigateBackToWarehouseInventory(warehouseId: number): Promise<boolean> {
    return this.router.navigate(['/warehouse', warehouseId, 'inventory'], {
      queryParams: { tab: 'weapon' },
      queryParamsHandling: 'merge'
    });
  }
}
