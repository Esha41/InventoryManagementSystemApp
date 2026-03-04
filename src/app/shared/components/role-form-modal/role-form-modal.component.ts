import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';
import { RoleDto, CreateRoleDto, UpdateRoleDto, ApplicationEntityDto } from '@models/backend-user.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BackendUserService } from '@services/backend-user.service';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { ProfileDataService } from '@services/profile-data.service';
import { ErrorHandler } from '@utils/error-handler.utils';

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
export class RoleFormModalComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() role?: RoleDto;
  @Input() mode: 'create' | 'edit' = 'create';

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<RoleDto>();
  @Output() error = new EventEmitter<string>();

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

  // Super admin check
  isSuperAdmin = false;

  constructor(
    private fb: FormBuilder,
    private backendUserService: BackendUserService,
    private translateService: TranslateService,
    private profileDataService: ProfileDataService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    // Check if user is super admin
    const profileData = this.profileDataService.getFullProfileData();
    this.isSuperAdmin = profileData?.isSuperAdmin || false;

    this.initializeForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && changes['isOpen'].currentValue) {
      this.initializeForm();
      this.errorMessage = '';
      // Load existing entity selection from role if editing (take first one if multiple exist)
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
      // Load existing entity selection from role if editing (take first one if multiple exist)
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

  private initializeForm(): void {
    this.roleForm = this.fb.group({
      nameEn: [this.role?.nameEn || this.role?.name || '', [Validators.required, Validators.minLength(3)]],
      nameAr: [this.role?.nameAr || '', [Validators.required, Validators.minLength(3)]],
      isSuperAdmin: [this.role?.isSuperAdmin || false],
      isAdmin: [this.role?.isAdmin || false],
      applicationEntityId: [null] // Single entity selection
    });
  }

  private loadEntities(): void {
    console.log('Loading application entities...');
    this.isLoadingEntities = true;
    this.backendUserService.getApplicationEntities().subscribe({
      next: (entities: ApplicationEntityDto[]) => {
        console.log('Entities loaded successfully:', entities);
        this.entities = entities;
        this.isLoadingEntities = false;
      },
      error: (error: unknown) => {
        this.isLoadingEntities = false;
        console.error('Failed to load entities:', error);
        this.translateService.get('roleFormModal.failedToLoadEntities').subscribe((translation: string) => {
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

    // Get selected entity ID (single selection)
    const selectedEntityId = this.roleForm.value.applicationEntityId;
    const applicationEntityIds = selectedEntityId ? [selectedEntityId] : undefined;

    console.log('Selected entity ID:', selectedEntityId);

    if (this.mode === 'create') {
      const dto: CreateRoleDto = {
        name: this.roleForm.value.nameEn, // Use nameEn as primary name for now
        nameEn: this.roleForm.value.nameEn,
        nameAr: this.roleForm.value.nameAr,
        isSuperAdmin: this.roleForm.value.isSuperAdmin || false,
        isAdmin: this.roleForm.value.isAdmin || false,
        applicationEntityIds: applicationEntityIds
      };

      console.log('Creating role with DTO:', dto);

      this.backendUserService.createRole(dto).subscribe({
        next: (role: RoleDto) => {
          console.log('Role created successfully:', role);
          this.isLoading = false;
          this.saved.emit(role);
          this.close();
        },
        error: (error: unknown) => {
          console.error('Error creating role:', error);
          this.isLoading = false;
          const errorMsg = ErrorHandler.extractErrorMessage(error, 'Failed to create role');
          this.errorMessage = errorMsg;
          this.error.emit(errorMsg);
        }
      });
    } else if (this.role) {
      const dto: UpdateRoleDto = {
        id: this.role.id,
        name: this.roleForm.value.nameEn, // Use nameEn as primary name
        nameEn: this.roleForm.value.nameEn,
        nameAr: this.roleForm.value.nameAr,
        isSuperAdmin: this.roleForm.value.isSuperAdmin || false,
        isAdmin: this.roleForm.value.isAdmin || false,
        applicationEntityIds: applicationEntityIds
      };

      console.log('Updating role with DTO:', dto);

      this.backendUserService.updateRole(this.role.id, dto).subscribe({
        next: (role: RoleDto) => {
          this.isLoading = false;
          this.saved.emit(role);
          this.close();
        },
        error: (error: unknown) => {
          this.isLoading = false;
          const errorMsg = ErrorHandler.extractErrorMessage(error, 'Failed to update role');
          this.errorMessage = errorMsg;
          this.error.emit(errorMsg);
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
    if (!option) {
      return null;
    }
    if (typeof option === 'object' && 'value' in option) {
      return option.value as ApplicationEntityDto;
    }
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
