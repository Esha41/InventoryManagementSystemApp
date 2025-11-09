import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { CardComponent } from '@components/card/card.component';
import { ButtonComponent } from '@components/button/button.component';
import { UserFormModalComponent } from '@components/user-form-modal/user-form-modal.component';
import { LookupFormModalComponent } from '@components/lookup-form-modal/lookup-form-modal.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { LucideAngularModule, UserPlus, Search, Edit, Trash2, Shield, Mail, User as UserIcon, Power, Database, Plus, ChevronDown, X } from 'lucide-angular';
import { BackendUserDto, RoleDto } from '@models/backend-user.model';
import { BackendUserService } from '@services/backend-user.service';
import { LookupService } from '@services/lookup.service';
import { LookupItem, LookupTableConfig, CreateUpdateLookupDto, LOOKUP_TABLES } from '@models/lookup.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastService } from '@services/toast.service';

@Component({
  selector: 'app-manage-admins',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    CardComponent, 
    ButtonComponent, 
    LucideAngularModule,
    UserFormModalComponent,
    LookupFormModalComponent,
    ConfirmDialogComponent,
    TranslateModule
  ],
  templateUrl: './manage-admins.component.html',
  styleUrls: ['./manage-admins.component.css']
})
export class ManageAdminsComponent implements OnInit, OnDestroy {
  readonly UserPlus = UserPlus;
  readonly Search = Search;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;
  readonly Shield = Shield;
  readonly Mail = Mail;
  readonly UserIcon = UserIcon;
  readonly Power = Power;
  readonly Database = Database;
  readonly Plus = Plus;
  readonly ChevronDown = ChevronDown;
  readonly X = X;

  // Tab management
  activeTab: 'users' | 'lookups' = 'users';

  // User management
  users: BackendUserDto[] = [];
  roles: RoleDto[] = [];
  ranks: LookupItem[] = [];
  userRolesMap: Map<string, string[]> = new Map(); // Cache user roles
  isLoading = false;
  errorMessage = '';
  
  searchTerm = '';

  // Modal states
  showUserModal = false;
  showDeleteConfirm = false;
  userModalMode: 'create' | 'edit' = 'create';
  selectedUser?: BackendUserDto;

  // Lookup management
  lookupTables = LOOKUP_TABLES;
  selectedTable?: LookupTableConfig;
  lookupItems: LookupItem[] = [];
  lookupSearchTerm = '';
  isLoadingLookups = false;
  lookupErrorMessage = '';
  
  // Searchable dropdown state
  tableSearchTerm = '';
  showTableDropdown = false;
  
  // Lookup modal states
  showLookupModal = false;
  showLookupDeleteConfirm = false;
  lookupModalMode: 'create' | 'edit' = 'create';
  selectedLookupItem?: LookupItem;
  lookupModalLoading = false; // Track modal loading state

  private destroy$ = new Subject<void>();

  @ViewChild('tableDropdown', { static: false }) tableDropdownRef?: ElementRef;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.tableDropdownRef && !this.tableDropdownRef.nativeElement.contains(event.target)) {
      this.closeTableDropdown();
    }
  }

  constructor(
    private backendUserService: BackendUserService,
    private lookupService: LookupService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeTabFromQueryParams();
    this.loadUsers();
    this.loadRoles();
    this.loadRanks();
    
    this.backendUserService.users$
      .pipe(takeUntil(this.destroy$))
      .subscribe(users => {
        this.users = users;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.backendUserService.getUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.isLoading = false;
        // Load roles for each user
        users.forEach(user => this.loadUserRolesData(user.id));
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = 'Failed to load users: ' + (error.message || 'Unknown error');
      }
    });
  }

  private loadUserRolesData(userId: string): void {
    this.backendUserService.getUserRoles(userId).subscribe({
      next: (roles) => {
        this.userRolesMap.set(userId, roles.map(r => r.name));
      },
      error: (error) => {
        console.error(`Failed to load roles for user ${userId}:`, error);
        this.userRolesMap.set(userId, []);
      }
    });
  }

 // Returns an array of role names for a given user ID
