/**
 * Asset List Facade
 * Centralizes state and coordinates services for the asset list page
 */

import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil, skip } from 'rxjs/operators';
import { timer } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from '@services/toast.service';
import { ConfigService } from '@services/config.service';
import { AssetListService } from './asset-list.service';
import { AssetImageService } from './asset-image.service';
import { AssetLookupService } from './asset-lookup.service';
import { AssetQueryParamsService, AssetQueryParamsState } from './asset-query-params.service';
import { AssetCrudService } from './asset-crud.service';
import { AssetExportService } from './asset-export.service';
import {
  Asset,
  AssetType,
  AssetFilterState,
  AssetSortState,
  AssetPaginationState,
  AssetModalState,
  AssetImageState
} from '@models/asset-list.model';
import { LookupItem } from '@models/lookup.model';
import { AssetFilterOptions, AssetLookups } from '../models/asset-filter-options.model';
import {
  createInitialFilterState,
  createInitialSortState,
  createInitialPaginationState,
  createInitialModalState,
  createInitialImageState,
  resetFilterState
} from '@utils/asset-list.state';
import { PaginatedList } from '@models/api-response.model';
import { BackendAuthService } from '@services/backend-auth.service';
import { resolveAccessibleAssetTab } from '@core/utils/asset-tab-access.utils';

type ViewMode = 'available' | 'deleted';

@Injectable()
export class AssetListFacade {
  private readonly assetListService = inject(AssetListService);
  private readonly assetImageService = inject(AssetImageService);
  private readonly assetLookupService = inject(AssetLookupService);
  private readonly assetQueryParamsService = inject(AssetQueryParamsService);
  private readonly assetCrudService = inject(AssetCrudService);
  private readonly assetExportService = inject(AssetExportService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translateService = inject(TranslateService);
  private readonly toastService = inject(ToastService);
  private readonly configService = inject(ConfigService);
  private readonly backendAuth = inject(BackendAuthService);

  private readonly destroy$ = new Subject<void>();

  // State
  private readonly _assets = new BehaviorSubject<Asset[]>([]);
  private readonly _loading = new BehaviorSubject<boolean>(false);
  private readonly _activeTab = new BehaviorSubject<AssetType>('ammunition');
  private readonly _ammunitionViewMode = new BehaviorSubject<ViewMode>('available');
  private readonly _explosivesViewMode = new BehaviorSubject<ViewMode>('available');
  private readonly _weaponsViewMode = new BehaviorSubject<ViewMode>('available');
  private readonly _filterState = new BehaviorSubject<AssetFilterState>(createInitialFilterState());
  private readonly _sortState = new BehaviorSubject<AssetSortState>(createInitialSortState());
  private readonly _paginationState = new BehaviorSubject<AssetPaginationState>(createInitialPaginationState());
  private readonly _modalState = new BehaviorSubject<AssetModalState>(createInitialModalState());
  private readonly _imageState = new BehaviorSubject<AssetImageState>(createInitialImageState());
  private readonly _totalItems = new BehaviorSubject<number>(0);
  private readonly _lookups = new BehaviorSubject<AssetLookups | null>(null);
  private readonly _units = new BehaviorSubject<LookupItem[]>([]);
  private readonly _filterOptions = new BehaviorSubject<AssetFilterOptions>({
    caseType: [],
    primaryPurpose: [],
    compatibility: [],
    propellant: [],
    weaponType: [],
    weaponClassification: [],
    countryOfManufacture: [],
    explosiveType: [],
    explosiveClassification: [],
    explosiveHazardDivision: [],
    explosiveCompatibility: [],
    calibersAmmunition: [],
    calibersWeapon: []
  });

  // Public streams
  readonly assets$ = this._assets.asObservable();
  readonly loading$ = this._loading.asObservable();
  readonly activeTab$ = this._activeTab.asObservable();
  readonly ammunitionViewMode$ = this._ammunitionViewMode.asObservable();
  readonly explosivesViewMode$ = this._explosivesViewMode.asObservable();
  readonly weaponsViewMode$ = this._weaponsViewMode.asObservable();
  readonly filterState$ = this._filterState.asObservable();
  readonly sortState$ = this._sortState.asObservable();
  readonly paginationState$ = this._paginationState.asObservable();
  readonly modalState$ = this._modalState.asObservable();
  readonly imageState$ = this._imageState.asObservable();
  readonly totalItems$ = this._totalItems.asObservable();
  readonly lookups$ = this._lookups.asObservable();
  readonly units$ = this._units.asObservable();
  readonly filterOptions$ = this._filterOptions.asObservable();

  get totalPages(): number {
    const total = this._totalItems.value;
    const rows = this._paginationState.value.rowsPerPage;
    return total === 0 ? 1 : Math.ceil(total / rows);
  }

  destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.assetImageService.cleanup();
  }

