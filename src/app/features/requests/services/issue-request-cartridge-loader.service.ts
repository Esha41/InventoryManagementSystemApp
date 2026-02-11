import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CartridgeDataService, CartridgeLoadResult } from '@services/cartridge-data.service';
import { CartridgeState } from '@requests/pages/new-issue/new-issue-request.state';
import { FilterState } from '@requests/pages/new-issue/new-issue-request.state';

/**
 * Service responsible for orchestrating cartridge loading operations
 * Extracted from NewIssueRequestComponent to follow single responsibility principle
 */
@Injectable({
  providedIn: 'root'
})
export class IssueRequestCartridgeLoaderService {
  constructor(
    private cartridgeDataService: CartridgeDataService
  ) { }

  /**
   * Determines which load method to use based on item type and allowance setting
   * @param itemType - Type of item (Ammunition, Weapon, Explosive)
   * @param isAllowance - Whether loading from allowance
   * @param departmentId - Department ID (required for allowance)
   * @returns Observable of cartridge load result
   */
  loadCartridges(
    itemType: string,
    isAllowance: boolean,
    departmentId: number | null
  ): Observable<CartridgeLoadResult> {
    if (isAllowance && !departmentId) {
      return new Observable(observer => {
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
    } else if (itemType === 'Explosive') {
      return isAllowance
        ? this.cartridgeDataService.loadAllowanceExplosives(departmentId!)
        : this.cartridgeDataService.loadAllExplosives();
    } else {
      // Ammunition
      return isAllowance
        ? this.cartridgeDataService.loadAllowanceAmmunition(departmentId!)
        : this.cartridgeDataService.loadAllAmmunition();
    }
  }
}

