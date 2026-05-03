import { AbstractControl, FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';

export function getControlScope(
  assetForm: FormGroup,
  fieldPath: string,
  index: number | undefined,
  rowAt?: (idx: number) => FormGroup
): AbstractControl | null {
  if (index !== undefined && rowAt) {
    return rowAt(index).get(fieldPath);
  }
  return assetForm.get(fieldPath);
}

export function isControlInvalid(control: AbstractControl | null): boolean {
  return !!(control && control.invalid && (control.dirty || control.touched));
}

export function fieldErrorFromControl(
  control: AbstractControl | null,
  translateService: TranslateService
): string | null {
  if (!control?.errors) return null;
  const errs = control.errors;
  if (errs['required']) {
    return translateService.instant('addWeaponAsset.required');
  }
  if (errs['maxlength']) {
    return translateService.instant('addWeaponAsset.maxLength', {
      max: errs['maxlength'].requiredLength
    });
  }
  if (errs['min']) {
    return translateService.instant('addWeaponAsset.minValue', {
      min: errs['min'].min
    });
  }
  return null;
}

export function touchControlIfPresent(control: AbstractControl | null): void {
  if (control) {
    control.markAsTouched();
    control.updateValueAndValidity();
  }
}
