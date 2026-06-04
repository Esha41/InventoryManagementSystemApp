/**
 * Typed form model for lookup create/edit modal.
 * Payload aligns with {@link CreateUpdateLookupDto} in `@models/lookup.model`
 * (maps to backend CreateUpdate* DTOs under Project.Module.Logic lookup controllers).
 */
import { FormArray, FormControl, FormGroup } from '@angular/forms';

/** Controls always present on the modal form */
export interface LookupModalFormControls {
  nameEn: FormControl<string>;
  nameAr: FormControl<string>;
  code: FormControl<string>;
  /** Present for ItemType / Unit / Caliber tables; unused tables keep `null` with no required validator */
  itemType: FormControl<number | null>;
  /** Order request purposes only */
  allowanceContext: FormControl<number | null>;
  /** RequestPurpose: multi-select of allowed item types */
  itemTypes: FormControl<number[] | null>;
  /** Used when managing RequestPurpose; empty array otherwise */
  attachmentRequirements: FormArray<AttachmentRequirementRowFormGroup>;
}

export interface AttachmentRequirementRowControls {
  id: FormControl<number | null>;
  nameEn: FormControl<string>;
  nameAr: FormControl<string>;
  isRequired: FormControl<boolean>;
  minCount: FormControl<number>;
  maxCount: FormControl<number>;
}

export type AttachmentRequirementRowFormGroup = FormGroup<AttachmentRequirementRowControls>;
export type LookupModalFormGroup = FormGroup<LookupModalFormControls>;
