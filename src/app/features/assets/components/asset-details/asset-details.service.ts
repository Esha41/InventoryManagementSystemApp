import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, switchMap, of } from 'rxjs';
import { ConfigService } from '@services/config.service';
import { AmmunitionService } from '@assets/services/ammunition.service';
import { WeaponService } from '@assets/services/weapon.service';
import { ExplosiveService } from '@assets/services/explosive.service';
import { AccessoryService } from '@assets/services/accessory.service';
import { FileUploadService, FileEntityType } from '@services/file-upload.service';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';
import { AccessoryDto } from '@models/accessory.model';
import { AssetDetailsData } from './asset-details.component';
import { isAccessory, isAmmunition, isExplosive, isWeapon } from '@utils/asset-property.utils';

/**
 * Service for asset details business logic
 * Following Angular 21 best practices: inject() for DI
 */
@Injectable()
export class AssetDetailsService {
  private readonly ammunitionService = inject(AmmunitionService);
  private readonly weaponService = inject(WeaponService);
  private readonly explosiveService = inject(ExplosiveService);
  private readonly accessoryService = inject(AccessoryService);
  private readonly fileUploadService = inject(FileUploadService);
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);

  /**
   * Load asset by ID and type
   * If type is not provided or the specified type fails, tries all three types in sequence
   * includeDeleted: when true, includes soft-deleted ammunition (for viewing from deleted list)
   */
  loadAsset(
    assetId: number,
    assetType?: 'ammunition' | 'weapon' | 'explosive' | 'accessory',
    includeDeleted = false
  ): Observable<AssetDetailsData> {
    // If assetType is provided, try that specific type first
    if (assetType) {
      return this.loadAssetByType(assetId, assetType, includeDeleted);
    } else {
      // If assetType is not provided, try all three types in sequence
      return this.tryLoadAssetFromAllTypes(assetId);
    }
  }

  /**
   * Load asset by specific type, with fallback to all types if it fails
   * includeDeleted: when true, includes soft-deleted ammunition
   */
  private loadAssetByType(
    assetId: number,
    assetType: 'ammunition' | 'weapon' | 'explosive' | 'accessory',
    includeDeleted = false
  ): Observable<AssetDetailsData> {
    let service$: Observable<AmmunitionReadDto | WeaponDto | ExplosiveDto | AccessoryDto>;

    if (assetType === 'weapon') {
      service$ = this.weaponService.getById<WeaponDto>(assetId, includeDeleted);
    } else if (assetType === 'explosive') {
      service$ = this.explosiveService.getById<ExplosiveDto>(assetId, includeDeleted);
    } else if (assetType === 'accessory') {
      service$ = this.accessoryService.getById<AccessoryDto>(assetId, includeDeleted);
    } else {
      service$ = this.ammunitionService.getById<AmmunitionReadDto>(assetId, includeDeleted);
    }

    return service$.pipe(
      catchError(() => {
        // If the specified type fails, try all types as fallback
        return this.tryLoadAssetFromAllTypes(assetId);
      })
    );
  }

  /**
   * Try loading asset from all three types in sequence: ammunition -> weapon -> explosive
   */
  private tryLoadAssetFromAllTypes(assetId: number): Observable<AssetDetailsData> {
    // Try ammunition first, then weapon, then explosive
    return this.ammunitionService.getById<AmmunitionReadDto>(assetId).pipe(
      catchError(() => {
        // If ammunition fails, try weapon
        return this.weaponService.getById<WeaponDto>(assetId).pipe(
          catchError(() => {
            // If weapon fails, try explosive
            return this.explosiveService.getById<ExplosiveDto>(assetId).pipe(
              catchError(() => {
                return this.accessoryService.getById<AccessoryDto>(assetId).pipe(
                  catchError((_err) => {
                    throw new Error('Failed to load asset details: asset not found');
                  })
                );
              })
            );
          })
        );
      })
    );
  }

  /**
   * Determine asset type from asset data
   */
  detectAssetType(asset: AssetDetailsData): 'ammunition' | 'weapon' | 'explosive' | 'accessory' | null {
    if (!asset) {
      return null;
    }
    if (isExplosive(asset)) {
      return 'explosive';
    }
    if (isAmmunition(asset)) {
      return 'ammunition';
    }
    if (isWeapon(asset)) {
      return 'weapon';
    }
    if (isAccessory(asset)) {
      return 'accessory';
    }
    return null;
  }

  /**
   * Get file entity type from asset type
   */
  getFileEntityType(assetType: 'ammunition' | 'weapon' | 'explosive' | 'accessory'): FileEntityType {
    switch (assetType) {
      case 'weapon':
        return FileEntityType.Weapon;
      case 'explosive':
        return FileEntityType.Explosive;
      case 'accessory':
        return FileEntityType.Accessory;
      default:
        return FileEntityType.Ammunition;
    }
  }

  /**
   * Load asset image as blob URL
   */
  loadAssetImage(
    assetId: number,
    assetType: 'ammunition' | 'weapon' | 'explosive' | 'accessory'
  ): Observable<string | null> {
    if (assetType === 'accessory') {
      return this.accessoryService.getImageBlob(assetId).pipe(
        switchMap((blob: Blob) => {
          if (blob.size > 0 && (blob.type.startsWith('image/') || blob.type === 'application/octet-stream' || !blob.type)) {
            return of(URL.createObjectURL(blob));
          }
          this.configService.logWarning('Accessory image rejected due to invalid type or empty size');
          return of(null);
        }),
        catchError((err) => {
          this.configService.logWarning('Failed to load accessory image blob', err);
          return of(null);
        })
      );
    }

    const entityType = this.getFileEntityType(assetType);

    return this.fileUploadService.getFilesByEntity(entityType, assetId).pipe(
      switchMap((files: unknown[]) => {
        if (!files || files.length === 0) {
          return of(null);
        }

        // Get main images (there might be multiple with isMain: true)
        const fileList = files as Array<{ id?: number; isMain?: boolean }>;
        const mainImages = fileList.filter((img) => img.isMain);
        let latestImage: { id?: number } | undefined;

        if (mainImages.length > 0) {
          latestImage = mainImages.reduce((latest, current) =>
            (current.id ?? 0) > (latest.id ?? 0) ? current : latest
          );
        } else {
          latestImage = fileList.reduce((latest, current) =>
            (current.id ?? 0) > (latest.id ?? 0) ? current : latest
          );
        }

        if (!latestImage?.id) {
          this.configService.logWarning('[AssetDetails] Selected image has no ID');
          return of(null);
        }

        const imageUrl = this.fileUploadService.getFileDownloadUrl(latestImage.id);

        return this.http.get(imageUrl, { responseType: 'blob' }).pipe(
          switchMap((blob: Blob) => {
            if (blob.size > 0 && (blob.type.startsWith('image/') || blob.type === 'application/octet-stream')) {
              const blobUrl = URL.createObjectURL(blob);
              return of(blobUrl);
            }
            this.configService.logWarning('Asset image rejected due to invalid type or empty size');
            return of(null);
          }),
          catchError((err) => {
            this.configService.logWarning('Failed to load image blob', err);
            return of(null);
          })
        );
      }),
      catchError(() => {
        this.configService.logWarning('Failed to get files');
        return of(null);
      })
    );
  }

  /**
   * Get asset ID from asset data
   */
  getAssetId(asset: AssetDetailsData): number | null {
    if (!asset) return null;
    if ('id' in asset && typeof (asset as any).id === 'number') {
      return (asset as any).id;
    }
    return null;
  }
}
