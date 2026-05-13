import { Observable, finalize, takeUntil } from 'rxjs';
import { FilterData, PagedRequest, PaginatedList } from '@models/api-response.model';

/** Ordered phases when loading “all inventory types” into one option list. */
export type ItemCatalogPhase = 'ammunition' | 'weapon' | 'explosive';

export interface MultiPhaseItemCatalogLoaderDeps<TItem, TItemType = unknown> {
  destroy$: Observable<void>;
  pageSize: number;
  getSelectedItem: () => number | string | null;
  /** Ammunition → weapons → explosives interleaving; if false, only {@link getSingleTypePaginated} runs. */
  isAllTypesMode: () => boolean;
  getItemType: () => TItemType | null;
  getSingleTypePaginated: (req: PagedRequest) => Observable<PaginatedList<TItem>>;
  getAllTypesPaginated: (
    phase: ItemCatalogPhase,
    req: PagedRequest
  ) => Observable<PaginatedList<TItem>>;
  fetchItemByIdForLabel: (id: number, itemType: TItemType | null) => Observable<TItem>;
  sameItemId: (a: number, b: number | string) => boolean;
  getItemNumericId: (row: TItem) => number;
  markForCheck: () => void;
}

/**
 * Server-paged dropdown catalog with optional multi-phase “all types” loading,
 * request-id stale guards, and getById label merge for the current value.
 */
export class MultiPhaseItemCatalogLoader<TItem, TItemType = unknown> {
  options: TItem[] = [];
  hasMore = false;
  loadingMore = false;
  selectedDetail: TItem | null = null;

  private searchTerm = '';
  private requestId = 0;
  private readonly pageSize: number;
  private singleTypeNextPage = 1;
  private allTypesPhase: ItemCatalogPhase = 'ammunition';
  private allTypesAmmoPage = 1;
  private allTypesWeaponPage = 1;
  private allTypesExplosivePage = 1;

  constructor(private readonly deps: MultiPhaseItemCatalogLoaderDeps<TItem, TItemType>) {
    this.pageSize = deps.pageSize;
  }

  clearSelectedDetail(): void {
    this.selectedDetail = null;
  }

  /** Reset option list and paging when parent data reloads (does not bump request id). */
  resetAfterParentDataLoad(): void {
    this.options = [];
    this.hasMore = false;
    this.singleTypeNextPage = 1;
    this.allTypesPhase = 'ammunition';
    this.allTypesAmmoPage = 1;
    this.allTypesWeaponPage = 1;
    this.allTypesExplosivePage = 1;
    this.searchTerm = '';
  }

  /** User changed filters that invalidate in-flight catalog calls. */
  resetOnUserFilterChange(): void {
    this.resetAfterParentDataLoad();
    this.requestId++;
    this.loadingMore = false;
  }

  onDropdownOpened(open: boolean): void {
    if (open) {
      this.searchTerm = '';
      this.fetchPage(false);
    }
  }

  loadMore(): void {
    this.fetchPage(true);
  }

  onSearchChange(term: string): void {
    const t = (term ?? '').trim();
    if (t === this.searchTerm.trim()) {
      return;
    }
    this.searchTerm = term;
    this.requestId++;
    this.fetchPage(false);
  }

  onPrimarySelectionChange(selectedItem: number | string | null): void {
    if (selectedItem != null && selectedItem !== '') {
      const found = this.options.find((i) => this.deps.sameItemId(this.deps.getItemNumericId(i), selectedItem));
      this.selectedDetail = found ?? this.selectedDetail;
    } else {
      this.selectedDetail = null;
    }
  }

  private buildPagedRequest(page: number): PagedRequest {
    const term = this.searchTerm.trim();
    let filter: FilterData | undefined;
    if (term) {
      filter = {
        logic: 'or',
        filters: [
          { field: 'Name', operator: 'contains', value: term },
          { field: 'ItemNo', operator: 'contains', value: term }
        ]
      };
    }
    return {
      page,
      pageSize: this.pageSize,
      filter
    };
  }

  private fetchPage(append: boolean): void {
    if (this.loadingMore) {
      return;
    }
    if (append && !this.hasMore) {
      return;
    }
    const reqId = ++this.requestId;
    this.loadingMore = true;
    this.deps.markForCheck();

    if (this.deps.isAllTypesMode()) {
      this.fetchAllItemTypesPage(append, reqId);
    } else {
      this.fetchSingleItemTypePage(append, reqId);
    }
  }

  private mergeBatch(append: boolean, batch: TItem[]): void {
    if (!append) {
      this.options = batch;
      return;
    }
    if (batch.length === 0) {
      return;
    }
    const seen = new Set(this.options.map((r) => this.deps.getItemNumericId(r)));
    for (const row of batch) {
      const id = this.deps.getItemNumericId(row);
      if (!seen.has(id)) {
        seen.add(id);
        this.options.push(row);
      }
    }
  }

