import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, X, CheckCircle, AlertCircle, Upload } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';

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

@Component({
    selector: 'app-import-preview-dialog',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TranslateModule,
        LucideAngularModule
    ],
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

    constructor(
        private translationService: TranslationService,
        private cdr: ChangeDetectorRef
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
        return this.previewData !== null && this.previewData.validRows > 0;
    }

    getRowClass(row: PreviewRow): string {
        return row.isValid ? 'row-valid' : 'row-invalid';
    }

    getCellValue(row: PreviewRow, column: string): any {
        return row.data[column] ?? '-';
    }

    getErrorsForRow(row: PreviewRow): string {
        return row.errors.join(', ');
    }
}
