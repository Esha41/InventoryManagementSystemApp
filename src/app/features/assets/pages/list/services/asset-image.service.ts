/**
 * Asset Image Service
 * Handles image loading and blob URL management for assets
 */

import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { Asset, AssetType } from '@models/asset-list.model';
import { FileUploadDto, FileEntityType } from '@models/file-upload.model';
import { AmmunitionService } from '@assets/services/ammunition.service';
import { FileUploadService } from '@services/file-upload.service';
import { WeaponService } from '@assets/services/weapon.service';
import { ExplosiveService } from '@assets/services/explosive.service';
import { AccessoryService } from '@assets/services/accessory.service';

export interface ImageLoadResult {
  assetId: string;
  url: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AssetImageService {
  private blobUrls: Set<string> = new Set();

  constructor(
    private ammunitionService: AmmunitionService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
    private accessoryService: AccessoryService
  ) { }

  /**
   * Load images for multiple assets
   */
  loadAssetImages(assets: Asset[], activeTab: AssetType): Observable<ImageLoadResult[]> {
    const imageRequests = assets
      .map(asset => {
        const originalData = asset.originalData as { images?: FileUploadDto[] } | undefined;
        if (!originalData?.images || originalData.images.length === 0) {
          return null;
        }

        const mainImages = originalData.images.filter((img: FileUploadDto) => img.isMain);
        const image = mainImages.length > 0
          ? mainImages.reduce((latest, current) => (current.id > latest.id) ? current : latest)
          : originalData.images.reduce((latest, current) => (current.id > latest.id) ? current : latest);

        if (!image?.id) {
          return null;
        }

        // Get the appropriate service based on active tab
        let fileBlob$: Observable<Blob>;
        if (activeTab === 'ammunition') {
          fileBlob$ = this.ammunitionService.getFileBlob(image.id);
        } else if (activeTab === 'weapon') {
          fileBlob$ = this.weaponService.getFileBlob(image.id);
        } else if (activeTab === 'explosive') {
          fileBlob$ = this.explosiveService.getFileBlob(image.id);
        } else if (activeTab === 'accessory') {
          fileBlob$ = this.accessoryService.getFileBlob(image.id);
        } else {
          return null;
        }

        return fileBlob$.pipe(
          map((blob: Blob) => {
            // Allow image/* types or generic octet-stream (browser will often render valid image bytes even if type is generic)
            if (blob.size > 0 && (blob.type.startsWith('image/') || blob.type === 'application/octet-stream' || !blob.type)) {
              const blobUrl = URL.createObjectURL(blob);
              this.blobUrls.add(blobUrl);
              return { assetId: asset.id, url: blobUrl };
            }
            return { assetId: asset.id, url: null };
          }),
          catchError((err) => {
            console.error(`Failed to load image for asset ${asset.id}:`, err);
            return of({ assetId: asset.id, url: null });
          })
        );
      })
      .filter((req): req is Observable<ImageLoadResult> => req !== null);

    if (imageRequests.length === 0) {
      return of([]);
    }

    return forkJoin(imageRequests);
  }

  /**
   * Load edit image for a specific asset
   */
  loadEditImage(
    id: number,
    activeTab: AssetType,
    fileUploadService: FileUploadService,
    callback?: () => void
  ): Observable<{ fileId: number | null; url: string | null }> {
    let entityType: FileEntityType;
    if (activeTab === 'ammunition') {
      entityType = FileEntityType.Ammunition;
    } else if (activeTab === 'weapon') {
      entityType = FileEntityType.Weapon;
    } else if (activeTab === 'explosive') {
      entityType = FileEntityType.Explosive;
    } else if (activeTab === 'accessory') {
      entityType = FileEntityType.Accessory;
    } else {
      if (callback) callback();
      return of({ fileId: null, url: null });
    }

    const service = this.getServiceForTab(activeTab);

    return fileUploadService.getFilesByEntity(entityType, id).pipe(
      switchMap((files: FileUploadDto[]) => {
        if (files && files.length > 0) {
          const mainImages = files.filter((img: FileUploadDto) => img.isMain);
          const latestImage = mainImages.length > 0
            ? mainImages.reduce((latest, current) => (current.id > latest.id) ? current : latest)
            : files.reduce((latest, current) => (current.id > latest.id) ? current : latest);

          if (latestImage?.id) {
            return service.getFileBlob(latestImage.id).pipe(
              map((blob: Blob) => {
                // Allow image/* types or generic octet-stream
                if (blob.size > 0 && (blob.type.startsWith('image/') || blob.type === 'application/octet-stream' || !blob.type)) {
                  const blobUrl = URL.createObjectURL(blob);
                  this.blobUrls.add(blobUrl);
                  if (callback) callback();
                  return { fileId: latestImage.id, url: blobUrl };
                }
                if (callback) callback();
                return { fileId: latestImage.id, url: null };
              }),
              catchError(() => {
                if (callback) callback();
                return of({ fileId: latestImage.id, url: null });
              })
            );
          }
        }
        if (callback) callback();
        return of({ fileId: null, url: null });
      }),
      catchError(() => {
        if (callback) callback();
        return of({ fileId: null, url: null });
      })
    );
  }

  /**
   * Get the appropriate service for the active tab
   */
  private getServiceForTab(activeTab: AssetType): AmmunitionService | WeaponService | ExplosiveService | AccessoryService {
    switch (activeTab) {
      case 'ammunition':
        return this.ammunitionService;
      case 'weapon':
        return this.weaponService;
      case 'explosive':
        return this.explosiveService;
      case 'accessory':
        return this.accessoryService;
      default:
        return this.ammunitionService;
    }
  }

  /**
   * Clean up blob URLs
   */
  cleanup(): void {
    this.blobUrls.forEach((url: string) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Silently handle blob URL revocation errors
      }
    });
    this.blobUrls.clear();
  }

  /**
   * Add a blob URL to track
   */
  addBlobUrl(url: string): void {
    this.blobUrls.add(url);
  }
}
