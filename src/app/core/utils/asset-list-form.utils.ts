import { FormBuilder, FormGroup, Validators } from '@angular/forms';

/**
 * Creates the edit form for asset list component
 */
export function createAssetEditForm(fb: FormBuilder): FormGroup {
  return fb.group({
    id: [0 as number],
    name: ['', Validators.required],
    nameAr: [''],
    itemNo: [''],
    partNo: [''],

    // Shared/Common (Nullable)
    hccId: [null as number | null],
    nsn: [''],
    expiryDate: [null],
    price: [null as number | null],
    minimumQuantity: [null as number | null],
    criticalQuantity: [null as number | null],
    maximumStock: [null as number | null],

    // Ammunition
    bulletDiameter: [null as number | null],
    bulletDiameterUnitId: [null as number | null],
    armNumber: [''],
    isLinked: [false as boolean],
    primer: [''],
    totalWeight: [null as number | null], // Used by both ammunition and explosive
    totalWeightUnitId: [null as number | null], // For explosive total weight unit
    caseTypeId: [null as number | null],
    propellantId: [null as number | null],
    compatibilityId: [null as number | null], // Used by both ammunition and explosive
    hazardDivisionId: [null as number | null], // Used by both ammunition and explosive
    primaryPurposIds: [[] as number[]],
    projectileColorId: [null as number | null],
    projectailMaterialId: [null as number | null],
    distribution: [''],
    referenceNo: [''],
    classificationId: [null as number | null],
    typeId: [null as number | null],
    /** Ammunition only: AmmunitionType enum as string '1' | '2' | '3' for dropdown */
    ammunitionType: [''],
    /** Weapon only: WeaponCaliberCategory (default Small = 1) */
    caliberCategory: ['1'],
    notes: [''],

    // Weapon / Ammunition catalog caliber (lookup)
    caliberId: [null as number | null],
    caliberUnitId: [null as number | null],
    yearOfManufacture: [null as number | null],
    countryOfManufactureId: [null as number | null],
    model: [''],

    // Explosive
    explosiveType: [null as number | null],
    unNumber: [''],
    netExplosiveQuantity: [null as number | null],
    netExplosiveQuantityUnitId: [null as number | null],
    unitId: [null as number | null], // Unit lookup ID for explosive
  });
}

