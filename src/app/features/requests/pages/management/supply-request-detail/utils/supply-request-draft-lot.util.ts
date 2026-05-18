import type { CreateSupplyDetailDto } from '@models/supply-dto.model';
import type { LotDetailDto } from '@inventory/services/inventory.service';
import type { LotItem, OrderItem, SupplyRequestDetail } from '@models/supply-request.model';
import { mapLotDetailsToLotItems } from '@utils/lot.utils';
import { capOrderItemDischargeToApprovedQuantity } from '../../utils/supply-request.mapper';

export interface DraftSelectionRestoreResult {
  restoredCount: number;
  notFoundCount: number;
}

/** Trim lot identifiers so draft restore matches saved supply details. */
export function normalizeSupplyLotKey(lot: string | number | null | undefined): string {
  return String(lot ?? '').trim();
}

/** Per-item lot → quantity map; sums duplicate draft lines for the same lot. */
export function buildDraftSelectionsByLot(details: CreateSupplyDetailDto[]): Map<string, number> {
  const selectionsByLot = new Map<string, number>();
  for (const detail of details) {
    const lotKey = normalizeSupplyLotKey(detail.lot);
    if (lotKey && detail.quantity > 0) {
      selectionsByLot.set(lotKey, (selectionsByLot.get(lotKey) ?? 0) + detail.quantity);
    }
  }
  return selectionsByLot;
}

/** Per order-item + lot map; sums duplicate draft lines (matches buildSupplyDetails consolidation). */
export function buildDraftSelectionsByItemAndLot(
  supplyDetails: CreateSupplyDetailDto[]
): Map<string, number> {
  const selections = new Map<string, number>();
  for (const detail of supplyDetails) {
    const lotKey = normalizeSupplyLotKey(detail.lot);
    if (detail.itemId && lotKey && detail.quantity > 0) {
      const key = `${detail.itemId}_${lotKey}`;
      selections.set(key, (selections.get(key) ?? 0) + detail.quantity);
    }
  }
  return selections;
}

export function getMissingDraftLotNumbers(
  details: CreateSupplyDetailDto[],
  existingLotKeys: Set<string>
): string[] {
  return [
    ...new Set(
      details
        .filter((detail) => {
          const lotKey = normalizeSupplyLotKey(detail.lot);
          return lotKey && detail.quantity > 0 && !existingLotKeys.has(lotKey);
        })
        .map((detail) => normalizeSupplyLotKey(detail.lot))
    )
  ];
}

export function collectValidExtraLotsForItem(
  itemId: number,
  lookedUpLots: ReadonlyArray<LotDetailDto | null>,
  existingLotKeys: Set<string>
): LotDetailDto[] {
  const extra: LotDetailDto[] = [];
  for (const lot of lookedUpLots) {
    if (!lot || lot.itemId !== itemId) {
      continue;
    }
    const lotKey = normalizeSupplyLotKey(lot.lot);
    if (!existingLotKeys.has(lotKey)) {
      existingLotKeys.add(lotKey);
      extra.push(lot);
    }
  }
  return extra;
}

export function mergeFefoLotItemsWithExtraDetails(
  fefoLots: LotDetailDto[],
  extraLotDetails: LotDetailDto[]
): LotItem[] {
  const merged = [...mapLotDetailsToLotItems(fefoLots), ...mapLotDetailsToLotItems(extraLotDetails)];
  merged.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  return merged;
}

export function applyDraftLotSelectionsToItem(
  item: OrderItem,
  lots: LotItem[],
  selectionsByLot: Map<string, number>
): void {
  item.availableLots = lots;
  for (const lot of item.availableLots) {
    const selectedQty = selectionsByLot.get(normalizeSupplyLotKey(lot.lotNumber));
    if (selectedQty !== undefined) {
      lot.selectedQuantity = selectedQty;
    }
  }
  item.totalSelectedForDischarge = item.availableLots.reduce(
    (sum, lot) => sum + lot.selectedQuantity,
    0
  );
  capOrderItemDischargeToApprovedQuantity(item);
}

/**
 * Overlay draft quantities onto items that already have `availableLots` (e.g. after FEFO suggestions).
 */
export function restoreDraftSelectionsOnRequestDetail(
  requestDetail: SupplyRequestDetail,
  supplyDetails: CreateSupplyDetailDto[]
): DraftSelectionRestoreResult {
  if (!requestDetail?.items?.length || !supplyDetails?.length) {
    return { restoredCount: 0, notFoundCount: 0 };
  }

  const selectionsByItemAndLot = buildDraftSelectionsByItemAndLot(supplyDetails);
  let restoredCount = 0;
  let notFoundCount = 0;

  for (const item of requestDetail.items) {
    if (!item.availableLots?.length) {
      continue;
    }

    for (const lot of item.availableLots) {
      const key = `${item.itemId}_${normalizeSupplyLotKey(lot.lotNumber)}`;
      const quantity = selectionsByItemAndLot.get(key);
      if (quantity !== undefined) {
        lot.selectedQuantity = quantity;
        restoredCount++;
      }
    }

    item.totalSelectedForDischarge = item.availableLots.reduce(
      (sum, lot) => sum + lot.selectedQuantity,
      0
    );
    capOrderItemDischargeToApprovedQuantity(item);
  }

  for (const [key] of selectionsByItemAndLot) {
    const firstSep = key.indexOf('_');
    if (firstSep < 0) {
      continue;
    }
    const itemId = key.slice(0, firstSep);
    const lotNumber = key.slice(firstSep + 1);
    const item = requestDetail.items.find((i) => i.itemId.toString() === itemId);
    if (!item) {
      continue;
    }
    const lot = item.availableLots?.find(
      (l) => normalizeSupplyLotKey(l.lotNumber) === lotNumber
    );
    if (!lot) {
      notFoundCount++;
    }
  }

  return { restoredCount, notFoundCount };
}
