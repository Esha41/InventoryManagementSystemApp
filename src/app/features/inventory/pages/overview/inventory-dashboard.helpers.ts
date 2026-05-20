import { ItemInventorySummaryDto, ItemType, normalizeItemType } from '@models/inventory.model';
import { LotDetailDto } from '@inventory/services/inventory.service';
import { AssetDto } from '@models/asset.model';
import { getLocalizedName } from '@utils/localization.utils';

export type ActiveTab = 'ammunition' | 'weapon' | 'explosive';

export interface ItemSummaryFilterState {
  selectedItemFilterIds: number[];
  searchText: string;
  /** Selected caliber lookup id; null = no filter (same as asset list). */
  caliberFilterId: number | null;
  activeTab: ActiveTab;
}

export function filterItemSummaries(
  items: ItemInventorySummaryDto[],
  f: ItemSummaryFilterState
): ItemInventorySummaryDto[] {
  let list = items;

  const tabType =
    f.activeTab === 'ammunition' ? 1 :
    f.activeTab === 'weapon'     ? 2 :
                                   3;
  list = list.filter(i => normalizeItemType(i.itemType) === tabType);

  if (f.selectedItemFilterIds.length > 0) {
    list = list.filter(i => f.selectedItemFilterIds.includes(i.itemId));
  }
  const q = f.searchText.trim().toLowerCase();
  if (q) {
    list = list.filter(
      i =>
        (i.itemName || '').toLowerCase().includes(q) ||
        (i.itemNameAr || '').toLowerCase().includes(q) ||
        ((i as { itemNameAR?: string | null }).itemNameAR || '').toLowerCase().includes(q) ||
        (i.itemNo || '').toLowerCase().includes(q) ||
        (i.nsn || '').toLowerCase().includes(q) ||
        (i.partNo || '').toLowerCase().includes(q)
    );
  }
  if (f.caliberFilterId != null) {
    list = list.filter(i => i.caliberId === f.caliberFilterId);
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

export function sortItemSummaries(
  items: ItemInventorySummaryDto[],
  column: string | null,
  direction: 'asc' | 'desc'
): ItemInventorySummaryDto[] {
  if (!column || column === 'itemType') return items;
  return sortByColumn(items, column, direction);
}

export function sortLotDetails(
  lots: LotDetailDto[],
  column: string | null,
  direction: 'asc' | 'desc'
): LotDetailDto[] {
  if (!column) return lots;
  return sortByColumn(lots, column, direction);
}

export function isPlaceholderCaliberLabel(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return /^[-–—]+$/.test(t);
}

export function distinctCalibersFromItems(items: ItemInventorySummaryDto[]): string[] {
  const set = new Set<string>();
  for (const i of items) {
    const c = (i.caliber || '').trim();
    if (c && !isPlaceholderCaliberLabel(c)) set.add(c);
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

export function filterItemSummariesByActiveTab(
  itemSummaries: ItemInventorySummaryDto[],
  activeTab: ActiveTab
): ItemInventorySummaryDto[] {
  const tabType =
    activeTab === 'ammunition' ? ItemType.Ammunition :
    activeTab === 'weapon'     ? ItemType.Weapon     :
                                ItemType.Explosive;
  return itemSummaries.filter(i => normalizeItemType(i.itemType) === tabType);
}

/** Search, caliber, or item pick — excludes tab scope. */
export function hasSecondaryItemTableFilters(
  itemSearchText: string,
  caliberFilterId: number | null | undefined,
  selectedItemFilterIds: number[]
): boolean {
  return (
    !!itemSearchText.trim() ||
    caliberFilterId != null ||
    selectedItemFilterIds.length > 0
  );
}

/** Bilingual item label for inventory dashboard rows (English in `itemName`, Arabic optional). */
export function localizedItemSummaryDisplayName(
  i: ItemInventorySummaryDto,
  lang: string
): string {
  const arRaw = i.itemNameAr ?? (i as { itemNameAR?: string | null }).itemNameAR;
  const ar = (arRaw ?? '').trim();
  const en = (i.itemName ?? '').trim();
  return getLocalizedName({ name: en, nameAr: ar || undefined }, lang)?.trim() || en || '—';
}

export function formatItemPickLabel(i: ItemInventorySummaryDto, lang: string): string {
  const display = localizedItemSummaryDisplayName(i, lang);
  const no = (i.itemNo || '').trim();
  return no ? `${display} (${no})` : display;
}

export function sumItemSummariesExcludingWeapon(
  filtered: ItemInventorySummaryDto[],
  field: keyof ItemInventorySummaryDto
): number {
  return sumItemSummariesField(
    filtered.filter(item => normalizeItemType(item.itemType) !== ItemType.Weapon),
    field
  );
}

export function totalRemainingFromSummaries(itemSummaries: ItemInventorySummaryDto[]): number {
  return itemSummaries.reduce((sum, i) => sum + (i.remainingQuantity ?? 0), 0);
}

export function totalLotsFromSummaries(itemSummaries: ItemInventorySummaryDto[]): number {
  return itemSummaries.reduce((sum, i) => sum + (i.totalLots ?? 0), 0);
}

export function paginatePage<T>(sortedRows: T[], currentPage: number, rowsPerPage: number): T[] {
  const n = sortedRows.length;
  if (n === 0) return [];
  const totalPages = Math.max(1, Math.ceil(n / rowsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (safePage - 1) * rowsPerPage;
  return sortedRows.slice(start, start + rowsPerPage);
}

export function pageCountForLength(n: number, rowsPerPage: number): number {
  return n === 0 ? 0 : Math.ceil(n / rowsPerPage);
}

export function nextTableSort(
  column: string,
  sortColumn: string | null,
  sortDirection: 'asc' | 'desc'
): { sortColumn: string; sortDirection: 'asc' | 'desc' } {
  if (sortColumn === column) {
    return { sortColumn: column, sortDirection: sortDirection === 'asc' ? 'desc' : 'asc' };
  }
  return { sortColumn: column, sortDirection: 'asc' };
}

export function sortAssetDetailsDtos(
  assets: AssetDto[],
  sortColumn: string | null,
  sortDirection: 'asc' | 'desc'
): AssetDto[] {
  if (!sortColumn) return assets;
  return sortByColumn(assets, sortColumn, sortDirection);
}
