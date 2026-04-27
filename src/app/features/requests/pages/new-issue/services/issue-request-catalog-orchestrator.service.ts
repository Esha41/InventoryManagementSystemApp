import { ChangeDetectorRef, Injectable } from '@angular/core';
import { Subject, debounceTime, takeUntil, Observable } from 'rxjs';
import { Cartridge } from '@models/cartridge.model';
import { FilterData, PagedRequest } from '@models/api-response.model';
import {
  CartridgeDataService,
  CartridgeLoadResult,
  CartridgePaginatedLoadResult
} from '@assets/services/cartridge-data.service';
import {
  CartridgeState,
  ExtendedFilterOptions,
  ExtendedFilterState,
  FilterState,
  createInitialCatalogPagination
} from '../new-issue-request.state';
import { IssueRequestFilterService } from './issue-request-filter.service';
import { IssueRequestStateService } from './issue-request-state.service';
import { inferCartridgeItemType } from '@requests/utils/issue-request.utils';

export interface CatalogOrchestratorContext {
  cartridgeState: CartridgeState;
  filterState: ExtendedFilterState;
  filterOptions: ExtendedFilterOptions;
  fromReserve: string;
  departmentId: number | null;
  cdr: ChangeDetectorRef;
}

export interface CatalogLoadHooks {
  onAfterLoad?: () => void;
  onLoadSuccess?: () => void;
}

// ---- Paged request builder helpers (inlined from IssueCatalogPagedRequestBuilder) ----

function buildCatalogSearchFilters(searchTerm: string): FilterData {
  const term = searchTerm.trim();
  return {
    logic: 'or',
    filters: [
      { field: 'Name', operator: 'contains', value: term },
      { field: 'ItemNo', operator: 'contains', value: term },
      { field: 'PartNo', operator: 'contains', value: term },
      { field: 'Nsn', operator: 'contains', value: term },
      { field: 'Caliber', operator: 'contains', value: term }
    ]
  };
}

function buildExplosiveCatalogSearchFilters(searchTerm: string): FilterData {
  const term = searchTerm.trim();
  return {
    logic: 'or',
    filters: [
      { field: 'Name', operator: 'contains', value: term },
      { field: 'ItemNo', operator: 'contains', value: term },
      { field: 'PartNo', operator: 'contains', value: term },
      { field: 'Nsn', operator: 'contains', value: term },
      { field: 'ArmNumber', operator: 'contains', value: term },
      { field: 'UNNumber', operator: 'contains', value: term },
      { field: 'Type.NameEn', operator: 'contains', value: term },
      { field: 'Type.NameAr', operator: 'contains', value: term }
    ]
  };
}

function spacedFromEnumKey(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').trim();
}

function wrapPagedRequest(page: number, pageSize: number, filters: FilterData[]): PagedRequest {
  const sortField = 'Name';
  const sortDirection = 1;
  return {
    page,
    pageSize,
    filter: filters.length > 0
      ? { logic: 'and', filters, sortField, sortDirection }
      : { sortField, sortDirection }
  };
}

function buildAmmunitionPagedRequest(page: number, pageSize: number, fs: FilterState): PagedRequest {
  const filters: FilterData[] = [];
  const search = fs.searchTerm?.trim() ?? '';
  if (search) filters.push(buildCatalogSearchFilters(search));
  if (fs.selectedAmmunitionType) filters.push({ field: 'AmmunitionType', operator: 'eq', value: fs.selectedAmmunitionType });
  if (fs.selectedLinked === 'Linked') filters.push({ field: 'IsLinked', operator: 'eq', value: 'true' });
  else if (fs.selectedLinked === 'Not Linked') filters.push({ field: 'IsLinked', operator: 'eq', value: 'false' });
  if (fs.selectedBulletDiameter?.trim()) filters.push({ field: 'BulletDiameterUnit.NameEn', operator: 'contains', value: fs.selectedBulletDiameter.trim() });
  if (fs.selectedNature?.trim()) {
    const v = fs.selectedNature.trim();
    filters.push({ logic: 'or', filters: [{ field: 'NatureOption.NameEn', operator: 'contains', value: v }, { field: 'NatureOption.NameAr', operator: 'contains', value: v }] });
  }
  const nsn = fs.selectedNSN?.trim() ?? '';
  if (nsn) filters.push({ field: 'Nsn', operator: 'contains', value: nsn });
  return wrapPagedRequest(page, pageSize, filters);
}