getUserRoles(userId: string): string[] {
  const user = this.filteredUsers.find(u => u.id === userId);
  if (!user || !user.roleIds) return [];

  // Map roleIds to role names
  return user.roleIds
    .map(roleId => this.roles.find(r => r.id === roleId)?.name)
    .filter(Boolean) as string[]; // remove undefined
}

  loadRoles(): void {
    this.backendUserService.getRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
      },
      error: (error) => {
        this.errorMessage = 'Failed to load roles: ' + (error.message || 'Unknown error');
      }
    });
  }

  loadRanks(): void {
    this.lookupService.getLookupItems('Rank').subscribe({
      next: (ranks: LookupItem[]) => {
        this.ranks = ranks || [];
      },
      error: (error: any) => {
        console.error('Failed to load ranks:', error);
        this.ranks = [];
      }
    });
  }

  get filteredUsers(): BackendUserDto[] {
    return this.users.filter(user => {
      const matchesSearch = user.userName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                           user.email.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchesSearch;
    });
  }

  getUserName(user: BackendUserDto): string {
    return user.userName || user.email;
  }

  getUserInitials(user: BackendUserDto): string {
    const name = user.userName || user.email;
    return name.substring(0, 2).toUpperCase();
  }

  onAddUser(): void {
    this.userModalMode = 'create';
    this.selectedUser = undefined;
    this.showUserModal = true;
  }

  onEdit(user: BackendUserDto): void {
    this.userModalMode = 'edit';
    this.selectedUser = user;
    this.showUserModal = true;
  }

  onDelete(user: BackendUserDto): void {
    this.selectedUser = user;
    this.showDeleteConfirm = true;
  }

  confirmDelete(): void {
    if (this.selectedUser) {
      this.backendUserService.deleteUser(this.selectedUser.id).subscribe({
        next: (success) => {
          if (success) {
            this.showDeleteConfirm = false;
            this.selectedUser = undefined;
            this.loadUsers();
          }
        },
        error: (error) => {
          this.errorMessage = error.message || 'Failed to delete user';
        }
      });
    }
  }

  onUserSaved(): void {
    this.loadUsers();
    this.userRolesMap.clear(); // Clear cache to reload roles
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getTotalUsers(): number {
    return this.users.length;
  }

  getTotalActiveUsers(): number {
    return this.users.length;
  }

  getTotalInactiveUsers(): number {
    return 0;
  }

  getFullName(user: BackendUserDto): string {
    // Get name from nameEn, nameAr, fullNameEN, or fullNameAR
    const nameEn = user.nameEn || (user as any)?.fullNameEN;
    const nameAr = user.nameAr || (user as any)?.fullNameAR;
    
    if (nameEn) return nameEn;
    if (nameAr) return nameAr;
    return user.userName || user.email;
  }

  getMilitaryId(user: BackendUserDto): string {
    // Handle both militaryId and militoryId (API typo)
    return user.militaryId || (user as any)?.militoryId || '-';
  }

  getRankName(user: BackendUserDto): string {
    if (!user.rankId) return '-';
    const rank = this.ranks.find(r => r.id === user.rankId);
    if (!rank) return '-';
    // Return English name if available, otherwise Arabic name
    return rank.nameEn || rank.nameAr || '-';
  }

  getStatusColor(): string {
    return 'bg-[var(--color-success)]';
  }

  getRoleTypeColor(): string {
    return 'bg-[var(--color-accent)]';
  }

  // Tab management
  setActiveTab(tab: 'users' | 'lookups'): void {
    this.activeTab = tab;
    this.updateQueryParams(tab);
    if (tab === 'lookups' && this.lookupTables.length > 0) {
      if (!this.selectedTable) {
        // Auto-select first table if none selected
        this.selectedTable = this.lookupTables[0];
      }
      this.loadLookupItems();
    }
  }

  private initializeTabFromQueryParams(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const tabParam = params['tab'];
        if (tabParam === 'lookups' || tabParam === 'users') {
          this.activeTab = tabParam;
          if (tabParam === 'lookups' && this.lookupTables.length > 0) {
            if (!this.selectedTable) {
              // Auto-select first table if none selected
              this.selectedTable = this.lookupTables[0];
            }
            this.loadLookupItems();
          }
        }
      });
  }

  private updateQueryParams(tab: 'users' | 'lookups'): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab },
      queryParamsHandling: 'merge'
    });
  }

  // Lookup management
  onTableSelect(table: LookupTableConfig | undefined): void {
    this.selectedTable = table;
    this.showTableDropdown = false;
    this.tableSearchTerm = '';
    if (table) {
      this.loadLookupItems();
    }
  }

  get filteredLookupTables(): LookupTableConfig[] {
    if (!this.tableSearchTerm.trim()) {
      return this.lookupTables;
    }
    const search = this.tableSearchTerm.toLowerCase();
    return this.lookupTables.filter(table =>
      table.displayName.toLowerCase().includes(search) ||
      table.name.toLowerCase().includes(search)
    );
  }

  toggleTableDropdown(): void {
    this.showTableDropdown = !this.showTableDropdown;
    if (!this.showTableDropdown) {
      this.tableSearchTerm = '';
    }
  }

  closeTableDropdown(): void {
    this.showTableDropdown = false;
    this.tableSearchTerm = '';
  }

  loadLookupItems(): void {
    if (!this.selectedTable) return;

    this.isLoadingLookups = true;
    this.lookupErrorMessage = '';
    this.lookupService.getLookupItems(this.selectedTable.apiEndpoint).subscribe({
      next: (items) => {
        this.lookupItems = items.filter(item => !item.isDeleted);
        this.isLoadingLookups = false;
      },
      error: (error) => {
        this.isLoadingLookups = false;
        this.lookupErrorMessage = 'Failed to load lookup items: ' + (error.message || 'Unknown error');
      }
    });
  }

  get filteredLookupItems(): LookupItem[] {
    if (!this.lookupSearchTerm.trim()) {
      return this.lookupItems;
    }
    const search = this.lookupSearchTerm.toLowerCase();
    return this.lookupItems.filter(item => 
      item.nameEn.toLowerCase().includes(search) ||
      item.nameAr.toLowerCase().includes(search) ||
      (item.code && item.code.toLowerCase().includes(search))
    );
  }

  onAddLookup(): void {
    if (!this.selectedTable) return;
    this.lookupModalMode = 'create';
    this.selectedLookupItem = undefined;
    this.showLookupModal = true;
  }

  onEditLookup(item: LookupItem): void {
    if (!this.selectedTable) return;
    this.lookupModalMode = 'edit';
    this.selectedLookupItem = item;
    this.showLookupModal = true;
  }

  onDeleteLookup(item: LookupItem): void {
    if (!this.selectedTable) return;
    this.selectedLookupItem = item;
    this.showLookupDeleteConfirm = true;
  }

  confirmLookupDelete(): void {
    if (!this.selectedTable || !this.selectedLookupItem) return;

    const dto: CreateUpdateLookupDto = {
      nameEn: this.selectedLookupItem.nameEn,
      nameAr: this.selectedLookupItem.nameAr,
      code: this.selectedLookupItem.code
    };

    this.lookupService.deleteLookupItem(
      this.selectedTable.apiEndpoint,
      this.selectedLookupItem.id!,
      dto
    ).subscribe({
      next: (success) => {
        if (success) {
          const itemName = this.selectedLookupItem?.nameEn || this.selectedLookupItem?.nameAr || '';
          this.translateService.get(['toast.success', 'lookupManagement.deleteItem']).subscribe(translations => {
            this.toastService.success(
              `"${itemName}" ${translations['lookupManagement.deleteItem'] || 'deleted'} successfully`,
              translations['toast.success']
            );
          });
          this.showLookupDeleteConfirm = false;
          this.selectedLookupItem = undefined;
          this.loadLookupItems();
        }
      },
      error: (error) => {
        this.lookupErrorMessage = error.message || 'Failed to delete lookup item';
        this.translateService.get(['toast.error']).subscribe(translations => {
          this.toastService.error(
            error.message || 'Failed to delete lookup item',
            translations['toast.error']
          );
        });
      }
    });
  }

  onLookupSaved(dto: CreateUpdateLookupDto): void {
    if (!this.selectedTable) return;

    this.lookupModalLoading = true;
    this.isLoadingLookups = true;
    this.lookupErrorMessage = '';

    const operation = this.lookupModalMode === 'create'
      ? this.lookupService.createLookupItem(this.selectedTable.apiEndpoint, dto)
      : this.lookupService.updateLookupItem(
          this.selectedTable.apiEndpoint,
          this.selectedLookupItem!.id!,
          dto
        );

    operation.subscribe({
      next: (item) => {
        const isCreate = this.lookupModalMode === 'create';
        const itemName = dto.nameEn || dto.nameAr || '';
        
        this.translateService.get([
          'toast.success',
          'lookupManagement.addItem',
          'lookupManagement.edit'
        ]).subscribe(translations => {
          const message = isCreate 
            ? `${translations['lookupManagement.addItem'] || 'Item'} "${itemName}" added successfully`
            : `"${itemName}" ${translations['lookupManagement.edit'] || 'updated'} successfully`;
          
          this.toastService.success(message, translations['toast.success']);
        });

        this.lookupModalLoading = false;
        this.isLoadingLookups = false;
        this.showLookupModal = false;
        this.selectedLookupItem = undefined;
        this.loadLookupItems();
      },
      error: (error) => {
        this.lookupModalLoading = false; // Reset modal loading state on error
        this.isLoadingLookups = false;
        this.lookupErrorMessage = error.message || `Failed to ${this.lookupModalMode} lookup item`;
        
        this.translateService.get(['toast.error']).subscribe(translations => {
          this.toastService.error(
            error.message || `Failed to ${this.lookupModalMode} lookup item`,
            translations['toast.error']
          );
        });
      }
    });
  }
  
}
