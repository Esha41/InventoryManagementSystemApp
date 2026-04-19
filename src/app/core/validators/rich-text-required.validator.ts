import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** True when HTML has no visible text (empty Quill doc is often `<p><br></p>`). */
export function richTextRequired(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = control.value;
    if (v == null || typeof v !== 'string') {
      return { required: true };
    }
    // Image-only articles (Quill): still valid content
    if (/<img[^>]*\bsrc\s*=/i.test(v)) {
      return null;
    }

    const text = v
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.length > 0 ? null : { required: true };
  };
}
