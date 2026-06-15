import { Injectable } from '@angular/core';
import { BatchForOrderDepotDto } from '@requests/services/asset-supply.service';

/**
 * Holds depot and batch selection state when navigating between
 * Page 1 (selection) and Page 2 (asset review).
 */
@Injectable({ providedIn: 'root' })
export class WeaponSupplySelectionService {
  private orderId: number = 0;
  private selectedDepotIds: number[] = [];
  private selectedBatchIds: number[] = [];
  private batchOptions: BatchForOrderDepotDto[] = [];
  /** Quantity per batch (batchId -> quantity). Required for every selected batch. */
  private batchQuantities: Map<number, number> = new Map();

  setSelection(
    orderId: number,
    depotIds: number[],
    batchIds: number[],
    batches: BatchForOrderDepotDto[],
    quantities?: Map<number, number>
  ): void {
    this.orderId = orderId;
    this.selectedDepotIds = [...depotIds];
    this.selectedBatchIds = [...batchIds];
    this.batchOptions = [...batches];
    this.batchQuantities = quantities ? new Map(quantities) : new Map();
  }

  getSelection(): {
    orderId: number;
    selectedDepotIds: number[];
    selectedBatchIds: number[];
    batchOptions: BatchForOrderDepotDto[];
    batchQuantities: Map<number, number>;
  } | null {
    if (!this.orderId || this.selectedDepotIds.length === 0) {
      return null;
    }
    return {
      orderId: this.orderId,
      selectedDepotIds: [...this.selectedDepotIds],
      selectedBatchIds: [...this.selectedBatchIds],
      batchOptions: [...this.batchOptions],
      batchQuantities: new Map(this.batchQuantities)
    };
  }

  clear(): void {
    this.orderId = 0;
    this.selectedDepotIds = [];
    this.selectedBatchIds = [];
    this.batchOptions = [];
    this.batchQuantities.clear();
  }

  hasValidSelection(): boolean {
    return this.orderId > 0 && this.selectedDepotIds.length > 0;
  }
}
