import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, merge, of, asyncScheduler, forkJoin } from 'rxjs';
import {
  catchError,
  switchMap,
  finalize,
  take,
  takeUntil,
  debounceTime
} from 'rxjs/operators';
import {
  LucideAngularModule,
  RefreshCw,
  Package,
  Warehouse,
  Search,
  Shield,
  FilterX,
  FileDown
} from 'lucide-angular';
import { BackendAuthService } from '@services/backend-auth.service';
import { MonitoringService } from '@services/monitoring.service';
import { InventoryService, LotDetailDto } from '@inventory/services/inventory.service';
import { AssetService } from '@assets/services/asset.service';
import { InventorySummaryDataService } from '@inventory/services/inventory-summary-data.service';
import { LookupService } from '@services/lookup.service';
import { ItemInventorySummaryDto, ItemType } from '@models/inventory.model';
import { AssetDto } from '@models/asset.model';
import { DepotDto } from '@models/depot.model';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { getLookupDropdownLabel } from '@utils/asset-list.utils';
import { LookupItem } from '@models/lookup.model';
import { TranslationService } from '@services/translation.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { defaultPageSize } from '@constants/app.constants';
import {
  activeTabFromItemTypeDropdown,
  filterItemSummaries,
  filterItemSummariesByActiveTab,
  formatItemPickLabel,
  hasActiveItemTableFilters,
  itemTypeTabAndStatCounts,
  nextTableSort,
  pageCountForLength,
  paginatePage,
  sortItemSummaries as sortItemSummariesHelper,
  sortLotDetails as sortLotDetailsHelper,
  distinctCalibersFromItems,
  isPlaceholderCaliberLabel,
  sumItemSummariesExcludingWeapon,
  sumItemSummariesField,
  sortAssetDetailsDtos,
  totalRemainingFromSummaries,
  totalLotsFromSummaries,
  ActiveTab
} from './inventory-dashboard.helpers';
import { InventoryItemSummaryTableComponent } from './inventory-item-summary-table.component';
import { InventoryDashboardStatCardsComponent } from './components/inventory-dashboard-stat-cards/inventory-dashboard-stat-cards.component';
import { InventoryDashboardWeaponPipelineComponent } from './components/inventory-dashboard-weapon-pipeline/inventory-dashboard-weapon-pipeline.component';
import { InventoryDashboardSummaryDto } from '@models/inventory-dashboard-monitoring.model';
import { InventoryDashboardExportService } from '@inventory/services/inventory-dashboard-export.service';
import {
  emptyInventoryMonitoring,
  enterInventoryDashboard$,
  getInventoryDashboardData$,
  userAccountRefetch$
} from './inventory-dashboard.data-load';

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
  private readonly afterDepotsReady$ = new Subject<void>();
  private loadingPipelineWired = false;

  isLoading = false;
  isExporting = false;
  errorMessage: string | null = null;

  depots: DepotDto[] = [];
  selectedDepotIds: number[] = [];

  activeTab: ActiveTab = 'all';

  itemSearchText = '';
  caliberFilter: string | null = null;
  itemTypeFilter: number | null = null;
  selectedItemFilterIds: number[] = [];

  /** Caliber display labels from lookup API (merged into filter dropdown with {@link distinctCalibers}). */
  caliberFilterCatalogLabels: string[] = [];

  lowStockCount = 0;
  expiringSoonCount = 0;

  inventoryMonitoring: InventoryDashboardSummaryDto = emptyInventoryMonitoring();

  itemSummaries: ItemInventorySummaryDto[] = [];
  private _itemTypeCountMetrics = itemTypeTabAndStatCounts([]);
  itemSortColumn: string | null = null;
  itemSortDirection: 'asc' | 'desc' = 'asc';
  itemCurrentPage = 1;
  itemRowsPerPage = defaultPageSize;

  expandedItemId: number | null = null;
  lotDetails: LotDetailDto[] = [];
  isLotsLoading = false;
  lotSortColumn: string | null = null;
  lotSortDirection: 'asc' | 'desc' = 'asc';
  lotCurrentPage = 1;
  lotRowsPerPage = 10;

  assetDetails: AssetDto[] = [];
  isAssetsLoading = false;
  assetSortColumn: string | null = null;
  assetSortDirection: 'asc' | 'desc' = 'asc';
  assetCurrentPage = 1;
  assetRowsPerPage = 10;

  readonly RefreshCw = RefreshCw;
  readonly Package = Package;
  readonly Warehouse = Warehouse;
  readonly Search = Search;
  readonly Shield = Shield;
  readonly FilterX = FilterX;
  readonly FileDown = FileDown;

  constructor(
    private readonly authService: BackendAuthService,
    private readonly monitoringService: MonitoringService,
    private readonly inventoryService: InventoryService,
    private readonly inventorySummaryData: InventorySummaryDataService,
    private readonly assetService: AssetService,
    private readonly lookupService: LookupService,
    private readonly translate: TranslateService,
    private readonly translationService: TranslationService,
    private readonly exportService: InventoryDashboardExportService,
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
      this.selectedDepotIds = depots.map(d => d.id);
      this.cdr.markForCheck();
      this.setupLoadingPipeline();
      this.afterDepotsReady$.next();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupLoadingPipeline(): void {
    if (this.loadingPipelineWired) {
      return;
    }
    this.loadingPipelineWired = true;

    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadCaliberFilterLookups();
        this.cdr.markForCheck();
      });

    merge(
      this.afterDepotsReady$,
      this.manualRefresh$,
      userAccountRefetch$(this.authService),
      enterInventoryDashboard$(this.router)
    )
      .pipe(
        debounceTime(0, asyncScheduler),
        switchMap(() => {
          this.isLoading = true;
          this.errorMessage = null;
          this.cdr.markForCheck();
          return this.fetchAllData();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(result => {
        if (result) {
          this.applyDashboardData(result);
        }
      });
  }

  private applyDashboardData(result: {
    lowStockCount: number;
    expiringSoonCount: number;
    itemSummaries: ItemInventorySummaryDto[];
    inventoryMonitoring: InventoryDashboardSummaryDto | null;
  }): void {
    this.lowStockCount = result.lowStockCount;
    this.expiringSoonCount = result.expiringSoonCount;
    this.itemSummaries = result.itemSummaries;
    this._itemTypeCountMetrics = itemTypeTabAndStatCounts(this.itemSummaries);
    this.inventoryMonitoring = result.inventoryMonitoring ?? emptyInventoryMonitoring();
    this.loadCaliberFilterLookups();
    this.itemCurrentPage = 1;
    this.expandedItemId = null;
    this.lotDetails = [];
    this.assetDetails = [];
    if (this.selectedItemFilterIds.length > 0) {
      const validIds = new Set(this.itemSummaries.map(i => i.itemId));
      this.selectedItemFilterIds = this.selectedItemFilterIds.filter(id => validIds.has(id));
    }
  }

  private fetchAllData() {
    return getInventoryDashboardData$(
      this.selectedDepotIds,
      this.monitoringService,
      this.inventorySummaryData
    ).pipe(
      catchError(err => {
        this.errorMessage = ErrorHandler.extractErrorMessage(err, 'Failed to load dashboard data');
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

  onExport(): void {
    if (this.isLoading || this.isExporting || this.sortedItemSummaries.length === 0) return;

    this.isExporting = true;
    this.cdr.markForCheck();
    try {
      this.exportService.exportItemSummariesToExcel(this.sortedItemSummaries, {
        depotLabel: this.selectedDepotLabel,
        activeTab: this.activeTab,
        filters: {
          searchText: this.itemSearchText,
          caliberText: (this.caliberFilter ?? '').trim() || undefined,
          itemTypeFilter: this.itemTypeFilter,
          selectedItemCount: this.selectedItemFilterIds.length
        },
        totals: {
          itemCount: this.filteredItemCount,
          totalQuantity: this.sumTotalQtyFiltered,
          usedQuantity: this.sumUsedQtyFiltered,
          reservedQuantity: this.sumReservedQtyFiltered,
          remainingQuantity: this.sumRemainingQtyFiltered,
          totalLots: this.sumLotsFiltered
        }
      });
    } finally {
      this.isExporting = false;
      this.cdr.markForCheck();
    }
  }

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
      label: formatItemPickLabel(i),
      value: i.itemId
    }));
  }

  get caliberDropdownOptions(): DropdownOption<string>[] {
    const labels = new Set<string>();
    for (const c of this.distinctCalibers) {
      if (c && !isPlaceholderCaliberLabel(c)) labels.add(c);
    }
    for (const c of this.caliberFilterCatalogLabels) {
      if (c && !isPlaceholderCaliberLabel(c)) labels.add(c);
    }
    return [...labels].sort((a, b) => a.localeCompare(b)).map(c => ({ label: c, value: c }));
  }

  get itemTypeCountMetrics() {
    return this._itemTypeCountMetrics;
  }

  setActiveTab(tab: ActiveTab): void {
    this.activeTab = tab;
    this.itemTypeFilter = null;
    this.selectedItemFilterIds = [];
    this.caliberFilter = null;
    this.itemCurrentPage = 1;
    this.expandedItemId = null;
    this.lotDetails = [];
    this.assetDetails = [];
    this.loadCaliberFilterLookups();
    this.cdr.markForCheck();
  }

  /** Populate caliber filter labels from Caliber lookup (ammunition + weapon); explosives omit. */
  private loadCaliberFilterLookups(): void {
    if (this.activeTab === 'explosive') {
      this.caliberFilterCatalogLabels = [];
      this.cdr.markForCheck();
      return;
    }
    if (this.activeTab === 'all') {
      forkJoin({
        ammo: this.lookupService.getCalibersByItemType(ItemType.Ammunition),
        wpn: this.lookupService.getCalibersByItemType(ItemType.Weapon)
      })
        .pipe(
          catchError(() => of({ ammo: [] as LookupItem[], wpn: [] as LookupItem[] })),
          takeUntil(this.destroy$)
        )
        .subscribe(({ ammo, wpn }) => {
          const merged = [...this.mapCalibersToFilterLabels(ammo), ...this.mapCalibersToFilterLabels(wpn)];
          this.caliberFilterCatalogLabels = [...new Set(merged)].sort((a, b) => a.localeCompare(b));
          this.cdr.markForCheck();
        });
      return;
    }
    const itemType =
      this.activeTab === 'ammunition' ? ItemType.Ammunition : ItemType.Weapon;
    this.lookupService
      .getCalibersByItemType(itemType)
      .pipe(
        catchError(() => of([] as LookupItem[])),
        takeUntil(this.destroy$)
      )
      .subscribe(items => {
        this.caliberFilterCatalogLabels = this.mapCalibersToFilterLabels(items).sort((a, b) =>
          a.localeCompare(b)
        );
        this.cdr.markForCheck();
      });
  }

  private mapCalibersToFilterLabels(items: LookupItem[]): string[] {
    const out: string[] = [];
    for (const it of items ?? []) {
      if (it == null || it.isDeleted) continue;
      const lab = getLookupDropdownLabel(it, this.translate).trim();
      if (lab && !isPlaceholderCaliberLabel(lab)) out.push(lab);
    }
    return out;
  }

  get tabFilteredSummaries(): ItemInventorySummaryDto[] {
    return filterItemSummariesByActiveTab(this.itemSummaries, this.activeTab);
  }

  onItemSearchInput(): void {
    this.itemCurrentPage = 1;
    this.cdr.markForCheck();
  }

  onCaliberFilterChange(): void {
    this.itemCurrentPage = 1;
    this.cdr.markForCheck();
  }

  onItemTypeFilterChange(): void {
    this.itemCurrentPage = 1;
    this.expandedItemId = null;
    this.lotDetails = [];
    this.assetDetails = [];
    const next = activeTabFromItemTypeDropdown(this.itemTypeFilter);
    this.activeTab = next.activeTab;
    this.itemTypeFilter = next.itemTypeFilter;
    this.loadCaliberFilterLookups();
    this.cdr.markForCheck();
  }

  onItemPickFilterChange(): void {
    this.itemCurrentPage = 1;
    this.cdr.markForCheck();
  }

  clearTableFilters(): void {
    this.activeTab = 'all';
    this.itemSearchText = '';
    this.caliberFilter = null;
    this.itemTypeFilter = null;
    this.selectedItemFilterIds = [];
    this.itemCurrentPage = 1;
    this.expandedItemId = null;
    this.lotDetails = [];
    this.assetDetails = [];
    this.loadCaliberFilterLookups();
    this.cdr.markForCheck();
  }

  get filteredItemSummaries(): ItemInventorySummaryDto[] {
    return filterItemSummaries(this.itemSummaries, {
      selectedItemFilterIds: this.selectedItemFilterIds,
      searchText: this.itemSearchText,
      caliberSelection: this.caliberFilter,
      itemType: this.itemTypeFilter,
      activeTab: this.activeTab
    });
  }

  get distinctCalibers(): string[] {
    return distinctCalibersFromItems(this.tabFilteredSummaries);
  }

  get hasActiveTableFilters(): boolean {
    return hasActiveItemTableFilters(
      this.activeTab,
      this.itemSearchText,
      this.caliberFilter,
      this.itemTypeFilter,
      this.selectedItemFilterIds
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

  get totalRemainingQty(): number {
    return totalRemainingFromSummaries(this.itemSummaries);
  }

  get totalLotsStat(): number {
    return totalLotsFromSummaries(this.itemSummaries);
  }

  get sumTotalQtyFiltered(): number {
    return sumItemSummariesField(this.filteredItemSummaries, 'totalQuantity');
  }

  get sumUsedQtyFiltered(): number {
    return sumItemSummariesExcludingWeapon(this.filteredItemSummaries, 'usedQuantity');
  }

  get sumReservedQtyFiltered(): number {
    return sumItemSummariesExcludingWeapon(
      this.filteredItemSummaries,
      'reservedQuantityByOrdersOnProcessing'
    );
  }

  get sumRemainingQtyFiltered(): number {
    return sumItemSummariesExcludingWeapon(this.filteredItemSummaries, 'remainingQuantity');
  }

  get sumLotsFiltered(): number {
    return sumItemSummariesExcludingWeapon(this.filteredItemSummaries, 'totalLots');
  }

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
    return pageCountForLength(this.filteredItemCount, this.itemRowsPerPage);
  }

  get paginatedItemSummaries(): ItemInventorySummaryDto[] {
    return paginatePage(this.sortedItemSummaries, this.itemCurrentPage, this.itemRowsPerPage);
  }

  sortItemsByColumn(column: string): void {
    const next = nextTableSort(column, this.itemSortColumn, this.itemSortDirection);
    this.itemSortColumn = next.sortColumn;
    this.itemSortDirection = next.sortDirection;
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

  get sortedLotDetails(): LotDetailDto[] {
    return sortLotDetailsHelper(this.lotDetails, this.lotSortColumn, this.lotSortDirection);
  }

  get lotTotalPages(): number {
    return pageCountForLength(this.lotDetails.length, this.lotRowsPerPage);
  }

  get paginatedLotDetails(): LotDetailDto[] {
    return paginatePage(this.sortedLotDetails, this.lotCurrentPage, this.lotRowsPerPage);
  }

  sortLotsByColumn(column: string): void {
    const next = nextTableSort(column, this.lotSortColumn, this.lotSortDirection);
    this.lotSortColumn = next.sortColumn;
    this.lotSortDirection = next.sortDirection;
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

  get sortedAssetDetails(): AssetDto[] {
    return sortAssetDetailsDtos(this.assetDetails, this.assetSortColumn, this.assetSortDirection);
  }

  get assetTotalPages(): number {
    return pageCountForLength(this.assetDetails.length, this.assetRowsPerPage);
  }

  get paginatedAssetDetails(): AssetDto[] {
    return paginatePage(this.sortedAssetDetails, this.assetCurrentPage, this.assetRowsPerPage);
  }

  sortAssetsByColumn(column: string): void {
    const next = nextTableSort(column, this.assetSortColumn, this.assetSortDirection);
    this.assetSortColumn = next.sortColumn;
    this.assetSortDirection = next.sortDirection;
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

  get selectedDepotLabel(): string {
    return this.selectedDepotLabels;
  }
}
