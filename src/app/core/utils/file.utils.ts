/**
 * File utility functions for common file operations
 */
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from '@services/toast.service';

/**
 * Formats file size in bytes to human-readable format
 * @param bytes File size in bytes
 * @returns Formatted string (e.g., "1.5 KB", "2.3 MB")
 */
export function getFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Formats File object size to human-readable format
 * @param file File object
 * @returns Formatted string (e.g., "1.5 KB", "2.3 MB")
 */
export function getFileSizeFromFile(file: File): string {
  return getFileSize(file.size);
}

/**
 * Removes a file from an array of files by index
 * @param files Array of File objects (will be modified in place)
 * @param index Index of the file to remove
 * @param fileInputElement Optional HTML input element to clear if files array becomes empty
 */
export function removeFile(
  files: File[],
  index: number,
  fileInputElement?: HTMLInputElement | null
): void {
  if (index < 0 || index >= files.length) {
    return;
  }

  files.splice(index, 1);

  // Clear the file input if no files remain
  if (files.length === 0 && fileInputElement) {
    fileInputElement.value = '';
  }
}

/**
 * Opens a file in a new browser tab/window
 * @param file File object to open
 */
export function viewFile(file: File): void {
  if (!file) return;
  
  const blobUrl = URL.createObjectURL(file);
  window.open(blobUrl, '_blank');
  
  // Clean up the blob URL after a delay to free memory
  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 100);
}

/**
 * Maximum file size in bytes (30 MB)
 */
export const MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024; // 30 MB

/**
 * Maximum file size in MB (for display)
 */
export const MAX_FILE_SIZE_MB = 30;

/**
 * Allowed file types/extensions
 */
export const ALLOWED_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf', '.xlsx', '.docx'];

/**
 * Allowed MIME types
 */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

/**
 * Validates if a file type is allowed
 * @param file File object to validate
 * @returns Object with isValid boolean and errorMessage string
 */
export function validateFileType(file: File): { isValid: boolean; errorMessage: string } {
  if (!file) {
    return { isValid: false, errorMessage: 'No file provided' };
  }

  const fileName = file.name.toLowerCase();
  const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
  
  // Check by extension
  const isValidExtension = ALLOWED_FILE_EXTENSIONS.some(ext => 
    fileName.endsWith(ext.toLowerCase())
  );

  // Check by MIME type (if available)
  const isValidMimeType = !file.type || ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());

  if (!isValidExtension && !isValidMimeType) {
    return {
      isValid: false,
      errorMessage: `File "${file.name}" has an invalid format. Allowed formats: JPEG, JPG, PNG, PDF, XLSX, DOCX.`
    };
  }

  return { isValid: true, errorMessage: '' };
}

/**
 * Validates if a file size is within the maximum allowed size
 * @param file File object to validate
 * @returns Object with isValid boolean and errorMessage string
 */
export function validateFileSize(file: File): { isValid: boolean; errorMessage: string } {
  if (!file) {
    return { isValid: false, errorMessage: 'No file provided' };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      isValid: false,
      errorMessage: `File "${file.name}" is too large (${fileSizeMB} MB). Maximum file size is ${MAX_FILE_SIZE_MB} MB.`
    };
  }

  return { isValid: true, errorMessage: '' };
}

/**
 * Validates both file type and file size
 * @param file File object to validate
 * @returns Object with isValid boolean and errorMessage string
 */
export function validateFile(file: File): { isValid: boolean; errorMessage: string } {
  if (!file) {
    return { isValid: false, errorMessage: 'No file provided' };
  }

  // First validate file type
  const typeValidation = validateFileType(file);
  if (!typeValidation.isValid) {
    return typeValidation;
  }

  // Then validate file size
  const sizeValidation = validateFileSize(file);
  if (!sizeValidation.isValid) {
    return sizeValidation;
  }

  return { isValid: true, errorMessage: '' };
}

/**
 * Contexts where file validation errors can occur.
 * Used to resolve the correct i18n key prefix.
 */
export type FileErrorContext =
  | 'newIssueRequest'
  | 'workflowApprovalDetail'
  | 'returnRequest'
  | 'discardRequest';

/**
 * Shows file validation errors in a toast with translation support.
 *
 * It takes the raw validation error messages (coming from frontend or backend),
 * detects if they are file-type or file-size errors, and maps them to the
 * appropriate translation keys for the given context.
 *
 * @param translate Angular TranslateService instance
 * @param toastService ToastService instance
 * @param invalidErrors Array of error messages returned from validateFile / backend
 * @param context Which page/context triggered the validation (controls i18n prefix)
 */
export function showFileValidationErrors(
  translate: TranslateService,
  toastService: ToastService,
  invalidErrors: string[],
  context: FileErrorContext
): void {
  if (!invalidErrors || invalidErrors.length === 0) {
    return;
  }

  const prefix = `${context}.errors`;

  // Use instant() instead of subscribe() for synchronous translation
  // Translations are already loaded by the time file validation occurs
  const errorTitle = translate.instant('toast.error') || 'Error';

  const translatedErrors = invalidErrors.map(errorMsg => {
    // Match backend/frontend format error:
    // File "name.ext" has an invalid format. Allowed formats: ...
    const formatMatch = errorMsg.match(/File "([^"]+)" has an invalid format/);
    if (formatMatch) {
      const fileName = formatMatch[1];
      return translate.instant(`${prefix}.invalidFileFormat`, { fileName });
    }

    // Match backend/frontend size error:
    // File "name.ext" is too large (X.YZ MB). Maximum file size is NN MB.
    const sizeMatch = errorMsg.match(/File "([^"]+)" is too large \(([\d.]+) MB\)/);
    if (sizeMatch) {
      return `${translate.instant(`${prefix}.fileSizeExceeded`)} ${MAX_FILE_SIZE_MB} MB`;
    }

    // Fallback to the original message
    return errorMsg;
  });

  const errorMessage = translatedErrors.join('\n');
  toastService.error(errorMessage, errorTitle);
}

