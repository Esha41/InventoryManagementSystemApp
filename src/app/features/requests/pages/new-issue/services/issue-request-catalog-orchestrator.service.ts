import { ChangeDetectorRef, Injectable } from '@angular/core';
import { Subject, debounceTime, takeUntil, Observable } from 'rxjs';
import { Cartridge } from '@models/cartridge.model';
import { ItemType } from '@models/backend-enums';
import {
  CartridgeDataService,
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
import { DropdownOption } from '@components/dropdown/dropdown.component';

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

  private loadCartridgesPaginated(
    itemType: string,
    page: number,
    pageSize: number,
    filterState: FilterState
  ): Observable<CartridgePaginatedLoadResult> {
    if (itemType === 'Weapon') return this.cartridgeDataService.loadWeaponsCatalogPaginated(page, pageSize, filterState);
    if (itemType === 'Explosive') return this.cartridgeDataService.loadExplosivesCatalogPaginated(page, pageSize, filterState);
    return this.cartridgeDataService.loadAmmunitionCatalogPaginated(page, pageSize, filterState);
  }

  private loadCaliberFilterOptions(itemType: string): Observable<DropdownOption<string>[]> {
    const lookupItemType = itemType === 'Weapon' ? ItemType.Weapon : ItemType.Ammunition;
    return this.cartridgeDataService.loadCaliberFilterOptions(lookupItemType);
  }
  // ---- Public orchestration API -------------------------------------------

  /** New-issue flow always uses paginated server catalog (same for allowance and non-allowance orders). */
  isServerCatalogMode(_ctx: CatalogOrchestratorContext): boolean {
    return true;
  }

  resetCatalogPagination(ctx: CatalogOrchestratorContext): void {
    ctx.cartridgeState.catalogPagination = createInitialCatalogPagination();
  }

  loadCartridges(ctx: CatalogOrchestratorContext, hooks: CatalogLoadHooks = {}): void {
    ctx.cartridgeState.cartridgeError = null;
    this.resetCatalogPagination(ctx);
    this.loadFilterMetadataIfNeeded(ctx);
    this.loadCatalogPage(1, 'initial', ctx, hooks);
  }

  loadFilterMetadataIfNeeded(ctx: CatalogOrchestratorContext): void {
    const itemType = ctx.filterState.selectedItemType;
    if (itemType === 'Ammunition' || itemType === 'Weapon') {
      this.loadCaliberFilterOptions(itemType).subscribe({
        next: (options) => {
          ctx.filterOptions.caliberOptions = options;
          ctx.cdr.markForCheck();
        }
      });
    } else {
      ctx.filterOptions.caliberOptions = [];
    }

    if (itemType === 'Ammunition' || itemType === 'Weapon' || itemType === 'Explosive') {
      this.cartridgeDataService.loadPrimaryPurposeFilterOptions().subscribe({
        next: (options) => {
          ctx.filterOptions.primaryPurposeOptions = options;
          ctx.cdr.markForCheck();
        }
      });
      this.cartridgeDataService.loadClassificationFilterOptions().subscribe({
        next: (options) => {
          ctx.filterOptions.classificationOptions = options;
          ctx.cdr.markForCheck();
        }
      });
    } else {
      ctx.filterOptions.primaryPurposeOptions = [];
      ctx.filterOptions.classificationOptions = [];
    }

    if (itemType === 'Ammunition') {
      this.cartridgeDataService.loadCaseTypeFilterOptions().subscribe({
        next: (options) => { ctx.filterOptions.caseTypeOptions = options; ctx.cdr.markForCheck(); }
      });
      this.cartridgeDataService.loadCompatibilityFilterOptions().subscribe({
        next: (options) => { ctx.filterOptions.compatibilityOptions = options; ctx.cdr.markForCheck(); }
      });
      this.cartridgeDataService.loadHazardDivisionFilterOptions().subscribe({
        next: (options) => { ctx.filterOptions.hazardDivisionOptions = options; ctx.cdr.markForCheck(); }
      });
      this.cartridgeDataService.loadPropellantFilterOptions().subscribe({
        next: (options) => { ctx.filterOptions.propellantOptions = options; ctx.cdr.markForCheck(); }
      });
      ctx.filterOptions.countryOptions = [];
    } else if (itemType === 'Weapon') {
      ctx.filterOptions.caseTypeOptions = [];
      ctx.filterOptions.compatibilityOptions = [];
      ctx.filterOptions.hazardDivisionOptions = [];
      ctx.filterOptions.propellantOptions = [];
      this.cartridgeDataService.loadCountryFilterOptions().subscribe({
        next: (options) => { ctx.filterOptions.countryOptions = options; ctx.cdr.markForCheck(); }
      });
    } else if (itemType === 'Explosive') {
      ctx.filterOptions.caseTypeOptions = [];
      ctx.filterOptions.propellantOptions = [];
      ctx.filterOptions.countryOptions = [];
      this.cartridgeDataService.loadHazardDivisionFilterOptions().subscribe({
        next: (options) => { ctx.filterOptions.hazardDivisionOptions = options; ctx.cdr.markForCheck(); }
      });
      this.cartridgeDataService.loadCompatibilityFilterOptions().subscribe({
        next: (options) => { ctx.filterOptions.compatibilityOptions = options; ctx.cdr.markForCheck(); }
      });
    } else {
      ctx.filterOptions.caseTypeOptions = [];
      ctx.filterOptions.compatibilityOptions = [];
      ctx.filterOptions.hazardDivisionOptions = [];
      ctx.filterOptions.propellantOptions = [];
      ctx.filterOptions.countryOptions = [];
    }
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
        hooks.onAfterLoad?.();
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
    if (value !== 'Ammunition' && value !== 'Weapon' && value !== 'Explosive') {
      ctx.filterOptions.primaryPurposeOptions = [];
      ctx.filterOptions.classificationOptions = [];
    }
    if (value !== 'Ammunition' && value !== 'Weapon') { ctx.filterOptions.caliberOptions = []; }
    this.loadCartridges(ctx, hooks);
  }

  handleClearFilters(ctx: CatalogOrchestratorContext, hooks: CatalogLoadHooks = {}): void {
    this.filterService.clearFilters(ctx.filterState, ctx.filterState.selectedItemType);
    if (ctx.cartridgeState.catalogPageLoading || ctx.cartridgeState.loadingCartridges) return;
    this.resetCatalogPagination(ctx);
    this.loadCatalogPage(1, 'overlay', ctx, hooks);
  }
}
