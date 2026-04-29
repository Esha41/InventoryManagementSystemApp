/**
 * Typed form model for lookup create/edit modal.
 * Payload aligns with {@link CreateUpdateLookupDto} in `@models/lookup.model`
 * (maps to backend CreateUpdate* DTOs under Project.Module.Logic lookup controllers).
 */
import { FormControl, FormGroup } from '@angular/forms';

/** Controls always present on the modal form */
export interface LookupModalFormControls {
  nameEn: FormControl<string>;
  nameAr: FormControl<string>;
  code: FormControl<string>;
  /** Present for ItemType / Unit / Caliber tables; unused tables keep `null` with no required validator */
  itemType: FormControl<number | null>;
}

export type LookupModalFormGroup = FormGroup<LookupModalFormControls>;
