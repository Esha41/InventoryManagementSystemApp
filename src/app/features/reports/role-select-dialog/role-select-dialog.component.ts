import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '@components/modal/modal.component';
import { ButtonComponent } from '@components/button/button.component';
import { LucideAngularModule, Users, Check, Search } from 'lucide-angular';
import { RoleService } from '@services/role.service';
import { RoleDto } from '@models/backend-user.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TranslationService } from '@services/translation.service';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-role-select-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ModalComponent,
    ButtonComponent,
    LucideAngularModule,
    TranslateModule
  ],
  templateUrl: './role-select-dialog.component.html',
  styleUrls: ['./role-select-dialog.component.css']
})
export class RoleSelectDialogComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() selectedRoleIds: string[] = [];
  @Output() rolesSelected = new EventEmitter<string[]>();
  @Output() cancelled = new EventEmitter<void>();

  roles: RoleDto[] = [];
  filteredRoles: RoleDto[] = [];
  selectedRoles: Set<string> = new Set();
  loading = false;
  error: string | null = null;
  searchTerm = '';

  readonly Users = Users;
  readonly Check = Check;
  readonly Search = Search;

  constructor(
    private roleService: RoleService,
    private translateService: TranslateService,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    if (this.isOpen) {
      this.loadRoles();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen && this.roles.length === 0) {
      this.loadRoles();
    }
    if (changes['isOpen'] && !this.isOpen) {
      this.selectedRoles.clear();
      this.error = null;
      this.searchTerm = '';
      this.filteredRoles = this.sortRolesWithSelectedFirst(this.roles);
    }
    if (changes['selectedRoleIds'] && this.selectedRoleIds) {
      this.selectedRoles = new Set(this.selectedRoleIds);
      // Re-sort when selected roles change
      if (this.roles.length > 0) {
        this.filteredRoles = this.sortRolesWithSelectedFirst(this.filteredRoles);
      }
    }
  }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  loadRoles(): void {
    this.loading = true;
    this.error = null;

    this.roleService.getAllRoles()
      .pipe(
        catchError((err) => {
          console.error('Error loading roles:', err);
          this.error = this.translateService.instant('common.errorLoadingData');
          return of([]);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((roles) => {
        this.roles = roles;
        // Initialize selected roles from input
        if (this.selectedRoleIds && this.selectedRoleIds.length > 0) {
          this.selectedRoles = new Set(this.selectedRoleIds);
        }
        // Sort roles with selected ones first
        this.filteredRoles = this.sortRolesWithSelectedFirst(roles);
      });
  }

  toggleRole(roleId: string): void {
    if (this.selectedRoles.has(roleId)) {
      this.selectedRoles.delete(roleId);
    } else {
      this.selectedRoles.add(roleId);
    }
    // Re-sort to maintain selected-first order
    this.filteredRoles = this.sortRolesWithSelectedFirst(this.filteredRoles);
  }

  isRoleSelected(roleId: string): boolean {
    return this.selectedRoles.has(roleId);
  }

  getRoleId(role: RoleDto): string {
    return role.id;
  }

  onConfirm(): void {
    this.rolesSelected.emit(Array.from(this.selectedRoles));
    this.isOpen = false;
  }

  onCancel(): void {
    this.cancelled.emit();
    this.isOpen = false;
    // Reset to original selection
    if (this.selectedRoleIds && this.selectedRoleIds.length > 0) {
      this.selectedRoles = new Set(this.selectedRoleIds);
    } else {
      this.selectedRoles.clear();
    }
  }

  getRoleDisplayName(role: RoleDto): string {
    const isRTL = this.translationService.isRTL();
    return isRTL && role.nameAr ? role.nameAr : (role.nameEn || role.name);
  }

  onSearchChange(term: string): void {
    this.searchTerm = term;
    const normalized = term.toLowerCase().trim();

    let filtered: RoleDto[];
    if (!normalized) {
      filtered = this.roles;
    } else {
      filtered = this.roles.filter(role => {
        const displayName = this.getRoleDisplayName(role).toLowerCase();
        const name = role.name?.toLowerCase() || '';
        const nameEn = role.nameEn?.toLowerCase() || '';
        const nameAr = role.nameAr?.toLowerCase() || '';
        
        return displayName.includes(normalized) ||
               name.includes(normalized) ||
               nameEn.includes(normalized) ||
               nameAr.includes(normalized);
      });
    }
    // Sort filtered roles with selected ones first
    this.filteredRoles = this.sortRolesWithSelectedFirst(filtered);
  }

  clearSearch(): void {
    this.searchTerm = '';
    // Sort roles with selected ones first
    this.filteredRoles = this.sortRolesWithSelectedFirst(this.roles);
  }

  /**
   * Sort roles so that selected roles appear first, then unselected roles
   * Within each group, roles are sorted alphabetically by display name
   */
  private sortRolesWithSelectedFirst(roles: RoleDto[]): RoleDto[] {
    return [...roles].sort((a, b) => {
      const aSelected = this.isRoleSelected(this.getRoleId(a));
      const bSelected = this.isRoleSelected(this.getRoleId(b));
      
      // Selected roles come first
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      
      // If both selected or both unselected, sort alphabetically by display name
      const aName = this.getRoleDisplayName(a).toLowerCase();
      const bName = this.getRoleDisplayName(b).toLowerCase();
      return aName.localeCompare(bName);
    });
  }
}
