import { Component, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, X, CheckCircle, AlertCircle, Upload, Download, Filter } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';
import { BATCH_IMPORT_ACTION_COLUMN } from '@core/utils/asset-master-import-preview.utils';
import * as XLSX from 'xlsx';

export type ImportPreviewMode = 'strict' | 'allowSkipInvalid';

export interface PreviewRow {
    rowNumber: number;
    data: Record<string, unknown>;
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
        LucideAngularModule,
        ConfirmDialogComponent
    ],
    providers: [AppDateTimePipe],
    templateUrl: './import-preview-dialog.component.html',
    styleUrls: ['./import-preview-dialog.component.css']
})
export class ImportPreviewDialogComponent {
    @Input() previewData: PreviewData | null = null;
    @Input() assetType: 'ammunition' | 'weapon' | 'explosive' | 'accessory' | 'batch' = 'ammunition';
    @Input() importPreviewMode: ImportPreviewMode = 'strict';
    @Output() confirm = new EventEmitter<PreviewRow[]>();
    @Output() importCancelled = new EventEmitter<void>();

    readonly X = X;
    readonly CheckCircle = CheckCircle;
    readonly AlertCircle = AlertCircle;
    readonly Upload = Upload;
    readonly Download = Download;
    readonly Filter = Filter;

    // Filter state
    activeFilter: RowFilter = 'all';

    // Partial-import confirmation dialog state
    showSkipConfirm = false;

    constructor(
        private translationService: TranslationService,
        private translateService: TranslateService,
        private cdr: ChangeDetectorRef,
        private appDateTimePipe: AppDateTimePipe
    ) { }

    get isRTL(): boolean {
        return this.translationService?.isRTL() ?? false;
    }

    onCancel(): void {
        this.importCancelled.emit();
    }

    onConfirmClick(): void {
        if (!this.previewData) return;

        if (this.importPreviewMode === 'allowSkipInvalid' && this.hasInvalidRows()) {
            this.showSkipConfirm = true;
            this.cdr.markForCheck();
            return;
        }

        this.emitConfirm();
    }

    onSkipConfirmAccepted(): void {
        this.showSkipConfirm = false;
        this.emitConfirm();
    }

    onSkipConfirmCancelled(): void {
        this.showSkipConfirm = false;
        this.cdr.markForCheck();
    }

    /** The original confirm: emits valid rows only. */
    private emitConfirm(): void {
        if (!this.previewData) return;
        const validRows = this.previewData.rows.filter(row => row.isValid);
        this.confirm.emit(validRows);
    }

    /** Kept for backward compatibility — old template binding name. */
    onConfirm(): void {
        this.onConfirmClick();
    }

    canConfirm(): boolean {
        if (!this.previewData || this.previewData.validRows === 0) return false;

        if (this.importPreviewMode === 'allowSkipInvalid') {
            return true;
        }
        return this.previewData.invalidRows === 0;
    }

    get isAllowSkipMode(): boolean {
        return this.importPreviewMode === 'allowSkipInvalid';
    }

    get skipConfirmTitle(): string {
        return this.translateService.instant('import.partialImportConfirmTitle');
    }

    get skipConfirmMessage(): string {
        return this.translateService.instant('import.partialImportConfirmMessage', {
            validCount: this.previewData?.validRows ?? 0,
            invalidCount: this.previewData?.invalidRows ?? 0
        });
    }

    get skipConfirmDescription(): string {
        return this.translateService.instant('import.partialImportConfirmDescription');
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

    getCellValue(row: PreviewRow, column: string): unknown {
        return row.data[column] ?? '-';
    }

    /** Formats ISO / Date values like the rest of the app; leaves other cells unchanged. */
    getDisplayCellValue(row: PreviewRow, column: string): string {
        if (column === BATCH_IMPORT_ACTION_COLUMN) {
            const raw = row.data[column];
            if (raw === 'create') {
                return this.translationService.getTranslation('import.batchImportActionCreate');
            }
            if (raw === 'update') {
                return this.translationService.getTranslation('import.batchImportActionUpdate');
            }
            return '-';
        }
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
            const rowData: Record<string, string | number | boolean | null | undefined> = {
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
        const fileName = `Import_Errors_${this.assetType === 'batch' ? 'batch_assets' : this.assetType}_${new Date().toISOString().split('T')[0]}.xlsx`;
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
        if (column === BATCH_IMPORT_ACTION_COLUMN) {
            return this.translationService.getTranslation('import.batchImportActionColumn');
        }

        const commonMap: { [key: string]: string } = {
            'assetId': 'warehouseInventory.assetId',
            'itemId': 'warehouseInventory.itemId',
            'itemName': 'warehouseInventory.itemName',
            'itemNo': 'warehouseInventory.itemNo',
            'statusLabel': 'warehouseInventory.status',
            'assignmentModeLabel': 'warehouseInventory.fields.assignmentMode',
            'assignmentDepartment': 'warehouseInventory.department',
            'assignmentEmployee': 'warehouseInventory.employee',
            'assignmentNotes': 'warehouseInventory.fields.assignmentNotes',
            'purchaseDate': 'addWeaponAsset.purchaseDate',
            'warrantyExpiryDate': 'addWeaponAsset.warrantyExpiryDate',
            'purchasePrice': 'addWeaponAsset.purchasePrice',
            'deliveryReceipt': 'addWeaponAsset.deliveryReceipt',
            'serialNumber': 'addWeaponAsset.serialNumber',
            'rfid': 'addWeaponAsset.rfidTag',
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
