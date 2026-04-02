import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, X, CheckCircle, AlertCircle, Upload, Download, Filter } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';
import * as XLSX from 'xlsx';

export interface PreviewRow {
    rowNumber: number;
    data: any;
    isValid: boolean;
    errors: string[];
}

export interface PreviewData {
    rows: PreviewRow[];
    totalRows: number;
    validRows: number;
    invalidRows: number;
    columns: string[];
}

export type RowFilter = 'all' | 'valid' | 'invalid';

@Component({
    selector: 'app-import-preview-dialog',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TranslateModule,
        LucideAngularModule
    ],
    providers: [AppDateTimePipe],
    templateUrl: './import-preview-dialog.component.html',
    styleUrls: ['./import-preview-dialog.component.css']
})
export class ImportPreviewDialogComponent implements OnInit {
    @Input() previewData: PreviewData | null = null;
    @Input() assetType: 'ammunition' | 'weapon' | 'explosive' = 'ammunition';
    @Output() confirm = new EventEmitter<PreviewRow[]>();
    @Output() cancel = new EventEmitter<void>();

    readonly X = X;
    readonly CheckCircle = CheckCircle;
    readonly AlertCircle = AlertCircle;
    readonly Upload = Upload;
    readonly Download = Download;
    readonly Filter = Filter;

    // Filter state
    activeFilter: RowFilter = 'all';

    constructor(
        private translationService: TranslationService,
        private cdr: ChangeDetectorRef,
        private appDateTimePipe: AppDateTimePipe
    ) { }

    get isRTL(): boolean {
        return this.translationService?.isRTL() ?? false;
    }

    ngOnInit(): void {
        // Initial setup if needed
    }

    onCancel(): void {
        this.cancel.emit();
    }

    onConfirm(): void {
        if (!this.previewData) return;

        // Only send valid rows for import
        const validRows = this.previewData.rows.filter(row => row.isValid);
        this.confirm.emit(validRows);
    }

    canConfirm(): boolean {
        // Block import if there are any invalid rows
        return this.previewData !== null &&
            this.previewData.validRows > 0 &&
            this.previewData.invalidRows === 0;
    }

    hasInvalidRows(): boolean {
        return this.previewData !== null && this.previewData.invalidRows > 0;
    }

    getFilteredRows(): PreviewRow[] {
        if (!this.previewData) return [];

        switch (this.activeFilter) {
            case 'valid':
                return this.previewData.rows.filter(row => row.isValid);
            case 'invalid':
                return this.previewData.rows.filter(row => !row.isValid);
            default:
                return this.previewData.rows;
        }
    }

    setFilter(filter: RowFilter): void {
        this.activeFilter = filter;
        this.cdr.markForCheck();
    }

    getRowClass(row: PreviewRow): string {
        return row.isValid ? 'row-valid' : 'row-invalid';
    }

    getCellValue(row: PreviewRow, column: string): any {
        return row.data[column] ?? '-';
    }

    /** Formats ISO / Date values like the rest of the app; leaves other cells unchanged. */
    getDisplayCellValue(row: PreviewRow, column: string): string {
        const raw = row.data[column];
        if (raw === null || raw === undefined || raw === '') {
            return '-';
        }
        if (this.isDateLikeForPreview(raw)) {
            const formatted = this.appDateTimePipe.transform(
                raw instanceof Date ? raw : String(raw).trim()
            );
            return formatted || String(raw);
        }
        return String(raw);
    }

    private isDateLikeForPreview(value: unknown): boolean {
        if (value instanceof Date) {
            return !isNaN(value.getTime());
        }
        if (typeof value !== 'string') {
            return false;
        }
        const s = value.trim();
        return /^\d{4}-\d{2}-\d{2}/.test(s);
    }

    getErrorsForRow(row: PreviewRow): string {
        return row.errors.join(', ');
    }

    /**
     * Download error report as Excel file
     */
    downloadErrorReport(): void {
        if (!this.previewData || this.previewData.invalidRows === 0) return;

        const invalidRows = this.previewData.rows.filter(row => !row.isValid);

        // Prepare data for Excel
        const excelData = invalidRows.map(row => {
            const rowData: any = {
                'Row Number': row.rowNumber,
                'Errors': row.errors.join('; ')
            };

            // Add all column data
            this.previewData!.columns.forEach(column => {
                rowData[this.getColumnHeader(column)] = this.getDisplayCellValue(row, column);
            });

            return rowData;
        });

        // Create workbook
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Invalid Rows');

        // Style the header row
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
            if (!ws[cellAddress]) continue;
            ws[cellAddress].s = {
                font: { bold: true },
                fill: { fgColor: { rgb: "FEF2F2" } }
            };
        }

        // Auto-size columns
        const maxWidth = 50;
        const colWidths = Object.keys(excelData[0] || {}).map(key => {
            const maxLen = Math.max(
                key.length,
                ...excelData.map(row => String(row[key] || '').length)
            );
            return { wch: Math.min(maxLen + 2, maxWidth) };
        });
        ws['!cols'] = colWidths;

        // Generate file
        const fileName = `Import_Errors_${this.assetType}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }

    /**
     * Get a translated header for a property name
     */
    getColumnHeader(column: string): string {
        if (!column) return '';

        // Try different translation paths
        const paths = [
            `warehouseInventory.fields.${column}`,
            `warehouseInventory.${column}`,
            `assetList.table.${column}`,
            `addAsset.${column}`,
            `assetDetails.${column}`,
            `weapon.${column}`,
            `common.${column}`
        ];

        for (const path of paths) {
            const translated = this.translationService.getTranslation(path);
            if (translated && translated !== path) {
                return translated;
            }
        }

        // Handle specific common overrides (match add-asset and Excel template labels)
        const commonMap: { [key: string]: string } = {
            'itemName': 'warehouseInventory.itemName',
            'itemNo': 'warehouseInventory.itemNo',
            'itemType': 'addAsset.type',
            'status': 'common.status',
            'neqUnit': 'addAsset.unit',
            'hazardDivision': 'assetList.table.hazardDivision',
            'armNumber': 'addAsset.armNumber',
            'compatibility': 'addAsset.compatibility',
            'bulletDiameter': 'warehouseInventory.bulletDiameter',
            'bulletDiameterUnit': 'warehouseInventory.caliberUnit',
            'caliberUnit': 'warehouseInventory.caliberUnit',
            'primaryPurpos': 'addAsset.primaryPurpose',
            'projectailMaterial': 'addAsset.projectileMaterial'
        };

        if (commonMap[column]) {
            const translated = this.translationService.getTranslation(commonMap[column]);
            if (translated && translated !== commonMap[column]) {
                return translated;
            }
        }

        // Fallback: convert camelCase to Title Case
        return column
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());
    }
}
