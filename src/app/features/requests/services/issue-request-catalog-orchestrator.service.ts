import { ChangeDetectorRef, Injectable } from '@angular/core';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { Cartridge } from '@models/cartridge.model';
import { CartridgeDataService } from '@assets/services/cartridge-data.service';
import {
  CartridgeState,
  ExtendedFilterOptions,
  ExtendedFilterState,
  createInitialCatalogPagination
} from '@requests/pages/new-issue/new-issue-request.state';
import { IssueRequestCartridgeLoaderService } from './issue-request-cartridge-loader.service';
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


@Injectable({
  providedIn: 'root'
})
export class IssueRequestCatalogOrchestratorService {
  static readonly SERVER_CATALOG_FILTER_DEBOUNCE_MS = 350;

  constructor(
    private cartridgeDataService: CartridgeDataService,
    private cartridgeLoaderService: IssueRequestCartridgeLoaderService,
    private filterService: IssueRequestFilterService,
    private stateService: IssueRequestStateService
  ) { }

  isServerCatalogMode(ctx: CatalogOrchestratorContext): boolean {
    return ctx.fromReserve === 'No';
  }

  resetCatalogPagination(ctx: CatalogOrchestratorContext): void {
    ctx.cartridgeState.catalogPagination = createInitialCatalogPagination();
  }

