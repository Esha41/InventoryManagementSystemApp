import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, merge, of, asyncScheduler, forkJoin, Observable } from 'rxjs';
import {
  catchError,
  switchMap,
  finalize,
  take,
  takeUntil,
  debounceTime,
  map
} from 'rxjs/operators';
import {
  LucideAngularModule,
  Loader2,
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
import { ItemInventorySummaryDto, ItemType, normalizeItemType } from '@models/inventory.model';
import { AssetDto } from '@models/asset.model';
import { FilterData, PagedListRequest, PaginatedList } from '@models/pagination.model';
import { DepotDto } from '@models/depot.model';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { CardComponent } from '@components/card/card.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { getLookupDropdownLabel } from '@utils/asset-list.utils';
import { LookupItem } from '@models/lookup.model';
import { TranslationService } from '@services/translation.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { defaultPageSize } from '@constants/app.constants';
import {
  filterItemSummaries,
  filterItemSummariesByActiveTab,
  formatItemPickLabel,
  hasSecondaryItemTableFilters,
  itemTypeTabAndStatCountsFromHeadline,
  nextTableSort,
  pageCountForLength,
  paginatePage,
  sortItemSummaries as sortItemSummariesHelper,
  sortLotDetails as sortLotDetailsHelper,
  isPlaceholderCaliberLabel,
  sumItemSummariesExcludingWeapon,
  sumItemSummariesField,
  sortAssetDetailsDtos,
  ActiveTab
} from './inventory-dashboard.helpers';
import { InventoryItemSummaryTableComponent } from './inventory-item-summary-table.component';
import { InventoryDashboardStatCardsComponent } from './components/inventory-dashboard-stat-cards/inventory-dashboard-stat-cards.component';
import { InventoryDashboardWeaponPipelineComponent } from './components/inventory-dashboard-weapon-pipeline/inventory-dashboard-weapon-pipeline.component';
import { InventoryDashboardSummaryDto, InventoryHeadlineMetricsDto } from '@models/inventory-dashboard-monitoring.model';
import { InventoryDashboardExportService } from '@inventory/services/inventory-dashboard-export.service';
import {
  emptyInventoryMonitoring,
  emptyInventoryHeadlineMetrics,
  enterInventoryDashboard$,
  getInventoryDashboard$,
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
    CardComponent,
    InventoryItemSummaryTableComponent,
    InventoryDashboardStatCardsComponent,
    InventoryDashboardWeaponPipelineComponent
  ],
  templateUrl: './inventory-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryDashboardComponent implements OnInit, OnDestroy {
  @ViewChild('depotDropdown') depotDropdownRef?: DropdownComponent<number>;

  private readonly destroy$ = new Subject<void>();
  private readonly manualRefresh$ = new Subject<void>();
  private readonly afterDepotsReady$ = new Subject<void>();
  private loadingPipelineWired = false;

  /** True until initial depot list + first dashboard bundle resolve (also during refresh). */
  isLoading = true;
  isExporting = false;
  errorMessage: string | null = null;

  depots: DepotDto[] = [];
  selectedDepotIds: number[] = [];
  /** Working selection for depot dropdown until Apply. */
  pendingDepotIds: number[] = [];

  /** Above this count (and when not all depots), header shows one summary chip instead of per-depot badges. */
  readonly depotHeaderMaxIndividualBadges = 4;
  /** Dropdown trigger collapses to one summary line when selection has at least this many depots. */
  readonly depotDropdownCollapseBadgeCount = 5;

  activeTab: ActiveTab = 'ammunition';

  itemSearchText = '';
  caliberFilterId: number | null = null;
  selectedItemFilterIds: number[] = [];

  /** Caliber lookups for filter dropdown (optionValue = id, like asset list). */
  caliberFilterLookupItems: LookupItem[] = [];

  inventoryMonitoring: InventoryDashboardSummaryDto = emptyInventoryMonitoring();

  headlineMetrics: InventoryHeadlineMetricsDto = emptyInventoryHeadlineMetrics();

  itemSummaries: ItemInventorySummaryDto[] = [];
  /** Total non-weapon rows for active Ammunition/Explosive tab (server paged). */
  serverNonWeaponTotalCount = 0;
  isItemTableLoading = false;
  private _itemTypeCountMetrics = itemTypeTabAndStatCountsFromHeadline(emptyInventoryHeadlineMetrics());
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
  lotRowsPerPage = defaultPageSize;

  assetDetails: AssetDto[] = [];
  /** Total weapon assets for expanded row (server paged); not the same as {@link assetDetails.length}. */
  assetServerTotalCount = 0;
  isAssetsLoading = false;
  assetSortColumn: string | null = null;
  assetSortDirection: 'asc' | 'desc' = 'asc';
  assetCurrentPage = 1;
  assetRowsPerPage = defaultPageSize;

  readonly Loader2 = Loader2;
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
      const ids = depots.map(d => d.id);
      this.selectedDepotIds = ids;
      this.pendingDepotIds = [...ids];
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
    headlineMetrics: InventoryHeadlineMetricsDto;
    itemSummaries: ItemInventorySummaryDto[];
    inventoryMonitoring: InventoryDashboardSummaryDto | null;
    serverNonWeaponTotalCount: number;
  }): void {
    this.headlineMetrics = result.headlineMetrics ?? emptyInventoryHeadlineMetrics();
    this.itemSummaries = result.itemSummaries;
    this.serverNonWeaponTotalCount = result.serverNonWeaponTotalCount;
    this._itemTypeCountMetrics = itemTypeTabAndStatCountsFromHeadline(this.headlineMetrics);
    this.inventoryMonitoring = result.inventoryMonitoring ?? emptyInventoryMonitoring();
    this.loadCaliberFilterLookups();
    this.expandedItemId = null;
    this.lotDetails = [];
    this.assetDetails = [];
    this.assetServerTotalCount = 0;
    if (this.selectedItemFilterIds.length > 0) {
      const validIds = new Set(this.itemSummaries.map(i => i.itemId));
      this.selectedItemFilterIds = this.selectedItemFilterIds.filter(id => validIds.has(id));
    }
  }

  private loadDashboardItemsBundle$(): Observable<{
    itemSummaries: ItemInventorySummaryDto[];
    serverNonWeaponTotalCount: number;
  }> {
    const ids = this.selectedDepotIds.length > 0 ? this.selectedDepotIds : undefined;
    if (hasSecondaryItemTableFilters(
      this.itemSearchText,
      this.caliberFilterId,
      this.selectedItemFilterIds
    )) {
      return this.inventorySummaryData.loadAllWarehouseSummaryItems(this.activeTab, ids).pipe(
        map(items => ({
          itemSummaries: items,
          serverNonWeaponTotalCount: items.length
        }))
      );
    }
    if (this.activeTab === 'weapon') {
      return this.inventorySummaryData.loadDashboardWeaponPage(
        ids,
        this.itemCurrentPage,
        this.itemRowsPerPage
      );
    }
    const itemType =
      this.activeTab === 'ammunition' ? ItemType.Ammunition : ItemType.Explosive;
    return this.inventorySummaryData.loadDashboardItemPage(
      ids,
      this.itemCurrentPage,
      this.itemRowsPerPage,
      itemType
    );
  }

  /** Refetch item table only (server page / weapon list) after page or page-size change. */
  private fetchItemSummariesPageOnly(): void {
    this.isItemTableLoading = true;
    this.cdr.markForCheck();
    this.loadDashboardItemsBundle$()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isItemTableLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe(bundle => {
        this.itemSummaries = bundle.itemSummaries;
        this.serverNonWeaponTotalCount = bundle.serverNonWeaponTotalCount;
        this.expandedItemId = null;
        this.lotDetails = [];
        this.assetDetails = [];
        this.assetServerTotalCount = 0;
        if (this.selectedItemFilterIds.length > 0) {
          const validIds = new Set(this.itemSummaries.map(i => i.itemId));
          this.selectedItemFilterIds = this.selectedItemFilterIds.filter(id => validIds.has(id));
        }
        this.cdr.markForCheck();
      });
  }

  private fetchAllData() {
    return forkJoin({
      shell: getInventoryDashboard$(this.selectedDepotIds, this.monitoringService),
      items: this.loadDashboardItemsBundle$()
    }).pipe(
      map(({ shell, items }) => ({
        headlineMetrics: shell.headlineMetrics,
        inventoryMonitoring: shell.inventoryMonitoring,
        itemSummaries: items.itemSummaries,
        serverNonWeaponTotalCount: items.serverNonWeaponTotalCount
      })),
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

  onExport(): void {
    if (this.isLoading || this.isItemTableLoading || this.isExporting || this.sortedItemSummaries.length === 0) return;

    this.isExporting = true;
    this.cdr.markForCheck();
    try {
      this.exportService.exportItemSummariesToExcel(this.sortedItemSummaries, {
        depotLabel: this.selectedDepotLabel,
        activeTab: this.activeTab,
        filters: {
          searchText: this.itemSearchText,
          caliberText: this.getCaliberFilterExportLabel(),
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

  private commitDepotSelection(ids: number[]): void {
    this.selectedDepotIds = ids.map(Number);
    this.clearTableFilters();
    this.manualRefresh$.next();
  }

  onDepotDropdownOpened(_open: boolean): void {
    this.pendingDepotIds = [...this.selectedDepotIds];
    this.cdr.markForCheck();
  }

  onDepotSelectionPending(): void {
    this.cdr.markForCheck();
  }

  onApplyDepotSelection(): void {
    this.commitDepotSelection(this.pendingDepotIds);
    this.depotDropdownRef?.closePanel();
    this.cdr.markForCheck();
  }

  onCancelDepotSelection(): void {
    this.pendingDepotIds = [...this.selectedDepotIds];
    this.depotDropdownRef?.closePanel();
    this.cdr.markForCheck();
  }

  onClearDepotSelection(): void {
    this.pendingDepotIds = [];
    this.cdr.markForCheck();
  }

  get isAllDepotsSelected(): boolean {
    return this.depots.length > 0 && this.selectedDepotIds.length === this.depots.length;
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

  get itemPicklistOptions(): DropdownOption<number>[] {
    const rows = [...this.tabFilteredSummaries].sort((a, b) =>
      (a.itemName || '').localeCompare(b.itemName || '', undefined, { sensitivity: 'base' })
    );
    return rows.map(i => ({
      label: formatItemPickLabel(i),
      value: i.itemId
    }));
  }

  get caliberDropdownOptions(): DropdownOption<number>[] {
    return this.caliberFilterLookupItems
      .filter(it => it != null && !it.isDeleted && it.id != null)
      .map(it => ({
        label: getLookupDropdownLabel(it, this.translate).trim(),
        value: it.id!
      }))
      .filter(opt => opt.label && !isPlaceholderCaliberLabel(opt.label))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  get itemTypeCountMetrics() {
    return this._itemTypeCountMetrics;
  }

  /** Stat cards "by type" — from headline API (excludes accessory in UI breakdown). */
  get statCardByType(): { ammo: number; weapon: number; explosive: number } {
    const h = this.headlineMetrics;
    return {
      ammo: h.ammunitionItemCount,
      weapon: h.weaponItemGroupsCount,
      explosive: h.explosiveItemCount
    };
  }

  setActiveTab(tab: ActiveTab): void {
    this.activeTab = tab;
    this.selectedItemFilterIds = [];
    this.caliberFilterId = null;
    this.itemCurrentPage = 1;
    this.expandedItemId = null;
    this.lotDetails = [];
    this.assetDetails = [];
    this.assetServerTotalCount = 0;
    this.loadCaliberFilterLookups();
    this.fetchItemSummariesPageOnly();
  }

  /** Show type tabs from headline counts (table may be one server page only). */
  get showItemTypeTabs(): boolean {
    const h = this.headlineMetrics;
    return (
      !this.isLoading &&
      h.ammunitionItemCount + h.explosiveItemCount + h.weaponItemGroupsCount > 0
    );
  }

  /** When true, item page index is applied on the server (inventory summary or asset catalog paged APIs). */
  private get useInventoryServerPaging(): boolean {
    return (
      (this.activeTab === 'ammunition' ||
        this.activeTab === 'explosive' ||
        this.activeTab === 'weapon') &&
      !hasSecondaryItemTableFilters(
        this.itemSearchText,
        this.caliberFilterId,
        this.selectedItemFilterIds
      )
    );
  }

  /** Populate caliber filter labels from Caliber lookup (ammunition + weapon); explosives omit. */
  private loadCaliberFilterLookups(): void {
    if (this.activeTab === 'explosive') {
      this.caliberFilterLookupItems = [];
      this.cdr.markForCheck();
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
        this.caliberFilterLookupItems = items ?? [];
        this.cdr.markForCheck();
      });
  }

  private getCaliberFilterExportLabel(): string | undefined {
    if (this.caliberFilterId == null) return undefined;
    const item = this.caliberFilterLookupItems.find(c => c.id === this.caliberFilterId);
    if (!item) return undefined;
    const lab = getLookupDropdownLabel(item, this.translate).trim();
    return lab || undefined;
  }

  get tabFilteredSummaries(): ItemInventorySummaryDto[] {
    return filterItemSummariesByActiveTab(this.itemSummaries, this.activeTab);
  }

  onItemSearchInput(): void {
    this.itemCurrentPage = 1;
    this.fetchItemSummariesPageOnly();
    this.syncExpandedWeaponAssetsAfterClientTableFilterChange();
    this.cdr.markForCheck();
  }

  onCaliberFilterChange(): void {
    this.itemCurrentPage = 1;
    this.fetchItemSummariesPageOnly();
    this.syncExpandedWeaponAssetsAfterClientTableFilterChange();
    this.cdr.markForCheck();
  }

  onItemPickFilterChange(): void {
    this.itemCurrentPage = 1;
    this.fetchItemSummariesPageOnly();
    this.syncExpandedWeaponAssetsAfterClientTableFilterChange();
    this.cdr.markForCheck();
  }

  clearTableFilters(): void {
    this.itemSearchText = '';
    this.caliberFilterId = null;
    this.selectedItemFilterIds = [];
    this.itemCurrentPage = 1;
    this.expandedItemId = null;
    this.lotDetails = [];
    this.assetDetails = [];
    this.assetServerTotalCount = 0;
    this.loadCaliberFilterLookups();
    if (this.activeTab === 'ammunition' || this.activeTab === 'explosive' || this.activeTab === 'weapon') {
      this.fetchItemSummariesPageOnly();
    } else {
      this.cdr.markForCheck();
    }
  }

  get filteredItemSummaries(): ItemInventorySummaryDto[] {
    return filterItemSummaries(this.itemSummaries, {
      selectedItemFilterIds: this.selectedItemFilterIds,
      searchText: this.itemSearchText,
      caliberFilterId: this.caliberFilterId,
      activeTab: this.activeTab
    });
  }

  get hasSecondaryTableFilters(): boolean {
    return hasSecondaryItemTableFilters(
      this.itemSearchText,
      this.caliberFilterId,
      this.selectedItemFilterIds
    );
  }

  get showTableTotalsHint(): boolean {
    return (
      this.itemSummaries.length > 0 &&
      (this.itemSummaries.length !== this.filteredItemCount || this.hasSecondaryTableFilters)
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

  get itemTableTotalItemsForPager(): number {
    if (this.useInventoryServerPaging) {
      return this.serverNonWeaponTotalCount;
    }
    return this.filteredItemCount;
  }

  get filteredItemCount(): number {
    return this.filteredItemSummaries.length;
  }

  get itemTotalPages(): number {
    if (this.useInventoryServerPaging) {
      return pageCountForLength(this.serverNonWeaponTotalCount, this.itemRowsPerPage);
    }
    return pageCountForLength(this.filteredItemCount, this.itemRowsPerPage);
  }

  get paginatedItemSummaries(): ItemInventorySummaryDto[] {
    if (this.useInventoryServerPaging) {
      return this.sortedItemSummaries;
    }
    return paginatePage(this.sortedItemSummaries, this.itemCurrentPage, this.itemRowsPerPage);
  }

  sortItemsByColumn(column: string): void {
    const next = nextTableSort(column, this.itemSortColumn, this.itemSortDirection);
    this.itemSortColumn = next.sortColumn;
    this.itemSortDirection = next.sortDirection;
    if (!this.useInventoryServerPaging) {
      this.itemCurrentPage = 1;
    }
    this.cdr.markForCheck();
  }

  onItemPageChange(page: number): void {
    if (page === this.itemCurrentPage) return;
    this.itemCurrentPage = page;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (this.useInventoryServerPaging) {
      this.fetchItemSummariesPageOnly();
    } else {
      this.cdr.markForCheck();
    }
  }

  onItemRowsPerPageChange(rows: number): void {
    if (rows === this.itemRowsPerPage) return;
    this.itemRowsPerPage = rows;
    this.itemCurrentPage = 1;
    if (this.useInventoryServerPaging) {
      this.fetchItemSummariesPageOnly();
    } else {
      this.cdr.markForCheck();
    }
  }

  toggleItemExpand(item: ItemInventorySummaryDto): void {
    if (this.expandedItemId === item.itemId) {
      this.expandedItemId = null;
      this.lotDetails = [];
      this.assetDetails = [];
      this.assetServerTotalCount = 0;
      this.cdr.markForCheck();
      return;
    }

    this.expandedItemId = item.itemId;
    this.lotDetails = [];
    this.assetDetails = [];
    this.assetServerTotalCount = 0;
    this.lotCurrentPage = 1;
    this.assetCurrentPage = 1;
    this.cdr.markForCheck();

    if (normalizeItemType(item.itemType) === ItemType.Weapon) {
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
    const depotScope = this.getAssetDepotQueryArgs();
    const request: PagedListRequest = {
      page: this.assetCurrentPage,
      pageSize: this.assetRowsPerPage,
      filter: this.buildAssetSortFilter()
    };
    const emptyPage: PaginatedList<AssetDto> = {
      items: [],
      pageIndex: this.assetCurrentPage,
      totalPages: 0,
      totalCount: 0,
      hasPreviousPage: false,
      hasNextPage: false
    };
    this.assetService.getAssetsByItemIdPaged(item.itemId, request, depotScope.depotId, depotScope.depotIds).pipe(
      catchError(() => of(emptyPage)),
      finalize(() => { this.isAssetsLoading = false; this.cdr.markForCheck(); }),
      takeUntil(this.destroy$)
    ).subscribe(res => {
      this.assetDetails = res.items ?? [];
      this.assetServerTotalCount = res.totalCount ?? 0;
      this.cdr.markForCheck();
    });
  }

  private buildAssetSortFilter(): FilterData | undefined {
    if (!this.assetSortColumn) return undefined;
    const sortField =
      this.assetSortColumn === 'serialNumber'
        ? 'SerialNumber'
        : this.assetSortColumn === 'rfid'
          ? 'RFID'
          : undefined;
    if (!sortField) return undefined;
    return {
      sortField,
      sortDirection: this.assetSortDirection === 'asc' ? 1 : 2
    };
  }

  /** When the item table uses client-side filters, collapse expansion if the row disappears; optionally refetch assets. */
  private syncExpandedWeaponAssetsAfterClientTableFilterChange(): void {
    if (this.activeTab !== 'weapon' || this.useInventoryServerPaging) {
      return;
    }
    const summary = this.getExpandedItemSummary();
    if (!summary || normalizeItemType(summary.itemType) !== ItemType.Weapon) {
      return;
    }
    if (!this.sortedItemSummaries.some(s => s.itemId === summary.itemId)) {
      this.expandedItemId = null;
      this.lotDetails = [];
      this.assetDetails = [];
      this.assetServerTotalCount = 0;
      this.cdr.markForCheck();
      return;
    }
    this.assetCurrentPage = 1;
    this.loadAssets(summary);
  }

  /** Align expanded weapon assets with summary row: same depot scope as catalog paged API. */
  private getAssetDepotQueryArgs(): { depotId?: number; depotIds?: number[] } {
    const ids = this.selectedDepotIds.filter(id => id > 0);
    if (ids.length === 1) {
      return { depotId: ids[0] };
    }
    if (ids.length > 1) {
      return { depotIds: ids };
    }
    return {};
  }

  private getExpandedItemSummary(): ItemInventorySummaryDto | undefined {
    if (this.expandedItemId == null) return undefined;
    return this.itemSummaries.find(i => i.itemId === this.expandedItemId);
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
    return pageCountForLength(this.assetServerTotalCount, this.assetRowsPerPage);
  }

  get paginatedAssetDetails(): AssetDto[] {
    return this.sortedAssetDetails;
  }

  sortAssetsByColumn(column: string): void {
    const next = nextTableSort(column, this.assetSortColumn, this.assetSortDirection);
    this.assetSortColumn = next.sortColumn;
    this.assetSortDirection = next.sortDirection;
    this.assetCurrentPage = 1;
    const summary = this.getExpandedItemSummary();
    if (summary && normalizeItemType(summary.itemType) === ItemType.Weapon) {
      this.loadAssets(summary);
    } else {
      this.cdr.markForCheck();
    }
  }

  onAssetPageChange(page: number): void {
    if (page === this.assetCurrentPage) return;
    this.assetCurrentPage = page;
    const summary = this.getExpandedItemSummary();
    if (summary && normalizeItemType(summary.itemType) === ItemType.Weapon) {
      this.loadAssets(summary);
    } else {
      this.cdr.markForCheck();
    }
  }

  onAssetRowsPerPageChange(rows: number): void {
    if (rows === this.assetRowsPerPage) return;
    this.assetRowsPerPage = rows;
    this.assetCurrentPage = 1;
    const summary = this.getExpandedItemSummary();
    if (summary && normalizeItemType(summary.itemType) === ItemType.Weapon) {
      this.loadAssets(summary);
    } else {
      this.cdr.markForCheck();
    }
  }

  onExpiringSoonClick(): void {
    this.router.navigate(['/inventory-dashboard/expiring-lots']);
  }

  onLowStockClick(): void {
    this.router.navigate(['/inventory-dashboard/low-stock']);
  }

  onCriticalStockClick(): void {
    this.router.navigate(['/inventory-dashboard/critical-stock']);
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
