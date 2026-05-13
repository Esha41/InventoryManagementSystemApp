import { Observable, finalize, takeUntil } from 'rxjs';
import { PaginatedList } from '@models/api-response.model';

export interface VirtualPagedListLoaderOptions<T> {
  /** Observable pipeline will unsubscribe when this emits (e.g. component destroy). */
  destroy$: Observable<void>;
  /** First page and refresh requests. */
  fetchPage: (pageIndex: number) => Observable<PaginatedList<T>>;
  markForCheck: () => void;
  onFetchError: (append: boolean) => void;
  /** After items and paging state were updated from a successful response. */
  afterPageLoaded?: (append: boolean) => void;
  getItemId: (row: T) => number;
}

const NEAR_END_SCROLL_PX = 48;

/**
 * Shared state + requests for “virtual” infinite lists: server paging, append on scroll,
 * and remote search de-duplication (same pattern as return/discard catalog pickers).
 */
export class VirtualPagedListLoader<T> {
  items: T[] = [];
  hasMore = false;
  loadingMore = false;
  /** True while the first page (or a full refresh) is loading. */
  loading = false;
  /** Bound to search inputs; trim/normalize in handlers, not here. */
  searchTerm = '';

  private nextPage = 1;
  private committedSearchNormalized = '';

  constructor(private readonly opts: VirtualPagedListLoaderOptions<T>) {}

  loadInitial(): void {
    this.searchTerm = '';
    this.committedSearchNormalized = '';
    this.nextPage = 1;
    this.items = [];
    this.hasMore = false;
    this.runFetch(false);
  }

  loadMore(): void {
    if (!this.hasMore || this.loadingMore || this.loading) {
      return;
    }
    this.runFetch(true);
  }

  /** Server-side / shared search (dropdown remote search or ngModelChange). */
  onRemoteSearch(term: string): void {
    const t = (term ?? '').trim();
    if (t === this.committedSearchNormalized) {
      return;
    }
    this.committedSearchNormalized = t;
    this.searchTerm = t;
    this.nextPage = 1;
    this.items = [];
    this.hasMore = false;
    this.runFetch(false);
  }

  onScrollNearEnd(event: Event): void {
    const el = event.target as HTMLElement;
    if (!el) {
      return;
    }
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_END_SCROLL_PX) {
      this.loadMore();
    }
  }

  /**
   * Clear shared search UI state. If the user had a non-empty filter, reload the unfiltered first page.
   */
  resetSharedSearch(hadSearchFilter: boolean): void {
    this.searchTerm = '';
    this.committedSearchNormalized = '';
    if (hadSearchFilter) {
      this.loadInitial();
    } else {
      this.opts.markForCheck();
    }
  }

  private runFetch(append: boolean): void {
    const pageNum = append ? this.nextPage : 1;
    if (append) {
      this.loadingMore = true;
    } else {
      this.loading = true;
    }

    this.opts
      .fetchPage(pageNum)
      .pipe(
        takeUntil(this.opts.destroy$),
        finalize(() => {
          this.loading = false;
          this.loadingMore = false;
          this.opts.markForCheck();
        })
      )
      .subscribe({
        next: page => {
          const batch = page?.items ?? [];
          if (append && batch.length > 0) {
            const seen = new Set(this.items.map(row => this.opts.getItemId(row)));
            for (const row of batch) {
              const id = this.opts.getItemId(row);
              if (!seen.has(id)) {
                seen.add(id);
                this.items.push(row);
              }
            }
          } else {
            this.items = batch;
          }
          this.hasMore = page?.hasNextPage ?? false;
          this.nextPage = (page?.pageIndex ?? pageNum) + 1;
          this.committedSearchNormalized = this.searchTerm.trim();
          this.opts.afterPageLoaded?.(append);
          this.opts.markForCheck();
        },
        error: () => {
          this.opts.onFetchError(append);
          if (!append) {
            this.items = [];
            this.hasMore = false;
          }
          this.opts.markForCheck();
        }
      });
  }
}
