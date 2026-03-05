/**
 * Asset CRUD Service
 * Handles CRUD operations for ammunition, weapons, and explosives
 */

import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AmmunitionService } from '@services/ammunition.service';
import { WeaponService } from '@services/weapon.service';
import { ExplosiveService } from '@services/explosive.service';
import { FileUploadService } from '@services/file-upload.service';
import { FileEntityType } from '@models/file-upload.model';
import { AssetType } from '@models/asset-list.model';
import { APIOperationResponse } from '@models/api-response.model';
import { AmmunitionCreateDto } from '@models/ammunition.model';
import { CreateUpdateWeaponDto } from '@models/weapon.model';
import { CreateUpdateExplosiveDto } from '@models/explosive.model';

export type AssetEntityService = AmmunitionService | WeaponService | ExplosiveService;

export type AssetCreateUpdateDto = AmmunitionCreateDto | CreateUpdateWeaponDto | CreateUpdateExplosiveDto;

export interface EditImageResult {
  url: string;
  fileId: number;
}

@Injectable({
  providedIn: 'root'
})
export class AssetCrudService {
  private readonly ammunitionService = inject(AmmunitionService);
  private readonly weaponService = inject(WeaponService);
  private readonly explosiveService = inject(ExplosiveService);
  private readonly fileUploadService = inject(FileUploadService);

  /**
   * Get the appropriate entity service for the active tab
   */
  getAssetService(activeTab: AssetType): AssetEntityService {
    switch (activeTab) {
      case 'ammunition':
        return this.ammunitionService;
      case 'weapon':
        return this.weaponService;
      case 'explosive':
        return this.explosiveService;
      default:
        return this.ammunitionService;
    }
  }

  /**
   * Get FileEntityType for the active tab
   */
  getFileEntityType(activeTab: AssetType): FileEntityType {
    switch (activeTab) {
      case 'ammunition':
        return FileEntityType.Ammunition;
      case 'weapon':
        return FileEntityType.Weapon;
      case 'explosive':
        return FileEntityType.Explosive;
      default:
        return FileEntityType.Ammunition;
    }
  }

  /**
   * Load edit image for an entity. Returns blob URL and file ID, or null if no image.
   */
  loadEditImage(
    activeTab: AssetType,
    entityId: number
  ): Observable<EditImageResult | null> {
    const entityType = this.getFileEntityType(activeTab);
    const service = this.getAssetService(activeTab);

    return this.fileUploadService.getFilesByEntity(entityType, entityId).pipe(
      switchMap(files => {
        if (!files || files.length === 0) {
          return of(null);
        }
        const mainImages = files.filter(f => f.isMain);
        const latestImage = mainImages.length > 0
          ? mainImages.reduce((latest, current) =>
              (current.id > latest.id) ? current : latest
            )
          : files.reduce((latest, current) =>
              (current.id > latest.id) ? current : latest
            );

        if (!latestImage?.id) {
          return of(null);
        }

        return service.getFileBlob(latestImage.id).pipe(
          map(blob => {
            const url = URL.createObjectURL(blob);
            return { url, fileId: latestImage.id };
          })
        );
      })
    );
  }

  /**
   * Update an asset with optional image changes
   */
  updateAsset(
    id: number,
    activeTab: AssetType,
    dto: AssetCreateUpdateDto,
    imageFile: File | null,
    imageFileId: number | null,
    removeImageRequested: boolean
  ): Observable<APIOperationResponse<unknown>> {
    const service = this.getAssetService(activeTab);
    return service.update(id, dto).pipe(
      switchMap(res => {
        if (!res.succeeded) {
          return of(res);
        }
        if (imageFile) {
          return service.updateImage(id, imageFile, imageFileId).pipe(
            map(() => res)
          );
        }
        if (removeImageRequested && imageFileId) {
          return this.fileUploadService.deleteFile(imageFileId).pipe(
            map(() => res)
          );
        }
        return of(res);
      })
    );
  }

  /**
   * Soft delete an asset
   */
  deleteAsset(
    id: number,
    activeTab: AssetType
  ): Observable<APIOperationResponse<boolean>> {
    const service = this.getAssetService(activeTab);
    return service.delete(id);
  }

  /**
   * Permanently delete a soft-deleted asset
   */
  permanentDeleteAsset(
    id: number,
    activeTab: AssetType
  ): Observable<APIOperationResponse<boolean>> {
    const service = this.getAssetService(activeTab);
    return service.permanentDelete(id);
  }

  /**
   * Restore a soft-deleted asset
   */
  restoreAsset(
    id: number,
    activeTab: AssetType
  ): Observable<APIOperationResponse<boolean>> {
    const service = this.getAssetService(activeTab);
    return service.restore(id);
  }
}
