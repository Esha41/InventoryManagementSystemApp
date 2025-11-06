import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';
import { LookupItem, CreateUpdateLookupDto, LookupTableConfig } from '@models/lookup.model';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-lookup-form-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ModalComponent,
    ButtonComponent,
    TranslateModule
  ],
  templateUrl: './lookup-form-modal.component.html',
  styleUrls: ['./lookup-form-modal.component.css']
})
export class LookupFormModalComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() lookupItem?: LookupItem;
  @Input() tableConfig?: LookupTableConfig;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() externalLoading: boolean = false; // Allow parent to control loading state
  
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<CreateUpdateLookupDto>();

  lookupForm!: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initializeForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // When modal opens, reset loading state and form if in create mode
    if (changes['isOpen'] && this.isOpen) {
      this.isLoading = false; // Reset loading state when modal opens
      this.errorMessage = '';
      if (this.mode === 'create') {
        this.lookupForm?.reset();
      }
    }
    
    // When mode changes to create, reset form
    if (changes['mode'] && this.mode === 'create' && this.isOpen) {
      this.lookupForm?.reset();
      this.errorMessage = '';
      this.isLoading = false; // Reset loading state
    }
    
    // When lookupItem is provided, populate form
    if (changes['lookupItem']) {
      if (this.lookupItem && this.lookupForm) {
        this.populateForm();
      } else if (!this.lookupItem && this.mode === 'create' && this.lookupForm) {
        // If no lookupItem and in create mode, ensure form is reset
        this.lookupForm.reset();
      }
    }
    
    // Reset loading state when external loading changes to false
    if (changes['externalLoading'] && !this.externalLoading) {
      this.isLoading = false;
    }
  }

  private initializeForm(): void {
    this.lookupForm = this.fb.group({
      nameEn: ['', [Validators.required, Validators.maxLength(100)]],
      nameAr: ['', [Validators.required, Validators.maxLength(100)]],
      code: ['', [Validators.maxLength(50)]]
    });

    if (this.lookupItem) {
      this.populateForm();
    }
  }

  private populateForm(): void {
    if (this.lookupItem && this.lookupForm) {
      this.lookupForm.patchValue({
        nameEn: this.lookupItem.nameEn || '',
        nameAr: this.lookupItem.nameAr || '',
        code: this.lookupItem.code || ''
      });
    }
  }

  get title(): string {
    if (!this.tableConfig) return '';
    return this.mode === 'create' 
      ? `Add New ${this.tableConfig.displayName.slice(0, -1)}` 
      : `Edit ${this.tableConfig.displayName.slice(0, -1)}`;
  }

  onSubmit(): void {
    if (this.lookupForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const formValue = this.lookupForm.value;
    const dto: CreateUpdateLookupDto = {
      nameEn: formValue.nameEn.trim(),
      nameAr: formValue.nameAr.trim(),
      code: this.tableConfig?.hasCode ? formValue.code?.trim() : undefined
    };

    this.saved.emit(dto);
  }

  close(): void {
    this.lookupForm.reset();
    this.errorMessage = '';
    this.isLoading = false; // Reset loading state when closing
    this.closed.emit();
  }

  private markFormGroupTouched(): void {
    Object.keys(this.lookupForm.controls).forEach(key => {
      this.lookupForm.get(key)?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.lookupForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return `${fieldName} is required`;
      }
      if (field.errors['maxlength']) {
        return `Maximum length is ${field.errors['maxlength'].requiredLength} characters`;
      }
    }
    return '';
  }
}

