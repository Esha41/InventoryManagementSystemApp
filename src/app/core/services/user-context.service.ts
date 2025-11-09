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
  'user.view',
  'user.manage',
  'role.view',
  'role.manage',
  'role.edit',
  'permissions.manage',
  'permissions.role'
];

@Injectable({
  providedIn: 'root'
})
export class UserContextService {
  private cachedUserDetails$?: Observable<BackendUserDto | null>;

  constructor(
    private readonly authService: BackendAuthService,
    private readonly apiService: ApiService
  ) {}

  /**
   * Returns detailed information about the currently authenticated user.
   * The result is cached for the lifetime of the service unless forceRefresh is true.
   */
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
        catchError(error => {
          console.error('Failed to load current user details. Falling back to token payload.', error);
          const fallback = this.buildDetailsFromTokenPayload();
          return of(fallback);
        }),
        map(details => details ?? this.buildDetailsFromTokenPayload()),
        shareReplay(1)
      );
    }

    return this.cachedUserDetails$;
  }

  /**
   * Clears the cached user details so they will be reloaded on next request.
   */
  clearCache(): void {
    this.cachedUserDetails$ = undefined;
  }

  /**
   * Determines whether the current user should be treated as an administrator.
   * Uses both role names and known permission hints.
   */
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

  /**
   * Attempts to build a minimal BackendUserDto using the decoded JWT payload.
   * Useful when the caller lacks permission to fetch full user details.
   */
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

    const employeeId = this.toNumber(
      payload.EmployeeId ??
      payload.employeeId
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
      employeeId: employeeId ?? undefined,
      nameEn: nameEn || undefined,
      nameAr: nameAr || undefined,
      organizationId: this.toNumber(
        payload.OrganizationId ??
        payload.organizationId ??
        payload.OrgId ??
        payload.orgId
      ) ?? undefined
    };
  }

  /**
   * Decodes the JWT payload stored in localStorage.
   */
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
    } catch (error) {
      console.error('Failed to decode JWT payload for current user.', error);
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
    return this.apiService.getWithAuth<APIOperationResponse<BackendUserDto>>(API_ENDPOINTS.AUTH.PROFILE).pipe(
      map(response => {
        if (response?.succeeded && response.data) {
          return response.data;
        }
        throw new Error(response?.message || 'Failed to load current user profile');
      })
    );
  }
}


