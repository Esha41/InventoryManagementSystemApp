import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { LookupService, LookupItem } from '@services/lookup.service';
import { ToastService } from '@services/toast.service';
import { EmployeeService } from '@services/employee.service';
import { CreateUpdateEmployeeDto } from '@core/models/employee.model';
import { EmployeeDto } from '@core/models/asset.model';
import { Observable } from 'rxjs';
import { ErrorHandler } from '@core/utils/error-handler.utils';

@Component({
  selector: 'app-employee-form-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ModalComponent,
    ButtonComponent,
    TranslateModule,
    DropdownComponent
  ],
  templateUrl: './employee-form-modal.component.html',
  styleUrls: ['./employee-form-modal.component.css']
})
export class EmployeeFormModalComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() employee?: EmployeeDto | null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  form!: FormGroup;
  departments: LookupItem[] = [];
  ranks: LookupItem[] = [];
  isLoading = false;
  errorMessage = '';

  readonly departmentOptionLabel = (option: DropdownOption<LookupItem> | LookupItem | null) =>
    this.getLocalizedName(this.unwrapOption(option));
  readonly rankOptionLabel = (option: DropdownOption<LookupItem> | LookupItem | null) =>
    this.getLocalizedName(this.unwrapOption(option));

  constructor(
    private fb: FormBuilder,
    private lookupService: LookupService,
    private employeeService: EmployeeService,
    private toastService: ToastService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadDepartments();
    this.loadRanks();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen && this.mode === 'edit' && this.employee && this.form) {
      this.populateFormFromEmployee();
    }

    if (changes['employee'] && this.isOpen && this.mode === 'edit' && this.employee && this.form) {
      this.populateFormFromEmployee();
    }
  }

  get title(): string {
    return this.mode === 'edit'
      ? this.translate.instant('employeeFormModal.editEmployee')
      : this.translate.instant('employeeFormModal.addNewEmployee');
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      nameEn: ['', [Validators.required]],
      nameAr: [''],
      militaryId: ['', [Validators.required]],
      departmentId: [null, [Validators.required]],
      rankId: [null, [Validators.required]],
      phone: [''],
      email: ['', [Validators.email]],
      notes: ['']
    });

    if (this.mode === 'edit' && this.employee) {
      this.populateFormFromEmployee();
    }
  }

  private populateFormFromEmployee(): void {
    if (!this.employee || !this.form) {
      return;
    }

    this.form.patchValue({
      nameEn: this.employee.nameEn || '',
      nameAr: this.employee.nameAr || '',
      militaryId: this.employee.militaryId || '',
      departmentId: this.employee.departmentId ?? null,
      rankId: this.employee.rankId ?? null,
      phone: this.employee.phone || '',
      email: this.employee.email || '',
      notes: this.employee.notes || ''
    });
  }

  private loadDepartments(): void {
    this.lookupService.getLookupItems('Department').subscribe({
      next: (deps: LookupItem[]) => {
        this.departments = deps ?? [];
      },
      error: () => {
        this.departments = [];
      }
    });
  }

  private loadRanks(): void {
    this.lookupService.getLookupItems('Rank').subscribe({
      next: (items: LookupItem[]) => {
        this.ranks = items ?? [];
      },
      error: () => {
        this.ranks = [];
      }
    });
  }

  private unwrapOption<T>(option: DropdownOption<T> | T | null): T | null {
    if (!option) {
      return null;
    }
    if (typeof option === 'object' && option !== null && 'value' in option) {
      return (option as DropdownOption<T>).value;
    }
    return option as T;
  }

  private getLocalizedName(entity: { nameEn?: string; nameAr?: string } | null | undefined): string {
    if (!entity) {
      return '';
    }
    const currentLang = this.translate.currentLang || 'en';
    return currentLang === 'ar'
      ? (entity.nameAr || entity.nameEn || '')
      : (entity.nameEn || entity.nameAr || '');
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const value = this.form.getRawValue();

    const dto: CreateUpdateEmployeeDto = {
      nameAr: value.nameAr || undefined,
      nameEn: value.nameEn || undefined,
      militaryId: value.militaryId || undefined,
      departmentId: value.departmentId || undefined,
      rankId: value.rankId || undefined,
      phone: value.phone || undefined,
      email: value.email || undefined,
      notes: value.notes || undefined
    };

    const isEdit = this.mode === 'edit' && this.employee && this.employee.id != null;

    // Normalize to a single observable type to avoid union type subscribe issue
    let request$: Observable<unknown>;
    if (isEdit) {
      request$ = this.employeeService.updateEmployee(this.employee!.id, dto);
    } else {
      request$ = this.employeeService.createEmployee(dto);
    }

    request$.subscribe({
      next: () => {
        this.isLoading = false;
        const successKey = isEdit ? 'employeeFormModal.updateSuccess' : 'employeeFormModal.createSuccess';
        const titleKey = isEdit ? 'employeeFormModal.updateTitle' : 'employeeFormModal.createTitle';

        this.toastService.success(
          this.translate.instant(successKey),
          this.translate.instant(titleKey)
        );
        this.saved.emit();
        this.close();
      },
      error: (error: any) => {
        this.isLoading = false;
        const errorKey = isEdit ? 'employeeFormModal.updateError' : 'employeeFormModal.createError';
        const titleKey = isEdit ? 'employeeFormModal.updateTitle' : 'employeeFormModal.createTitle';
        const msg = ErrorHandler.extractAndTranslateErrorMessage(
          error,
          this.translate.instant(errorKey),
          this.translate
        );
        this.errorMessage = msg;
        this.toastService.error(
          msg,
          this.translate.instant(titleKey)
        );
      }
    });
  }

  close(): void {
    this.form.reset();
    this.errorMessage = '';
    this.closed.emit();
  }

  private markFormGroupTouched(): void {
    Object.keys(this.form.controls).forEach(key => {
      this.form.get(key)?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.form.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        const displayName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1');
        return `${displayName} is required`;
      }
      if (field.errors['email']) {
        return 'Please enter a valid email address';
      }
    }
    return '';
  }
}

