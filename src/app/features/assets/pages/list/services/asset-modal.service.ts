/**
 * Asset Modal Service
 * Handles modal operations (edit, delete, view) for assets
 */

import { Injectable } from '@angular/core';
import { Asset, AssetModalState, AssetImageState } from '@models/asset-list.model';
import { ToastService } from '@services/toast.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { createInitialImageState } from '@utils/asset-list.state';

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
    Object.assign(imageState, createInitialImageState());
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
    Object.assign(imageState, createInitialImageState());
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
   * Show success message
   */
  showSuccess(message: string): void {
    this.toastService.success(message);
  }

  /**
   * Show error message
   */
  showError(message: string, error?: unknown): void {
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
