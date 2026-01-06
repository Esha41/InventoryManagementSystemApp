import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Cartridge } from '@pages/new-issue-request/components/cartridge-list/cartridge-list.component';

export interface ItemTypeValidationResult {
  isValid: boolean;
  errorMessage?: string;
  errorMessageKey?: string;
}

/**
 * Service for validating item type combinations in orders
 * Rules:
 * 1. Weapons cannot be ordered with anything else (ammunition, explosives, or other types)
 * 2. Ammunition and explosives can be ordered together
 * 3. All items in a weapon order must be weapons
 */
@Injectable({
  providedIn: 'root'
})
export class ItemTypeValidationService {
  constructor(private translate: TranslateService) {}

  /**
   * Validates if a new item can be added to the existing selection
   * @param newItemType - Type of the item being added ('Ammunition', 'Weapon', 'Explosive')
   * @param existingItemTypes - Array of item types already in the selection
   * @returns Validation result with error message if invalid
   */
  validateItemTypeCombination(
    newItemType: string,
    existingItemTypes: string[]
  ): ItemTypeValidationResult {
    // Normalize item types
    const normalizedNewType = this.normalizeItemType(newItemType);
    const normalizedExistingTypes = existingItemTypes.map(t => this.normalizeItemType(t));

    // Rule 1: Weapons cannot be ordered with anything else
    if (normalizedNewType === 'Weapon') {
      if (normalizedExistingTypes.length > 0 && normalizedExistingTypes.some(t => t !== 'Weapon')) {
        return {
          isValid: false,
          errorMessageKey: 'newIssueRequest.validation.errors.weaponCannotMixWithOthers'
        };
      }
    }

    // Rule 2: If existing selection has weapons, new item must also be a weapon
    if (normalizedExistingTypes.includes('Weapon')) {
      if (normalizedNewType !== 'Weapon') {
        return {
          isValid: false,
          errorMessageKey: 'newIssueRequest.validation.errors.cannotMixWithWeapons'
        };
      }
    }

    // Rule 3: Ammunition and explosives can be ordered together (already satisfied by Rule 1)
    // This is the default valid case

    return { isValid: true };
  }

  /**
   * Validates the entire selection
   * @param cartridges - Array of selected cartridges
   * @returns Validation result
   */
  validateSelection(cartridges: Cartridge[]): ItemTypeValidationResult {
    if (!cartridges || cartridges.length === 0) {
      return { isValid: true };
    }

    const itemTypes = cartridges
      .map(c => c.itemType || this.inferItemType(c))
      .filter(t => t != null) as string[];

    if (itemTypes.length === 0) {
      return { isValid: true };
    }

    const uniqueTypes = [...new Set(itemTypes)];
    const hasWeapon = uniqueTypes.includes('Weapon');
    const hasAmmunition = uniqueTypes.includes('Ammunition');
    const hasExplosive = uniqueTypes.includes('Explosive');
    const hasOtherTypes = uniqueTypes.some(t => t !== 'Weapon' && t !== 'Ammunition' && t !== 'Explosive');

    // Rule 1: Weapons cannot be ordered with anything else
    if (hasWeapon && (hasAmmunition || hasExplosive || hasOtherTypes)) {
      return {
        isValid: false,
        errorMessageKey: 'newIssueRequest.validation.errors.weaponCannotMixWithOthers'
      };
    }

    return { isValid: true };
  }

  /**
   * Infers item type from cartridge properties
   * @param cartridge - Cartridge to infer type from
   * @returns Inferred item type
   */
  inferItemType(cartridge: Cartridge): string | null {
    if (cartridge.itemType) {
      return cartridge.itemType;
    }

    // Infer from properties
    if (cartridge.weaponType || cartridge.caliber || cartridge.actionType) {
      return 'Weapon';
    }
    if (cartridge.explosiveType || cartridge.unNumber) {
      return 'Explosive';
    }
    if (cartridge.ammunitionType || cartridge.bulletDiameterLabel || cartridge.linkedLabel) {
      return 'Ammunition';
    }

    return null;
  }

  /**
   * Normalizes item type string to standard format
   * @param itemType - Item type to normalize
   * @returns Normalized item type
   */
  private normalizeItemType(itemType: string | null | undefined): string {
    if (!itemType) {
      return '';
    }
    const normalized = itemType.trim();
    // Handle variations
    if (normalized.toLowerCase() === 'ammunition' || normalized.toLowerCase() === 'ammo') {
      return 'Ammunition';
    }
    if (normalized.toLowerCase() === 'weapon' || normalized.toLowerCase() === 'weapons') {
      return 'Weapon';
    }
    if (normalized.toLowerCase() === 'explosive' || normalized.toLowerCase() === 'explosives') {
      return 'Explosive';
    }
    return normalized;
  }

  /**
   * Gets the translated error message
   * @param errorMessageKey - Translation key
   * @returns Translated error message
   */
  getErrorMessage(errorMessageKey: string): string {
    return this.translate.instant(errorMessageKey);
  }
}