function buildWeaponPagedRequest(page: number, pageSize: number, fs: FilterState): PagedRequest {
  const filters: FilterData[] = [];
  const search = fs.searchTerm?.trim() ?? '';
  if (search) filters.push(buildCatalogSearchFilters(search));
  if (fs.selectedWeaponType?.trim()) filters.push({ field: 'Type.NameEn', operator: 'contains', value: spacedFromEnumKey(fs.selectedWeaponType.trim()) });
  const caliber = fs.selectedCaliber?.trim() ?? '';
  if (caliber) filters.push({ field: 'Caliber', operator: 'contains', value: caliber });
  const nsn = fs.selectedNSN?.trim() ?? '';
  if (nsn) filters.push({ field: 'Nsn', operator: 'contains', value: nsn });
  return wrapPagedRequest(page, pageSize, filters);
}

function buildExplosivePagedRequest(page: number, pageSize: number, fs: FilterState): PagedRequest {
  const filters: FilterData[] = [];
  const search = fs.searchTerm?.trim() ?? '';
  if (search) filters.push(buildExplosiveCatalogSearchFilters(search));
  if (fs.selectedExplosiveType?.trim()) filters.push({ field: 'Type.NameEn', operator: 'contains', value: spacedFromEnumKey(fs.selectedExplosiveType.trim()) });
  const un = fs.selectedUNNumber?.trim() ?? '';
  if (un) filters.push({ field: 'UNNumber', operator: 'contains', value: un });
  return wrapPagedRequest(page, pageSize, filters);
}

// ---- Orchestrator ----------------------------------------------------------

@Injectable({ providedIn: 'root' })
export class IssueRequestCatalogOrchestratorService {
  static readonly SERVER_CATALOG_FILTER_DEBOUNCE_MS = 350;

  constructor(
    private cartridgeDataService: CartridgeDataService,
    private filterService: IssueRequestFilterService,
    private stateService: IssueRequestStateService
  ) {}

  // ---- Cartridge loading (inlined from IssueRequestCartridgeLoaderService) --

  private loadCartridgesFromApi(
    itemType: string,
    isAllowance: boolean,
    departmentId: number | null
  ): Observable<CartridgeLoadResult> {
    if (isAllowance && !departmentId) {
      return new Observable(observer => {
        observer.next({ cartridges: [], error: 'Department not found for current user.' });
        observer.complete();
      });
    }
    if (itemType === 'Weapon') return isAllowance ? this.cartridgeDataService.loadAllowanceWeapons(departmentId!) : this.cartridgeDataService.loadAllWeapons();
    if (itemType === 'Explosive') return isAllowance ? this.cartridgeDataService.loadAllowanceExplosives(departmentId!) : this.cartridgeDataService.loadAllExplosives();
    return isAllowance ? this.cartridgeDataService.loadAllowanceAmmunition(departmentId!) : this.cartridgeDataService.loadAllAmmunition();
  }

  private loadCartridgesPaginated(
    itemType: string,
    page: number,
    pageSize: number,
    filterState: FilterState
  ): Observable<CartridgePaginatedLoadResult> {
    if (itemType === 'Weapon') return this.cartridgeDataService.loadWeaponsPaginated(buildWeaponPagedRequest(page, pageSize, filterState));
    if (itemType === 'Explosive') return this.cartridgeDataService.loadExplosivesPaginated(buildExplosivePagedRequest(page, pageSize, filterState));
    return this.cartridgeDataService.loadAmmunitionPaginated(buildAmmunitionPagedRequest(page, pageSize, filterState));
  }

  private loadAmmunitionFacetSample(): Observable<{ bulletDiameters: string[]; natureOptions: string[] }> {
    const request: PagedRequest = { page: 1, pageSize: 500, filter: { sortField: 'Name', sortDirection: 1 } };
    return this.cartridgeDataService.loadAmmunitionFacetSample(request);
  }

  // ---- Public orchestration API -------------------------------------------

  isServerCatalogMode(ctx: CatalogOrchestratorContext): boolean {
    return ctx.fromReserve === 'No';
  }

  resetCatalogPagination(ctx: CatalogOrchestratorContext): void {
    ctx.cartridgeState.catalogPagination = createInitialCatalogPagination();
  }

