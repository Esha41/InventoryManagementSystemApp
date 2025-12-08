/**
 * File utility functions for common file operations
 */

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

