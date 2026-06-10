import { Injectable } from '@angular/core';
import { Observable, throwError, of, from, forkJoin } from 'rxjs';
import { map, catchError, switchMap, concatMap, scan, last } from 'rxjs/operators';
import { AmmunitionService } from './ammunition.service';
import { WeaponService } from './weapon.service';
import { ExplosiveService } from './explosive.service';
import { ApiService } from '@services/api.service';
import { LookupService } from '@services/lookup.service';
import { CartridgeMapperService } from './cartridge-mapper.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { Cartridge } from '@models/cartridge.model';
import { ItemType } from '@models/backend-enums';
import { TranslateService } from '@ngx-translate/core';
import { getCurrentLang } from '@utils/localization.utils';
import { catalogDtoMatchesPrimaryPurpose, createFilterOptions } from '@utils/asset-list.utils';
import {
  buildAmmunitionPagedRequest,
  buildWeaponPagedRequest,
  buildExplosivePagedRequest
} from '@requests/utils/catalog-paged-request.builder';
import type { FilterState } from '@requests/pages/new-issue/new-issue-request.state';
import { DropdownOption } from '@components/dropdown/dropdown.component';
import { PagedRequest, PaginatedList } from '@models/api-response.model';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';
import {
  AllowanceItemByDepartmentDto,
  AllowanceItemDetailDto,
  AllowanceReserveDetailsByItemDto,
  AllowanceItemReserveDetailsDto
} from '@models/allowance.model';
import { LookupItem } from '@models/lookup.model';

export interface ReserveDetails {
  totalReserve: number;
  totalAvailableReserve: number;
  totalOrderedQuantity: number;
  totalUsedQuantity: number;
  items: unknown[];
}

/** Normalized row for UI — mapped from {@link AllowanceItemReserveDetailsDto}. */
export interface ReserveDetailByItemRow {
  itemId: number;
  itemName: string;
  itemNo?: string | null;
  totalReserve: number;
  availableReserve: number;
  orderedQuantity: number;
  usedQuantity: number;
}

export interface CartridgeLoadResult {
  cartridges: Cartridge[];
  error?: string;
}

export interface CartridgePaginatedLoadResult {
  cartridges: Cartridge[];
  totalCount: number;
  pageIndex: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  error?: string;
}

export interface ReserveDetailsResult {
  totalReserve: number;
  availableReserve: number;
  orderedQuantity: number;
  usedQuantity: number;
  reserveDetailsByItem: ReserveDetailByItemRow[];
}

const GET_BY_ID_BATCH_SIZE = 12;
const CATALOG_PRIMARY_PURPOSE_FETCH_PAGE_SIZE = 500;

type CatalogPrimaryPurposeDto = Pick<
  AmmunitionReadDto,
  'primaryPurposId' | 'primaryPurposes' | 'primaryPurpos'
>;

/** Data inside {@link APIOperationResponse.data} for GET `AllowanceItem/department/{id}/year/{year}`. */
type AllowanceByDepartmentPayload = AllowanceItemByDepartmentDto & {
  Items?: AllowanceItemDetailDto[];
};

@Injectable({
  providedIn: 'root'
})
export class CartridgeDataService {
  constructor(
    private ammunitionService: AmmunitionService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
    private apiService: ApiService,
    private lookupService: LookupService,
    private mapperService: CartridgeMapperService,
    private translateService: TranslateService
  ) { }

  loadAllAmmunition(): Observable<CartridgeLoadResult> {
    const currentLang = getCurrentLang(this.translateService);
    return this.ammunitionService.getAll().pipe(
      map((items) => ({
        cartridges: this.mapperService.mapAmmunitionArrayToCartridges(items || [], currentLang)
      })),
      catchError(() => {
        return throwError(() => ({
          cartridges: [],
          error: 'Failed to load ammunition catalog. Please try again.'
        }));
      })
    );
  }

  loadAllWeapons(): Observable<CartridgeLoadResult> {
    const currentLang = getCurrentLang(this.translateService);
    return this.weaponService.getAll().pipe(
      map((items) => ({
        cartridges: this.mapperService.mapWeaponArrayToCartridges(items || [], currentLang)
      })),
      catchError(() => {
        return throwError(() => ({
          cartridges: [],
          error: 'Failed to load weapon catalog. Please try again.'
        }));
      })
    );
  }

