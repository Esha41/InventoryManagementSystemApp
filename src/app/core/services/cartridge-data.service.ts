import { Injectable } from '@angular/core';
import { Observable, throwError, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { AmmunitionService } from './ammunition.service';
import { ApiService } from './api.service';
import { CartridgeMapperService } from './cartridge-mapper.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { Cartridge } from '@pages/new-issue-request/components/cartridge-list/cartridge-list.component';
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
    private apiService: ApiService,
    private mapperService: CartridgeMapperService,
    private translateService: TranslateService
  ) {}

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

  loadAllowanceItems(departmentId: number): Observable<CartridgeLoadResult> {
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

        // Extract item IDs and fetch full ammunition details
        const itemIds = allowanceItems.map((item: any) => item.itemId);
        return this.fetchAmmunitionDetails(itemIds);
      }),
      catchError(() => {
        return throwError(() => ({
          cartridges: [],
          error: 'Failed to load allowance items. Please try again.'
        }));
      })
    );
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
    caseLengths: string[];
    natureOptions: string[];
  } {
    const diameters = new Set<string>();
    const caseLens = new Set<string>();
    const natures = new Set<string>();

    for (const cartridge of cartridges) {
      if (cartridge.bulletDiameterLabel) {
        diameters.add(cartridge.bulletDiameterLabel);
      }
      if (cartridge.caseLengthLabel) {
        caseLens.add(cartridge.caseLengthLabel);
      }
      if (cartridge.natureLabel) {
        natures.add(cartridge.natureLabel);
      }
    }

    return {
      bulletDiameters: Array.from(diameters),
      caseLengths: Array.from(caseLens),
      natureOptions: Array.from(natures)
    };
  }
}

