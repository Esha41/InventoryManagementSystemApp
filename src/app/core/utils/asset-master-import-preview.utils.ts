import { ImportResult } from '@models/import-result.model';
import { PreviewData } from '@shared/components/import-preview-dialog/import-preview-dialog.component';

/**
 * Build import preview grid from API ImportResult (shared by asset catalog & admin import UI).
 */
export function mapImportResultToPreviewData(result: ImportResult): PreviewData | null {
  if (!result) {
    return null;
  }

  const successfulRecords = Array.isArray(result.successfulRecords) ? result.successfulRecords : [];
  const errors = Array.isArray(result.errors) ? result.errors : [];

  const errorsByRow = new Map<number, { errors: string[]; rowData: Record<string, unknown> }>();
  errors.forEach((error) => {
    const rowNum = error.rowNumber || 0;
    if (!errorsByRow.has(rowNum)) {
      errorsByRow.set(rowNum, { errors: [], rowData: (error.rowData || {}) as Record<string, unknown> });
    }
    errorsByRow.get(rowNum)!.errors.push(error.errorMessage || 'Unknown error');
  });

  const previewRows: PreviewData['rows'] = [];

  successfulRecords.forEach((record: unknown, index: number) => {
    const rowData = record as Record<string, unknown>;
    const rowNum = (rowData['rowNumber'] as number) || index + 2;
    const errorInfo = errorsByRow.get(rowNum);

    previewRows.push({
      rowNumber: rowNum,
      data: rowData,
      isValid: !errorInfo || errorInfo.errors.length === 0,
      errors: errorInfo ? errorInfo.errors : []
    });

    if (errorInfo) {
      errorsByRow.delete(rowNum);
    }
  });

  errorsByRow.forEach((errorInfo, rowNum) => {
    previewRows.push({
      rowNumber: rowNum,
      data: errorInfo.rowData || {},
      isValid: false,
      errors: errorInfo.errors
    });
  });

  previewRows.sort((a, b) => a.rowNumber - b.rowNumber);

  const validRows = previewRows.filter((r) => r.isValid).length;
  const invalidRows = previewRows.filter((r) => !r.isValid).length;

  const columns =
    result.importHeaders && result.importHeaders.length > 0
      ? result.importHeaders
      : previewRows.length > 0 && previewRows[0].data
        ? Object.keys(previewRows[0].data)
        : [];

  return {
    rows: previewRows,
    totalRows: previewRows.length,
    validRows,
    invalidRows,
    columns
  };
}
