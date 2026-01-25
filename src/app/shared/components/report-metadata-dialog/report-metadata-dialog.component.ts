import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

export interface ReportMetadata {
  reportName: string;
  url: string;
  description?: string;
}

@Component({
  selector: 'app-report-metadata-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ModalComponent,
    ButtonComponent,
    TranslateModule
  ],
  templateUrl: './report-metadata-dialog.component.html',
  styleUrls: ['./report-metadata-dialog.component.css']
})
export class ReportMetadataDialogComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() defaultReportName = '';
  @Input() defaultUrl = '';
  @Input() defaultDescription = '';
  @Input() mode: 'create' | 'import' = 'create';

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<ReportMetadata>();

  metadataForm!: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private translate: TranslateService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.initializeForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && changes['isOpen'].currentValue) {
      this.initializeForm();
      this.errorMessage = '';
    }
    if (changes['defaultReportName'] || changes['defaultUrl'] || changes['defaultDescription']) {
      this.updateFormDefaults();
    }
  }

  private initializeForm(): void {
    this.metadataForm = this.fb.group({
      reportName: [this.defaultReportName || '', [Validators.required, Validators.maxLength(200)]],
      url: [this.defaultUrl || '', [Validators.required, Validators.maxLength(500), this.urlValidator]],
      description: [this.defaultDescription || '', [Validators.maxLength(1000)]]
    });

    // Auto-generate URL from report name if URL is empty
    const reportNameControl = this.metadataForm.get('reportName');
    const urlControl = this.metadataForm.get('url');
    
    if (reportNameControl && urlControl) {
      reportNameControl.valueChanges.subscribe(value => {
        if (!urlControl.value || urlControl.pristine) {
          const generatedUrl = this.generateUrlFromName(value);
          urlControl.setValue(generatedUrl, { emitEvent: false });
        }
      });
    }
  }

  private updateFormDefaults(): void {
    if (this.metadataForm) {
      this.metadataForm.patchValue({
        reportName: this.defaultReportName || '',
        url: this.defaultUrl || '',
        description: this.defaultDescription || ''
      });
    }
  }

  private generateUrlFromName(name: string): string {
    if (!name) return '';
    
    // Convert report name to URL-friendly format
    let url = name.trim();
    // Replace spaces and special characters with underscores
    url = url.replace(/[^a-zA-Z0-9_-]/g, '_');
    // Remove multiple consecutive underscores
    url = url.replace(/_+/g, '_');
    // Remove leading/trailing underscores
    url = url.trim().replace(/^_+|_+$/g, '');
    // Ensure it's not empty
    if (!url) {
      url = `report_${Date.now()}`;
    }
    return url.toLowerCase();
  }

  private urlValidator(control: any): { [key: string]: any } | null {
    const url = control.value;
    if (!url) {
      return null; // Required validator will handle this
    }
    
    // Check for invalid characters
    if (/[^a-zA-Z0-9_-]/.test(url)) {
      return { invalidUrl: true };
    }
    
    // Check for path traversal attempts
    if (url.includes('..') || url.includes('/') || url.includes('\\')) {
      return { invalidUrl: true };
    }
    
    return null;
  }

  get title(): string {
    if (this.mode === 'import') {
      return this.translate.instant('reportDesigner.metadataDialog.importTitle');
    }
    return this.translate.instant('reportDesigner.metadataDialog.createTitle');
  }

  onSubmit(): void {
    if (this.metadataForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    const formValue = this.metadataForm.value;
    const metadata: ReportMetadata = {
      reportName: formValue.reportName.trim(),
      url: formValue.url.trim(),
      description: formValue.description?.trim() || undefined
    };

    this.saved.emit(metadata);
  }

  close(): void {
    this.metadataForm.reset();
    this.errorMessage = '';
    this.closed.emit();
  }

  private markFormGroupTouched(): void {
    Object.keys(this.metadataForm.controls).forEach(key => {
      this.metadataForm.get(key)?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.metadataForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return this.translate.instant('common.fieldRequired') || 'This field is required';
      }
      if (field.errors['maxlength']) {
        const max = field.errors['maxlength'].requiredLength;
        return this.translate.instant('common.fieldMaxLength', { max }) || `Maximum length is ${max} characters`;
      }
      if (field.errors['invalidUrl']) {
        return this.translate.instant('reportDesigner.metadataDialog.invalidUrl');
      }
    }
    return '';
  }
}
