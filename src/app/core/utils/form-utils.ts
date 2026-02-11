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

  /**
   * Validates required field
   */
  static validateRequired(value: unknown, fieldName: string): string | null {
    if (value === null || value === undefined) {
      return `${fieldName} is required`;
    }
    if (typeof value === 'string' && value.trim().length === 0) {
      return `${fieldName} is required`;
    }
    return null;
  }

  /**
   * Validates max length
   */
  static validateMaxLength(value: string, maxLength: number, fieldName: string): string | null {
    if (value && value.length > maxLength) {
      return `${fieldName} cannot exceed ${maxLength} characters`;
    }
    return null;
  }

  /**
   * Validates year
   */
  static validateYear(year: string, minYear: number = 1900, maxYear: number = 5000): string | null {
    if (!year || year.trim().length === 0) {
      return 'Year is required';
    }
    const yearNum = parseInt(year.trim(), 10);
    if (isNaN(yearNum) || yearNum < minYear || yearNum > maxYear) {
      return `Year must be between ${minYear} and ${maxYear}`;
    }
    return null;
  }

  /**
   * Validates numeric value
   */
  static validateNumeric(value: string, fieldName: string, min?: number, max?: number): string | null {
    if (!value || value.trim().length === 0) {
      return `${fieldName} is required`;
    }
    const num = parseFloat(value.trim());
    if (isNaN(num)) {
      return `${fieldName} must be a valid number`;
    }
    if (min !== undefined && num < min) {
      return `${fieldName} must be at least ${min}`;
    }
    if (max !== undefined && num > max) {
      return `${fieldName} must be at most ${max}`;
    }
    return null;
  }
}