  loadCartridges(ctx: CatalogOrchestratorContext, hooks: CatalogLoadHooks = {}): void {
    ctx.cartridgeState.cartridgeError = null;
    const isAllowance = ctx.fromReserve === 'Yes';

    if (this.isServerCatalogMode(ctx)) {
      this.resetCatalogPagination(ctx);
      this.loadAmmunitionFacetMetadataIfNeeded(ctx);
      this.loadCatalogPage(1, 'initial', ctx, hooks);
      return;
    }

    ctx.cartridgeState.loadingCartridges = true;
    ctx.cdr.markForCheck();

    if (isAllowance && !ctx.departmentId) {
      ctx.cartridgeState.allCartridges = [];
      ctx.cartridgeState.filteredCartridges = [];
      ctx.cartridgeState.loadingCartridges = false;
      ctx.cartridgeState.cartridgeError = 'Department not found for current user.';
      ctx.cdr.markForCheck();
      return;
    }

    this.loadCartridgesFromApi(ctx.filterState.selectedItemType, isAllowance, ctx.departmentId).subscribe({
      next: (result: any) => {
        ctx.cartridgeState.allCartridges = result.cartridges;
        this.buildFilterOptions(ctx);
        this.filterCartridges(ctx);
        hooks.onAfterLoad?.();
        ctx.cartridgeState.loadingCartridges = false;
        if (result.error) { ctx.cartridgeState.cartridgeError = result.error; } else { hooks.onLoadSuccess?.(); }
        ctx.cdr.markForCheck();
      },
      error: (error: any) => {
        ctx.cartridgeState.allCartridges = [];
        ctx.cartridgeState.filteredCartridges = [];
        ctx.cartridgeState.loadingCartridges = false;
        ctx.cartridgeState.cartridgeError = error.error || 'Failed to load items. Please try again.';
        ctx.cdr.markForCheck();
      }
    });
  }

  loadAmmunitionFacetMetadataIfNeeded(ctx: CatalogOrchestratorContext): void {
    if (ctx.filterState.selectedItemType !== 'Ammunition') return;
    this.loadAmmunitionFacetSample().subscribe({
      next: (facets) => {
        ctx.filterOptions.bulletDiameters = facets.bulletDiameters;
        ctx.filterOptions.natureOptions = facets.natureOptions;
        ctx.cdr.markForCheck();
      }
    });
  }

  loadCatalogPage(page: number, loadMode: 'initial' | 'overlay', ctx: CatalogOrchestratorContext, hooks: CatalogLoadHooks = {}): void {
    ctx.cartridgeState.cartridgeError = null;
    if (loadMode === 'overlay') { ctx.cartridgeState.catalogPageLoading = true; }
    else { ctx.cartridgeState.loadingCartridges = true; ctx.cartridgeState.catalogPageLoading = false; }
    ctx.cdr.markForCheck();

    this.loadCartridgesPaginated(ctx.filterState.selectedItemType, page, ctx.cartridgeState.catalogPagination.pageSize, ctx.filterState).subscribe({
      next: (result) => {
        ctx.cartridgeState.allCartridges = result.cartridges;
        ctx.cartridgeState.catalogPagination = {
          page: result.pageIndex, pageSize: ctx.cartridgeState.catalogPagination.pageSize,
          totalCount: result.totalCount, totalPages: result.totalPages,
          hasNextPage: result.hasNextPage, hasPreviousPage: result.hasPreviousPage
        };
        this.mergeSelectedWithList(ctx.cartridgeState.allCartridges, ctx);
        ctx.cartridgeState.loadingCartridges = false;
        ctx.cartridgeState.catalogPageLoading = false;
        if (result.error) { ctx.cartridgeState.cartridgeError = result.error; } else { hooks.onLoadSuccess?.(); }
        ctx.cdr.markForCheck();
      },
      error: () => {
        ctx.cartridgeState.allCartridges = [];
        ctx.cartridgeState.filteredCartridges = [];
        ctx.cartridgeState.loadingCartridges = false;
        ctx.cartridgeState.catalogPageLoading = false;
        ctx.cartridgeState.cartridgeError = 'Failed to load items. Please try again.';
        ctx.cdr.markForCheck();
      }
    });
  }

  applyCatalogSearch(searchTerm: string | undefined, ctx: CatalogOrchestratorContext, hooks: CatalogLoadHooks = {}): void {
    if (!this.isServerCatalogMode(ctx) || ctx.cartridgeState.catalogPageLoading || ctx.cartridgeState.loadingCartridges) return;
    if (searchTerm !== undefined) ctx.filterState.searchTerm = searchTerm;
    ctx.cartridgeState.catalogPagination.page = 1;
    this.loadCatalogPage(1, 'overlay', ctx, hooks);
  }

