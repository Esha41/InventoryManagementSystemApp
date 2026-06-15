import { FormGroup, AbstractControl } from '@angular/forms';

/**
 * Utility functions for form operations
 */
export class FormUtils {
  /**
   * Scrolls to the first error element in the form
   */
  static scrollToError(selector: string = '.bg-red-100, .border-red-500, [class*="error"]'): void {
    setTimeout(() => {
      const errorElement = document.querySelector(selector);
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }

  /**
   * Marks all form controls as touched
   */
  static markFormGroupTouched(formGroup: FormGroup | AbstractControl): void {
    if (formGroup instanceof FormGroup) {
      Object.keys(formGroup.controls).forEach(key => {
        const control = formGroup.get(key);
        if (control) {
          control.markAsTouched();
          
          if (control instanceof FormGroup) {
            // It's a FormGroup, recurse
            this.markFormGroupTouched(control);
          }
        }
      });
    } else {
      formGroup.markAsTouched();
    }
  }
}

