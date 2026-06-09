import { ImportResult } from '@models/import-result.model';
import { PreviewData } from '@components/import-preview-dialog/import-preview-dialog.component';

export const ACCESSORY_IMPORT_PREVIEW_COLUMNS = ['name', 'nameAr', 'itemNo'] as const;

export interface MapImportPreviewOptions {
  /** When set, only these camelCase column keys are shown (in this order). */
  includeColumns?: readonly string[];
  /** Column keys (camelCase) to omit from preview table and error export (e.g. assetId, itemId). */
  excludeColumns?: string[];

  /**
   * When true, prepends a synthetic `importAction` column (`create` | `update` | empty)
   * from each row's `isNewRow` (batch asset Excel preview after API enrich).
   */
  batchImportActions?: boolean;
}

/** Synthetic column key; values are `create`, `update`, or '' (unknown / error row). */
export const BATCH_IMPORT_ACTION_COLUMN = 'importAction';

const BATCH_DUAL_ASSIGNMENT_MSG =
  'Specify either assign to employee or assign to department, not both.';

function rowHasActiveAssignment(data: Record<string, unknown>): boolean {
  const mode = String(data['assignmentModeLabel'] ?? data['updateAssignment'] ?? '').trim().toLowerCase();
  if (!mode || mode === 'no change' || mode === 'بدون تغيير' || mode === 'false' || mode === 'no' || mode === '0') return false;
  return true;
}

/** True when Excel row would be rejected for both department and employee assignment targets. */
function batchImportRowHasDualAssignment(data: Record<string, unknown>): boolean {
  if (!rowHasActiveAssignment(data)) return false;
  const deptLabel = String(data['assignmentDepartment'] ?? '').trim();
  const empLabel = String(data['assignmentEmployee'] ?? '').trim();
  if (deptLabel.length > 0 && empLabel.length > 0) return true;
  const du = data['assignToDepartmentId'];
  const eu = data['assignToEmployeeId'];
  const deptId = typeof du === 'number' ? du : du != null && du !== '' ? Number(du) : NaN;
  const empId = typeof eu === 'number' ? eu : eu != null && eu !== '' ? Number(eu) : NaN;
  const hasDept = Number.isFinite(deptId) && deptId > 0;
  const hasEmp = Number.isFinite(empId) && empId > 0;
  return hasDept && hasEmp;
}

function filterPreviewColumns(
  columns: string[],
  options?: Pick<MapImportPreviewOptions, 'includeColumns' | 'excludeColumns'>
): string[] {
  if (options?.includeColumns?.length) {
    return [...options.includeColumns];
  }

  if (!options?.excludeColumns?.length) {
    return columns.filter((c) => c !== 'rowNumber');
  }

  const drop = new Set([...options.excludeColumns, 'rowNumber']);
  return columns.filter((c) => !drop.has(c));
}

function pickPreviewRowData(
  data: Record<string, unknown>,
  columns: string[]
): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  columns.forEach((col) => {
    if (col in data) {
      picked[col] = data[col];
    }
  });
  return picked;
}

/**
 * Build import preview grid from API ImportResult (shared by asset catalog & admin import UI).
 */
export function mapImportResultToPreviewData(
  result: ImportResult,
  options?: MapImportPreviewOptions
): PreviewData | null {
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

  const withImportAction = (
    data: Record<string, unknown>
  ): Record<string, unknown> => {
    if (!options?.batchImportActions) {
      return data;
    }
    const v = data['isNewRow'];
    const action =
      v === true ? 'create' : v === false ? 'update' : '';
    return { ...data, [BATCH_IMPORT_ACTION_COLUMN]: action };
  };

  successfulRecords.forEach((record: unknown, index: number) => {
    const rowData = record as Record<string, unknown>;
    const rowNum = (rowData['rowNumber'] as number) || index + 2;
    const errorInfo = errorsByRow.get(rowNum);
    let dualAssignment = options?.batchImportActions === true && batchImportRowHasDualAssignment(rowData);
    if (dualAssignment && errorInfo) {
      dualAssignment = false;
    }

    const mergedErrors = errorInfo
      ? [...errorInfo.errors]
      : dualAssignment
        ? [BATCH_DUAL_ASSIGNMENT_MSG]
        : [];
    const isValid = !errorInfo && !dualAssignment;

    previewRows.push({
      rowNumber: rowNum,
      data: withImportAction(rowData),
      isValid,
      errors: mergedErrors
    });

    if (errorInfo) {
      errorsByRow.delete(rowNum);
    }
  });

  errorsByRow.forEach((errorInfo, rowNum) => {
    previewRows.push({
      rowNumber: rowNum,
      data: withImportAction((errorInfo.rowData || {}) as Record<string, unknown>),
      isValid: false,
      errors: errorInfo.errors
    });
  });

  previewRows.sort((a, b) => a.rowNumber - b.rowNumber);

  const validRows = previewRows.filter((r) => r.isValid).length;
  const invalidRows = previewRows.filter((r) => !r.isValid).length;

  const rawColumns =
    result.importHeaders && result.importHeaders.length > 0
      ? result.importHeaders
      : previewRows.length > 0 && previewRows[0].data
        ? Object.keys(previewRows[0].data)
        : [];

  let columns = filterPreviewColumns(rawColumns, options);
  if (options?.batchImportActions) {
    columns = [
      BATCH_IMPORT_ACTION_COLUMN,
      ...columns.filter((c) => c !== BATCH_IMPORT_ACTION_COLUMN)
    ];
  }

  const rows = columns.length > 0
    ? previewRows.map((row) => ({
        ...row,
        data: pickPreviewRowData(row.data, columns)
      }))
    : previewRows;

  return {
    rows,
    totalRows: rows.length,
    validRows,
    invalidRows,
    columns
  };
}