  private runRequest(
    reqId: number,
    obs: Observable<PaginatedList<TItem>>,
    append: boolean,
    applyPage: (page: PaginatedList<TItem>) => void
  ): void {
    obs
      .pipe(
        takeUntil(this.deps.destroy$),
        finalize(() => {
          if (reqId === this.requestId) {
            this.loadingMore = false;
            this.deps.markForCheck();
          }
        })
      )
      .subscribe({
        next: (page) => {
          if (reqId !== this.requestId) {
            return;
          }
          applyPage(page);
          this.ensureSelectedInOptions();
          this.deps.markForCheck();
        },
        error: () => {
          if (reqId !== this.requestId) {
            return;
          }
          if (!append) {
            this.options = [];
            this.hasMore = false;
          }
          this.deps.markForCheck();
        }
      });
  }

  private fetchSingleItemTypePage(append: boolean, reqId: number): void {
    const pageNum = append ? this.singleTypeNextPage : 1;
    const req = this.buildPagedRequest(pageNum);
    this.runRequest(reqId, this.deps.getSingleTypePaginated(req), append, (page) => {
      const batch = page?.items ?? [];
      this.mergeBatch(append, batch);
      this.hasMore = page?.hasNextPage ?? false;
      this.singleTypeNextPage = (page?.pageIndex ?? pageNum) + 1;
    });
  }

  private fetchAllItemTypesPage(append: boolean, reqId: number): void {
    if (!append) {
      this.options = [];
      this.allTypesPhase = 'ammunition';
      this.allTypesAmmoPage = 1;
      this.allTypesWeaponPage = 1;
      this.allTypesExplosivePage = 1;
    }

    let pageNum = 1;
    if (this.allTypesPhase === 'ammunition') {
      pageNum = this.allTypesAmmoPage;
    } else if (this.allTypesPhase === 'weapon') {
      pageNum = this.allTypesWeaponPage;
    } else {
      pageNum = this.allTypesExplosivePage;
    }

    const req = this.buildPagedRequest(pageNum);
    this.runRequest(reqId, this.deps.getAllTypesPaginated(this.allTypesPhase, req), append, (page) => {
      const batch = page?.items ?? [];
      const apiHasNext = page?.hasNextPage ?? false;
      const pIndex = page?.pageIndex ?? pageNum;

      this.mergeBatch(append, batch);

      if (apiHasNext) {
        if (this.allTypesPhase === 'ammunition') {
          this.allTypesAmmoPage = pIndex + 1;
        } else if (this.allTypesPhase === 'weapon') {
          this.allTypesWeaponPage = pIndex + 1;
        } else {
          this.allTypesExplosivePage = pIndex + 1;
        }
        this.hasMore = true;
      } else if (this.allTypesPhase === 'ammunition') {
        this.allTypesPhase = 'weapon';
        this.hasMore = true;
      } else if (this.allTypesPhase === 'weapon') {
        this.allTypesPhase = 'explosive';
        this.hasMore = true;
      } else {
        this.hasMore = false;
      }
    });
  }

  private ensureSelectedInOptions(): void {
    const selectedItem = this.deps.getSelectedItem();
    if (selectedItem === null || selectedItem === undefined || selectedItem === '') {
      return;
    }
    const id = selectedItem;
    if (this.options.some((i) => this.deps.sameItemId(this.deps.getItemNumericId(i), id))) {
      return;
    }
    if (this.selectedDetail && this.deps.sameItemId(this.deps.getItemNumericId(this.selectedDetail), id)) {
      this.options = [this.selectedDetail, ...this.options];
      return;
    }
    this.loadSelectedItemForDropdownLabel();
  }

  private loadSelectedItemForDropdownLabel(): void {
    const selectedItem = this.deps.getSelectedItem();
    if (selectedItem === null || selectedItem === undefined || selectedItem === '') {
      return;
    }
    const id = Number(selectedItem);
    const seq = this.requestId;

    this.deps
      .fetchItemByIdForLabel(id, this.deps.getItemType())
      .pipe(takeUntil(this.deps.destroy$))
      .subscribe({
        next: (item) => {
          if (seq !== this.requestId || !item) {
            return;
          }
          this.selectedDetail = item;
          if (!this.options.some((i) => this.deps.sameItemId(this.deps.getItemNumericId(i), id))) {
            this.options = [item, ...this.options];
          }
          this.deps.markForCheck();
        },
        error: () => {
          /* wrong catalog / 404 — leave trigger without prepended row */
        }
      });
  }
}