  onCatalogPageNext(ctx: CatalogOrchestratorContext, hooks: CatalogLoadHooks = {}): void {
    if (!this.isServerCatalogMode(ctx) || !ctx.cartridgeState.catalogPagination.hasNextPage) return;
    if (ctx.cartridgeState.catalogPageLoading || ctx.cartridgeState.loadingCartridges) return;
    this.loadCatalogPage(ctx.cartridgeState.catalogPagination.page + 1, 'overlay', ctx, hooks);
  }

  onCatalogPagePrev(ctx: CatalogOrchestratorContext, hooks: CatalogLoadHooks = {}): void {
    if (!this.isServerCatalogMode(ctx) || !ctx.cartridgeState.catalogPagination.hasPreviousPage) return;
    if (ctx.cartridgeState.catalogPageLoading || ctx.cartridgeState.loadingCartridges) return;
    this.loadCatalogPage(ctx.cartridgeState.catalogPagination.page - 1, 'overlay', ctx, hooks);
  }

  buildFilterOptions(ctx: CatalogOrchestratorContext): void {
    if (this.isServerCatalogMode(ctx)) return;
    const options = this.cartridgeDataService.buildFilterOptions(ctx.cartridgeState.allCartridges);
    ctx.filterOptions.bulletDiameters = options.bulletDiameters;
    ctx.filterOptions.natureOptions = options.natureOptions;
  }

  filterCartridges(ctx: CatalogOrchestratorContext): void {
    if (this.isServerCatalogMode(ctx)) { this.mergeSelectedWithList(ctx.cartridgeState.allCartridges, ctx); return; }
    this.mergeSelectedWithList(this.filterService.filterCartridges(ctx.cartridgeState.allCartridges, ctx.filterState), ctx);
  }

  mergeSelectedWithList(filtered: Cartridge[], ctx: CatalogOrchestratorContext): void {
    const selectedCartridges: Cartridge[] = [];
    const selectedIds = new Set<number>();
    ctx.cartridgeState.selectedCartridgesCache.forEach((cachedCartridge, id) => {
      const itemType = cachedCartridge.itemType || inferCartridgeItemType(cachedCartridge);
      if (itemType === ctx.filterState.selectedItemType) {
        selectedCartridges.push({ ...cachedCartridge, added: true, selected: true });
        selectedIds.add(id);
      }
    });
    ctx.cartridgeState.filteredCartridges = [...selectedCartridges, ...filtered.filter(c => !selectedIds.has(c.id))];
    ctx.cdr.markForCheck();
  }

  restoreSelections(pendingSelections: Array<{ id: number; quantity: number }> | null, ctx: CatalogOrchestratorContext): void {
    if (!pendingSelections) return;
    this.stateService.restoreSelections(pendingSelections, ctx.cartridgeState);
  }

  setupFilterDebounce(ctxProvider: () => CatalogOrchestratorContext, destroy$: Subject<void>, hooksProvider: () => CatalogLoadHooks = () => ({})): () => void {
    const filterApply$ = new Subject<void>();
    filterApply$
      .pipe(debounceTime(IssueRequestCatalogOrchestratorService.SERVER_CATALOG_FILTER_DEBOUNCE_MS), takeUntil(destroy$))
      .subscribe(() => {
        const ctx = ctxProvider();
        if (!this.isServerCatalogMode(ctx) || ctx.cartridgeState.catalogPageLoading || ctx.cartridgeState.loadingCartridges) return;
        ctx.cartridgeState.catalogPagination.page = 1;
        this.loadCatalogPage(1, 'overlay', ctx, hooksProvider());
      });
    return () => filterApply$.next();
  }

  handleItemTypeChange(value: string, ctx: CatalogOrchestratorContext, hooks: CatalogLoadHooks = {}): void {
    if (ctx.filterState.selectedItemType === value) return;
    ctx.filterState.selectedItemType = value;
    this.filterService.clearFilters(ctx.filterState, value);
    ctx.cartridgeState.allCartridges = [];
    if (value !== 'Ammunition') { ctx.filterOptions.bulletDiameters = []; ctx.filterOptions.natureOptions = []; }
    this.loadCartridges(ctx, hooks);
  }

  handleClearFilters(ctx: CatalogOrchestratorContext, hooks: CatalogLoadHooks = {}): void {
    this.filterService.clearFilters(ctx.filterState, ctx.filterState.selectedItemType);
    if (this.isServerCatalogMode(ctx)) {
      if (ctx.cartridgeState.catalogPageLoading || ctx.cartridgeState.loadingCartridges) return;
      this.resetCatalogPagination(ctx);
      this.loadCatalogPage(1, 'overlay', ctx, hooks);
    } else {
      this.filterCartridges(ctx);
    }
  }
}
