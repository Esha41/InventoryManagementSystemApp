import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { WeaponAssignMode } from '../utils/weapon-asset-assign.types';

export function createWeaponAssetRowGroup(fb: FormBuilder): FormGroup {
  return fb.group({
    itemId: [null, Validators.required],
    batchNumber: ['', [Validators.required, Validators.maxLength(500)]],
    supplierId: [null as number | null],
    manufacturerId: [null as number | null],
    primaryPurposId: [null as number | null],
    serialNumber: ['', [Validators.maxLength(200)]],
    rfid: ['', [Validators.maxLength(500)]],
    purchaseDate: [''],
    warrantyExpiryDate: [''],
    purchasePrice: [null, [Validators.min(0)]],
    notes: ['', [Validators.maxLength(1000)]],
    assignMode: ['none' as WeaponAssignMode],
    assignToEmployeeId: [null as number | null],
    assignToDepartmentId: [null as number | null],
    assignmentNotes: ['', [Validators.maxLength(2000)]]
  });
}

/** Single-mode parent form with delivery receipt text and assets array */
export function createAddWeaponAssetMainForm(fb: FormBuilder): FormGroup {
  return fb.group({
    deliveryReceipt: [''],
    assets: fb.array([createWeaponAssetRowGroup(fb)])
  });
}

/** Bulk intake form */
export function createBulkWeaponAssetForm(fb: FormBuilder): FormGroup {
  return fb.group({
    itemId: [null, Validators.required],
    batchNumber: ['', [Validators.required, Validators.maxLength(500)]],
    quantity: [null as number | null, [Validators.required, Validators.min(1), Validators.max(50000)]],
    fillIdentifiers: [false],
    purchaseDate: [''],
    warrantyExpiryDate: [''],
    purchasePrice: [null, [Validators.min(0)]],
    notes: ['', [Validators.maxLength(1000)]],
    assignMode: ['none' as WeaponAssignMode],
    assignToEmployeeId: [null as number | null],
    assignToDepartmentId: [null as number | null],
    assignmentNotes: ['', [Validators.maxLength(2000)]],
    deliveryReceipt: ['', [Validators.maxLength(200)]],
    supplierId: [null as number | null],
    manufacturerId: [null as number | null],
    primaryPurposId: [null as number | null]
  });
}