  loadCartridges(
    ctx: CatalogOrchestratorContext,
    hooks: CatalogLoadHooks = {}
  ): void {
    ctx.cartridgeState.cartridgeError = null;
    const type = ctx.filterState.selectedItemType;
    const isAllowance = ctx.fromReserve === 'Yes';
    const deptId = ctx.departmentId;

    if (this.isServerCatalogMode(ctx)) {
      this.resetCatalogPagination(ctx);
      this.loadAmmunitionFacetMetadataIfNeeded(ctx);
      this.loadCatalogPage(1, 'initial', ctx, hooks);
      return;
    }

    ctx.cartridgeState.loadingCartridges = true;
    ctx.cdr.markForCheck();

    if (isAllowance && !deptId) {
      ctx.cartridgeState.allCartridges = [];
      ctx.cartridgeState.filteredCartridges = [];
      ctx.cartridgeState.loadingCartridges = false;
      ctx.cartridgeState.cartridgeError = 'Department not found for current user.';
      ctx.cdr.markForCheck();
      return;
    }

    this.cartridgeLoaderService
      .loadCartridges(type, isAllowance, deptId)
      .subscribe({
        next: (result: any) => {
          ctx.cartridgeState.allCartridges = result.cartridges;
          this.buildFilterOptions(ctx);
          this.filterCartridges(ctx);

          hooks.onAfterLoad?.();

          ctx.cartridgeState.loadingCartridges = false;
          if (result.error) {
            ctx.cartridgeState.cartridgeError = result.error;
          } else {
            hooks.onLoadSuccess?.();
          }
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
    if (ctx.filterState.selectedItemType !== 'Ammunition') {
      return;
    }
    this.cartridgeLoaderService.loadAmmunitionFacetSample().subscribe({
      next: (facets) => {
        ctx.filterOptions.bulletDiameters = facets.bulletDiameters;
        ctx.filterOptions.natureOptions = facets.natureOptions;
        ctx.cdr.markForCheck();
      }
    });
  }

  loadCatalogPage(
    page: number,
    loadMode: 'initial' | 'overlay',
    ctx: CatalogOrchestratorContext,
    hooks: CatalogLoadHooks = {}
  ): void {
    ctx.cartridgeState.cartridgeError = null;
    if (loadMode === 'overlay') {
      ctx.cartridgeState.catalogPageLoading = true;
    } else {
      ctx.cartridgeState.loadingCartridges = true;
      ctx.cartridgeState.catalogPageLoading = false;
    }
    ctx.cdr.markForCheck();

    const type = ctx.filterState.selectedItemType;
    const size = ctx.cartridgeState.catalogPagination.pageSize;

    this.cartridgeLoaderService
      .loadCartridgesPaginated(type, page, size, ctx.filterState)
      .subscribe({
        next: (result) => {
          ctx.cartridgeState.allCartridges = result.cartridges;
          ctx.cartridgeState.catalogPagination = {
            page: result.pageIndex,
            pageSize: size,
            totalCount: result.totalCount,
            totalPages: result.totalPages,
            hasNextPage: result.hasNextPage,
            hasPreviousPage: result.hasPreviousPage
          };
          this.mergeSelectedWithList(ctx.cartridgeState.allCartridges, ctx);
          ctx.cartridgeState.loadingCartridges = false;
          ctx.cartridgeState.catalogPageLoading = false;
          if (result.error) {
            ctx.cartridgeState.cartridgeError = result.error;
          } else {
            hooks.onLoadSuccess?.();
          }
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

  applyCatalogSearch(
    searchTerm: string | undefined,
    ctx: CatalogOrchestratorContext,
    hooks: CatalogLoadHooks = {}
  ): void {
    if (!this.isServerCatalogMode(ctx)) {
      return;
    }
    if (ctx.cartridgeState.catalogPageLoading || ctx.cartridgeState.loadingCartridges) {
      return;
    }
    if (searchTerm !== undefined) {
      ctx.filterState.searchTerm = searchTerm;
    }
    ctx.cartridgeState.catalogPagination.page = 1;
    this.loadCatalogPage(1, 'overlay', ctx, hooks);
  }

  onCatalogPageNext(ctx: CatalogOrchestratorContext, hooks: CatalogLoadHooks = {}): void {
    if (!this.isServerCatalogMode(ctx) || !ctx.cartridgeState.catalogPagination.hasNextPage) {
      return;
    }
    if (ctx.cartridgeState.catalogPageLoading || ctx.cartridgeState.loadingCartridges) {
      return;
    }
    this.loadCatalogPage(ctx.cartridgeState.catalogPagination.page + 1, 'overlay', ctx, hooks);
  }

  onCatalogPagePrev(ctx: CatalogOrchestratorContext, hooks: CatalogLoadHooks = {}): void {
    if (!this.isServerCatalogMode(ctx) || !ctx.cartridgeState.catalogPagination.hasPreviousPage) {
      return;
    }
    if (ctx.cartridgeState.catalogPageLoading || ctx.cartridgeState.loadingCartridges) {
      return;
    }
    this.loadCatalogPage(ctx.cartridgeState.catalogPagination.page - 1, 'overlay', ctx, hooks);
  }

  buildFilterOptions(ctx: CatalogOrchestratorContext): void {
    if (this.isServerCatalogMode(ctx)) {
      return;
    }
    const options = this.cartridgeDataService.buildFilterOptions(ctx.cartridgeState.allCartridges);
    ctx.filterOptions.bulletDiameters = options.bulletDiameters;
    ctx.filterOptions.natureOptions = options.natureOptions;
  }

  filterCartridges(ctx: CatalogOrchestratorContext): void {
    if (this.isServerCatalogMode(ctx)) {
      this.mergeSelectedWithList(ctx.cartridgeState.allCartridges, ctx);
      return;
    }
    const filtered = this.filterService.filterCartridges(
      ctx.cartridgeState.allCartridges,
      ctx.filterState
    );
    this.mergeSelectedWithList(filtered, ctx);
  }

  mergeSelectedWithList(filtered: Cartridge[], ctx: CatalogOrchestratorContext): void {
    const selectedCartridges: Cartridge[] = [];
    const selectedIds = new Set<number>();
    const currentItemType = ctx.filterState.selectedItemType;

    ctx.cartridgeState.selectedCartridgesCache.forEach((cachedCartridge, id) => {
      const cartridgeItemType = cachedCartridge.itemType || inferCartridgeItemType(cachedCartridge);

      if (cartridgeItemType === currentItemType) {
        const cartridgeCopy = { ...cachedCartridge };
        cartridgeCopy.added = true;
        cartridgeCopy.selected = true;
        selectedCartridges.push(cartridgeCopy);
        selectedIds.add(id);
      }
    });

    const filteredWithoutSelected = filtered.filter(c => !selectedIds.has(c.id));
    ctx.cartridgeState.filteredCartridges = [...selectedCartridges, ...filteredWithoutSelected];
    ctx.cdr.markForCheck();
  }

  restoreSelections(
    pendingSelections: Array<{ id: number; quantity: number }> | null,
    ctx: CatalogOrchestratorContext
  ): void {
    if (!pendingSelections) {
      return;
    }
    this.stateService.restoreSelections(pendingSelections, ctx.cartridgeState);
  }

  setupFilterDebounce(
    ctxProvider: () => CatalogOrchestratorContext,
    destroy$: Subject<void>,
    hooksProvider: () => CatalogLoadHooks = () => ({})
  ): () => void {
    const filterApply$ = new Subject<void>();
    filterApply$
      .pipe(
        debounceTime(IssueRequestCatalogOrchestratorService.SERVER_CATALOG_FILTER_DEBOUNCE_MS),
        takeUntil(destroy$)
      )
      .subscribe(() => {
        const ctx = ctxProvider();
        if (!this.isServerCatalogMode(ctx)) {
          return;
        }
        if (ctx.cartridgeState.catalogPageLoading || ctx.cartridgeState.loadingCartridges) {
          return;
        }
        ctx.cartridgeState.catalogPagination.page = 1;
        this.loadCatalogPage(1, 'overlay', ctx, hooksProvider());
      });
    return () => filterApply$.next();
  }

  handleItemTypeChange(value: string, ctx: CatalogOrchestratorContext, hooks: CatalogLoadHooks = {}): void {
    const prev = ctx.filterState.selectedItemType;
    if (prev !== value) {
      ctx.filterState.selectedItemType = value;
      this.filterService.clearFilters(ctx.filterState, value);
      ctx.cartridgeState.allCartridges = [];
      if (value !== 'Ammunition') {
        ctx.filterOptions.bulletDiameters = [];
        ctx.filterOptions.natureOptions = [];
      }
      this.loadCartridges(ctx, hooks);
    }
  }

  handleClearFilters(ctx: CatalogOrchestratorContext, hooks: CatalogLoadHooks = {}): void {
    this.filterService.clearFilters(ctx.filterState, ctx.filterState.selectedItemType);
    if (this.isServerCatalogMode(ctx)) {
      if (ctx.cartridgeState.catalogPageLoading || ctx.cartridgeState.loadingCartridges) {
        return;
      }
      this.resetCatalogPagination(ctx);
      this.loadCatalogPage(1, 'overlay', ctx, hooks);
    } else {
      this.filterCartridges(ctx);
    }
  }
}
