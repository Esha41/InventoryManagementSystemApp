import { Injectable } from '@angular/core';
import { Observable, throwError, of, from, forkJoin } from 'rxjs';
import { map, catchError, switchMap, concatMap, scan, last } from 'rxjs/operators';
import { AmmunitionService } from './ammunition.service';
import { WeaponService } from './weapon.service';
import { ExplosiveService } from './explosive.service';
import { ApiService } from '@services/api.service';
import { CartridgeMapperService } from './cartridge-mapper.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { Cartridge } from '@models/cartridge.model';
import { TranslateService } from '@ngx-translate/core';
import { getCurrentLang } from '@utils/localization.utils';
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
   * One paginated sample (no extra filters) to populate ammunition facet dropdowns when not using full catalog.
   */
  loadAmmunitionFacetSample(request: PagedRequest): Observable<{ bulletDiameters: string[]; natureOptions: string[] }> {
    const currentLang = getCurrentLang(this.translateService);
    return this.ammunitionService.getAllPaginated(request).pipe(
      map((res: PaginatedList<AmmunitionReadDto>) => {
        const cartridges = this.mapperService.mapAmmunitionArrayToCartridges(res.items || [], currentLang);
        return this.buildFilterOptions(cartridges);
      }),
      catchError(() => of({ bulletDiameters: [], natureOptions: [] }))
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

  buildFilterOptions(cartridges: Cartridge[]): {
    bulletDiameters: string[];
    natureOptions: string[];
  } {
    const diameters = new Set<string>();
    const natures = new Set<string>();

    for (const cartridge of cartridges) {
      if (cartridge.bulletDiameterLabel) {
        diameters.add(cartridge.bulletDiameterLabel);
      }
      if (cartridge.natureLabel) {
        natures.add(cartridge.natureLabel);
      }
    }

    return {
      bulletDiameters: Array.from(diameters).sort((a, b) => a.localeCompare(b)),
      natureOptions: Array.from(natures).sort((a, b) => a.localeCompare(b))
    };
  }
}
