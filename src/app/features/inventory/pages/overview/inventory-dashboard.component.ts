import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, merge, of, forkJoin } from 'rxjs';
import { catchError, filter, map, startWith, switchMap, finalize, distinctUntilChanged, take } from 'rxjs/operators';
import {
  LucideAngularModule,
  RefreshCw,
  Package,
  Warehouse,
  Search,
  Shield,
  FilterX
} from 'lucide-angular';
import { BackendAuthService } from '@services/backend-auth.service';
import { MonitoringService } from '@services/monitoring.service';
import { InventoryService, LotDetailDto } from '@services/inventory.service';
import { AssetService } from '@services/asset.service';
import { InventorySummaryDataService } from '@services/inventory-summary-data.service';
import { LookupService } from '@services/lookup.service';
import { ItemInventorySummaryDto, ItemType } from '@models/inventory.model';
import { AssetDto } from '@models/asset.model';
import { DepotDto } from '@models/depot.model';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { DropdownComponent, DropdownOption } from '@shared/components/dropdown/dropdown.component';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslationService } from '@services/translation.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { defaultPageSize } from '@constants/app.constants';
import {
  filterItemSummaries,
  sortItemSummaries as sortItemSummariesHelper,
  sortLotDetails as sortLotDetailsHelper,
  distinctCalibersFromItems,
  sumItemSummariesField,
  ActiveTab
} from './inventory-dashboard.helpers';
import { InventoryItemSummaryTableComponent } from './inventory-item-summary-table.component';
import { InventoryDashboardStatCardsComponent } from './components/inventory-dashboard-stat-cards/inventory-dashboard-stat-cards.component';
import { InventoryDashboardWeaponPipelineComponent } from './components/inventory-dashboard-weapon-pipeline/inventory-dashboard-weapon-pipeline.component';
import { InventoryDashboardSummaryDto } from '@models/inventory-dashboard-monitoring.model';

const emptyInventoryMonitoring = (): InventoryDashboardSummaryDto => ({
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
});

