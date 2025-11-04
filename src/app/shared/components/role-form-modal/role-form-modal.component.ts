import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, FormControl } from '@angular/forms';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';
import { RoleDto, CreateRoleDto, UpdateRoleDto } from '@models/backend-user.model';
import { TranslateModule } from '@ngx-translate/core';
import { BackendUserService } from '@services/backend-user.service';

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
  @Output() saved = new EventEmitter<void>();
  
  roleForm!: FormGroup;
  isLoading = false;
  isLoadingEntities = false;
  errorMessage = '';
  entities: ApplicationEntity[] = [];
  selectedEntityIds: Set<number> = new Set(); // Store as numbers to match API format

  constructor(
    private fb: FormBuilder,
    private backendUserService: BackendUserService
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
      // Load existing entity selections from role if editing
      if (this.role?.applicationEntityIds) {
        this.selectedEntityIds.clear();
        this.role.applicationEntityIds.forEach(id => {
          this.selectedEntityIds.add(id);
        });
        console.log('Loaded existing entity IDs from role:', Array.from(this.selectedEntityIds));
      } else {
        this.selectedEntityIds.clear();
      }
      this.loadEntities();
    }
    if (changes['role'] || changes['mode']) {
      this.initializeForm();
      // Load existing entity selections from role if editing
      if (this.role?.applicationEntityIds) {
        this.selectedEntityIds.clear();
        this.role.applicationEntityIds.forEach(id => {
          this.selectedEntityIds.add(id);
        });
        console.log('Loaded existing entity IDs from role:', Array.from(this.selectedEntityIds));
      } else {
        this.selectedEntityIds.clear();
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
      entityIds: this.fb.array([]) // Will be populated with checkboxes
    });
  }

  private loadEntities(): void {
    console.log('Loading application entities...');
    this.isLoadingEntities = true;
    this.backendUserService.getApplicationEntities().subscribe({
      next: (entities: ApplicationEntity[]) => {
        console.log('Entities loaded successfully:', entities);
        this.entities = entities;
        this.initializeEntityCheckboxes();
        this.isLoadingEntities = false;
      },
      error: (error: any) => {
        this.isLoadingEntities = false;
        console.error('Failed to load entities:', error);
        this.errorMessage = `Failed to load entities: ${error.message || 'Unknown error'}`;
      }
    });
  }

  private initializeEntityCheckboxes(): void {
    const entityFormArray = this.roleForm.get('entityIds') as FormArray;
    entityFormArray.clear();
    
    // Initialize checkboxes based on selectedEntityIds (which may be populated from role.applicationEntityIds)
    this.entities.forEach(entity => {
      // Check if entity ID is in selectedEntityIds
      const isSelected = this.selectedEntityIds.has(entity.id) || 
                        (this.role?.applicationEntityIds?.includes(entity.id) || false);
      entityFormArray.push(this.fb.control(isSelected));
      
      // Make sure the entity ID is in selectedEntityIds if it's selected
      if (isSelected && !this.selectedEntityIds.has(entity.id)) {
        this.selectedEntityIds.add(entity.id);
      }
    });
    
    console.log('Initialized checkboxes. Selected entity IDs:', Array.from(this.selectedEntityIds));
  }

  toggleEntity(entity: ApplicationEntity, index: number): void {
    const entityFormArray = this.roleForm.get('entityIds') as FormArray;
    const control = entityFormArray.at(index);
    const currentValue = control.value;
    control.setValue(!currentValue);

    // Use the entity ID as number (matching API format)
    const entityId = entity.id;
    if (!currentValue) {
      // Add to selected
      this.selectedEntityIds.add(entityId);
    } else {
      // Remove from selected
      this.selectedEntityIds.delete(entityId);
    }
    
    console.log('Toggled entity:', entityId, 'Selected IDs:', Array.from(this.selectedEntityIds));
  }

  isEntitySelected(index: number): boolean {
    const entityFormArray = this.roleForm.get('entityIds') as FormArray;
    return entityFormArray.at(index)?.value || false;
  }

  get entityIdsFormArray(): FormArray {
    return this.roleForm.get('entityIds') as FormArray;
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

    // Get selected entity IDs (already numbers, just convert to array)
    const applicationEntityIds = Array.from(this.selectedEntityIds);

    console.log('Selected entity IDs:', applicationEntityIds);

    if (this.mode === 'create') {
      const dto: CreateRoleDto = {
        name: this.roleForm.value.name,
        isDefaultRole: this.roleForm.value.isDefaultRole || false,
        isSuperAdmin: this.roleForm.value.isSuperAdmin || false,
        applicationEntityIds: applicationEntityIds.length > 0 ? applicationEntityIds : undefined
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
        applicationEntityIds: applicationEntityIds.length > 0 ? applicationEntityIds : undefined
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
    this.selectedEntityIds.clear();
    this.entities = [];
    this.closed.emit();
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
