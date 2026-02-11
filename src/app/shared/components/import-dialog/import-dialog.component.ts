import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Upload, FileText, AlertCircle, Check, X } from 'lucide-angular';
import { ButtonComponent } from '../button/button.component';

@Component({
    selector: 'app-import-dialog',
    standalone: true,
    imports: [CommonModule, TranslateModule, LucideAngularModule],
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

    selectedFile = signal<File | null>(null);
    error = signal<string | null>(null);
    dragOver = signal(false);

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
        this.dragOver.set(true);
    }

    onDragLeave(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.dragOver.set(false);
    }

    onDrop(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.dragOver.set(false);
        if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
            this.validateAndSetFile(event.dataTransfer.files[0]);
        }
    }

    validateAndSetFile(file: File) {
        this.error.set(null);
        if (!file.name.endsWith('.xlsx')) {
            this.error.set('Only .xlsx files are allowed');
            this.selectedFile.set(null);
            return;
        }
        this.selectedFile.set(file);
    }

    onPreview() {
        const file = this.selectedFile();
        if (file) {
            this.preview.emit(file);
        }
    }

    confirmImport() {
        const file = this.selectedFile();
        if (file) {
            this.import.emit(file);
        }
    }

    onClose() {
        this.reset();
        this.close.emit();
    }

    reset() {
        this.selectedFile.set(null);
        this.error.set(null);
    }
}
