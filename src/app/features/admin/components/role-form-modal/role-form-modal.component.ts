import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ModalComponent } from '@components/modal/modal.component';
import { ButtonComponent } from '@components/button/button.component';
import { RoleDto, CreateRoleDto, UpdateRoleDto, ApplicationEntityDto } from '@models/backend-user.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BackendUserService } from '@services/backend-user.service';
import {  DropdownOption } from '@components/dropdown/dropdown.component';
import { Subject, takeUntil } from 'rxjs';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { ProfileDataService } from '@profile/services/profile-data.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { ConfigService } from '@services/config.service';

/** @deprecated Use ApplicationEntityDto from @models/backend-user.model */
export type ApplicationEntity = ApplicationEntityDto;

@Component({
  selector: 'app-role-form-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ModalComponent,
    ButtonComponent,
    TranslateModule
  ],
  templateUrl: './role-form-modal.component.html',
  styleUrls: ['./role-form-modal.component.css']
})
export class RoleFormModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() role?: RoleDto;
  @Input() mode: 'create' | 'edit' = 'create';

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<RoleDto>();
  @Output() saveError = new EventEmitter<string>();

  roleForm!: FormGroup;
  isLoading = false;
  isLoadingEntities = false;
  errorMessage = '';
  entities: ApplicationEntityDto[] = [];
  selectedEntityId: number | null = null;
  readonly entityOptionLabel = (option: DropdownOption<ApplicationEntityDto> | ApplicationEntityDto | null) => {
    const entity = this.unwrapEntityOption(option);
    return entity ? this.getEntityName(entity) : '';
  };

  isSuperAdmin = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private backendUserService: BackendUserService,
    private translateService: TranslateService,
    private profileDataService: ProfileDataService,
    private configService: ConfigService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    const profileData = this.profileDataService.getFullProfileData();
    this.isSuperAdmin = profileData?.isSuperAdmin || false;
    this.initializeForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && changes['isOpen'].currentValue) {
      this.initializeForm();
      this.errorMessage = '';
      if (this.role?.applicationEntityIds && this.role.applicationEntityIds.length > 0) {
        this.selectedEntityId = this.role.applicationEntityIds[0];
        this.roleForm.patchValue({ applicationEntityId: this.selectedEntityId });
      } else {
        this.selectedEntityId = null;
        this.roleForm.patchValue({ applicationEntityId: null });
      }
      this.loadEntities();
    }
    if (changes['role'] || changes['mode']) {
      this.initializeForm();
      if (this.role?.applicationEntityIds && this.role.applicationEntityIds.length > 0) {
        this.selectedEntityId = this.role.applicationEntityIds[0];
        this.roleForm.patchValue({ applicationEntityId: this.selectedEntityId });
      } else {
        this.selectedEntityId = null;
        this.roleForm.patchValue({ applicationEntityId: null });
      }
      if (this.isOpen) {
        this.loadEntities();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.roleForm = this.fb.group({
      nameEn: [this.role?.nameEn || this.role?.name || '', [Validators.required, Validators.minLength(3)]],
      nameAr: [this.role?.nameAr || '', [Validators.required, Validators.minLength(3)]],
      isSuperAdmin: [this.role?.isSuperAdmin || false],
      isAdmin: [this.role?.isAdmin || false],
      applicationEntityId: [null]
    });
  }

  private loadEntities(): void {
    this.isLoadingEntities = true;
    this.backendUserService.getApplicationEntities()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (entities: ApplicationEntityDto[]) => {
          this.entities = entities;
          this.isLoadingEntities = false;
        },
        error: (error: unknown) => {
          this.isLoadingEntities = false;
          this.configService.logError('Failed to load entities', error);
          this.translateService.get('roleFormModal.failedToLoadEntities')
            .pipe(takeUntil(this.destroy$))
            .subscribe((translation: string) => {
              this.errorMessage = `${translation}: ${ErrorHandler.extractErrorMessage(error, 'Unknown error')}`;
            });
        }
      });
  }

  getEntityName(entity: ApplicationEntityDto): string {
    const localizedName = getLocalizedName(entity, getCurrentLang(this.translateService));
    return localizedName || entity.code || entity.id.toString();
  }

  get title(): string {
    if (this.mode === 'create') {
      return this.translateService.instant('roleFormModal.createTitle');
    }
    const nameAr = this.role?.nameAr;
    const nameEn = this.role?.nameEn || this.role?.name;
    let roleDisplayName = '';
    if (nameAr && nameEn) {
      roleDisplayName = `${nameAr} / ${nameEn}`;
    } else {
      roleDisplayName = nameAr || nameEn || '';
    }
    return `${this.translateService.instant('roleFormModal.editTitle')}: ${roleDisplayName}`;
  }

  onSubmit(): void {
    if (this.roleForm.invalid) {
      this.markFormGroupTouched();
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    const selectedEntityId = this.roleForm.value.applicationEntityId;
    const applicationEntityIds = selectedEntityId ? [selectedEntityId] : undefined;

    if (this.mode === 'create') {
      const dto: CreateRoleDto = {
        name: this.roleForm.value.nameEn,
        nameEn: this.roleForm.value.nameEn,
        nameAr: this.roleForm.value.nameAr,
        isSuperAdmin: this.roleForm.value.isSuperAdmin || false,
        isAdmin: this.roleForm.value.isAdmin || false,
        applicationEntityIds: applicationEntityIds
      };
      this.backendUserService.createRole(dto)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (role: RoleDto) => {
            this.isLoading = false;
            this.saved.emit(role);
            this.close();
          },
          error: (error: unknown) => {
            this.configService.logError('Error creating role', error);
            this.isLoading = false;
            const errorMsg = ErrorHandler.extractErrorMessage(error, 'Failed to create role');
            this.errorMessage = errorMsg;
            this.saveError.emit(errorMsg);
          }
        });
    } else if (this.role) {
      const dto: UpdateRoleDto = {
        id: this.role.id,
        name: this.roleForm.value.nameEn,
        nameEn: this.roleForm.value.nameEn,
        nameAr: this.roleForm.value.nameAr,
        isSuperAdmin: this.roleForm.value.isSuperAdmin || false,
        isAdmin: this.roleForm.value.isAdmin || false,
        applicationEntityIds: applicationEntityIds
      };
      this.backendUserService.updateRole(this.role.id, dto)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (role: RoleDto) => {
            this.isLoading = false;
            this.saved.emit(role);
            this.close();
          },
          error: (error: unknown) => {
            this.isLoading = false;
            const errorMsg = ErrorHandler.extractErrorMessage(error, 'Failed to update role');
            this.errorMessage = errorMsg;
            this.saveError.emit(errorMsg);
          }
        });
    }
  }

  close(): void {
    this.roleForm.reset();
    this.errorMessage = '';
    this.selectedEntityId = null;
    this.entities = [];
    this.closed.emit();
  }

  private unwrapEntityOption(option: DropdownOption<ApplicationEntityDto> | ApplicationEntityDto | null): ApplicationEntityDto | null {
    if (!option) return null;
    if (typeof option === 'object' && 'value' in option) return option.value as ApplicationEntityDto;
    return option as ApplicationEntityDto;
  }

  private markFormGroupTouched(): void {
    Object.keys(this.roleForm.controls).forEach(key => {
      this.roleForm.get(key)?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.roleForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        const labelKey = fieldName === 'nameEn' ? 'roleFormModal.nameEn' : (fieldName === 'nameAr' ? 'roleFormModal.nameAr' : fieldName);
        return `${this.translateService.instant(labelKey)} ${this.translateService.instant('common.requiredSuffix') || 'is required'}`;
      }
      if (field.errors['minlength']) {
        return `${this.translateService.instant('common.minLength') || 'Minimum length is'} ${field.errors['minlength'].requiredLength}`;
      }
    }
    return '';
  }
}
