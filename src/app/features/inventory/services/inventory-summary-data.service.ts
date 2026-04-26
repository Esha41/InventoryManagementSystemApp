import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { InventoryService } from './inventory.service';
import { AssetService } from '@assets/services/asset.service';
import { ItemInventorySummaryDto, ItemType } from '@models/inventory.model';
import { AssetDto, AssetStatus } from '@models/asset.model';


@Injectable({ providedIn: 'root' })
export class InventorySummaryDataService {
    constructor(
        private readonly inventoryService: InventoryService,
        private readonly assetService: AssetService
    ) { }

    loadAllItems(): Observable<ItemInventorySummaryDto[]> {
        return this.loadMergedItemSummaries(undefined);
    }

    loadMergedItemSummaries(depotIds?: number[]): Observable<ItemInventorySummaryDto[]> {
        return forkJoin({
            inventorySummary: this.inventoryService.getAllItemsSummary(depotIds).pipe(
                map(items => this.filterOutWeapons(items)),
                catchError(() => of([]))
            ),
            weaponAssets: this.loadAssetsForDepotScope(depotIds).pipe(
                map(assets => this.transformAssetsToSummary(assets)),
                catchError(() => of([]))
            )
        }).pipe(
            map(({ inventorySummary, weaponAssets }) => [...inventorySummary, ...weaponAssets])
        );
    }

    private loadAssetsForDepotScope(depotIds?: number[]): Observable<AssetDto[]> {
        if (!depotIds?.length) {
            return this.assetService.getAll<AssetDto>({ search: '' });
        }
        if (depotIds.length === 1) {
            return this.assetService.getAll<AssetDto>({ search: '', depotId: depotIds[0] });
        }
        return this.assetService
            .getAll<AssetDto>({ search: '', depotIds: depotIds })
            .pipe(
                map(assets => {
                    const byAssetId = new Map<number, AssetDto>();
                    for (const a of assets) {
                        if (!a.isDeleted) {
                            byAssetId.set(a.id, a);
                        }
                    }
                    return [...byAssetId.values()];
                })
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

        return {
            itemId,
            itemName: weapon.name || '',
            itemNo: weapon.itemNo || '',
            itemType: ItemType.Weapon,
            nsn: weapon.nsn || '',
            partNo: weapon.partNo || '',
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
