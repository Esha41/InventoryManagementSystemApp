import { Injectable } from '@angular/core';
import { defer, Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { BackendAuthService } from './backend-auth.service';
import { BackendUserDto } from '@models/backend-user.model';
import { ApiService } from './api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { APIOperationResponse } from '@models/api-response.model';

const ADMIN_ROLE_KEYWORDS = ['admin', 'administrator', 'superadmin', 'super admin'];
const ADMIN_PERMISSION_HINTS = [
  'Permissions.Roles.Page',
  'Permissions.Roles.View',
  'Permissions.Roles.Edit',
  'Permissions.Roles.Create',
  'Permissions.Roles.Delete',
  'Permissions.Roles.Manage'
];

@Injectable({
  providedIn: 'root'
})
export class UserContextService {
  private cachedUserDetails$?: Observable<BackendUserDto | null>;

  constructor(
    private readonly authService: BackendAuthService,
    private readonly apiService: ApiService
  ) { }

  getCurrentUserDetails(forceRefresh: boolean = false): Observable<BackendUserDto | null> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser?.id) {
      return of(null);
    }

    if (forceRefresh) {
      this.cachedUserDetails$ = undefined;
    }

    if (!this.cachedUserDetails$) {
      this.cachedUserDetails$ = defer(() => this.fetchCurrentUserProfile()).pipe(
        catchError(() => {
          const fallback = this.buildDetailsFromTokenPayload();
          return of(fallback);
        }),
        map(details => details ?? this.buildDetailsFromTokenPayload()),
        shareReplay(1)
      );
    }

    return this.cachedUserDetails$;
  }

  clearCache(): void {
    this.cachedUserDetails$ = undefined;
  }

  isAdminUser(): boolean {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) {
      return false;
    }

    const hasAdminRole = (authUser.roles || []).some(role =>
      ADMIN_ROLE_KEYWORDS.some(keyword => role?.toLowerCase().includes(keyword))
    );

    if (hasAdminRole) {
      return true;
    }

    return this.authService.hasAnyPermission(ADMIN_PERMISSION_HINTS);
  }

  private buildDetailsFromTokenPayload(): BackendUserDto | null {
    const payload = this.decodeTokenPayload();
    if (!payload) {
      return null;
    }

    const departmentId = this.toNumber(
      payload.DepartmentId ??
      payload.departmentId ??
      payload.DeptId ??
      payload.deptId
    );

    const nameEn =
      payload.FullNameEN ??
      payload.fullNameEN ??
      payload.FullNameEn ??
      payload.fullNameEn ??
      payload.NameEn ??
      payload.nameEn;

    const nameAr =
      payload.FullNameAR ??
      payload.fullNameAR ??
      payload.FullNameAr ??
      payload.fullNameAr ??
      payload.NameAr ??
      payload.nameAr;

    return {
      id: String(payload.userId || payload.sub || ''),
      userName: String(payload.UserName || payload.userName || payload.unique_name || payload.name || ''),
      email: String(payload.email || payload.Email || ''),
      isLdapUser: String(payload.isLdapUser || payload.IsLdapUser || '').toLowerCase() === 'true',
      roleIds: [],
      departmentId: departmentId ?? undefined,
      departmentName: payload.DepartmentName || payload.departmentName,
      nameEn: nameEn || undefined,
      nameAr: nameAr || undefined,
      isActive: String(payload.isActive || payload.IsActive || 'true').toLowerCase() === 'true',
      organizationId: this.toNumber(
        payload.OrganizationId ??
        payload.organizationId ??
        payload.OrgId ??
        payload.orgId
      ) ?? undefined
    };
  }

  private decodeTokenPayload(): any | null {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      return null;
    }

    try {
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) {
        return null;
      }
      const decoded = atob(payloadBase64);
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  private toNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private fetchCurrentUserProfile(): Observable<BackendUserDto | null> {
    // Use /Users/me endpoint which returns more complete user data
    return this.apiService.postWithAuth<APIOperationResponse<any>>(API_ENDPOINTS.USERS.ME, {}).pipe(
      map(response => {
        if (response?.succeeded && response.data) {
          // Map the API response to BackendUserDto format
          return this.mapApiResponseToDto(response.data);
        }
        throw new Error(response?.message || 'Failed to load current user profile');
      })
    );
  }

  private mapApiResponseToDto(apiData: any): BackendUserDto {
    const departmentId = this.toNumber(
      apiData.department?.id ??
      apiData.Department?.Id ??
      apiData.deparmentId ??
      apiData.DeparmentId ??
      apiData.departmentId ??
      apiData.DepartmentId
    );

    const departmentName = (
      apiData.department?.nameEn ??
      apiData.department?.NameEn ??
      apiData.Department?.NameEn ??
      apiData.department?.nameAr ??
      apiData.department?.NameAr ??
      apiData.Department?.NameAr ??
      apiData.departmentName ??
      apiData.DepartmentName
    ) || undefined;

    const nameEn = (
      apiData.fullNameEN ??
      apiData.FullNameEN ??
      apiData.fullNameEn ??
      apiData.FullNameEn ??
      apiData.nameEn ??
      apiData.NameEn
    ) || undefined;

    const nameAr = (
      apiData.fullNameAR ??
      apiData.FullNameAR ??
      apiData.fullNameAr ??
      apiData.FullNameAr ??
      apiData.nameAr ??
      apiData.NameAr
    ) || undefined;

    const roleIds: string[] = [];
    const normalizedRoles: any[] = [];

    const rolesArray = apiData.roles ?? apiData.Roles ?? [];
    if (Array.isArray(rolesArray)) {
      rolesArray.forEach((role: any) => {
        const roleId = String(role.id ?? role.Id ?? '');
        if (roleId !== '') {
          roleIds.push(roleId);
        }
        normalizedRoles.push({
          id: roleId,
          name: role.name ?? role.Name ?? '',
          isDefaultRole: role.isDefaultRole ?? role.IsDefaultRole ?? false,
          isSuperAdmin: role.isSuperAdmin ?? role.IsSuperAdmin ?? false
        });
      });
    }

    const militaryId =
      apiData.militaryId ??
      apiData.MilitaryId ??
      apiData.militoryId ??
      apiData.MilitoryId;

    const rankId = this.toNumber(
      apiData.rankId ??
      apiData.RankId ??
      apiData.rank?.id ??
      apiData.Rank?.Id
    );

    const rankNameEn =
      apiData.rank?.nameEn ??
      apiData.rank?.NameEn ??
      apiData.Rank?.NameEn ??
      apiData.rankNameEn ??
      apiData.RankNameEn;

    const rankNameAr =
      apiData.rank?.nameAr ??
      apiData.rank?.NameAr ??
      apiData.Rank?.NameAr ??
      apiData.rankNameAr ??
      apiData.RankNameAr;

    return {
      id: String(apiData.id ?? apiData.Id ?? ''),
      userName: String(apiData.userName ?? apiData.UserName ?? ''),
      email: String(apiData.email ?? apiData.Email ?? ''),
      isLdapUser: Boolean(apiData.isLdapUser ?? apiData.IsLdapUser ?? false),
      ldapUserName: apiData.ldapUserName ?? apiData.LdapUserName,
      extraEmployeesView: apiData.extraEmployeesView ?? apiData.ExtraEmployeesView,
      organizationId: this.toNumber(apiData.organizationId ?? apiData.OrganizationId) ?? undefined,
      departmentId: departmentId ?? undefined,
      departmentName: departmentName,
      nameEn: nameEn,
      nameAr: nameAr,
      rankId: rankId ?? undefined,
      rankNameEn: rankNameEn || undefined,
      rankNameAr: rankNameAr || undefined,
      isActive: Boolean(apiData.isActive ?? apiData.IsActive ?? true),
      militaryId: militaryId || undefined,
      militoryId: militaryId || undefined,
      roles: normalizedRoles,
      roleIds: roleIds
    };
  }
}


