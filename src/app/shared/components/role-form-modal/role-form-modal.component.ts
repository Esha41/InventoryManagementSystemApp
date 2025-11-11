import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';
import { RoleDto, CreateRoleDto, UpdateRoleDto } from '@models/backend-user.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BackendUserService } from '@services/backend-user.service';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';

export interface ApplicationEntity {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string;
  isDeleted: boolean;
  creationDate?: string;
  modificationDate?: string | null;
  modifiedBy?: string | null;
  createdBy?: string | null;
}

@Component({
  selector: 'app-role-form-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ModalComponent,
    ButtonComponent,
    TranslateModule,
    DropdownComponent
  ],
  templateUrl: './role-form-modal.component.html',
  styleUrls: ['./role-form-modal.component.css']
})
export class RoleFormModalComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() role?: RoleDto;
  @Input() mode: 'create' | 'edit' = 'create';
  
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();
  
  roleForm!: FormGroup;
  isLoading = false;
  isLoadingEntities = false;
  errorMessage = '';
  entities: ApplicationEntity[] = [];
  selectedEntityId: number | null = null; // Store single entity ID
  readonly entityOptionLabel = (option: DropdownOption<ApplicationEntity> | ApplicationEntity | null) => {
    const entity = this.unwrapEntityOption(option);
    return entity ? this.getEntityName(entity) : '';
  };

  constructor(
    private fb: FormBuilder,
    private backendUserService: BackendUserService,
    private translateService: TranslateService
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
      name: [this.role?.name || '', [Validators.required, Validators.minLength(3)]],
      isDefaultRole: [this.role?.isDefaultRole || false],
      isSuperAdmin: [this.role?.isSuperAdmin || false],
      applicationEntityId: [null] // Single entity selection
    });
  }

  private loadEntities(): void {
    console.log('Loading application entities...');
    this.isLoadingEntities = true;
    this.backendUserService.getApplicationEntities().subscribe({
      next: (entities: ApplicationEntity[]) => {
        console.log('Entities loaded successfully:', entities);
        this.entities = entities;
        this.isLoadingEntities = false;
      },
      error: (error: any) => {
        this.isLoadingEntities = false;
        console.error('Failed to load entities:', error);
        this.errorMessage = `Failed to load entities: ${error.message || 'Unknown error'}`;
      }
    });
  }

  getEntityName(entity: ApplicationEntity): string {
    const currentLang = this.translateService.currentLang || 'en';
    const name = currentLang === 'ar' ? entity.nameAr : entity.nameEn;
    return name || entity.code || entity.id.toString();
  }

  get title(): string {
    return this.mode === 'create' ? 'Create New Role' : `Edit Role: ${this.role?.name}`;
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
        name: this.roleForm.value.name,
        isDefaultRole: this.roleForm.value.isDefaultRole || false,
        isSuperAdmin: this.roleForm.value.isSuperAdmin || false,
        applicationEntityIds: applicationEntityIds
      };

      console.log('Creating role with DTO:', dto);

      this.backendUserService.createRole(dto).subscribe({
        next: (role: RoleDto) => {
          console.log('Role created successfully:', role);
          this.isLoading = false;
          this.saved.emit();
          this.close();
        },
        error: (error: any) => {
          console.error('Error creating role:', error);
          this.isLoading = false;
          this.errorMessage = error.message || 'Failed to create role';
        }
      });
    } else if (this.role) {
      const dto: UpdateRoleDto = {
        id: this.role.id,
        name: this.roleForm.value.name,
        isDefaultRole: this.roleForm.value.isDefaultRole || false,
        isSuperAdmin: this.roleForm.value.isSuperAdmin || false,
        applicationEntityIds: applicationEntityIds
      };

      console.log('Updating role with DTO:', dto);

      this.backendUserService.updateRole(this.role.id, dto).subscribe({
        next: (role: RoleDto) => {
          this.isLoading = false;
          this.saved.emit();
          this.close();
        },
        error: (error: any) => {
          this.isLoading = false;
          this.errorMessage = error.message || 'Failed to update role';
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

  private unwrapEntityOption(option: DropdownOption<ApplicationEntity> | ApplicationEntity | null): ApplicationEntity | null {
    if (!option) {
      return null;
    }
    if (typeof option === 'object' && 'value' in option) {
      return option.value as ApplicationEntity;
    }
    return option as ApplicationEntity;
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
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
      }
      if (field.errors['minlength']) {
        return `Minimum length is ${field.errors['minlength'].requiredLength}`;
      }
    }
    return '';
  }
}
