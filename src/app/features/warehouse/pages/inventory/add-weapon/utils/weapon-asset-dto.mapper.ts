import { CreateAssetDto, CreateBulkAssetsFromTemplateDto } from '@models/asset.model';
import { WeaponAssignMode, AssetFormRawValue } from './weapon-asset-assign.types';

export function buildAssignmentFields(
  mode: WeaponAssignMode,
  assignToEmployeeId: number | null | undefined,
  assignToDepartmentId: number | null | undefined,
  assignmentNotes: string | null | undefined
): Pick<CreateAssetDto, 'assignToEmployeeId' | 'assignToDepartmentId' | 'assignmentNotes'> {
  const notes = assignmentNotes?.trim();
  if (mode === 'none') {
    return {};
  }
  if (mode === 'employee') {
    if (assignToEmployeeId == null || assignToEmployeeId <= 0) {
      return {};
    }
    return {
      assignToEmployeeId,
      ...(notes ? { assignmentNotes: notes } : {})
    };
  }
  if (mode === 'department') {
    if (assignToDepartmentId == null || assignToDepartmentId <= 0) {
      return {};
    }
    return {
      assignToDepartmentId,
      ...(notes ? { assignmentNotes: notes } : {})
    };
  }
  return {};
}

/**
 * Maps validated single-mode form to CreateAssetDto rows (shared deliveryReceipt on each row from parent form).
 */
export function mapAssetFormToCreateDtos(
  formValue: AssetFormRawValue,
  warehouseId: number
): CreateAssetDto[] {
  return formValue.assets.map((asset) => ({
    itemId: asset.itemId!,
    batchNumber: asset.batchNumber.trim(),
    depotId: warehouseId,
    serialNumber: asset.serialNumber.trim() || undefined,
    rfid: asset.rfid.trim() || undefined,
    purchaseDate: asset.purchaseDate || undefined,
    warrantyExpiryDate: asset.warrantyExpiryDate || undefined,
    purchasePrice: asset.purchasePrice ?? undefined,
    deliveryReceipt: formValue.deliveryReceipt.trim() || undefined,
    notes: asset.notes.trim() || undefined,
    supplierId: asset.supplierId ?? undefined,
    manufacturerId: asset.manufacturerId ?? undefined,
    primaryPurposId: asset.primaryPurposId ?? undefined,
    ...buildAssignmentFields(
      asset.assignMode ?? 'none',
      asset.assignToEmployeeId,
      asset.assignToDepartmentId,
      asset.assignmentNotes
    )
  }));
}

export interface BulkFormValue {
  itemId: number | null;
  batchNumber?: string;
  quantity: number | null;
  purchaseDate?: string;
  warrantyExpiryDate?: string;
  purchasePrice?: number | null;
  notes?: string;
  deliveryReceipt?: string;
  assignMode?: WeaponAssignMode;
  assignToEmployeeId?: number | null;
  assignToDepartmentId?: number | null;
  assignmentNotes?: string;
  supplierId?: number | null;
  manufacturerId?: number | null;
  primaryPurposId?: number | null;
}

export function buildCreateBulkAssetsFromTemplateDto(
  val: BulkFormValue,
  warehouseId: number
): CreateBulkAssetsFromTemplateDto {
  const assignment = buildAssignmentFields(
    val.assignMode ?? 'none',
    val.assignToEmployeeId,
    val.assignToDepartmentId,
    val.assignmentNotes
  );
  return {
    itemId: val.itemId!,
    batchNumber: (val.batchNumber?.trim() ?? '') as string,
    depotId: warehouseId,
    quantity: val.quantity!,
    purchaseDate: val.purchaseDate || undefined,
    warrantyExpiryDate: val.warrantyExpiryDate || undefined,
    purchasePrice: val.purchasePrice || undefined,
    notes: val.notes?.trim() || undefined,
    deliveryReceipt: val.deliveryReceipt?.trim() || undefined,
    supplierId: val.supplierId ?? undefined,
    manufacturerId: val.manufacturerId ?? undefined,
    primaryPurposId: val.primaryPurposId ?? undefined,
    ...assignment
  };
}

export function generateBulkCreateDtos(val: BulkFormValue, warehouseId: number): CreateAssetDto[] {
  const dtos: CreateAssetDto[] = [];
  const quantity = val.quantity || 0;
  const assignment = buildAssignmentFields(
    val.assignMode ?? 'none',
    val.assignToEmployeeId,
    val.assignToDepartmentId,
    val.assignmentNotes
  );

  for (let i = 0; i < quantity; i++) {
    dtos.push({
      itemId: val.itemId!,
      batchNumber: (val.batchNumber?.trim() ?? '') as string,
      depotId: warehouseId,
      serialNumber: undefined,
      rfid: undefined,
      purchaseDate: val.purchaseDate || undefined,
      warrantyExpiryDate: val.warrantyExpiryDate || undefined,
      purchasePrice: val.purchasePrice || undefined,
      deliveryReceipt: val.deliveryReceipt?.trim() || undefined,
      notes: val.notes?.trim() || undefined,
      supplierId: val.supplierId ?? undefined,
      manufacturerId: val.manufacturerId ?? undefined,
      primaryPurposId: val.primaryPurposId ?? undefined,
      ...assignment
    });
  }
  return dtos;
}
