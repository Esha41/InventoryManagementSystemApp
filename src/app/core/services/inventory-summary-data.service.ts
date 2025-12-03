import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { InventoryService } from '@services/inventory.service';
import { WeaponService } from '@services/weapon.service';
import { ExplosiveService } from '@services/explosive.service';
import { ItemInventorySummaryDto, BaseItemDto } from '@models/inventory.model';
import { InventorySummaryUtils } from '@utils/inventory-summary.utils';

/**
 * Service to aggregate inventory data from multiple sources
 */
@Injectable()
export class InventorySummaryDataService {
    constructor(
        private inventoryService: InventoryService,
        private weaponService: WeaponService,
        private explosiveService: ExplosiveService
    ) { }

    /**
     * Load all inventory items (ammunition, weapons, explosives)
     */
    loadAllItems(): Observable<ItemInventorySummaryDto[]> {
        return forkJoin({
            ammunition: this.inventoryService.getAllItemsSummary().pipe(
                catchError(err => {
                    console.error('Error loading ammunition:', err);
                    return of([]);
                })
            ),
            weapons: this.weaponService.getAll<BaseItemDto>().pipe(
                map(weapons => weapons.map(w => InventorySummaryUtils.transformBaseItemToSummary(w, 2))),
                catchError(err => {
                    console.error('Error loading weapons:', err);
                    return of([]);
                })
            ),
            explosives: this.explosiveService.getAll<BaseItemDto>().pipe(
                map(explosives => explosives.map(e => InventorySummaryUtils.transformBaseItemToSummary(e, 3))),
                catchError(err => {
                    console.error('Error loading explosives:', err);
                    return of([]);
                })
            )
        }).pipe(
            map(({ ammunition, weapons, explosives }) => {
                return [...ammunition, ...weapons, ...explosives];
            })
        );
    }
}
