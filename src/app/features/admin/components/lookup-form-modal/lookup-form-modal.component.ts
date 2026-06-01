import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import { ModalComponent } from '@components/modal/modal.component';
import { ButtonComponent } from '@components/button/button.component';
import { Subject, takeUntil } from 'rxjs';
import {
  AttachmentRequirementLookupDraft,
  CreateUpdateLookupDto,
  LookupItem,
  LookupTableConfig,
  RequestPurposeAllowanceContext
} from '@models/lookup.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import type {
  AttachmentRequirementRowFormGroup,
  LookupModalFormGroup
} from './lookup-form-modal.models';

const ITEM_TYPE_NAME_TO_VALUE: Record<string, number> = {
  Ammunition: 1,
  Weapon: 2,
  Explosive: 3
};

function coerceInt(v: unknown): number | null {
  if (v === '' || v === undefined || v === null) return null;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function attachmentRowValidator(control: AbstractControl): ValidationErrors | null {
  const g = control as FormGroup;
  const en = String(g.get('nameEn')?.value ?? '').trim();
  const ar = String(g.get('nameAr')?.value ?? '').trim();
  if (!en && !ar) return null;

  const min = coerceInt(g.get('minCount')?.value);
  const max = coerceInt(g.get('maxCount')?.value);

  if (!en || !ar) return { incompleteNames: true };

  if (min === null || min < 0) return { minInvalid: true };
  if (max === null || max < 1) return { maxInvalid: true };
  if (max < min) return { rangeInvalid: true };

  return null;
}

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
  @Input() externalLoading = false;
  @Input() externalErrorMessage = '';

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<CreateUpdateLookupDto>();

  lookupForm!: LookupModalFormGroup;
  isLoading = false;
  errorMessage = '';

  private readonly destroy$ = new Subject<void>();

  itemTypeOptions: DropdownOption<number>[] = [
    { value: 1, label: '' },
    { value: 2, label: '' },
    { value: 3, label: '' }
  ];

  caliberItemTypeOptions: DropdownOption<number>[] = [
    { value: 1, label: '' },
    { value: 2, label: '' }
  ];

  allowanceContextOptions: DropdownOption<number>[] = [];

  constructor(private fb: FormBuilder, private translateService: TranslateService) {
    this.translateService.onTranslationChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateItemTypeTranslations();
      this.updateCaliberItemTypeTranslations();
      this.updateAllowanceContextTranslations();
    });

    this.translateService.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateItemTypeTranslations();
      this.updateCaliberItemTypeTranslations();
      this.updateAllowanceContextTranslations();
    });
  }

  get isRequestPurpose(): boolean {
    return !!this.tableConfig?.requestPurposeType;
  }

  get isOrderRequestPurpose(): boolean {
    return this.tableConfig?.requestPurposeType === 'order';
  }

  get displayedErrorMessage(): string {
    return this.externalErrorMessage?.trim() || this.errorMessage;
  }

  get attachmentRows(): FormArray<AttachmentRequirementRowFormGroup> {
    return this.lookupForm?.get('attachmentRequirements') as FormArray<AttachmentRequirementRowFormGroup>;
  }

  ngOnInit(): void {
    this.initializeForm();

    this.translateService.stream([
      'lookupFormModal.selectItemType',
      'lookupFormModal.ammunition',
      'lookupFormModal.weapon',
      'lookupFormModal.explosive'
    ]).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateItemTypeTranslations();
      this.updateCaliberItemTypeTranslations();
      this.updateAllowanceContextTranslations();
    });
    this.updateAllowanceContextTranslations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tableConfig'] && this.tableConfig) {
      this.initializeForm();
    }

    if (changes['isOpen'] && this.isOpen) {
      this.isLoading = false;
      this.errorMessage = '';

      if (this.mode === 'create') {
        this.resetFormForCreate();
      } else if (this.mode === 'edit' && this.lookupItem && this.lookupForm) {
        this.populateForm();
      }
    }

    if (changes['isOpen'] && !this.isOpen && this.lookupForm) {
      this.resetFormForCreate();
    }

    if (changes['mode'] && this.mode === 'create' && this.isOpen) {
      this.resetFormForCreate();
      this.errorMessage = '';
      this.isLoading = false;
    }

    if (changes['lookupItem']) {
      if (this.lookupItem && this.lookupForm) {
        this.populateForm();
      } else if (!this.lookupItem && this.mode === 'create' && this.lookupForm) {
        this.resetFormForCreate();
      }
    }

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

    const needsAllowanceContext = this.tableConfig?.requestPurposeType === 'order';

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
      }),
      allowanceContext: this.fb.control<number | null>(null, {
        validators: needsAllowanceContext ? [Validators.required] : []
      }),
      attachmentRequirements: this.fb.array<AttachmentRequirementRowFormGroup>([])
    });

    if (this.lookupItem) {
      this.populateForm();
    }
  }

  private populateForm(): void {
    if (!this.lookupItem || !this.lookupForm) {
      return;
    }

    const needsItemType =
      this.tableConfig?.name === 'ItemType' ||
      this.tableConfig?.name === 'Unit' ||
      this.tableConfig?.name === 'Caliber';

    this.lookupForm.patchValue({
      nameEn: this.lookupItem.nameEn || '',
      nameAr: this.lookupItem.nameAr || '',
      code: this.lookupItem.code || '',
      ...(needsItemType ? { itemType: normalizeLookupItemType(this.lookupItem) } : { itemType: null }),
      allowanceContext: this.lookupItem.allowanceContext ?? null
    });

    this.clearAttachmentRequirements();
    const slots = this.lookupItem.attachmentRequirements ?? [];
    for (const slot of slots) {
      this.attachmentRows.push(this.createAttachmentRow(slot));
    }
  }

  private clearAttachmentRequirements(): void {
    if (!this.lookupForm || !this.attachmentRows) {
      return;
    }
    while (this.attachmentRows.length > 0) {
      this.attachmentRows.removeAt(0);
    }
  }

  private createAttachmentRow(initial?: AttachmentRequirementLookupDraft): AttachmentRequirementRowFormGroup {
    let persistedId: number | null = null;
    if (initial?.id != null) {
      const n = Number(initial.id);
      if (Number.isFinite(n) && n > 0) persistedId = n;
    }
    return this.fb.group(
      {
        id: this.fb.control<number | null>(persistedId),
        nameEn: this.fb.nonNullable.control(initial?.nameEn ?? '', [Validators.maxLength(500)]),
        nameAr: this.fb.nonNullable.control(initial?.nameAr ?? '', [Validators.maxLength(500)]),
        isRequired: this.fb.nonNullable.control(initial?.isRequired ?? false),
        minCount: this.fb.nonNullable.control(initial?.minCount ?? 1),
        maxCount: this.fb.nonNullable.control(initial?.maxCount ?? 1)
      },
      { validators: [attachmentRowValidator] }
    );
  }

  addAttachmentSlot(): void {
    this.attachmentRows.push(this.createAttachmentRow());
  }

  removeAttachmentSlot(index: number): void {
    this.attachmentRows.removeAt(index);
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

    if (this.isRequestPurpose) {
      let order = 0;
      const drafts: AttachmentRequirementLookupDraft[] = [];
      for (const row of this.attachmentRows.controls) {
        const en = String(row.get('nameEn')?.value ?? '').trim();
        const ar = String(row.get('nameAr')?.value ?? '').trim();
        if (!en && !ar) {
          continue;
        }
        if (row.invalid) {
          row.markAllAsTouched();
          this.isLoading = false;
          return;
        }
        const min = coerceInt(row.get('minCount')?.value) ?? 0;
        const max = coerceInt(row.get('maxCount')?.value) ?? 1;
        const rid = row.get('id')?.value;
        drafts.push({
          id: rid != null && rid > 0 ? rid : null,
          nameEn: en,
          nameAr: ar,
          isRequired: !!row.get('isRequired')?.value,
          minCount: min,
          maxCount: max,
          displayOrder: order++
        });
      }
      dto.attachmentRequirements = drafts;
    }

    if (this.isOrderRequestPurpose) {
      const ctx = v.allowanceContext;
      if (ctx != null) {
        dto.allowanceContext = ctx as RequestPurposeAllowanceContext;
      }
    }

    this.saved.emit(dto);
  }

  close(): void {
    this.resetFormForCreate();
    this.closed.emit();
  }

  /** Clears values and touched/dirty state so validation does not show on reopen for Add. */
  private resetFormForCreate(): void {
    if (!this.lookupForm) {
      return;
    }
    this.clearAttachmentRequirements();
    this.lookupForm.reset(
      {
        nameEn: '',
        nameAr: '',
        code: '',
        itemType: null,
        allowanceContext: null,
        attachmentRequirements: []
      },
      { emitEvent: false }
    );
    this.errorMessage = '';
    this.isLoading = false;
  }

  private markFormGroupTouched(): void {
    Object.keys(this.lookupForm.controls).forEach(key => {
      const ctrl = this.lookupForm.get(key);
      if (!ctrl) {
        return;
      }
      if (key === 'attachmentRequirements' && ctrl instanceof FormArray) {
        ctrl.controls.forEach(row => row.markAllAsTouched());
      } else {
        ctrl.markAsTouched();
      }
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

  attachmentRowMessageKey(control: AbstractControl): string | null {
    const g = control as FormGroup;
    if (!g.errors || !(g.touched || g.dirty)) {
      return null;
    }
    if (g.errors['incompleteNames']) return 'lookupFormModal.attachmentRowIncomplete';
    if (g.errors['minInvalid'] || g.errors['maxInvalid'] || g.errors['rangeInvalid']) {
      return 'lookupFormModal.attachmentCountsInvalid';
    }
    return null;
  }

  getRowFieldMaxLengthError(ctrl: AbstractControl | null): string {
    const field = ctrl;
    if (field?.errors && field.touched && field.errors['maxlength']) {
      return `Maximum length is ${field.errors['maxlength'].requiredLength} characters`;
    }
    return '';
  }

  trackByRowIndex(index: number): number {
    return index;
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

  private updateAllowanceContextTranslations(): void {
    this.allowanceContextOptions = [
      {
        value: RequestPurposeAllowanceContext.FromAllowance,
        label: this.translateService.instant('lookupFormModal.fromAllowance')
      },
      {
        value: RequestPurposeAllowanceContext.OutsideAllowance,
        label: this.translateService.instant('lookupFormModal.outsideAllowance')
      },
      {
        value: RequestPurposeAllowanceContext.Both,
        label: this.translateService.instant('lookupFormModal.both')
      }
    ];
  }
}
