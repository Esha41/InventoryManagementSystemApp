import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { InventoryService, LotDetailDto } from '@inventory/services/inventory.service';
import type { CreateSupplyDetailDto } from '@models/supply-dto.model';
import type { OrderItem, SupplyRequestDetail } from '@models/supply-request.model';
import { mapLotDetailsToLotItems } from '@utils/lot.utils';
import { ConfigService } from '@services/config.service';

import {
  applyDraftLotSelectionsToItem,
  buildDraftSelectionsByLot,
  collectValidExtraLotsForItem,
  getMissingDraftLotNumbers,
  mergeFefoLotItemsWithExtraDetails,
  normalizeSupplyLotKey,
  restoreDraftSelectionsOnRequestDetail,
  type DraftSelectionRestoreResult
} from '../utils/supply-request-draft-lot.util';

export type { DraftSelectionRestoreResult };

/**
 * Loads and merges inventory lots for draft supply lines (FEFO + lots chosen outside FEFO).
 */
@Injectable({ providedIn: 'root' })
export class SupplyRequestDraftLotService {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly config: ConfigService
  ) {}

  restoreSelectionsOnRequestDetail(
    requestDetail: SupplyRequestDetail,
    supplyDetails: CreateSupplyDetailDto[]
  ): DraftSelectionRestoreResult {
    return restoreDraftSelectionsOnRequestDetail(requestDetail, supplyDetails);
  }

  loadLotsForExistingSelections(
    requestDetail: SupplyRequestDetail,
    supplyDetails: CreateSupplyDetailDto[],
    excludeSupplyId?: number
  ): Observable<void> {
    if (!requestDetail?.items?.length || !supplyDetails?.length) {
      return of(undefined);
    }

    const detailsByItem = new Map<number, CreateSupplyDetailDto[]>();
    for (const detail of supplyDetails) {
      if (!detail.itemId) {
        continue;
      }
      const list = detailsByItem.get(detail.itemId) ?? [];
      list.push(detail);
      detailsByItem.set(detail.itemId, list);
    }

    const itemLoads: Observable<void>[] = [];
    for (const [itemId, details] of detailsByItem) {
      const item = requestDetail.items.find((i) => i.itemId === itemId);
      if (!item) {
        continue;
      }
      itemLoads.push(
        this.inventoryService
          .getAvailableLotsForQuantity(itemId, item.approvedQuantity, undefined, excludeSupplyId)
          .pipe(
            switchMap((fefoLots) => this.hydrateOrderItemFromDraft(item, fefoLots ?? [], details)),
            catchError((error) => {
              this.config.logError(
                `Failed to load lots for item ${itemId} from draft selections`,
                error
              );
              return of(undefined);
            })
          )
      );
    }

    if (itemLoads.length === 0) {
      return of(undefined);
    }

    return forkJoin(itemLoads).pipe(map(() => undefined));
  }

  hydrateOrderItemFromDraft(
    item: OrderItem,
    fefoLots: LotDetailDto[],
    details: CreateSupplyDetailDto[]
  ): Observable<void> {
    const selectionsByLot = buildDraftSelectionsByLot(details);
    const baseLots = mapLotDetailsToLotItems(fefoLots);
    const existingLotKeys = new Set(
      baseLots.map((lot) => normalizeSupplyLotKey(lot.lotNumber))
    );
    const missingLotNumbers = getMissingDraftLotNumbers(details, existingLotKeys);

    if (missingLotNumbers.length === 0) {
      applyDraftLotSelectionsToItem(item, baseLots, selectionsByLot);
      return of(undefined);
    }

    const lookups = missingLotNumbers.map((lotNumber) =>
      this.inventoryService.getLotByNumber(lotNumber).pipe(
        catchError((error) => {
          this.config.logError(
            `Failed to load draft lot ${lotNumber} for item ${item.itemId}`,
            error
          );
          return of(null);
        })
      )
    );

    return forkJoin(lookups).pipe(
      map((lookedUpLots) => {
        const extraLotDetails = collectValidExtraLotsForItem(
          item.itemId,
          lookedUpLots,
          existingLotKeys
        );
        for (const lot of lookedUpLots) {
          if (lot && lot.itemId !== item.itemId) {
            this.config.log(
              `Draft lot ${lot.lot} belongs to item ${lot.itemId}, expected ${item.itemId}`
            );
          }
        }
        return mergeFefoLotItemsWithExtraDetails(fefoLots, extraLotDetails);
      }),
      map((mergedLots) => {
        applyDraftLotSelectionsToItem(item, mergedLots, selectionsByLot);
        return undefined;
      })
    );
  }
}
