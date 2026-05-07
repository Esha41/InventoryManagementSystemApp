import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { InventoryService } from './inventory.service';
import { AssetService } from '@assets/services/asset.service';
import { ItemInventorySummaryDto, ItemType } from '@models/inventory.model';
import { AssetDto, AssetStatus } from '@models/asset.model';
import { PaginatedList } from '@models/pagination.model';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { defaultPageSize } from '@constants/app.constants';

export interface MergedItemSummariesPage {
    items: ItemInventorySummaryDto[];
    weaponAssetsPage: PaginatedList<AssetDto> | null;
}


@Injectable({ providedIn: 'root' })
export class InventorySummaryDataService {
    constructor(
        private readonly inventoryService: InventoryService,
        private readonly assetService: AssetService,
        private readonly translate: TranslateService
    ) { }

    loadAllItems(): Observable<ItemInventorySummaryDto[]> {
        return this.loadMergedItemSummaries(undefined);
    }

    /**
     * Loads non-weapon item summaries plus a single page of weapon assets (default page 1, size 20).
     * The caller fetches additional weapon-asset pages on demand via {@link loadWeaponAssetsPage}.
     */
    loadMergedItemSummaries(
        depotIds?: number[],
        page: number = 1,
        pageSize: number = defaultPageSize
    ): Observable<ItemInventorySummaryDto[]> {
        return forkJoin({
            inventorySummary: this.inventoryService.getAllItemsSummary(depotIds).pipe(
                map(items => this.filterOutWeapons(items)),
                catchError(() => of([]))
            ),
            weaponAssets: this.loadWeaponAssetsPage(depotIds, page, pageSize).pipe(
                map(res => this.transformAssetsToSummary(res?.items ?? [])),
                catchError(() => of([]))
            )
        }).pipe(
            map(({ inventorySummary, weaponAssets }) => [...inventorySummary, ...weaponAssets])
        );
    }

    /**
     * Single-page fetch of weapon assets for the given depot scope. Use this for the dashboard's
     * server-side "Next" pagination so each click is one request.
     */
    loadWeaponAssetsPage(
        depotIds: number[] | undefined,
        page: number = 1,
        pageSize: number = defaultPageSize
    ): Observable<PaginatedList<AssetDto> | null> {
        const request = { page, pageSize };
        if (!depotIds?.length) {
            return this.assetService.getAssetsPaged(request);
        }
        if (depotIds.length === 1) {
            return this.assetService.getAssetsPaged(request, { depotId: depotIds[0] });
        }
        return this.assetService.getAssetsPaged(request, { depotIds });
    }

    /**
     * Fetch a single page of weapon assets and return the per-item weapon summaries plus the raw
     * pagination metadata. Used by the dashboard to refresh ONLY the weapon part of the table on
     * "Next" clicks (no headline/monitoring requests).
     */
    loadWeaponSummariesPage(
        depotIds: number[] | undefined,
        page: number = 1,
        pageSize: number = defaultPageSize
    ): Observable<{ summaries: ItemInventorySummaryDto[]; meta: PaginatedList<AssetDto> | null }> {
        return this.loadWeaponAssetsPage(depotIds, page, pageSize).pipe(
            map(res => ({
                summaries: this.transformAssetsToSummary(res?.items ?? []),
                meta: res
            })),
            catchError(() => of({ summaries: [] as ItemInventorySummaryDto[], meta: null }))
        );
    }

    private filterOutWeapons(items: ItemInventorySummaryDto[]): ItemInventorySummaryDto[] {
        return items.filter(item => item.itemType !== ItemType.Weapon);
    }
    private transformAssetsToSummary(assets: AssetDto[]): ItemInventorySummaryDto[] {
        const assetsByItem = this.groupAssetsByItemId(assets);
        return this.createSummariesFromGroupedAssets(assetsByItem);
    }
    private groupAssetsByItemId(assets: AssetDto[]): Map<number, AssetDto[]> {
        const assetsByItem = new Map<number, AssetDto[]>();

        assets.forEach(asset => {
            if (!asset.isDeleted) {
                const existing = assetsByItem.get(asset.itemId) || [];
                existing.push(asset);
                assetsByItem.set(asset.itemId, existing);
            }
        });

        return assetsByItem;
    }

    private createSummariesFromGroupedAssets(
        assetsByItem: Map<number, AssetDto[]>
    ): ItemInventorySummaryDto[] {
        const summaries: ItemInventorySummaryDto[] = [];

        assetsByItem.forEach((itemAssets, itemId) => {
            const summary = this.createSummaryForAssetGroup(itemId, itemAssets);
            if (summary) {
                summaries.push(summary);
            }
        });

        return summaries;
    }

    private createSummaryForAssetGroup(
        itemId: number,
        itemAssets: AssetDto[]
    ): ItemInventorySummaryDto | null {
        const firstAsset = itemAssets[0];
        const weapon = firstAsset?.item;

        if (!weapon) {
            return null;
        }

        const lang = getCurrentLang(this.translate);
        const caliberRaw = weapon.caliber ? getLocalizedName(weapon.caliber, lang).trim() : '';
        const caliberUnitRaw = weapon.caliberUnit ? getLocalizedName(weapon.caliberUnit, lang).trim() : '';

        return {
            itemId,
            itemName: weapon.name || '',
            itemNo: weapon.itemNo || '',
            itemType: ItemType.Weapon,
            nsn: weapon.nsn || '',
            partNo: weapon.partNo || '',
            ...(caliberRaw ? { caliber: caliberRaw } : {}),
            ...(caliberUnitRaw ? { caliberUnitName: caliberUnitRaw } : {}),
            totalQuantity: itemAssets.length,
            usedQuantity: 0,
            reservedQuantityByOrdersOnProcessing: 0,
            remainingQuantity: this.countAssetsByStatus(itemAssets, 'ReadyToIssue'),
            totalLots: itemAssets.length
        };
    }

    private countAssetsByStatus(assets: AssetDto[], status: AssetStatus | string): number {
        return assets.filter(asset => asset.status === status || asset.status === (status as number)).length;
    }
}
