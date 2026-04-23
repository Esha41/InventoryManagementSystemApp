import { Router, NavigationEnd } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, filter, map, pairwise, startWith, skip, distinctUntilChanged } from 'rxjs/operators';
import { BackendAuthService } from '@services/backend-auth.service';
import { MonitoringService } from '@services/monitoring.service';
import { InventorySummaryDataService } from '@services/inventory-summary-data.service';
import { ItemInventorySummaryDto } from '@models/inventory.model';
import { InventoryDashboardSummaryDto } from '@models/inventory-dashboard-monitoring.model';

export const INVENTORY_DASHBOARD_PATH_SEGMENT = 'inventory-dashboard';

export function pathHasInventoryDashboardSegment(
  url: string,
  segment: string = INVENTORY_DASHBOARD_PATH_SEGMENT
): boolean {
  const pathOnly = url.split('?')[0].split('#')[0];
  return pathOnly.split('/').filter(Boolean).includes(segment);
}

export function emptyInventoryMonitoring(): InventoryDashboardSummaryDto {
  return {
    weaponAssets: {
      totalAssets: 0,
      assignedCount: 0,
      inDepotCount: 0,
      unknownStatusCount: 0,
      byStatus: []
    },
    pipeline: {
      draftSupplyCount: 0,
      ordersAwaitingFulfillmentCount: 0
    }
  };
}

export function buildMonitoringCountQuery(
  selectedDepotIds: number[]
): { depotId?: number; depotIds?: number[] } {
  if (selectedDepotIds.length === 0) {
    return {};
  }
  if (selectedDepotIds.length === 1) {
    return { depotId: selectedDepotIds[0] };
  }
  return { depotIds: [...selectedDepotIds] };
}

export interface InventoryDashboardDataResult {
  lowStockCount: number;
  expiringSoonCount: number;
  itemSummaries: ItemInventorySummaryDto[];
  inventoryMonitoring: InventoryDashboardSummaryDto;
}

export function getInventoryDashboardData$(
  selectedDepotIds: number[],
  monitoringService: MonitoringService,
  inventorySummaryData: InventorySummaryDataService
): Observable<InventoryDashboardDataResult> {
  const ids = selectedDepotIds.length > 0 ? selectedDepotIds : undefined;
  const countQ = buildMonitoringCountQuery(selectedDepotIds);
  return forkJoin({
    lowStockCount: monitoringService
      .getLowStockItemsCount(countQ.depotId, countQ.depotIds)
      .pipe(catchError(() => of(0))),
    expiringSoonCount: monitoringService
      .getExpiringLotsCount(countQ.depotId, countQ.depotIds)
      .pipe(catchError(() => of(0))),
    itemSummaries: inventorySummaryData.loadMergedItemSummaries(ids).pipe(catchError(() => of([]))),
    inventoryMonitoring: monitoringService
      .getInventoryDashboardSummary(ids)
      .pipe(catchError(() => of(emptyInventoryMonitoring())))
  });
}

export function userAccountRefetch$(authService: BackendAuthService): Observable<void> {
  return authService.currentUser$.pipe(
    map(u => u?.id ?? null),
    filter((id): id is string => id != null && id.length > 0),
    distinctUntilChanged(),
    skip(1),
    map(() => void 0)
  );
}

export function enterInventoryDashboard$(
  router: Router,
  segment: string = INVENTORY_DASHBOARD_PATH_SEGMENT
): Observable<void> {
  return router.events.pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    map((e) => e.urlAfterRedirects),
    startWith(router.url),
    pairwise(),
    filter(
      ([from, to]) => pathHasInventoryDashboardSegment(to, segment) && !pathHasInventoryDashboardSegment(from, segment)
    ),
    map(() => void 0)
  );
}
