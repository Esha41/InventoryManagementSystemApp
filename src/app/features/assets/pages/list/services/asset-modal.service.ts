/**
 * Asset Modal Service
 * Handles modal operations (edit, delete, view) for assets
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { Asset, AssetType, AssetModalState, AssetImageState } from '@models/asset-list.model';
import { AmmunitionCreateDto } from '@models/ammunition.model';
import { CreateUpdateWeaponDto } from '@models/weapon.model';
import { CreateUpdateExplosiveDto } from '@models/explosive.model';
import { APIOperationResponse } from '@models/api-response.model';
import { ToastService } from '@services/toast.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { createInitialImageState } from '@utils/asset-list.state';

export interface EditSaveEvent {
  dto: AmmunitionCreateDto | CreateUpdateWeaponDto | CreateUpdateExplosiveDto;
  imageFile: File | null;
  imageFileId: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class AssetModalService {
  constructor(private toastService: ToastService) { }

  /**
   * Open edit modal
   */
  openEditModal(
    asset: Asset,
    modalState: AssetModalState,
    imageState: AssetImageState
  ): void {
    modalState.selectedAsset = asset;
    imageState = createInitialImageState();
  }

  /**
   * Close edit modal
   */
  closeEditModal(
    modalState: AssetModalState,
    imageState: AssetImageState
  ): void {
    modalState.showEditModal = false;
    modalState.selectedAsset = null;
    imageState = createInitialImageState();
  }

  /**
   * Open delete modal
   */
  openDeleteModal(asset: Asset, modalState: AssetModalState): void {
    modalState.selectedAsset = asset;
    modalState.showDeleteModal = true;
  }

  /**
   * Close delete modal
   */
  closeDeleteModal(modalState: AssetModalState): void {
    modalState.showDeleteModal = false;
    modalState.selectedAsset = null;
  }

  /**
   * Open permanent delete modal
   */
  openPermanentDeleteModal(asset: Asset, modalState: AssetModalState): void {
    modalState.selectedAsset = asset;
    modalState.showPermanentDeleteModal = true;
  }

  /**
   * Close permanent delete modal
   */
  closePermanentDeleteModal(modalState: AssetModalState): void {
    modalState.showPermanentDeleteModal = false;
    modalState.selectedAsset = null;
  }

  /**
   * Open restore modal
   */
  openRestoreModal(asset: Asset, modalState: AssetModalState): void {
    modalState.selectedAsset = asset;
    modalState.showRestoreModal = true;
  }

  /**
   * Close restore modal
   */
  closeRestoreModal(modalState: AssetModalState): void {
    modalState.showRestoreModal = false;
    modalState.selectedAsset = null;
  }

  /**
   * Handle edit save
   */
  handleEditSave(
    event: EditSaveEvent,
    selectedAsset: any,
    service: any,
    destroy$: Subject<void>,
    onSuccess: () => void
  ): Observable<void> {
    if (!selectedAsset || !('id' in selectedAsset)) {
      return new Observable(observer => observer.complete());
    }

    const id = parseInt(String(selectedAsset.id));
    if (isNaN(id)) {
      return new Observable(observer => observer.complete());
    }

    return service.update(id, event.dto).pipe(
      takeUntil(destroy$),
      // Handle response in component
    ) as any;
  }

  /**
   * Handle delete confirmation
   */
  handleDelete(
    selectedAsset: any,
    service: any,
    destroy$: Subject<void>,
    onSuccess: () => void,
    onError: (error: any) => void
  ): Observable<void> {
    if (!selectedAsset || !('id' in selectedAsset)) {
      return new Observable(observer => observer.complete());
    }

    const id = parseInt(String(selectedAsset.id));
    if (isNaN(id)) {
      return new Observable(observer => observer.complete());
    }

    return service.delete(id).pipe(
      takeUntil(destroy$),
      // Handle response in component
    ) as any;
  }

  /**
   * Show success message
   */
  showSuccess(message: string): void {
    this.toastService.success(message);
  }

  /**
   * Show error message
   */
  showError(message: string, error?: any): void {
    const errorMessage = error 
      ? ErrorHandler.extractErrorMessage(error, message)
      : message;
    this.toastService.error(errorMessage);
  }

  /**
   * Show warning message
   */
  showWarning(message: string): void {
    this.toastService.warning(message);
  }
}
