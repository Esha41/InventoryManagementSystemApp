import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';
import { RoleDto, CreateRoleDto, UpdateRoleDto } from '@models/backend-user.model';
import { TranslateModule } from '@ngx-translate/core';
import { BackendUserService } from '@services/backend-user.service';

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
  errorMessage = '';

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
    }
    if (changes['role'] || changes['mode']) {
      this.initializeForm();
    }
  }

  private initializeForm(): void {
    this.roleForm = this.fb.group({
      name: [this.role?.name || '', [Validators.required, Validators.minLength(3)]],
      isDefaultRole: [this.role?.isDefaultRole || false],
      isSuperAdmin: [this.role?.isSuperAdmin || false]
    });
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

    if (this.mode === 'create') {
      const dto: CreateRoleDto = this.roleForm.value;

      this.backendUserService.createRole(dto).subscribe({
        next: (role: RoleDto) => {
          this.isLoading = false;
          this.saved.emit();
          this.close();
        },
        error: (error: any) => {
          this.isLoading = false;
          this.errorMessage = error.message || 'Failed to create role';
        }
      });
    } else if (this.role) {
      const dto: UpdateRoleDto = {
        id: this.role.id,
        ...this.roleForm.value
      };

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
