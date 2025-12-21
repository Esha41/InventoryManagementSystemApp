import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Upload, FileText, AlertCircle, Check, X } from 'lucide-angular';
import { ButtonComponent } from '../button/button.component';

@Component({
    selector: 'app-import-dialog',
    standalone: true,
    imports: [CommonModule, TranslateModule, LucideAngularModule, ButtonComponent],
    templateUrl: './import-dialog.component.html',
    styleUrl: './import-dialog.component.css'
})
export class ImportDialogComponent {
    @Input() isOpen = false;
    @Input() title = 'Import Data';
    @Input() entityName = 'Items';
    @Output() close = new EventEmitter<void>();
    @Output() import = new EventEmitter<File>();
    @Output() preview = new EventEmitter<File>();  // New preview event
    @Output() downloadTemplate = new EventEmitter<void>();

    selectedFile: File | null = null;
    error: string | null = null;
    dragOver = false;

    readonly Upload = Upload;
    readonly FileText = FileText;
    readonly AlertCircle = AlertCircle;
    readonly Check = Check;
    readonly X = X;

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            this.validateAndSetFile(input.files[0]);
        }
    }

    onDragOver(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.dragOver = true;
    }

    onDragLeave(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.dragOver = false;
    }

    onDrop(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.dragOver = false;
        if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
            this.validateAndSetFile(event.dataTransfer.files[0]);
        }
    }

    validateAndSetFile(file: File) {
        this.error = null;
        if (!file.name.endsWith('.xlsx')) {
            this.error = 'Only .xlsx files are allowed';
            this.selectedFile = null;
            return;
        }
        this.selectedFile = file;
    }

    onPreview() {
        if (this.selectedFile) {
            this.preview.emit(this.selectedFile);
        }
    }

    confirmImport() {
        if (this.selectedFile) {
            this.import.emit(this.selectedFile);
        }
    }

    onClose() {
        this.reset();
        this.close.emit();
    }

    reset() {
        this.selectedFile = null;
        this.error = null;
    }
}
