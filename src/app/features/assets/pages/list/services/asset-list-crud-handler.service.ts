/**
 * Asset List CRUD Handler Service
 * Handles edit, delete, restore, permanent delete operations for the asset list
 */

import { inject, Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from '@services/toast.service';
import { FileUploadService } from '@services/file-upload.service';
import { AssetCrudService } from './asset-crud.service';
import { AssetModalService } from './asset-modal.service';
import { AssetImageService } from './asset-image.service';
import { AssetType } from '@models/asset-list.model';
import { Asset, AssetModalState, AssetImageState } from '@models/asset-list.model';
import { AmmunitionCreateDto } from '@models/ammunition.model';
import { CreateUpdateWeaponDto } from '@models/weapon.model';
import { CreateUpdateExplosiveDto } from '@models/explosive.model';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';
import { ErrorHandler } from '@utils/error-handler.utils';

export interface EditSaveEvent {
  dto: AmmunitionCreateDto | CreateUpdateWeaponDto | CreateUpdateExplosiveDto;
  imageFile: File | null;
  imageFileId: number | null;
  removeImageRequested: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AssetListCrudHandlerService {
  private readonly assetCrudService = inject(AssetCrudService);
  private readonly assetModalService = inject(AssetModalService);
  private readonly assetImageService = inject(AssetImageService);
  private readonly fileUploadService = inject(FileUploadService);
  private readonly translateService = inject(TranslateService);
  private readonly toastService = inject(ToastService);

  /**
   * Open edit modal: fetch asset details, load image, set modal state
   */
  openEdit(
    assetId: string,
    assets: Asset[],
    activeTab: AssetType,
    modalState: AssetModalState,
    destroy$: Subject<void>,
    onReady: () => void,
    setLoading: (v: boolean) => void,
    setImageState: (s: AssetImageState) => void,
    setModalState: (s: AssetModalState) => void,
    _loadAssets: () => void
  ): void {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;

    const numericId = parseInt(assetId, 10);
    if (isNaN(numericId)) return;

    const service = this.assetCrudService.getAssetService(activeTab);
    setLoading(true);

    service.getById(numericId)
      .pipe(takeUntil(destroy$))
      .subscribe({
        next: (data: AmmunitionReadDto | WeaponDto | ExplosiveDto) => {
          const newModalState = { ...modalState, selectedAsset: data };
          setModalState(newModalState);

          this.assetCrudService.loadEditImage(activeTab, numericId)
            .pipe(takeUntil(destroy$))
            .subscribe({
              next: (result) => {
                if (result) {
                  this.assetImageService.addBlobUrl(result.url);
                  setImageState({
                    editImageUrl: result.url,
                    editImageFile: null,
                    editImagePreview: null,
                    editImageFileId: result.fileId
                  });
                }
                setLoading(false);
                setModalState({ ...newModalState, showEditModal: true });
                onReady();
              },
              error: () => {
                setLoading(false);
                setModalState({ ...newModalState, showEditModal: true });
                onReady();
              }
            });
        },
        error: () => {
          setLoading(false);
          onReady();
        }
      });
  }

  /**
   * Save edit: update asset, handle image changes
   */
  saveEdit(
    event: EditSaveEvent,
    modalState: AssetModalState,
    activeTab: AssetType,
    destroy$: Subject<void>,
    closeEdit: () => void,
    setLoading: (v: boolean) => void,
    loadAssets: () => void,
    onReady: () => void
  ): void {
    if (!modalState.selectedAsset || !('id' in modalState.selectedAsset)) return;

    const id = parseInt(String(modalState.selectedAsset.id), 10);
    if (isNaN(id)) return;

    setLoading(true);

    this.assetCrudService.updateAsset(
      id,
      activeTab,
      event.dto,
      event.imageFile,
      event.imageFileId,
      event.removeImageRequested
    )
      .pipe(takeUntil(destroy$))
      .subscribe({
        next: (res) => {
          if (res.succeeded) {
            closeEdit();
            this.toastService.success('Asset updated successfully');
            loadAssets();
          } else {
            this.toastService.error(res.message || 'Update failed');
            setLoading(false);
          }
          onReady();
        },
        error: (err: unknown) => {
          this.toastService.error(ErrorHandler.extractErrorMessage(err, 'Update failed'));
          setLoading(false);
          onReady();
        }
      });
  }

  /**
   * Confirm soft delete
   */
  confirmDelete(
    modalState: AssetModalState,
    activeTab: AssetType,
    destroy$: Subject<void>,
    closeModal: () => void,
    setLoading: (v: boolean) => void,
    loadAssets: () => void,
    onReady: () => void
  ): void {
    if (!modalState.selectedAsset || !('id' in modalState.selectedAsset)) return;

    const id = parseInt(String(modalState.selectedAsset.id), 10);
    if (isNaN(id)) return;

    setLoading(true);
    this.assetCrudService.deleteAsset(id, activeTab)
      .pipe(takeUntil(destroy$))
      .subscribe({
        next: (res) => {
          if (res.succeeded) {
            this.toastService.success('Deleted successfully');
            closeModal();
            loadAssets();
          } else {
            this.toastService.error(res.message || 'Delete failed');
            setLoading(false);
          }
          onReady();
        },
        error: (err: unknown) => {
          this.toastService.error(ErrorHandler.extractErrorMessage(err, 'Delete failed'));
          setLoading(false);
          onReady();
        }
      });
  }

  /**
   * Confirm permanent delete
   */
  confirmPermanentDelete(
    modalState: AssetModalState,
    activeTab: AssetType,
    destroy$: Subject<void>,
    closeModal: () => void,
    setLoading: (v: boolean) => void,
    loadAssets: () => void,
    onReady: () => void
  ): void {
    if (!modalState.selectedAsset || !('id' in modalState.selectedAsset)) return;

    const id = parseInt(String(modalState.selectedAsset.id), 10);
    if (isNaN(id)) return;

    const successKey = activeTab === 'ammunition' ? 'assetList.ammunition.permanentDeleteSuccess'
      : activeTab === 'explosive' ? 'assetList.explosives.permanentDeleteSuccess'
      : 'assetList.weapons.permanentDeleteSuccess';

    setLoading(true);
    this.assetCrudService.permanentDeleteAsset(id, activeTab)
      .pipe(takeUntil(destroy$))
      .subscribe({
        next: (res) => {
          if (res.succeeded) {
            this.toastService.success(this.translateService.instant(successKey));
            closeModal();
            loadAssets();
          } else {
            this.toastService.error(res.message || this.translateService.instant('assetList.errors.failedToPermanentDelete'));
            setLoading(false);
          }
          onReady();
        },
        error: (err: unknown) => {
          this.toastService.error(ErrorHandler.extractErrorMessage(err, this.translateService.instant('assetList.errors.failedToPermanentDelete')));
          setLoading(false);
          onReady();
        }
      });
  }

  /**
   * Confirm restore
   */
  confirmRestore(
    modalState: AssetModalState,
    activeTab: AssetType,
    destroy$: Subject<void>,
    closeModal: () => void,
    setLoading: (v: boolean) => void,
    loadAssets: () => void,
    onReady: () => void
  ): void {
    if (!modalState.selectedAsset || !('id' in modalState.selectedAsset)) return;

    const id = parseInt(String(modalState.selectedAsset.id), 10);
    if (isNaN(id)) return;

    const successKey = activeTab === 'ammunition' ? 'assetList.ammunition.restoreSuccess'
      : activeTab === 'explosive' ? 'assetList.explosives.restoreSuccess'
      : 'assetList.weapons.restoreSuccess';
    const errorKey = 'assetList.errors.failedToRestore';

    setLoading(true);
    this.assetCrudService.restoreAsset(id, activeTab)
      .pipe(takeUntil(destroy$))
      .subscribe({
        next: (res) => {
          if (res.succeeded) {
            this.toastService.success(this.translateService.instant(successKey));
            closeModal();
            loadAssets();
          } else {
            this.toastService.error(res.message || this.translateService.instant(errorKey));
            setLoading(false);
          }
          onReady();
        },
        error: (err: unknown) => {
          this.toastService.error(ErrorHandler.extractErrorMessage(err, this.translateService.instant(errorKey)));
          setLoading(false);
          onReady();
        }
      });
  }
}