  loadAllExplosives(): Observable<CartridgeLoadResult> {
    const currentLang = getCurrentLang(this.translateService);
    return this.explosiveService.getAll().pipe(
      map((items) => ({
        cartridges: this.mapperService.mapExplosiveArrayToCartridges(items || [], currentLang)
      })),
      catchError(() => {
        return throwError(() => ({
          cartridges: [],
          error: 'Failed to load explosive catalog. Please try again.'
        }));
      })
    );
  }

  loadAmmunitionPaginated(request: PagedRequest): Observable<CartridgePaginatedLoadResult> {
    const currentLang = getCurrentLang(this.translateService);
    return this.ammunitionService.getAllPaginated(request).pipe(
      map((res: PaginatedList<AmmunitionReadDto>) => ({
        cartridges: this.mapperService.mapAmmunitionArrayToCartridges(res.items || [], currentLang),
        totalCount: res.totalCount,
        pageIndex: res.pageIndex,
        totalPages: res.totalPages,
        hasNextPage: res.hasNextPage,
        hasPreviousPage: res.hasPreviousPage
      })),
      catchError(() =>
        throwError(() => ({
          cartridges: [],
          totalCount: 0,
          pageIndex: 1,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
          error: 'Failed to load ammunition catalog. Please try again.'
        }))
      )
    );
  }

  loadAmmunitionCatalogPaginated(
    page: number,
    pageSize: number,
    filterState: FilterState
  ): Observable<CartridgePaginatedLoadResult> {
    const currentLang = getCurrentLang(this.translateService);
    return this.loadCatalogPaginatedWithOptionalPrimaryPurpose(
      page,
      pageSize,
      filterState,
      (p, ps, fs) => buildAmmunitionPagedRequest(p, ps, fs),
      req => this.ammunitionService.getAllPaginated(req),
      items => this.mapperService.mapAmmunitionArrayToCartridges(items, currentLang),
      'Failed to load ammunition catalog. Please try again.'
    );
  }

  loadWeaponsCatalogPaginated(
    page: number,
    pageSize: number,
    filterState: FilterState
  ): Observable<CartridgePaginatedLoadResult> {
    const currentLang = getCurrentLang(this.translateService);
    return this.loadCatalogPaginatedWithOptionalPrimaryPurpose(
      page,
      pageSize,
      filterState,
      (p, ps, fs) => buildWeaponPagedRequest(p, ps, fs),
      req => this.weaponService.getAllPaginated(req),
      items => this.mapperService.mapWeaponArrayToCartridges(items, currentLang),
      'Failed to load weapon catalog. Please try again.'
    );
  }

  loadExplosivesCatalogPaginated(
    page: number,
    pageSize: number,
    filterState: FilterState
  ): Observable<CartridgePaginatedLoadResult> {
    const currentLang = getCurrentLang(this.translateService);
    return this.loadCatalogPaginatedWithOptionalPrimaryPurpose(
      page,
      pageSize,
      filterState,
      (p, ps, fs) => buildExplosivePagedRequest(p, ps, fs),
      req => this.explosiveService.getAllPaginated(req),
      items => this.mapperService.mapExplosiveArrayToCartridges(items, currentLang),
      'Failed to load explosive catalog. Please try again.'
    );
  }

