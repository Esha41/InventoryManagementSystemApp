import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BackendUserDto, RoleDto } from '@models/backend-user.model';
import { LookupItem } from '@models/lookup.model';
import { PagedRequest, FilterData } from '@models/api-response.model';
import { BackendUserService, UserSummaryDto } from './backend-user.service';
import { LookupService } from './lookup.service';
import { TranslateService } from '@ngx-translate/core';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

/**
 * User Management Service
 * Handles user-related business logic, filtering, and data operations
 */
@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  private userRolesMap: Map<string, string[]> = new Map();
  private userSummary: UserSummaryDto = { totalUsers: 0, activeUsers: 0, inactiveUsers: 0 };

  constructor(
    private backendUserService: BackendUserService,
    private lookupService: LookupService,
    private translateService: TranslateService
  ) { }

  /**
   * Load all users
   */
  // Pagination state
  private currentPage = 1;
  private pageSize = 10;
  private totalCount = 0;
  private searchTerm = '';

  get paginationState() {
    return {
      currentPage: this.currentPage,
      pageSize: this.pageSize,
      totalCount: this.totalCount,
      totalPages: Math.ceil(this.totalCount / this.pageSize)
    };
  }

  /**
   * Load users with pagination and filtering
   */
  loadUsers(page: number = 1, pageSize: number = 10, searchTerm: string = '', status: 'all' | 'active' | 'inactive' = 'all'): Observable<BackendUserDto[]> {
    this.currentPage = page;
    this.pageSize = pageSize;
    this.searchTerm = searchTerm;

    const filters: FilterData[] = [];

    if (searchTerm) {
      filters.push({ value: searchTerm }); // Backend handles multi-field search if field is missing
    }

    if (status !== 'all') {
      filters.push({
        field: 'IsActive',
        operator: 'eq',
        value: status === 'active' ? 'true' : 'false'
      });
    }

    const request: PagedRequest = {
      page,
      pageSize,
      filter: filters.length > 0 ? (filters.length === 1 ? filters[0] : {
        logic: 'and',
        filters: filters
      }) : undefined
    };

    return this.backendUserService.getUsers(request).pipe(
      map(paginatedList => {
        this.totalCount = paginatedList.totalCount;
        this.userRolesMap.clear();
        paginatedList.items.forEach(user => this.cacheUserRoles(user));
        return paginatedList.items;
      })
    );
  }

  /**
   * Load all roles
   */
  loadRoles(): Observable<RoleDto[]> {
    return this.backendUserService.getRoles();
  }

  /**
   * Load ranks lookup items
   */
  loadRanks(): Observable<LookupItem[]> {
    return this.lookupService.getLookupItems('Rank');
  }

  /**
   * Load departments lookup items
   */
  loadDepartments(): Observable<LookupItem[]> {
    return this.lookupService.getDepartments();
  }

  /**
   * Delete a user
   */
  deleteUser(userId: string): Observable<boolean> {
    return this.backendUserService.deleteUser(userId);
  }

  /**
   * Toggle user active status
   */
  toggleUserStatus(userId: string): Observable<boolean> {
    return this.backendUserService.toggleUserStatus(userId);
  }

  /**
   * Load user summary
   */
  loadUserSummary(): Observable<UserSummaryDto> {
    return this.backendUserService.getUsersSummary().pipe(
      map(summary => {
        this.userSummary = summary;
        return summary;
      })
    );
  }

  /**
   * Filter users by search term
   * @deprecated Use loadUsers with searchTerm instead
   */
  filterUsers(users: BackendUserDto[], searchTerm: string): BackendUserDto[] {
    // Logic moved to backend. This is kept for compatibility if needed or local filtering of small lists.
    // For now, return as is or implement client side if strictly required (not recommended with server pagination)
    return users;
  }

  /**
   * Get user roles for a specific user
   */
  getUserRoles(userId: string, users: BackendUserDto[], roles: RoleDto[]): string[] {
    const cachedRoles = this.userRolesMap.get(userId);
    if (cachedRoles !== undefined) {
      return cachedRoles;
    }

    const user = users.find(u => u.id === userId);
    if (!user) {
      return [];
    }

    const roleNames = this.extractRoleNames(user, roles);
    this.userRolesMap.set(user.id, roleNames);
    return roleNames;
  }

  /**
   * Cache user roles
   */
  cacheUserRoles(user: BackendUserDto, roles: RoleDto[] = []): void {
    const roleNames = this.extractRoleNames(user, roles);
    this.userRolesMap.set(user.id, roleNames);

    // If user has roleIds but no roles, load them
    if (roleNames.length === 0 && user.roleIds && user.roleIds.length > 0 && (!user.roles || user.roles.length === 0)) {
      this.loadUserRolesData(user.id);
    }
  }

  /**
   * Update roles cache when roles are loaded
   */
  updateRolesCache(users: BackendUserDto[], roles: RoleDto[]): void {
    users.forEach(user => {
      if (!user.roles || user.roles.length === 0) {
        this.userRolesMap.set(user.id, this.extractRoleNames(user, roles));
      }
    });
  }

  /**
   * Clear roles cache
   */
  clearRolesCache(): void {
    this.userRolesMap.clear();
  }

  /**
   * Get user name display
   */
  getUserName(user: BackendUserDto): string {
    return user.userName || user.email;
  }

  /**
   * Get user initials
   */
  getUserInitials(user: BackendUserDto): string {
    const name = user.userName || user.email;
    return name.substring(0, 2).toUpperCase();
  }

  /**
   * Get full name (localized)
   */
  getFullName(user: BackendUserDto): string {
    const localizedName = getLocalizedName(user, getCurrentLang(this.translateService));
    return localizedName || user.userName || user.email || '';
  }

  /**
   * Get military ID
   */
  getMilitaryId(user: BackendUserDto): string {
    // Handle both militaryId and militoryId (API typo)
    return user.militaryId || user.militoryId || '-';
  }

  /**
   * Get rank name (localized)
   */
  getRankName(user: BackendUserDto, ranks: LookupItem[]): string {
    if (user.rankNameEn || user.rankNameAr) {
      // Use rankNameEn/rankNameAr directly if available
      const rankNameObj = { nameEn: user.rankNameEn, nameAr: user.rankNameAr };
      return getLocalizedName(rankNameObj, getCurrentLang(this.translateService)) || '-';
    }

    if (!user.rankId) return '-';
    const rank = ranks.find(r => r.id === user.rankId);
    if (!rank) return '-';
    return getLocalizedName(rank, getCurrentLang(this.translateService)) || '-';
  }

  /**
   * Get department name (localized)
   */
  getDepartmentName(user: BackendUserDto, departments: LookupItem[]): string {
    if (!user.departmentId) {
      // Fallback to departmentName if no departmentId
      return user.departmentName || '-';
    }

    // Find department by ID and get localized name
    const department = departments.find(d => d.id === user.departmentId);
    if (department) {
      return getLocalizedName(department, getCurrentLang(this.translateService)) || '-';
    }

    // Fallback to departmentName if department not found in lookup
    return user.departmentName || '-';
  }

  /**
   * Format date for display
   */
  formatDate(date: Date | undefined): string {
    if (!date) return 'Never';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Never';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Get total users count
   */
  getTotalUsers(users: BackendUserDto[]): number {
    return this.userSummary.totalUsers;
  }

  /**
   * Get total active users count
   */
  getTotalActiveUsers(users: BackendUserDto[]): number {
    return this.userSummary.activeUsers;
  }

  /**
   * Get total inactive users count
   */
  getTotalInactiveUsers(users: BackendUserDto[]): number {
    return this.userSummary.inactiveUsers;
  }

  /**
   * Get users observable
   */
  get users$(): Observable<BackendUserDto[]> {
    return this.backendUserService.users$;
  }

  /**
   * Private: Extract role names from user
   */
  private extractRoleNames(user: BackendUserDto, roles: RoleDto[]): string[] {
    const currentLang = getCurrentLang(this.translateService);

    if (user.roles && user.roles.length > 0) {
      return user.roles
        .map(role => getLocalizedName(role, currentLang) || role.name)
        .filter((name): name is string => !!name && name.trim().length > 0);
    }

    if (user.roleIds && user.roleIds.length > 0) {
      return user.roleIds
        .map(roleId => {
          const role = roles.find(r => r.id === roleId);
          return role ? (getLocalizedName(role, currentLang) || role.name) : null;
        })
        .filter((name): name is string => !!name && name.trim().length > 0);
    }

    return [];
  }

  /**
   * Private: Load user roles data
   */
  private loadUserRolesData(userId: string): void {
    this.backendUserService.getUserRoles(userId).subscribe({
      next: (roles) => {
        this.userRolesMap.set(userId, roles.map(r => r.name));
      },
      error: () => {
        this.userRolesMap.set(userId, []);
      }
    });
  }

  onPageChange(page: number): void {
    this.loadUsers(page, this.pageSize, this.searchTerm).subscribe();
  }

  onRowsPerPageChange(rows: number): void {
    this.loadUsers(1, rows, this.searchTerm).subscribe();
  }

  onSearchChange(searchTerm: string): void {
    this.loadUsers(1, this.pageSize, searchTerm).subscribe();
  }
}

