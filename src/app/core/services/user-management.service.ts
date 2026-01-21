import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BackendUserDto, RoleDto } from '@models/backend-user.model';
import { LookupItem } from '@models/lookup.model';
import { BackendUserService } from './backend-user.service';
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

  constructor(
    private backendUserService: BackendUserService,
    private lookupService: LookupService,
    private translateService: TranslateService
  ) { }

  /**
   * Load all users
   */
  loadUsers(): Observable<BackendUserDto[]> {
    return this.backendUserService.getUsers().pipe(
      map(users => {
        this.userRolesMap.clear();
        users.forEach(user => this.cacheUserRoles(user));
        return users;
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
   * Filter users by search term
   */
  filterUsers(users: BackendUserDto[], searchTerm: string): BackendUserDto[] {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return users;
    }

    return users.filter(user => {
      const name = (user.userName || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      return name.includes(term) || email.includes(term);
    });
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
    return users.length;
  }

  /**
   * Get total active users count
   */
  getTotalActiveUsers(users: BackendUserDto[]): number {
    return users.filter(user => user.isActive).length;
  }

  /**
   * Get total inactive users count
   */
  getTotalInactiveUsers(users: BackendUserDto[]): number {
    return users.filter(user => !user.isActive).length;
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
}