@Component({
  selector: 'app-inventory-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    PaginationComponent,
    RowsPerPageComponent,
    DropdownComponent,
    InventoryItemSummaryTableComponent,
    InventoryDashboardStatCardsComponent,
    InventoryDashboardWeaponPipelineComponent
  ],
  templateUrl: './inventory-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryDashboardComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly manualRefresh$ = new Subject<void>();

  isLoading = false;
  errorMessage: string | null = null;

  // ── Global depot filter (multi-select) ────────────────────────────────────
  depots: DepotDto[] = [];
  /** Empty array = "All my depots" */
  selectedDepotIds: number[] = [];

  // ── Tab filter ────────────────────────────────────────────────────────────
  activeTab: ActiveTab = 'all';

  // ── Table filters (client-side) ───────────────────────────────────────────
  itemSearchText = '';
  caliberFilterText = '';
  /** null = all types (used when tab = 'all' with dropdown) */
  itemTypeFilter: number | null = null;
  /** Multi-select item filter — empty = all items */
  selectedItemFilterIds: number[] = [];

  // ── Alert stats (react to depot filter) ───────────────────────────────────
  lowStockCount = 0;
  expiringSoonCount = 0;

  /** Weapon assets + supply pipeline (multi-depot aligned with item summary). */
  inventoryMonitoring: InventoryDashboardSummaryDto = emptyInventoryMonitoring();

  // ── Item summary table ─────────────────────────────────────────────────────
  itemSummaries: ItemInventorySummaryDto[] = [];
  itemSortColumn: string | null = null;
  itemSortDirection: 'asc' | 'desc' = 'asc';
  itemCurrentPage = 1;
  itemRowsPerPage = defaultPageSize;

  // ── Lot detail expansion (ammunition / explosives) ─────────────────────────
  expandedItemId: number | null = null;
  lotDetails: LotDetailDto[] = [];
  isLotsLoading = false;
  lotSortColumn: string | null = null;
  lotSortDirection: 'asc' | 'desc' = 'asc';
  lotCurrentPage = 1;
  lotRowsPerPage = 10;

  // ── Asset detail expansion (weapons) ──────────────────────────────────────
  assetDetails: AssetDto[] = [];
  isAssetsLoading = false;
  assetSortColumn: string | null = null;
  assetSortDirection: 'asc' | 'desc' = 'asc';
  assetCurrentPage = 1;
  assetRowsPerPage = 10;

  // ── Icons ──────────────────────────────────────────────────────────────────
  readonly RefreshCw = RefreshCw;
  readonly Package = Package;
  readonly Warehouse = Warehouse;
  readonly Search = Search;
  readonly Shield = Shield;
  readonly FilterX = FilterX;

  constructor(
    private readonly authService: BackendAuthService,
    private readonly monitoringService: MonitoringService,
    private readonly inventoryService: InventoryService,
    private readonly inventorySummaryData: InventorySummaryDataService,
    private readonly assetService: AssetService,
    private readonly lookupService: LookupService,
    private readonly translate: TranslateService,
    private readonly translationService: TranslationService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router
  ) {}

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  ngOnInit(): void {
    this.lookupService.getDepotList().pipe(
      catchError(() => of([] as DepotDto[])),
      take(1),
      takeUntil(this.destroy$)
    ).subscribe((depots: DepotDto[]) => {
      this.depots = depots;
      // Pre-select all accessible depots so the user sees their data immediately
      this.selectedDepotIds = depots.map(d => d.id);
      this.cdr.markForCheck();
      this.setupLoadingPipeline();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data pipeline ──────────────────────────────────────────────────────────

  private setupLoadingPipeline(): void {
    const userChanges$ = this.authService.currentUser$.pipe(
      filter(user => !!user),
      map(() => 'user-change')
    );

    const navigationChanges$ = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      filter(() => this.router.url.startsWith('/inventory-dashboard')),
      map(() => 'navigation')
    );

    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());

    merge(
      userChanges$.pipe(distinctUntilChanged()),
      navigationChanges$,
      this.manualRefresh$
    ).pipe(
      startWith('initial-load'),
      switchMap(() => {
        this.isLoading = true;
        this.errorMessage = null;
        this.cdr.markForCheck();
        return this.fetchAllData();
      }),
      takeUntil(this.destroy$)
    ).subscribe(result => {
      if (result) {
        this.lowStockCount = result.lowStockCount;
        this.expiringSoonCount = result.expiringSoonCount;
        this.itemSummaries = result.itemSummaries;
        this.inventoryMonitoring = result.inventoryMonitoring ?? emptyInventoryMonitoring();
        this.itemCurrentPage = 1;
        this.expandedItemId = null;
        this.lotDetails = [];
        this.assetDetails = [];
        // Remove selected items that are no longer in the summary
        if (this.selectedItemFilterIds.length > 0) {
          const validIds = new Set(this.itemSummaries.map(i => i.itemId));
          this.selectedItemFilterIds = this.selectedItemFilterIds.filter(id => validIds.has(id));
        }
      }
      this.isLoading = false;
      this.cdr.markForCheck();
    });
  }

  private fetchAllData() {
    const ids = this.selectedDepotIds.length > 0 ? this.selectedDepotIds : undefined;
    // For monitoring endpoints pass only the first selected depot for now (single-depot APIs)
    const singleDepotId = this.selectedDepotIds.length === 1 ? this.selectedDepotIds[0] : undefined;
    return forkJoin({
      lowStockCount: this.monitoringService.getLowStockItemsCount(singleDepotId).pipe(catchError(() => of(0))),
      expiringSoonCount: this.monitoringService.getExpiringLotsCount(singleDepotId).pipe(catchError(() => of(0))),
      itemSummaries: this.inventorySummaryData.loadMergedItemSummaries(ids).pipe(catchError(() => of([]))),
      inventoryMonitoring: this.monitoringService.getInventoryDashboardSummary(ids).pipe(
        catchError(() => of(emptyInventoryMonitoring()))
      )
    }).pipe(
      catchError(err => {
        this.errorMessage = ErrorHandler.extractErrorMessage(err, 'Failed to load dashboard data');
        this.isLoading = false;
        this.cdr.markForCheck();
        return of(null);
      }),
      finalize(() => {
        this.isLoading = false;
        this.cdr.markForCheck();
      })
    );
  }

  onRefresh(): void {
    this.manualRefresh$.next();
  }

  // ── Global depot filter ────────────────────────────────────────────────────

  onDepotFilterChange(depotIds: number[] | null): void {
    this.selectedDepotIds = Array.isArray(depotIds) ? depotIds.map(Number) : [];
    this.clearTableFilters();
    this.manualRefresh$.next();
  }

  get selectedDepotLabels(): string {
    if (this.selectedDepotIds.length === 0) return '';
    const lang = getCurrentLang(this.translate);
    return this.selectedDepotIds
      .map(id => {
        const d = this.depots.find(x => x.id === id);
        return d ? (getLocalizedName(d, lang) || d.nameEn || d.nameAr) : String(id);
      })
      .join(', ');
  }

  getDepotName(depot: DepotDto): string {
    return getLocalizedName(depot, getCurrentLang(this.translate)) || depot.nameEn || depot.nameAr;
  }

  getDepotNameById(id: number): string {
    const d = this.depots.find(x => x.id === id);
    return d ? this.getDepotName(d) : String(id);
  }

  get depotDropdownOptions(): DropdownOption<number>[] {
    return this.depots.map(d => ({ label: this.getDepotName(d), value: d.id }));
  }

  get itemTypeDropdownOptions(): DropdownOption<number>[] {
    return [
      { label: this.translate.instant('inventoryDashboard.itemType.ammunition'), value: ItemType.Ammunition },
      { label: this.translate.instant('inventoryDashboard.itemType.weapon'), value: ItemType.Weapon },
      { label: this.translate.instant('inventoryDashboard.itemType.explosive'), value: ItemType.Explosive }
    ];
  }

  get itemPicklistOptions(): DropdownOption<number>[] {
    const rows = [...this.tabFilteredSummaries].sort((a, b) =>
      (a.itemName || '').localeCompare(b.itemName || '', undefined, { sensitivity: 'base' })
    );
    return rows.map(i => ({
      label: this.formatItemPickLabel(i),
      value: i.itemId
    }));
  }

  private formatItemPickLabel(i: ItemInventorySummaryDto): string {
    const no = (i.itemNo || '').trim();
    return no ? `${i.itemName} (${no})` : (i.itemName || '—');
  }

  // ── Tabs ───────────────────────────────────────────────────────────────────

  setActiveTab(tab: ActiveTab): void {
    this.activeTab = tab;
    this.itemTypeFilter = null;
    this.selectedItemFilterIds = [];
    this.itemCurrentPage = 1;
    this.expandedItemId = null;
    this.lotDetails = [];
    this.assetDetails = [];
    this.cdr.markForCheck();
  }

  get tabCounts(): { all: number; ammunition: number; weapon: number; explosive: number } {
    return {
      all: this.itemSummaries.length,
      ammunition: this.itemSummaries.filter(i => i.itemType === ItemType.Ammunition).length,
      weapon: this.itemSummaries.filter(i => i.itemType === ItemType.Weapon).length,
      explosive: this.itemSummaries.filter(i => i.itemType === ItemType.Explosive).length
    };
  }

  /** Items filtered only by active tab (before text/item filters). Used for item picker options. */
  get tabFilteredSummaries(): ItemInventorySummaryDto[] {
    if (this.activeTab === 'all') return this.itemSummaries;
    const tabType =
      this.activeTab === 'ammunition' ? ItemType.Ammunition :
      this.activeTab === 'weapon'     ? ItemType.Weapon     :
                                        ItemType.Explosive;
    return this.itemSummaries.filter(i => i.itemType === tabType);
  }

  // ── Table filters ──────────────────────────────────────────────────────────

  onItemSearchInput(): void {
    this.itemCurrentPage = 1;
    this.cdr.markForCheck();
  }

  onCaliberFilterInput(): void {
    this.itemCurrentPage = 1;
    this.cdr.markForCheck();
  }

  onItemTypeFilterChange(): void {
    this.itemCurrentPage = 1;
    this.expandedItemId = null;
    this.lotDetails = [];
    this.assetDetails = [];

    // Keep tab strip in sync with the item-type dropdown (All tab only)
    const raw = this.itemTypeFilter;
    if (raw === null || raw === undefined) {
      this.activeTab = 'all';
    } else {
      const t = Number(raw);
      if (t === ItemType.Ammunition) {
        this.activeTab = 'ammunition';
        this.itemTypeFilter = null;
      } else if (t === ItemType.Weapon) {
        this.activeTab = 'weapon';
        this.itemTypeFilter = null;
      } else if (t === ItemType.Explosive) {
        this.activeTab = 'explosive';
        this.itemTypeFilter = null;
      }
    }

    this.cdr.markForCheck();
  }

  onItemPickFilterChange(): void {
    this.itemCurrentPage = 1;
    this.cdr.markForCheck();
  }

  clearTableFilters(): void {
    this.activeTab = 'all';
    this.itemSearchText = '';
    this.caliberFilterText = '';
    this.itemTypeFilter = null;
    this.selectedItemFilterIds = [];
    this.itemCurrentPage = 1;
    this.expandedItemId = null;
    this.lotDetails = [];
    this.assetDetails = [];
    this.cdr.markForCheck();
  }

  get filteredItemSummaries(): ItemInventorySummaryDto[] {
    return filterItemSummaries(this.itemSummaries, {
      selectedItemFilterIds: this.selectedItemFilterIds,
      searchText: this.itemSearchText,
      caliberText: this.caliberFilterText,
      itemType: this.itemTypeFilter,
      activeTab: this.activeTab
    });
  }

  get distinctCalibers(): string[] {
    return distinctCalibersFromItems(this.tabFilteredSummaries);
  }

  get hasActiveTableFilters(): boolean {
    return (
      this.activeTab !== 'all' ||
      !!this.itemSearchText.trim() ||
      !!this.caliberFilterText.trim() ||
      this.itemTypeFilter !== null ||
      this.selectedItemFilterIds.length > 0
    );
  }

  get singleItemTotalsSubtitle(): string | null {
    if (this.filteredItemCount !== 1) return null;
    const i = this.filteredItemSummaries[0];
    if (!i) return null;
    const no = (i.itemNo || '').trim();
    if (no) {
      return this.translate.instant('inventoryDashboard.itemSummary.singleItemTotalsWithNo', {
        name: i.itemName,
        no
      });
    }
    return this.translate.instant('inventoryDashboard.itemSummary.singleItemTotalsNameOnly', { name: i.itemName });
  }

  // ── Computed stats ─────────────────────────────────────────────────────────

  get totalRemainingQty(): number {
    return this.itemSummaries.reduce((sum, i) => sum + (i.remainingQuantity ?? 0), 0);
  }

  get totalLotsStat(): number {
    return this.itemSummaries.reduce((sum, i) => sum + (i.totalLots ?? 0), 0);
  }

  get byType(): { ammo: number; weapon: number; explosive: number } {
    return {
      ammo: this.itemSummaries.filter(i => i.itemType === ItemType.Ammunition).length,
      weapon: this.itemSummaries.filter(i => i.itemType === ItemType.Weapon).length,
      explosive: this.itemSummaries.filter(i => i.itemType === ItemType.Explosive).length
    };
  }

  get sumTotalQtyFiltered(): number {
    return sumItemSummariesField(this.filteredItemSummaries, 'totalQuantity');
  }

  get sumUsedQtyFiltered(): number {
    return sumItemSummariesField(
      this.filteredItemSummaries.filter(i => i.itemType !== ItemType.Weapon),
      'usedQuantity'
    );
  }

  get sumReservedQtyFiltered(): number {
    return sumItemSummariesField(
      this.filteredItemSummaries.filter(i => i.itemType !== ItemType.Weapon),
      'reservedQuantityByOrdersOnProcessing'
    );
  }

  get sumRemainingQtyFiltered(): number {
    return sumItemSummariesField(
      this.filteredItemSummaries.filter(i => i.itemType !== ItemType.Weapon),
      'remainingQuantity'
    );
  }

  get sumLotsFiltered(): number {
    return sumItemSummariesField(
      this.filteredItemSummaries.filter(i => i.itemType !== ItemType.Weapon),
      'totalLots'
    );
  }

  // ── Item summary table ─────────────────────────────────────────────────────

  get sortedItemSummaries(): ItemInventorySummaryDto[] {
    return sortItemSummariesHelper(
      this.filteredItemSummaries,
      this.itemSortColumn,
      this.itemSortDirection
    );
  }

  get filteredItemCount(): number {
    return this.filteredItemSummaries.length;
  }

  get itemTotalPages(): number {
    return Math.ceil(this.filteredItemCount / this.itemRowsPerPage);
  }

  get paginatedItemSummaries(): ItemInventorySummaryDto[] {
    const sorted = this.sortedItemSummaries;
    const n = this.filteredItemCount;
    if (n === 0) return [];
    const totalPages = Math.ceil(n / this.itemRowsPerPage);
    const safePage = Math.min(Math.max(1, this.itemCurrentPage), totalPages);
    const start = (safePage - 1) * this.itemRowsPerPage;
    return sorted.slice(start, start + this.itemRowsPerPage);
  }

  sortItemsByColumn(column: string): void {
    if (this.itemSortColumn === column) {
      this.itemSortDirection = this.itemSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.itemSortColumn = column;
      this.itemSortDirection = 'asc';
    }
    this.itemCurrentPage = 1;
    this.cdr.markForCheck();
  }

  onItemPageChange(page: number): void {
    this.itemCurrentPage = page;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.cdr.markForCheck();
  }

  onItemRowsPerPageChange(rows: number): void {
    this.itemRowsPerPage = rows;
    this.itemCurrentPage = 1;
    this.cdr.markForCheck();
  }

  // ── Row expansion — routes to lots (ammo/explosive) or assets (weapon) ─────

  toggleItemExpand(item: ItemInventorySummaryDto): void {
    if (this.expandedItemId === item.itemId) {
      this.expandedItemId = null;
      this.lotDetails = [];
      this.assetDetails = [];
      this.cdr.markForCheck();
      return;
    }

    this.expandedItemId = item.itemId;
    this.lotDetails = [];
    this.assetDetails = [];
    this.lotCurrentPage = 1;
    this.assetCurrentPage = 1;
    this.cdr.markForCheck();

    if (item.itemType === ItemType.Weapon) {
      this.loadAssets(item);
    } else {
      this.loadLots(item);
    }
  }

  private loadLots(item: ItemInventorySummaryDto): void {
    this.isLotsLoading = true;
    this.cdr.markForCheck();
    // For single-depot selection pass that depot, otherwise no filter
    const depotId = this.selectedDepotIds.length === 1 ? this.selectedDepotIds[0] : undefined;
    this.inventoryService.getLotsByItemId(item.itemId, depotId).pipe(
      catchError(() => of([])),
      finalize(() => { this.isLotsLoading = false; this.cdr.markForCheck(); }),
      takeUntil(this.destroy$)
    ).subscribe(lots => {
      this.lotDetails = lots;
      this.cdr.markForCheck();
    });
  }

  private loadAssets(item: ItemInventorySummaryDto): void {
    this.isAssetsLoading = true;
    this.cdr.markForCheck();
    const depotId = this.selectedDepotIds.length === 1 ? this.selectedDepotIds[0] : undefined;
    this.assetService.getAssetsByItemId(item.itemId, depotId).pipe(
      catchError(() => of([])),
      finalize(() => { this.isAssetsLoading = false; this.cdr.markForCheck(); }),
      takeUntil(this.destroy$)
    ).subscribe(assets => {
      this.assetDetails = assets;
      this.cdr.markForCheck();
    });
  }

  // ── Lot pagination / sort ──────────────────────────────────────────────────

  get sortedLotDetails(): LotDetailDto[] {
    return sortLotDetailsHelper(this.lotDetails, this.lotSortColumn, this.lotSortDirection);
  }

  get lotTotalPages(): number {
    return Math.ceil(this.lotDetails.length / this.lotRowsPerPage);
  }

  get paginatedLotDetails(): LotDetailDto[] {
    const start = (this.lotCurrentPage - 1) * this.lotRowsPerPage;
    return this.sortedLotDetails.slice(start, start + this.lotRowsPerPage);
  }

  sortLotsByColumn(column: string): void {
    if (this.lotSortColumn === column) {
      this.lotSortDirection = this.lotSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.lotSortColumn = column;
      this.lotSortDirection = 'asc';
    }
    this.lotCurrentPage = 1;
    this.cdr.markForCheck();
  }

  onLotPageChange(page: number): void {
    this.lotCurrentPage = page;
    this.cdr.markForCheck();
  }

  onLotRowsPerPageChange(rows: number): void {
    this.lotRowsPerPage = rows;
    this.lotCurrentPage = 1;
    this.cdr.markForCheck();
  }

  // ── Asset pagination / sort ────────────────────────────────────────────────

  get sortedAssetDetails(): AssetDto[] {
    if (!this.assetSortColumn) return this.assetDetails;
    const col = this.assetSortColumn;
    const dir = this.assetSortDirection === 'asc' ? 1 : -1;
    return [...this.assetDetails].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[col] ?? '';
      const bv = (b as unknown as Record<string, unknown>)[col] ?? '';
      if (typeof av === 'string') return av.localeCompare(String(bv)) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  }

  get assetTotalPages(): number {
    return Math.ceil(this.assetDetails.length / this.assetRowsPerPage);
  }

  get paginatedAssetDetails(): AssetDto[] {
    const start = (this.assetCurrentPage - 1) * this.assetRowsPerPage;
    return this.sortedAssetDetails.slice(start, start + this.assetRowsPerPage);
  }

  sortAssetsByColumn(column: string): void {
    if (this.assetSortColumn === column) {
      this.assetSortDirection = this.assetSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.assetSortColumn = column;
      this.assetSortDirection = 'asc';
    }
    this.assetCurrentPage = 1;
    this.cdr.markForCheck();
  }

  onAssetPageChange(page: number): void {
    this.assetCurrentPage = page;
    this.cdr.markForCheck();
  }

  onAssetRowsPerPageChange(rows: number): void {
    this.assetRowsPerPage = rows;
    this.assetCurrentPage = 1;
    this.cdr.markForCheck();
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  onExpiringSoonClick(): void {
    this.router.navigate(['/inventory-dashboard/expiring-lots']);
  }

  onLowStockClick(): void {
    this.router.navigate(['/inventory-dashboard/low-stock']);
  }

  onDraftSuppliesClick(): void {
    const ids = this.selectedDepotIds.length > 0 ? this.selectedDepotIds : undefined;
    this.router.navigate(
      ['/inventory-dashboard/draft-supplies'],
      ids?.length ? { queryParams: { depotIds: ids } } : {}
    );
  }

  onOrdersAwaitingClick(): void {
    const ids = this.selectedDepotIds.length > 0 ? this.selectedDepotIds : undefined;
    this.router.navigate(
      ['/inventory-dashboard/orders-awaiting-fulfillment'],
      ids?.length ? { queryParams: { depotIds: ids } } : {}
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  get selectedDepotLabel(): string {
    if (this.selectedDepotIds.length === 0) return '';
    if (this.selectedDepotIds.length === 1) {
      const d = this.depots.find(x => x.id === this.selectedDepotIds[0]);
      return d ? this.getDepotName(d) : '';
    }
    return `${this.selectedDepotIds.length} ${this.translate.instant('inventoryDashboard.filter.depots')}`;
  }
}
