import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CartridgeDataService,
  CartridgeLoadResult,
  CartridgePaginatedLoadResult
} from '@services/cartridge-data.service';
import { IssueCatalogPagedRequestBuilder } from './issue-catalog-paged-request.builder';
import { FilterState } from '@requests/pages/new-issue/new-issue-request.state';

@Injectable({
  providedIn: 'root'
})
export class IssueRequestCartridgeLoaderService {
  constructor(
    private cartridgeDataService: CartridgeDataService,
    private pagedRequestBuilder: IssueCatalogPagedRequestBuilder
  ) { }

  loadCartridges(
    itemType: string,
    isAllowance: boolean,
    departmentId: number | null
  ): Observable<CartridgeLoadResult> {
    if (isAllowance && !departmentId) {
      return new Observable((observer) => {
        observer.next({
          cartridges: [],
          error: 'Department not found for current user.'
        });
        observer.complete();
      });
    }

    if (itemType === 'Weapon') {
      return isAllowance
        ? this.cartridgeDataService.loadAllowanceWeapons(departmentId!)
        : this.cartridgeDataService.loadAllWeapons();
    }
    if (itemType === 'Explosive') {
      return isAllowance
        ? this.cartridgeDataService.loadAllowanceExplosives(departmentId!)
        : this.cartridgeDataService.loadAllExplosives();
    }
    return isAllowance
      ? this.cartridgeDataService.loadAllowanceAmmunition(departmentId!)
      : this.cartridgeDataService.loadAllAmmunition();
  }

  /**
   * Server-paginated full catalog (not allowance). Use with Apply Search / pagination controls.
   */
  loadCartridgesPaginated(
    itemType: string,
    page: number,
    pageSize: number,
    filterState: FilterState
  ): Observable<CartridgePaginatedLoadResult> {
    if (itemType === 'Weapon') {
      const request = this.pagedRequestBuilder.buildForWeapon(page, pageSize, filterState);
      return this.cartridgeDataService.loadWeaponsPaginated(request);
    }
    if (itemType === 'Explosive') {
      const request = this.pagedRequestBuilder.buildForExplosive(page, pageSize, filterState);
      return this.cartridgeDataService.loadExplosivesPaginated(request);
    }
    const request = this.pagedRequestBuilder.buildForAmmunition(page, pageSize, filterState);
    return this.cartridgeDataService.loadAmmunitionPaginated(request);
  }

  loadAmmunitionFacetSample(): Observable<{ bulletDiameters: string[]; natureOptions: string[] }> {
    const request = this.pagedRequestBuilder.buildFacetSampleRequest();
    return this.cartridgeDataService.loadAmmunitionFacetSample(request);
  }
}
