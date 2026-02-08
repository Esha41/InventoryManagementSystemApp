import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';
import { LookupItem, CreateUpdateLookupDto, LookupTableConfig } from '@models/lookup.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DropdownComponent, DropdownOption } from '../dropdown/dropdown.component';

@Component({
  selector: 'app-lookup-form-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ModalComponent,
    ButtonComponent,
    DropdownComponent,
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

  // Item type options for dropdown
  itemTypeOptions: DropdownOption<number>[] = [
    { value: 1, label: '' },
    { value: 2, label: '' },
    { value: 3, label: '' }
  ];

  constructor(private fb: FormBuilder, private translateService: TranslateService) {
    // Subscribe to translation changes (including initial load)
    this.translateService.onTranslationChange.subscribe(() => {
      this.updateItemTypeTranslations();
    });

    // Subscribe to language changes
    this.translateService.onLangChange.subscribe(() => {
      this.updateItemTypeTranslations();
    });
  }

  ngOnInit(): void {
    this.initializeForm();

    // Use stream to get translations (updates automatically when translations load or language changes)
    this.translateService.stream([
      'lookupFormModal.selectItemType',
      'lookupFormModal.ammunition',
      'lookupFormModal.weapon',
      'lookupFormModal.explosive'
    ]).subscribe(() => {
      this.updateItemTypeTranslations();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reinitialize form when tableConfig changes
    if (changes['tableConfig'] && this.tableConfig) {
      this.initializeForm();
    }

    // When modal opens, reset loading state and populate/reset form
    if (changes['isOpen'] && this.isOpen) {
      this.isLoading = false; // Reset loading state when modal opens
      this.errorMessage = '';

      if (this.mode === 'create') {
        this.lookupForm?.reset();
      } else if (this.mode === 'edit' && this.lookupItem && this.lookupForm) {
        // Repopulate form when modal opens in edit mode
        this.populateForm();
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
    const formConfig: any = {
      nameEn: ['', [Validators.required, Validators.maxLength(100)]],
      nameAr: ['', [Validators.required, Validators.maxLength(100)]],
      code: ['', this.tableConfig?.hasCode ? [Validators.required, Validators.maxLength(50)] : [Validators.maxLength(50)]]
    };

    // Add ItemType field for ItemType and Unit lookup tables
    if (this.tableConfig?.name === 'ItemType' || this.tableConfig?.name === 'Unit') {
      formConfig['itemType'] = [null, [Validators.required]];
    }

    this.lookupForm = this.fb.group(formConfig);

    if (this.lookupItem) {
      this.populateForm();
    }
  }

  private populateForm(): void {
    if (this.lookupItem && this.lookupForm) {
      const formValue: any = {
        nameEn: this.lookupItem.nameEn || '',
        nameAr: this.lookupItem.nameAr || '',
        code: this.lookupItem.code || ''
      };

      // Add ItemType if it exists in the lookup item (for ItemType and Unit tables)
      if ((this.tableConfig?.name === 'ItemType' || this.tableConfig?.name === 'Unit') && (this.lookupItem as any).itemType !== undefined) {
        let itemTypeValue = (this.lookupItem as any).itemType;

        // Convert string enum to number if needed
        if (typeof itemTypeValue === 'string') {
          const itemTypeMap: { [key: string]: number } = {
            'Ammunition': 1,
            'Weapon': 2,
            'Explosive': 3
          };
          itemTypeValue = itemTypeMap[itemTypeValue] || 0;
        }

        formValue['itemType'] = itemTypeValue;
      }

      this.lookupForm.patchValue(formValue);
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
    const dto: any = {
      nameEn: formValue.nameEn.trim(),
      nameAr: formValue.nameAr.trim(),
      code: this.tableConfig?.hasCode ? formValue.code?.trim() : undefined
    };

    // Add ItemType if this is an ItemType or Unit lookup
    if (this.tableConfig?.name === 'ItemType' || this.tableConfig?.name === 'Unit') {
      dto.itemType = formValue.itemType;
    }

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

  private updateItemTypeTranslations(): void {
    this.itemTypeOptions = [
      { value: 1, label: this.translateService.instant('lookupFormModal.ammunition') },
      { value: 2, label: this.translateService.instant('lookupFormModal.weapon') },
      { value: 3, label: this.translateService.instant('lookupFormModal.explosive') }
    ];
  }
}

