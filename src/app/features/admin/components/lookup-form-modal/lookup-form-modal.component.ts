import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { ModalComponent } from '@components/modal/modal.component';
import { ButtonComponent } from '@components/button/button.component';
import { Subject, takeUntil } from 'rxjs';
import { LookupItem, CreateUpdateLookupDto, LookupTableConfig } from '@models/lookup.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import type { LookupModalFormGroup } from './lookup-form-modal.models';

const ITEM_TYPE_NAME_TO_VALUE: Record<string, number> = {
  Ammunition: 1,
  Weapon: 2,
  Explosive: 3
};

function normalizeLookupItemType(item: LookupItem): number | null {
  const raw = (item as LookupItem & { itemType?: number | string }).itemType;
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw === 'number') {
    return raw;
  }
  if (typeof raw === 'string') {
    return ITEM_TYPE_NAME_TO_VALUE[raw] ?? null;
  }
  return null;
}

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
export class LookupFormModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() lookupItem?: LookupItem;
  @Input() tableConfig?: LookupTableConfig;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() externalLoading: boolean = false; // Allow parent to control loading state

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<CreateUpdateLookupDto>();

  lookupForm!: LookupModalFormGroup;
  isLoading = false;
  errorMessage = '';

  private readonly destroy$ = new Subject<void>();

  // Item type options for ItemType & Unit (Ammunition, Weapon, Explosive)
  itemTypeOptions: DropdownOption<number>[] = [
    { value: 1, label: '' },
    { value: 2, label: '' },
    { value: 3, label: '' }
  ];

  caliberItemTypeOptions: DropdownOption<number>[] = [
    { value: 1, label: '' },
    { value: 2, label: '' }
  ];

  constructor(private fb: FormBuilder, private translateService: TranslateService) {
    // Subscribe to translation changes (including initial load)
    this.translateService.onTranslationChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateItemTypeTranslations();
      this.updateCaliberItemTypeTranslations();
    });

    // Subscribe to language changes
    this.translateService.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateItemTypeTranslations();
      this.updateCaliberItemTypeTranslations();
    });
  }

  ngOnInit(): void {
    this.initializeForm();

    // Use stream to get translations (updates automatically when translations load or language changes)
    this.translateService.stream([
      'lookupFormModal.selectItemType',
      'lookupFormModal.ammunition',
      'lookupFormModal.weapon',
      'lookupFormModal.explosive',
    ]).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateItemTypeTranslations();
      this.updateCaliberItemTypeTranslations();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
    const needsItemType =
      this.tableConfig?.name === 'ItemType' ||
      this.tableConfig?.name === 'Unit' ||
      this.tableConfig?.name === 'Caliber';

    const codeValidators = this.tableConfig?.hasCode
      ? [Validators.required, Validators.maxLength(50)]
      : [Validators.maxLength(50)];

    this.lookupForm = this.fb.group({
      nameEn: this.fb.nonNullable.control('', {
        validators: [Validators.required, Validators.maxLength(100)]
      }),
      nameAr: this.fb.nonNullable.control('', {
        validators: [Validators.required, Validators.maxLength(100)]
      }),
      code: this.fb.nonNullable.control('', { validators: codeValidators }),
      itemType: this.fb.control<number | null>(null, {
        validators: needsItemType ? [Validators.required] : []
      })
    });

    if (this.lookupItem) {
      this.populateForm();
    }
  }

  private populateForm(): void {
    if (this.lookupItem && this.lookupForm) {
      const needsItemType =
        this.tableConfig?.name === 'ItemType' ||
        this.tableConfig?.name === 'Unit' ||
        this.tableConfig?.name === 'Caliber';

      this.lookupForm.patchValue({
        nameEn: this.lookupItem.nameEn || '',
        nameAr: this.lookupItem.nameAr || '',
        code: this.lookupItem.code || '',
        ...(needsItemType ? { itemType: normalizeLookupItemType(this.lookupItem) } : { itemType: null })
      });
    }
  }

  get title(): string {
    if (!this.tableConfig) return '';
    const singularKey = this.tableConfig.displayNameKeySingular;
    const itemName = singularKey
      ? this.translateService.instant(singularKey)
      : this.tableConfig.displayName.slice(0, -1);
    return this.mode === 'create'
      ? this.translateService.instant('lookupFormModal.addNewItem', { item: itemName })
      : this.translateService.instant('lookupFormModal.editItem', { item: itemName });
  }

  onSubmit(): void {
    if (this.lookupForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const v = this.lookupForm.getRawValue();
    const dto: CreateUpdateLookupDto = {
      nameEn: v.nameEn.trim(),
      nameAr: v.nameAr.trim(),
      code: this.tableConfig?.hasCode ? v.code.trim() : undefined
    };

    if (
      this.tableConfig?.name === 'ItemType' ||
      this.tableConfig?.name === 'Unit' ||
      this.tableConfig?.name === 'Caliber'
    ) {
      const itemType = v.itemType;
      if (itemType != null) {
        dto.itemType = itemType;
      }
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

  private updateCaliberItemTypeTranslations(): void {
    this.caliberItemTypeOptions = [
      { value: 1, label: this.translateService.instant('lookupFormModal.ammunition') },
      { value: 2, label: this.translateService.instant('lookupFormModal.weapon') }
    ];
  }
}

