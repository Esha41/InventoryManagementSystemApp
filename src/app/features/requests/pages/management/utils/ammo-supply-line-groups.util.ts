import type { WorkflowSupplySummaryLineDto } from '@models/supply-dto.model';

/** One catalog request line (`itemId`) that may be fulfilled from multiple lots/depots. */
export interface AmmoSupplyLineGroup {
  itemId: number;
  itemName: string;
  itemNo: string | null | undefined;
  requestedQuantity: number;
  approvedQuantity: number;
  splits: WorkflowSupplySummaryLineDto[];
}

/**
 * Groups flat workflow supply lines by `itemId` while preserving API order (first occurrence defines group order).
 */
export function groupAmmoSupplyLines(
  lines: WorkflowSupplySummaryLineDto[] | undefined | null
): AmmoSupplyLineGroup[] {
  if (!lines?.length) {
    return [];
  }
  const byItemId = new Map<number, WorkflowSupplySummaryLineDto[]>();
  for (const line of lines) {
    const list = byItemId.get(line.itemId) ?? [];
    list.push(line);
    byItemId.set(line.itemId, list);
  }
  const seen = new Set<number>();
  const groups: AmmoSupplyLineGroup[] = [];
  for (const line of lines) {
    if (seen.has(line.itemId)) {
      continue;
    }
    seen.add(line.itemId);
    const splits = byItemId.get(line.itemId) ?? [];
    const first = splits[0];
    groups.push({
      itemId: first.itemId,
      itemName: first.itemName,
      itemNo: first.itemNo,
      requestedQuantity: first.requestedQuantity,
      approvedQuantity: first.approvedQuantity ?? first.requestedQuantity,
      splits
    });
  }
  return groups;
}

/** 1-based row index for a flat table that lists every split row (e.g. print “#” column). */
export function ammoSupplyTableRowNumber(
  groups: readonly AmmoSupplyLineGroup[],
  groupIndex: number,
  splitIndex: number
): number {
  let prior = 0;
  for (let i = 0; i < groupIndex; i++) {
    prior += groups[i].splits.length;
  }
  return prior + splitIndex + 1;
}
