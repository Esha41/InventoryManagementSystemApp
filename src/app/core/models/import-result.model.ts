export interface ImportResult<T = any> {
    totalProcessed?: number;
    successCount?: number;
    failureCount?: number;
    successfulRecords?: T[];
    errors?: ImportError[];
    importHeaders?: string[];
}

export interface ImportError {
    rowNumber: number;
    errorMessage: string;
    columnName?: string;
    rowData?: any;
}
