/**
 * Types for add-weapon-asset forms and DTO mapping.
 */
export type WeaponAssignMode = 'none' | 'department' | 'employee';

export interface AssetFormValue {
  itemId: number | null;
  batchNumber: string;
  supplierId: number | null;
  manufacturerId: number | null;
  primaryPurposId: number | null;
  serialNumber: string;
  rfid: string;
  purchaseDate: string;
  warrantyExpiryDate: string;
  purchasePrice: number | null;
  notes: string;
  assignMode: WeaponAssignMode;
  assignToEmployeeId: number | null;
  assignToDepartmentId: number | null;
  assignmentNotes: string;
}

export interface AssetFormRawValue {
  deliveryReceipt: string;
  assets: AssetFormValue[];
}
