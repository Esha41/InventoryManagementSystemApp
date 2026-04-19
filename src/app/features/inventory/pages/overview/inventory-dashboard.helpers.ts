import { ItemInventorySummaryDto } from '@models/inventory.model';
import { LotDetailDto } from '@services/inventory.service';

export type ActiveTab = 'all' | 'ammunition' | 'weapon' | 'explosive';

export interface ItemSummaryFilterState {
  /** Multi-select item filter — empty means "all items" */
  selectedItemFilterIds: number[];
  searchText: string;
  caliberText: string;
  /** null = all types (used when activeTab = 'all') */
  itemType: number | null;
  activeTab: ActiveTab;
}

export function filterItemSummaries(
  items: ItemInventorySummaryDto[],
  f: ItemSummaryFilterState
): ItemInventorySummaryDto[] {
  let list = items;

  // Tab filter (takes precedence over itemType dropdown when not 'all')
  if (f.activeTab !== 'all') {
    const tabType =
      f.activeTab === 'ammunition' ? 1 :
      f.activeTab === 'weapon'     ? 2 :
                                     3; // explosive
    list = list.filter(i => i.itemType === tabType);
  } else if (f.itemType !== null) {
    list = list.filter(i => i.itemType === f.itemType);
  }

  if (f.selectedItemFilterIds.length > 0) {
    list = list.filter(i => f.selectedItemFilterIds.includes(i.itemId));
  }
  const q = f.searchText.trim().toLowerCase();
  if (q) {
    list = list.filter(
      i =>
        (i.itemName || '').toLowerCase().includes(q) ||
        (i.itemNo || '').toLowerCase().includes(q) ||
        (i.nsn || '').toLowerCase().includes(q) ||
        (i.partNo || '').toLowerCase().includes(q)
    );
  }
  const cal = f.caliberText.trim().toLowerCase();
  if (cal) {
    list = list.filter(i => (i.caliber || '').toLowerCase().includes(cal));
  }
  return list;
}

export function sortByColumn<T>(rows: T[], column: string, direction: 'asc' | 'desc'): T[] {
  const dir = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[column] as unknown;
    const bVal = (b as Record<string, unknown>)[column] as unknown;
    const aNorm = aVal ?? '';
    const bNorm = bVal ?? '';
    if (typeof aNorm === 'string') return aNorm.localeCompare(String(bNorm)) * dir;
    return ((aNorm as number) - (bNorm as number)) * dir;
  });
}

/** Sort item summary rows; returns `items` unchanged when `column` is null. */
export function sortItemSummaries(
  items: ItemInventorySummaryDto[],
  column: string | null,
  direction: 'asc' | 'desc'
): ItemInventorySummaryDto[] {
  if (!column) return items;
  return sortByColumn(items, column, direction);
}

/** Sort lot rows; returns `lots` unchanged when `column` is null. */
export function sortLotDetails(
  lots: LotDetailDto[],
  column: string | null,
  direction: 'asc' | 'desc'
): LotDetailDto[] {
  if (!column) return lots;
  return sortByColumn(lots, column, direction);
}

export function distinctCalibersFromItems(items: ItemInventorySummaryDto[]): string[] {
  const set = new Set<string>();
  for (const i of items) {
    const c = (i.caliber || '').trim();
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function sumItemSummariesField(
  items: ItemInventorySummaryDto[],
  field: keyof ItemInventorySummaryDto
): number {
  return items.reduce((s, i) => {
    const v = i[field];
    return s + (typeof v === 'number' && !Number.isNaN(v) ? v : 0);
  }, 0);
}

export function sumLotDetailsMetrics(lots: LotDetailDto[]): {
  original: number;
  used: number;
  reserved: number;
  remaining: number;
} {
  return lots.reduce(
    (acc, l) => ({
      original: acc.original + (l.originalQuantity ?? 0),
      used: acc.used + (l.usedQuantity ?? 0),
      reserved: acc.reserved + (l.reservedQuantityByOrdersOnProcessing ?? 0),
      remaining: acc.remaining + (l.remainingQuantity ?? 0)
    }),
    { original: 0, used: 0, reserved: 0, remaining: 0 }
  );
}
