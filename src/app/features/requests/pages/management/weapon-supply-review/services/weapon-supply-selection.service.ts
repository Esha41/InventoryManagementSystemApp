import { Injectable } from '@angular/core';
import { BatchForOrderDepotDto } from '@services/asset-supply.service';

/**
 * Holds depot and batch selection state when navigating between
 * Page 1 (selection) and Page 2 (asset review).
 */
@Injectable({ providedIn: 'root' })
export class WeaponSupplySelectionService {
  orderId: number = 0;
  selectedDepotIds: number[] = [];
  selectedBatchIds: number[] = [];
  batchOptions: BatchForOrderDepotDto[] = [];

  setSelection(orderId: number, depotIds: number[], batchIds: number[], batches: BatchForOrderDepotDto[]): void {
    this.orderId = orderId;
    this.selectedDepotIds = [...depotIds];
    this.selectedBatchIds = [...batchIds];
    this.batchOptions = [...batches];
  }

  getSelection(): {
    orderId: number;
    selectedDepotIds: number[];
    selectedBatchIds: number[];
    batchOptions: BatchForOrderDepotDto[];
  } | null {
    if (!this.orderId || this.selectedDepotIds.length === 0 || this.selectedBatchIds.length === 0) {
      return null;
    }
    return {
      orderId: this.orderId,
      selectedDepotIds: [...this.selectedDepotIds],
      selectedBatchIds: [...this.selectedBatchIds],
      batchOptions: [...this.batchOptions]
    };
  }

  clear(): void {
    this.orderId = 0;
    this.selectedDepotIds = [];
    this.selectedBatchIds = [];
    this.batchOptions = [];
  }

  hasValidSelection(): boolean {
    return this.orderId > 0 &&
      this.selectedDepotIds.length > 0 &&
      this.selectedBatchIds.length > 0;
  }
}
