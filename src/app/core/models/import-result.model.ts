/**
 * Mirrors `Ettad.Inventory.Services/Common/Interfaces/ExcelImportService.cs` — `ImportResult<T>` (JSON camelCase).
 * `successCount` / `failureCount` are computed properties on the server; serializers may include them on the wire.
 */
export interface ImportResult<T = unknown> {
  successfulRecords?: T[];
  errors?: ImportError[];
  totalProcessed?: number;
  successCount?: number;
  failureCount?: number;
  importHeaders?: string[];
}

/**
 * Mirrors backend `ImportError` in the same file.
 */
export interface ImportError {
  rowNumber: number;
  errorMessage: string;
  columnName?: string | null;
  rowData?: unknown;
}

/**
 * Narrow shape for import toasts — callers derive counts from {@link ImportResult} or API envelope `message`.
 */
export interface ImportResultToastPayload {
  successCount: number;
  failureCount: number;
  errors?: ImportError[];
  message?: string | null;
}