  init(options?: { onViewItemId?: (id: string) => void }): void {
    if (this.route.snapshot.queryParams) {
      const parsed = this.assetQueryParamsService.parseParams(this.route.snapshot.queryParams);
      const safeTab = this.clampTabToPermissions(parsed.tab);
      if (parsed.tab != null && safeTab !== parsed.tab) {
        this.assetQueryParamsService.updateUrl(this.route, {
          tab: safeTab,
          page: parsed.page ?? undefined
        });
      }
      this._activeTab.next(safeTab);
      if (parsed.page != null) this._paginationState.next({ ...this._paginationState.value, currentPage: parsed.page });
      if (parsed.ammunitionView) this._ammunitionViewMode.next(parsed.ammunitionView);
      if (parsed.explosivesView) this._explosivesViewMode.next(parsed.explosivesView);
      if (parsed.weaponsView) this._weaponsViewMode.next(parsed.weaponsView);
      this.loadUnitsForTab(safeTab);
    }

    this.loadLookups();
    this.loadAssets();

    this.translateService.onLangChange
      .pipe(skip(1), takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadLookups();
        this.loadAssets();
      });

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const parsed = this.assetQueryParamsService.parseParams(params as Record<string, string>);
        this.handleQueryParams(parsed);
        if (parsed.viewItemId && options?.onViewItemId) {
          timer(300).pipe(takeUntil(this.destroy$)).subscribe(() => {
            options.onViewItemId!(parsed.viewItemId!);
          });
        }
      });

    this.backendAuth.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const safe = this.clampTabToPermissions(this._activeTab.value);
        if (safe !== this._activeTab.value) {
          this._activeTab.next(safe);
          this.loadUnitsForTab(safe);
          this._paginationState.next({ ...this._paginationState.value, currentPage: 1 });
          this._filterState.next(resetFilterState(this._filterState.value));
          this.assetQueryParamsService.updateUrl(this.route, { tab: safe, page: 1 });
          this.loadAssets();
          const lookups = this._lookups.value;
          if (lookups) {
            this._filterOptions.next(this.assetLookupService.getFilterOptions(safe, lookups));
          }
        }
      });
  }

  private clampTabToPermissions(tab: AssetType | null): AssetType {
    return resolveAccessibleAssetTab(
      (perms) => this.backendAuth.hasAnyPermission([...perms]),
      tab
    );
  }

  private handleQueryParams(parsed: AssetQueryParamsState): void {
    const safeTab = this.clampTabToPermissions(parsed.tab);
    if (parsed.tab != null && safeTab !== parsed.tab) {
      this.assetQueryParamsService.updateUrl(this.route, {
        tab: safeTab,
        page: parsed.page ?? undefined
      });
    }
    const tabChanged = safeTab !== this._activeTab.value;
    if (tabChanged) {
      this._activeTab.next(safeTab);
      this.loadUnitsForTab(safeTab);
      this._paginationState.next({ ...this._paginationState.value, currentPage: 1 });
      this._filterState.next(resetFilterState(this._filterState.value));
      this.loadAssets();
    }
    if (!tabChanged && parsed.page != null && parsed.page !== this._paginationState.value.currentPage) {
      this._paginationState.next({ ...this._paginationState.value, currentPage: parsed.page });
      this.loadAssets();
    }
    if (parsed.ammunitionView === 'deleted' && this._ammunitionViewMode.value !== 'deleted') {
      this._ammunitionViewMode.next('deleted');
      this.loadAssets();
    }
    if (parsed.explosivesView === 'deleted' && this._explosivesViewMode.value !== 'deleted') {
      this._explosivesViewMode.next('deleted');
      this.loadAssets();
    }
    if (parsed.weaponsView === 'deleted' && this._weaponsViewMode.value !== 'deleted') {
      this._weaponsViewMode.next('deleted');
      this.loadAssets();
    }
    // viewItemId is handled by the component's route subscription
  }

  loadLookups(): void {
    this.assetLookupService.loadAllLookups()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: lookups => {
          this._lookups.next(lookups);
          this.loadUnitsForTab(this._activeTab.value);
          this._filterOptions.next(
            this.assetLookupService.getFilterOptions(this._activeTab.value, lookups)
          );
        },
        error: () => {
          this.toastService.error(
            this.translateService.instant('assetList.errors.failedToLoad') || 'Failed to load data'
          );
        }
      });
  }

  loadUnitsForTab(tab: AssetType): void {
    this.assetLookupService.loadUnitsForTab(tab)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: units => this._units.next(units),
        error: () => {
          this.toastService.error(
            this.translateService.instant('assetList.errors.failedToLoadUnits') || 'Failed to load units'
          );
        }
      });
  }

  loadAssets(): void {
    this._loading.next(true);
    const ammoDeleted = this._activeTab.value === 'ammunition' && this._ammunitionViewMode.value === 'deleted';
    const expDeleted = this._activeTab.value === 'explosive' && this._explosivesViewMode.value === 'deleted';
    const weapDeleted = this._activeTab.value === 'weapon' && this._weaponsViewMode.value === 'deleted';

    this.assetListService.getAssets(
      this._activeTab.value,
      this._paginationState.value.currentPage,
      this._paginationState.value.rowsPerPage,
      this._filterState.value,
      this._sortState.value,
      ammoDeleted,
      expDeleted,
      weapDeleted
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: PaginatedList<Asset>) => {
          this._assets.next(res.items || []);
          this._totalItems.next(res.totalCount || 0);
          this.loadAssetImages(res.items || []);
          this._loading.next(false);
        },
        error: () => {
          this.toastService.error(
            this.translateService.instant('assetList.errors.failedToLoad') || 'Failed to load assets'
          );
          this._assets.next([]);
          this._totalItems.next(0);
          this._loading.next(false);
        }
      });
  }

  private loadAssetImages(assets: Asset[]): void {
    this.assetImageService.loadAssetImages(assets, this._activeTab.value)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: results => {
          const current = this._assets.value;
          results.forEach(({ assetId, url }) => {
            const asset = current.find(a => a.id === assetId);
            if (asset && url) asset.imageUrl = url;
          });
          this._assets.next([...current]);
        },
        error: (err) => { this.configService.logError('Asset image load failed', err); }
      });
  }

  switchTab(tab: AssetType): void {
    const safe = this.clampTabToPermissions(tab);
    if (safe !== tab) {
      return;
    }
    this._activeTab.next(tab);
    this._ammunitionViewMode.next('available');
    this._explosivesViewMode.next('available');
    this._weaponsViewMode.next('available');
    this.loadUnitsForTab(tab);
    this._paginationState.next({ ...this._paginationState.value, currentPage: 1 });
    this._filterState.next(resetFilterState(this._filterState.value));
    this.assetQueryParamsService.updateUrl(this.route, { tab, page: 1 });
    this.loadAssets();
    const lookups = this._lookups.value;
    if (lookups) {
      this._filterOptions.next(this.assetLookupService.getFilterOptions(tab, lookups));
    }
  }

  switchViewMode(
    mode: ViewMode,
    tab: 'ammunition' | 'explosive' | 'weapon'
  ): void {
    if (tab === 'ammunition') {
      if (this._ammunitionViewMode.value === mode) return;
      this._ammunitionViewMode.next(mode);
    } else if (tab === 'explosive') {
      if (this._explosivesViewMode.value === mode) return;
      this._explosivesViewMode.next(mode);
    } else {
      if (this._weaponsViewMode.value === mode) return;
      this._weaponsViewMode.next(mode);
    }
    this._paginationState.next({ ...this._paginationState.value, currentPage: 1 });
    this.loadAssets();
  }

  onFilterChange(): void {
    this._paginationState.next({ ...this._paginationState.value, currentPage: 1 });
    this.loadAssets();
  }

  clearFilters(): void {
    this._filterState.next(resetFilterState(this._filterState.value));
    this.onFilterChange();
  }

  clearSearchTerm(): void {
    this._filterState.next({ ...this._filterState.value, searchTerm: '' });
    this.onFilterChange();
  }

  sortByColumn(column: string): void {
    const sort = this._sortState.value;
    const newDirection = sort.column === column
      ? (sort.direction === 'asc' ? 'desc' : 'asc')
      : 'asc';
    this._sortState.next({
      column,
      direction: newDirection
    });
    this._paginationState.next({ ...this._paginationState.value, currentPage: 1 });
    this.loadAssets();
  }

  onPageChange(page: number): void {
    this._paginationState.next({ ...this._paginationState.value, currentPage: page });
    this.loadAssets();
    this.assetQueryParamsService.updateUrl(this.route, {
      tab: this._activeTab.value,
      page
    });
  }

  onRowsPerPageChange(rows: number): void {
    this._paginationState.next({
      currentPage: 1,
      rowsPerPage: rows
    });
    this.loadAssets();
  }

  exportToExcel(): void {
    this._loading.next(true);
    const ammoDeleted = this._activeTab.value === 'ammunition' && this._ammunitionViewMode.value === 'deleted';
    const expDeleted = this._activeTab.value === 'explosive' && this._explosivesViewMode.value === 'deleted';
    const weapDeleted = this._activeTab.value === 'weapon' && this._weaponsViewMode.value === 'deleted';

    this.assetListService.getAllFilteredAssetsForExport(
      this._activeTab.value,
      this._filterState.value,
      this._sortState.value,
      ammoDeleted,
      expDeleted,
      weapDeleted
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (allFilteredAssets) => {
          this.assetExportService.exportToExcel(allFilteredAssets, this._activeTab.value);
          this._loading.next(false);
          this.translateService.get(['common.exportSuccess', 'toast.success'])
            .pipe(takeUntil(this.destroy$))
            .subscribe(translations => {
              this.toastService.success(translations['common.exportSuccess'], translations['toast.success']);
            });
        },
        error: () => {
          this._loading.next(false);
          this.toastService.error(this.translateService.instant('assetList.errors.failedToExport'));
        }
      });
  }

  // Getters for current values (for component that needs sync access)
  get assets(): Asset[] { return this._assets.value; }
  get loading(): boolean { return this._loading.value; }
  get activeTab(): AssetType { return this._activeTab.value; }
  get ammunitionViewMode(): ViewMode { return this._ammunitionViewMode.value; }
  get explosivesViewMode(): ViewMode { return this._explosivesViewMode.value; }
  get weaponsViewMode(): ViewMode { return this._weaponsViewMode.value; }
  get filterState(): AssetFilterState { return this._filterState.value; }
  get sortState(): AssetSortState { return this._sortState.value; }
  get paginationState(): AssetPaginationState { return this._paginationState.value; }
  get modalState(): AssetModalState { return this._modalState.value; }
  get imageState(): AssetImageState { return this._imageState.value; }
  get totalItems(): number { return this._totalItems.value; }
  get lookups(): AssetLookups | null { return this._lookups.value; }
  get units(): LookupItem[] { return this._units.value; }
  get filterOptions(): AssetFilterOptions { return this._filterOptions.value; }

  // State setters for modal/CRUD
  setLoading(v: boolean): void { this._loading.next(v); }
  setFilterState(state: AssetFilterState): void { this._filterState.next(state); }
  setModalState(state: AssetModalState): void { this._modalState.next(state); }
  setImageState(state: AssetImageState): void { this._imageState.next(state); }
}
