import { Router, NavigationEnd } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, filter, map, pairwise, startWith, skip, distinctUntilChanged } from 'rxjs/operators';
import { BackendAuthService } from '@services/backend-auth.service';
import { MonitoringService } from '@services/monitoring.service';
import { InventoryDashboardSummaryDto, InventoryHeadlineMetricsDto } from '@models/inventory-dashboard-monitoring.model';

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

export function emptyInventoryHeadlineMetrics(): InventoryHeadlineMetricsDto {
  return {
    lowStockCount: 0,
    expiringSoonCount: 0,
    totalDistinctItems: 0,
    totalRemainingQuantity: 0,
    totalLots: 0,
    weaponCount: 0,
    lotCount: 0,
    totalBatches: 0,
    ammunitionItemCount: 0,
    explosiveItemCount: 0,
    accessoryItemCount: 0,
    weaponItemGroupsCount: 0
  };
}

/** Headline + monitoring only; item table loads its own paged/sliced data in the component. */
export interface InventoryDashboardShellResult {
  headlineMetrics: InventoryHeadlineMetricsDto;
  inventoryMonitoring: InventoryDashboardSummaryDto;
}

export function getInventoryDashboard$(
  selectedDepotIds: number[],
  monitoringService: MonitoringService
): Observable<InventoryDashboardShellResult> {
  const ids = selectedDepotIds.length > 0 ? selectedDepotIds : undefined;

  return forkJoin({
    headlineMetrics: monitoringService
      .getInventoryHeadlineMetrics(ids)
      .pipe(catchError(() => of(emptyInventoryHeadlineMetrics()))),
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
