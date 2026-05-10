import { Injectable } from '@angular/core';
import { Observable, forkJoin, of, EMPTY } from 'rxjs';
import { map, catchError, expand, reduce } from 'rxjs/operators';
import { InventoryService } from './inventory.service';
import { AssetService } from '@assets/services/asset.service';
import { ItemInventorySummaryDto, ItemType, AssetItemCatalogSummaryDto, normalizeItemType } from '@models/inventory.model';
import { defaultPageSize } from '@constants/app.constants';
import { PaginatedList } from '@models/pagination.model';

@Injectable({ providedIn: 'root' })
export class InventorySummaryDataService {
    constructor(
        private readonly inventoryService: InventoryService,
        private readonly assetService: AssetService
    ) { }

    loadAllItems(): Observable<ItemInventorySummaryDto[]> {
        return this.loadMergedItemSummaries(undefined);
    }

    /**
     * Loads non-weapon rows from inventory summary plus weapon catalog rows from
     * `POST /api/Asset/catalog-items/paged` (accumulated pages), not `GET /api/Asset`.
     */
    loadMergedItemSummaries(depotIds?: number[]): Observable<ItemInventorySummaryDto[]> {
        return forkJoin({
            inventorySummary: this.inventoryService.getAllItemsSummary(depotIds).pipe(
                map(items => this.filterOutWeapons(items)),
                catchError(() => of([]))
            ),
            weaponSummaries: this.loadAllWeaponCatalogSummaries(depotIds)
        }).pipe(
            map(({ inventorySummary, weaponSummaries }) => [...inventorySummary, ...weaponSummaries])
        );
    }

    /**
     * One page for dashboard Ammunition / Explosive tabs (`itemType` sent to API for correct totals).
     */
    loadDashboardItemPage(
        depotIds: number[] | undefined,
        page: number,
        pageSize: number,
        itemType: ItemType.Ammunition | ItemType.Explosive
    ): Observable<{ itemSummaries: ItemInventorySummaryDto[]; serverNonWeaponTotalCount: number }> {
        const query = !depotIds?.length
            ? { itemType }
            : depotIds.length === 1
                ? { depotId: depotIds[0], itemType }
                : { depotIds, itemType };
        return this.inventoryService.getAllItemsSummaryPaginated({ page, pageSize }, query).pipe(
            map(res => ({
                itemSummaries: res.items ?? [],
                serverNonWeaponTotalCount: res.totalCount ?? 0
            })),
            catchError(() => of({ itemSummaries: [] as ItemInventorySummaryDto[], serverNonWeaponTotalCount: 0 }))
        );
    }

    /**
     * Weapon dashboard tab: one round-trip per page via `POST /api/Asset/catalog-items/paged` (lean rows).
     */
    loadDashboardWeaponPage(
        depotIds: number[] | undefined,
        page: number,
        pageSize: number
    ): Observable<{ itemSummaries: ItemInventorySummaryDto[]; serverNonWeaponTotalCount: number }> {
        const query = this.buildWeaponCatalogQuery(depotIds);
        return this.assetService.getAssetCatalogItemSummariesPaged({ page, pageSize }, query).pipe(
            map(res => ({
                itemSummaries: (res.items ?? []).map(row => this.mapAssetCatalogRowToItemSummary(row)),
                serverNonWeaponTotalCount: res.totalCount ?? 0
            })),
            catchError(() => of({ itemSummaries: [] as ItemInventorySummaryDto[], serverNonWeaponTotalCount: 0 }))
        );
    }

    /**
     * Warehouse inventory summary table: one server page per tab (ammunition / explosive / weapon).
     */
    loadWarehouseSummaryPage(
        tab: 'ammunition' | 'weapon' | 'explosive',
        page: number,
        pageSize: number,
        depotIds?: number[]
    ): Observable<{ items: ItemInventorySummaryDto[]; totalCount: number }> {
        if (tab === 'weapon') {
            return this.loadDashboardWeaponPage(depotIds, page, pageSize).pipe(
                map(r => ({ items: r.itemSummaries, totalCount: r.serverNonWeaponTotalCount }))
            );
        }
        const itemType = tab === 'ammunition' ? ItemType.Ammunition : ItemType.Explosive;
        return this.loadDashboardItemPage(depotIds, page, pageSize, itemType).pipe(
            map(r => ({ items: r.itemSummaries, totalCount: r.serverNonWeaponTotalCount }))
        );
    }

    private buildWeaponCatalogQuery(depotIds: number[] | undefined):
        | { itemType: ItemType.Weapon }
        | { depotId: number; itemType: ItemType.Weapon }
        | { depotIds: number[]; itemType: ItemType.Weapon } {
        if (!depotIds?.length) {
            return { itemType: ItemType.Weapon };
        }
        if (depotIds.length === 1) {
            return { depotId: depotIds[0], itemType: ItemType.Weapon };
        }
        return { depotIds, itemType: ItemType.Weapon };
    }

    /**
     * All weapon catalog rows for merged lists (warehouse / admin summary), via repeated catalog paged calls.
     */
    private loadAllWeaponCatalogSummaries(depotIds?: number[]): Observable<ItemInventorySummaryDto[]> {
        const pageSize = defaultPageSize;
        const maxPages = 5000;
        const query = this.buildWeaponCatalogQuery(depotIds);

        const fetchPage = (page: number) =>
            this.assetService.getAssetCatalogItemSummariesPaged({ page, pageSize }, query).pipe(
                map(res => ({ res, requestedPage: page }))
            );

        return fetchPage(1).pipe(
            expand(({ res, requestedPage }) => {
                const totalPages = res.totalPages ?? 0;
                if (requestedPage >= totalPages || totalPages === 0 || requestedPage >= maxPages) {
                    return EMPTY;
                }
                return fetchPage(requestedPage + 1);
            }),
            reduce<{ res: PaginatedList<AssetItemCatalogSummaryDto>; requestedPage: number }, ItemInventorySummaryDto[]>(
                (acc, { res }) =>
                    acc.concat((res.items ?? []).map(row => this.mapAssetCatalogRowToItemSummary(row))),
                []
            ),
            catchError(() => of([] as ItemInventorySummaryDto[]))
        );
    }

    private mapAssetCatalogRowToItemSummary(row: AssetItemCatalogSummaryDto): ItemInventorySummaryDto {
        return {
            itemId: row.itemId,
            itemName: row.itemName,
            itemNo: row.itemNo,
            itemType: normalizeItemType(row.itemType),
            nsn: row.nsn ?? '',
            partNo: row.partNo ?? '',
            totalQuantity: row.totalAssets,
            usedQuantity: 0,
            reservedQuantityByOrdersOnProcessing: 0,
            remainingQuantity: 0,
            totalLots: row.totalAssets
        };
    }

    private filterOutWeapons(items: ItemInventorySummaryDto[]): ItemInventorySummaryDto[] {
        return items.filter(item => normalizeItemType(item.itemType) !== ItemType.Weapon);
    }
}
