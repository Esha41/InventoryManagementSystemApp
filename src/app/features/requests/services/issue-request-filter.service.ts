import { Injectable } from '@angular/core';
import { Cartridge } from '@models/cartridge.model';
import { FilterState, ExtendedFilterState } from '@requests/pages/new-issue/new-issue-request.state';

export type { ExtendedFilterState };

/**
 * Service responsible for filtering cartridges based on filter state
 * Extracted from NewIssueRequestComponent to follow single responsibility principle
 */
@Injectable({
  providedIn: 'root'
})
export class IssueRequestFilterService {
  /**
   * Filters cartridges based on the provided filter state
   * @param cartridges - Array of cartridges to filter
   * @param filterState - Filter state containing all filter criteria
   * @returns Filtered array of cartridges
   */
  filterCartridges(cartridges: Cartridge[], filterState: ExtendedFilterState | FilterState): Cartridge[] {
    return cartridges.filter(cartridge => {
      // Common Search
      const searchLower = filterState.searchTerm.toLowerCase();
      const bySearch = !filterState.searchTerm ||
        (cartridge.name?.toLowerCase().includes(searchLower)) ||
        (cartridge.itemNo?.toLowerCase().includes(searchLower)) ||
        (cartridge.productId?.toLowerCase().includes(searchLower)) ||
        (cartridge.ncn?.toLowerCase().includes(searchLower));

      if (filterState.selectedItemType === 'Ammunition') {
        const diameterLabel = cartridge.bulletDiameterLabel ?? '';
        const linkedLabelForFilter = cartridge.linkedLabelEn ?? cartridge.linkedLabel ?? '';
        const natureLabel = cartridge.natureLabel ?? '';
        const nsn = cartridge.ncn ?? '';

        const byDiameter = !filterState.selectedBulletDiameter || filterState.selectedBulletDiameter === diameterLabel;
        const byLinked = !filterState.selectedLinked || filterState.selectedLinked === linkedLabelForFilter;
        const byNature = !filterState.selectedNature || filterState.selectedNature === natureLabel;

        const nsnFilterLower = filterState.selectedNSN?.toLowerCase() ?? '';
        const byNSN = !nsnFilterLower || (nsn && nsn.toLowerCase().includes(nsnFilterLower));

        const byAmmunitionType = !filterState.selectedAmmunitionType ||
          (cartridge.ammunitionType !== undefined &&
            String(cartridge.ammunitionType).toLowerCase() === filterState.selectedAmmunitionType.toLowerCase());

        return byDiameter && byLinked && byNature && byNSN && byAmmunitionType && bySearch;

      } else if (filterState.selectedItemType === 'Weapon') {
        const byWeaponType = !filterState.selectedWeaponType || cartridge.weaponType === filterState.selectedWeaponType;

        // Caliber might be numeric or string, loosely matching or contains
        const caliberFilter = filterState.selectedCaliber?.toLowerCase() ?? '';
        const byCaliber = !caliberFilter || (cartridge.caliber && String(cartridge.caliber).toLowerCase().includes(caliberFilter));

        const nsn = cartridge.ncn ?? '';
        const nsnFilterLower = filterState.selectedNSN?.toLowerCase() ?? '';
        const byNSN = !nsnFilterLower || (nsn && nsn.toLowerCase().includes(nsnFilterLower));

        return byWeaponType && byCaliber && byNSN && bySearch;

      } else if (filterState.selectedItemType === 'Explosive') {
        const byExplosiveType = !filterState.selectedExplosiveType || cartridge.explosiveType === filterState.selectedExplosiveType;

        const unfilter = filterState.selectedUNNumber?.toLowerCase() ?? '';
        const byUN = !unfilter || (cartridge.unNumber && String(cartridge.unNumber).toLowerCase().includes(unfilter));

        return byExplosiveType && byUN && bySearch;
      }

      return bySearch;
    });
  }

  /**
   * Clears all filter values for the current item type
   * @param filterState - Filter state to clear
   * @param itemType - Current item type to determine which filters to clear
   */
  clearFilters(filterState: ExtendedFilterState | FilterState, itemType: string): void {
    // Reset based on current type
    if (itemType === 'Ammunition') {
      filterState.selectedAmmunitionType = '';
      filterState.selectedBulletDiameter = '';
      filterState.selectedLinked = '';
      filterState.selectedNature = '';
    } else if (itemType === 'Weapon') {
      filterState.selectedWeaponType = '';
      filterState.selectedCaliber = '';
    } else if (itemType === 'Explosive') {
      filterState.selectedExplosiveType = '';
      filterState.selectedUNNumber = '';
    }

    // Common filters
    filterState.selectedNSN = '';
    filterState.searchTerm = '';
  }
}