  /**
   * Server-paginated catalog with optional client-side primary purpose filter (same pattern as asset list).
   */
  private loadCatalogPaginatedWithOptionalPrimaryPurpose<T extends CatalogPrimaryPurposeDto>(
    page: number,
    pageSize: number,
    filterState: FilterState,
    buildPagedRequest: (page: number, pageSize: number, fs: FilterState) => PagedRequest,
    fetchPaginated: (request: PagedRequest) => Observable<PaginatedList<T>>,
    mapItemsToCartridges: (items: T[]) => Cartridge[],
    errorMessage: string
  ): Observable<CartridgePaginatedLoadResult> {
    const purposeRaw = filterState.selectedPrimaryPurposeId?.trim() ?? '';
    const purposeId = purposeRaw ? Number(purposeRaw) : NaN;
    const hasPrimaryPurposeFilter = Number.isFinite(purposeId) && purposeId > 0;

    if (!hasPrimaryPurposeFilter) {
      return fetchPaginated(buildPagedRequest(page, pageSize, filterState)).pipe(
        map(res => ({
          cartridges: mapItemsToCartridges(res.items || []),
          totalCount: res.totalCount,
          pageIndex: res.pageIndex,
          totalPages: res.totalPages,
          hasNextPage: res.hasNextPage,
          hasPreviousPage: res.hasPreviousPage
        })),
        catchError(() => throwError(() => this.emptyCatalogPaginatedResult(errorMessage)))
      );
    }

    const loadAll = (fetchPage: number, acc: T[]): Observable<T[]> => {
      const request = buildPagedRequest(fetchPage, CATALOG_PRIMARY_PURPOSE_FETCH_PAGE_SIZE, filterState);
      return fetchPaginated(request).pipe(
        concatMap(res => {
          const merged = [...acc, ...(res.items || [])];
          if (
            (res.items?.length ?? 0) < CATALOG_PRIMARY_PURPOSE_FETCH_PAGE_SIZE ||
            merged.length >= res.totalCount
          ) {
            return of(merged);
          }
          return loadAll(fetchPage + 1, merged);
        })
      );
    };

    return loadAll(1, []).pipe(
      map(dtos => {
        const filtered = dtos.filter(d => catalogDtoMatchesPrimaryPurpose(d, purposeId));
        const totalCount = filtered.length;
        const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / pageSize);
        const start = (page - 1) * pageSize;
        const slice = filtered.slice(start, start + pageSize);
        return {
          cartridges: mapItemsToCartridges(slice),
          totalCount,
          pageIndex: page,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        };
      }),
      catchError(() => throwError(() => this.emptyCatalogPaginatedResult(errorMessage)))
    );
  }

  private emptyCatalogPaginatedResult(errorMessage: string): CartridgePaginatedLoadResult {
    return {
      cartridges: [],
      totalCount: 0,
      pageIndex: 1,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
      error: errorMessage
    };
  }

  loadWeaponsPaginated(request: PagedRequest): Observable<CartridgePaginatedLoadResult> {
    const currentLang = getCurrentLang(this.translateService);
    return this.weaponService.getAllPaginated(request).pipe(
      map((res: PaginatedList<WeaponDto>) => ({
        cartridges: this.mapperService.mapWeaponArrayToCartridges(res.items || [], currentLang),
        totalCount: res.totalCount,
        pageIndex: res.pageIndex,
        totalPages: res.totalPages,
        hasNextPage: res.hasNextPage,
        hasPreviousPage: res.hasPreviousPage
      })),
      catchError(() =>
        throwError(() => ({
          cartridges: [],
          totalCount: 0,
          pageIndex: 1,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
          error: 'Failed to load weapon catalog. Please try again.'
        }))
      )
    );
  }

  loadExplosivesPaginated(request: PagedRequest): Observable<CartridgePaginatedLoadResult> {
    const currentLang = getCurrentLang(this.translateService);
    return this.explosiveService.getAllPaginated(request).pipe(
      map((res: PaginatedList<ExplosiveDto>) => ({
        cartridges: this.mapperService.mapExplosiveArrayToCartridges(res.items || [], currentLang),
        totalCount: res.totalCount,
        pageIndex: res.pageIndex,
        totalPages: res.totalPages,
        hasNextPage: res.hasNextPage,
        hasPreviousPage: res.hasPreviousPage
      })),
      catchError(() =>
        throwError(() => ({
          cartridges: [],
          totalCount: 0,
          pageIndex: 1,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
          error: 'Failed to load explosive catalog. Please try again.'
        }))
      )
    );
  }

  loadAllowanceItems(departmentId: number): Observable<CartridgeLoadResult> {
    return this.loadAllowanceAmmunition(departmentId);
  }

  private loadAllowanceGeneric(departmentId: number, fetchDetailsFn: (ids: number[]) => Observable<CartridgeLoadResult>): Observable<CartridgeLoadResult> {
    const currentYear = new Date().getFullYear();
    const endpoint = API_ENDPOINTS.ALLOWANCE.BY_DEPARTMENT_AND_YEAR(departmentId, currentYear);

    return this.apiService.getRaw<AllowanceByDepartmentPayload>(endpoint).pipe(
      switchMap((response) => {
        const allowanceItems = response.data?.items || response.data?.Items || [];

        if (allowanceItems.length === 0) {
          return of({
            cartridges: [],
            error: this.translateService.instant('newIssueRequest.noAllowanceItemsFound')
          });
        }

        const itemIds = allowanceItems.map((item) => item.itemId);
        return fetchDetailsFn(itemIds);
      }),
      catchError(() => {
        return throwError(() => ({
          cartridges: [],
          error: 'Failed to load allowance items. Please try again.'
        }));
      })
    );
  }

  loadAllowanceAmmunition(departmentId: number): Observable<CartridgeLoadResult> {
    return this.loadAllowanceGeneric(departmentId, (ids) => this.fetchAmmunitionDetails(ids));
  }

  loadAllowanceWeapons(departmentId: number): Observable<CartridgeLoadResult> {
    return this.loadAllowanceGeneric(departmentId, (ids) => this.fetchWeaponDetails(ids));
  }

  loadAllowanceExplosives(departmentId: number): Observable<CartridgeLoadResult> {
    return this.loadAllowanceGeneric(departmentId, (ids) => this.fetchExplosiveDetails(ids));
  }

  private fetchByIdsBatched<T>(ids: number[], getOne: (id: number) => Observable<T>): Observable<T[]> {
    const unique = [...new Set(ids.filter((id) => Number(id) > 0))];
    if (unique.length === 0) {
      return of([]);
    }
    const chunks: number[][] = [];
    for (let i = 0; i < unique.length; i += GET_BY_ID_BATCH_SIZE) {
      chunks.push(unique.slice(i, i + GET_BY_ID_BATCH_SIZE));
    }
    return from(chunks).pipe(
      concatMap((chunk) =>
        forkJoin(
          chunk.map((id) =>
            getOne(id).pipe(
              catchError(() => of(null as T | null))
            )
          )
        ).pipe(
          map((batch) => batch.filter((x): x is T => x != null))
        )
      ),
      scan((acc: T[], batch: T[]) => [...acc, ...batch], [] as T[]),
      last()
    );
  }

  fetchAmmunitionDetails(itemIds: number[]): Observable<CartridgeLoadResult> {
    const currentLang = getCurrentLang(this.translateService);
    return this.fetchByIdsBatched(itemIds, (id) => this.ammunitionService.getById<AmmunitionReadDto>(id)).pipe(
      map((items) => ({
        cartridges: this.mapperService.mapAmmunitionArrayToCartridges(items, currentLang)
      })),
      catchError(() =>
        throwError(() => ({
          cartridges: [],
          error: 'Failed to load ammunition details. Please try again.'
        }))
      )
    );
  }

  fetchWeaponDetails(itemIds: number[]): Observable<CartridgeLoadResult> {
    const currentLang = getCurrentLang(this.translateService);
    return this.fetchByIdsBatched(itemIds, (id) => this.weaponService.getById<WeaponDto>(id)).pipe(
      map((items) => ({
        cartridges: this.mapperService.mapWeaponArrayToCartridges(items, currentLang)
      })),
      catchError(() =>
        throwError(() => ({
          cartridges: [],
          error: 'Failed to load weapon details. Please try again.'
        }))
      )
    );
  }

  fetchExplosiveDetails(itemIds: number[]): Observable<CartridgeLoadResult> {
    const currentLang = getCurrentLang(this.translateService);
    return this.fetchByIdsBatched(itemIds, (id) => this.explosiveService.getById<ExplosiveDto>(id)).pipe(
      map((items) => ({
        cartridges: this.mapperService.mapExplosiveArrayToCartridges(items, currentLang)
      })),
      catchError(() =>
        throwError(() => ({
          cartridges: [],
          error: 'Failed to load explosive details. Please try again.'
        }))
      )
    );
  }

  /**
   * All caliber lookup rows for ammunition or weapon filters (same source as asset list / add asset).
   */
  loadCaliberFilterOptions(itemType: ItemType.Ammunition | ItemType.Weapon): Observable<DropdownOption<string>[]> {
    return this.lookupService.getCalibersByItemType(itemType).pipe(
      map(items =>
        createFilterOptions(items, this.translateService)
          .map(opt => ({ label: opt.label, value: String(opt.value) }))
          .sort((a, b) => a.label.localeCompare(b.label))
      ),
      catchError(() => of([]))
    );
  }

  loadPrimaryPurposeFilterOptions(): Observable<DropdownOption<string>[]> {
    return this.lookupService.getPrimaryPurposes().pipe(
      map(items =>
        createFilterOptions(items, this.translateService)
          .map(opt => ({ label: opt.label, value: String(opt.value) }))
          .sort((a, b) => a.label.localeCompare(b.label))
      ),
      catchError(() => of([]))
    );
  }

  loadClassificationFilterOptions(): Observable<DropdownOption<string>[]> {
    return this.lookupService.getClassifications().pipe(
      map(items =>
        createFilterOptions(items, this.translateService)
          .map(opt => ({ label: opt.label, value: String(opt.value) }))
          .sort((a, b) => a.label.localeCompare(b.label))
      ),
      catchError(() => of([]))
    );
  }

  loadCaseTypeFilterOptions(): Observable<DropdownOption<string>[]> {
    return this.loadLookupFilterOptions(() => this.lookupService.getCaseTypes());
  }

  loadCompatibilityFilterOptions(): Observable<DropdownOption<string>[]> {
    return this.loadLookupFilterOptions(() => this.lookupService.getCompatibilities());
  }

  loadHazardDivisionFilterOptions(): Observable<DropdownOption<string>[]> {
    return this.loadLookupFilterOptions(() => this.lookupService.getHazardDivisions());
  }

  loadPropellantFilterOptions(): Observable<DropdownOption<string>[]> {
    return this.loadLookupFilterOptions(() => this.lookupService.getPropellants());
  }

  loadCountryFilterOptions(): Observable<DropdownOption<string>[]> {
    return this.loadLookupFilterOptions(() => this.lookupService.getCountries());
  }

  private loadLookupFilterOptions(
    fetch: () => Observable<LookupItem[]>
  ): Observable<DropdownOption<string>[]> {
    return fetch().pipe(
      map(items =>
        createFilterOptions(items, this.translateService)
          .map(opt => ({ label: opt.label, value: String(opt.value) }))
          .sort((a, b) => a.label.localeCompare(b.label))
      ),
      catchError(() => of([]))
    );
  }

  loadReserveDetails(departmentId: number): Observable<ReserveDetailsResult> {
    const currentYear = new Date().getFullYear();
    const endpoint = API_ENDPOINTS.ALLOWANCE.RESERVE_DETAILS(departmentId, currentYear);

    return this.apiService.getRaw<AllowanceReserveDetailsByItemDto>(endpoint).pipe(
      map((response) => {
        if (response.succeeded && response.data) {
          const data = response.data;
          return {
            totalReserve: data.totalOriginalQuantity || 0,
            availableReserve: data.totalRemainingQuantity || 0,
            orderedQuantity: data.totalReservedQuantityByOrdersOnProcessing || 0,
            usedQuantity: data.totalUsedQuantity || 0,
            reserveDetailsByItem: (data.items || []).map((item: AllowanceItemReserveDetailsDto): ReserveDetailByItemRow => ({
              itemId: Number(item.itemId),
              itemName: item.itemName ?? '',
              itemNo: item.itemNo,
              totalReserve: item.originalQuantity || 0,
              availableReserve: item.remainingQuantity || 0,
              orderedQuantity: item.reservedQuantityByOrdersOnProcessing || 0,
              usedQuantity: item.usedQuantity || 0
            }))
          };
        }
        return {
          totalReserve: 0,
          availableReserve: 0,
          orderedQuantity: 0,
          usedQuantity: 0,
          reserveDetailsByItem: []
        };
      }),
      catchError(() => {
        return throwError(() => ({
          totalReserve: 0,
          availableReserve: 0,
          orderedQuantity: 0,
          usedQuantity: 0,
          reserveDetailsByItem: []
        }));
      })
    );
  }

}
