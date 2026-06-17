import { Injectable } from '@angular/core';
import { Cartridge } from '@models/cartridge.model';
import { FilterState, ExtendedFilterState } from '@requests/pages/new-issue/new-issue-request.state';

export type { ExtendedFilterState };


@Injectable({
  providedIn: 'root'
})
export class IssueRequestFilterService {

  filterCartridges(cartridges: Cartridge[], filterState: ExtendedFilterState | FilterState): Cartridge[] {
    return cartridges.filter(cartridge => {
      // Common Search
      const searchLower = filterState.searchTerm.toLowerCase();
      const bySearch = !filterState.searchTerm ||
        (cartridge.name?.toLowerCase().includes(searchLower)) ||
        (cartridge.itemNo?.toLowerCase().includes(searchLower)) ||
        (cartridge.productId?.toLowerCase().includes(searchLower)) ||
        (cartridge.ncn?.toLowerCase().includes(searchLower));

      const itemNoFilterLower = filterState.selectedItemNo?.toLowerCase() ?? '';
      const itemNo = cartridge.itemNo ?? cartridge.productId ?? '';
      const byItemNo = !itemNoFilterLower || (itemNo && itemNo.toLowerCase().includes(itemNoFilterLower));

      const nsnFilterLower = filterState.selectedNSN?.toLowerCase() ?? '';
      const nsn = cartridge.ncn ?? '';
      const byNSN = !nsnFilterLower || (nsn && nsn.toLowerCase().includes(nsnFilterLower));

      if (filterState.selectedItemType === 'Ammunition') {
        const linkedLabelForFilter = cartridge.linkedLabelEn ?? cartridge.linkedLabel ?? '';

        const selectedCaliberId = filterState.selectedCaliber?.trim() ?? '';
        const byCaliber = !selectedCaliberId || String(cartridge.caliberId ?? '') === selectedCaliberId;
        const byLinked = !filterState.selectedLinked || filterState.selectedLinked === linkedLabelForFilter;

        const byAmmunitionType = !filterState.selectedAmmunitionType ||
          (cartridge.ammunitionType !== undefined &&
            String(cartridge.ammunitionType).toLowerCase() === filterState.selectedAmmunitionType.toLowerCase());

        return byCaliber && byLinked && byItemNo && byNSN && byAmmunitionType && bySearch;

      } else if (filterState.selectedItemType === 'Weapon') {
        const byWeaponType = !filterState.selectedWeaponType || cartridge.weaponType === filterState.selectedWeaponType;

        // Caliber might be numeric or string, loosely matching or contains
        const selectedCaliberId = filterState.selectedCaliber?.trim() ?? '';
        const byCaliber = !selectedCaliberId || String(cartridge.caliberId ?? '') === selectedCaliberId;

        return byWeaponType && byCaliber && byItemNo && byNSN && bySearch;

      } else if (filterState.selectedItemType === 'Explosive') {
        const byExplosiveType = !filterState.selectedExplosiveType || cartridge.explosiveType === filterState.selectedExplosiveType;

        const unfilter = filterState.selectedUNNumber?.toLowerCase() ?? '';
        const byUN = !unfilter || (cartridge.unNumber && String(cartridge.unNumber).toLowerCase().includes(unfilter));

        return byExplosiveType && byUN && byItemNo && byNSN && bySearch;
      }

      return bySearch;
    });
  }

 
  clearFilters(filterState: ExtendedFilterState | FilterState, itemType: string): void {
    if (itemType === 'Ammunition') {
      filterState.selectedAmmunitionType = '';
      filterState.selectedCaliber = '';
      filterState.selectedLinked = '';
      filterState.selectedPrimaryPurposeId = '';
      filterState.selectedClassificationId = '';
      filterState.selectedCaseType = '';
      filterState.selectedCompatibility = '';
      filterState.selectedHazardDivision = '';
      filterState.selectedPropellant = '';
      filterState.selectedAmmunitionArmNumber = '';
      filterState.selectedAmmunitionPartNo = '';
    } else if (itemType === 'Weapon') {
      filterState.selectedWeaponType = '';
      filterState.selectedCaliber = '';
      filterState.selectedPrimaryPurposeId = '';
      filterState.selectedClassificationId = '';
      filterState.selectedCountryOfManufacture = '';
      filterState.selectedWeaponUNNumber = '';
      filterState.selectedPartNo = '';
      filterState.selectedWeaponModel = '';
      filterState.selectedWeaponReferenceNo = '';
    } else if (itemType === 'Explosive') {
      filterState.selectedExplosiveType = '';
      filterState.selectedUNNumber = '';
      filterState.selectedPrimaryPurposeId = '';
      filterState.selectedClassificationId = '';
      filterState.selectedExplosiveHazardDivision = '';
      filterState.selectedExplosiveCompatibility = '';
      filterState.selectedArmNumber = '';
      filterState.selectedExplosivePartNo = '';
      filterState.selectedExplosiveReferenceNo = '';
    }

    filterState.selectedNSN = '';
    filterState.selectedItemNo = '';
    filterState.searchTerm = '';
  }
}

