import { Injectable } from '@angular/core';
import { Observable, throwError, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { AmmunitionService } from './ammunition.service';
import { WeaponService } from './weapon.service';
import { ExplosiveService } from './explosive.service';
import { ApiService } from './api.service';
import { CartridgeMapperService } from './cartridge-mapper.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { Cartridge } from '@requests/pages/new-issue/components/cartridge-list/cartridge-list.component';
import { TranslateService } from '@ngx-translate/core';
import { getCurrentLang } from '@utils/localization.utils';

export interface ReserveDetails {
  totalReserve: number;
  totalAvailableReserve: number;
  totalOrderedQuantity: number;
  totalUsedQuantity: number;
  items: any[];
}

export interface CartridgeLoadResult {
  cartridges: Cartridge[];
  error?: string;
}

export interface ReserveDetailsResult {
  totalReserve: number;
  availableReserve: number;
  orderedQuantity: number;
  usedQuantity: number;
  reserveDetailsByItem: any[];
}

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
    return this.ammunitionService.getAll<any>().pipe(
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
    return this.weaponService.getAll<any>().pipe(
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
    return this.explosiveService.getAll<any>().pipe(
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

  // Allowance Methods
  // Note: Allowance API returns generic items. We filter by ID locally after fetching respective catalog.

  loadAllowanceItems(departmentId: number): Observable<CartridgeLoadResult> {
    // Default to ammunition for backward compatibility or when context is ambiguous
    return this.loadAllowanceAmmunition(departmentId);
  }

  private loadAllowanceGeneric(departmentId: number, fetchDetailsFn: (ids: number[]) => Observable<CartridgeLoadResult>): Observable<CartridgeLoadResult> {
    const currentYear = new Date().getFullYear();
    const endpoint = API_ENDPOINTS.ALLOWANCE.BY_DEPARTMENT_AND_YEAR(departmentId, currentYear);

    return this.apiService.getWithAuth<any>(endpoint).pipe(
      switchMap((response) => {
        const allowanceItems = response.data?.items || response.data?.Items || [];

        if (allowanceItems.length === 0) {
          return of({
            cartridges: [],
            error: 'No allowance items found for your department this year. Please contact your administrator.'
          });
        }

        const itemIds = allowanceItems.map((item: any) => item.itemId);
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


  fetchAmmunitionDetails(itemIds: number[]): Observable<CartridgeLoadResult> {
    return this.ammunitionService.getAll<any>().pipe(
      map((allAmmunition) => {
        const allowanceAmmunition = allAmmunition.filter((ammo: any) =>
          itemIds.includes(ammo.id)
        );
        const currentLang = getCurrentLang(this.translateService);
        return {
          cartridges: this.mapperService.mapAmmunitionArrayToCartridges(allowanceAmmunition, currentLang)
        };
      }),
      catchError(() => {
        return throwError(() => ({
          cartridges: [],
          error: 'Failed to load ammunition details. Please try again.'
        }));
      })
    );
  }

  fetchWeaponDetails(itemIds: number[]): Observable<CartridgeLoadResult> {
    return this.weaponService.getAll<any>().pipe(
      map((allWeapons) => {
        const allowanceWeapons = allWeapons.filter((w: any) => itemIds.includes(w.id));
        const currentLang = getCurrentLang(this.translateService);
        return {
          cartridges: this.mapperService.mapWeaponArrayToCartridges(allowanceWeapons, currentLang)
        };
      }),
      catchError(() => {
        return throwError(() => ({
          cartridges: [],
          error: 'Failed to load weapon details. Please try again.'
        }));
      })
    );
  }

  fetchExplosiveDetails(itemIds: number[]): Observable<CartridgeLoadResult> {
    return this.explosiveService.getAll<any>().pipe(
      map((allExplosives) => {
        const allowanceExplosives = allExplosives.filter((e: any) => itemIds.includes(e.id));
        const currentLang = getCurrentLang(this.translateService);
        return {
          cartridges: this.mapperService.mapExplosiveArrayToCartridges(allowanceExplosives, currentLang)
        };
      }),
      catchError(() => {
        return throwError(() => ({
          cartridges: [],
          error: 'Failed to load explosive details. Please try again.'
        }));
      })
    );
  }

  loadReserveDetails(departmentId: number): Observable<ReserveDetailsResult> {
    const currentYear = new Date().getFullYear();
    const endpoint = API_ENDPOINTS.ALLOWANCE.RESERVE_DETAILS(departmentId, currentYear);

    return this.apiService.getWithAuth<any>(endpoint).pipe(
      map((response) => {
        if (response.succeeded && response.data) {
          // Map the new API field names to the expected format
          return {
            totalReserve: response.data.totalOriginalQuantity || response.data.totalReserve || 0,
            availableReserve: response.data.totalRemainingQuantity || response.data.totalAvailableReserve || 0,
            orderedQuantity: response.data.totalReservedQuantityByOrdersOnProcessing || response.data.totalOrderedQuantity || 0,
            usedQuantity: response.data.totalUsedQuantity || 0,
            reserveDetailsByItem: (response.data.items || []).map((item: any) => ({
              itemId: item.itemId,
              itemName: item.itemName,
              itemNo: item.itemNo,
              totalReserve: item.originalQuantity || item.totalReserve || 0,
              availableReserve: item.remainingQuantity || item.availableReserve || 0,
              orderedQuantity: item.reservedQuantityByOrdersOnProcessing || item.orderedQuantity || 0,
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
        // Return default values on error
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
      bulletDiameters: Array.from(diameters),
      natureOptions: Array.from(natures)
    };
  }
}
