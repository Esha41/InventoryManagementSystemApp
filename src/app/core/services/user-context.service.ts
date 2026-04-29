import { Injectable } from '@angular/core';
import { defer, Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { BackendAuthService } from './backend-auth.service';
import { BackendUserDto } from '@models/backend-user.model';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import { APIOperationResponse } from '@models/api-response.model';
import { decodeJwtPayload } from '@utils/jwt.util';

const ADMIN_PERMISSION_HINTS = [
  PERMISSIONS.ADMIN.SYSTEM_USERS.API_PAGE,
  PERMISSIONS.ADMIN.SYSTEM_USERS.VIEW,
  PERMISSIONS.ADMIN.DASHBOARD.API_PAGE,
  PERMISSIONS.ADMIN.DASHBOARD.API_VIEW
];

type LooseRecord = Record<string, unknown>;

const asRecord = (value: unknown): LooseRecord | null =>
  value !== null && typeof value === 'object' ? (value as LooseRecord) : null;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

@Injectable({
  providedIn: 'root'
})
export class UserContextService {
  private cachedUserDetails$?: Observable<BackendUserDto | null>;

  constructor(
    private readonly authService: BackendAuthService,
    private readonly apiService: ApiService,
    private readonly storageService: StorageService
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

  /** Pre-populate the cache from already-fetched /Users/me data to avoid a redundant network call. */
  primeCache(apiData: unknown): void {
    if (!apiData) return;
    try {
      const apiRecord = asRecord(apiData);
      if (!apiRecord) {
        this.cachedUserDetails$ = undefined;
        return;
      }
      const dto = this.mapApiResponseToDto(apiRecord);
      this.cachedUserDetails$ = of(dto).pipe(shareReplay(1));
    } catch {
      this.cachedUserDetails$ = undefined;
    }
  }

  isAdminUser(): boolean {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) {
      return false;
    }

    // Keep this intentionally strict: "admin user" means super-admin or explicit admin permissions,
    // not a fuzzy match on role names.
    if (this.authService.isSuperAdmin()) {
      return true;
    }

    return this.authService.hasAnyPermission(ADMIN_PERMISSION_HINTS);
  }

  private buildDetailsFromTokenPayload(): BackendUserDto | null {
    const payload = this.decodeTokenPayload() as Record<string, unknown> | null;
    if (!payload) {
      return null;
    }

    const departmentId = this.toNumber(
      payload['DepartmentId'] ??
      payload['departmentId'] ??
      payload['DeptId'] ??
      payload['deptId']
    );

    const nameEn =
      payload['FullNameEN'] ??
      payload['fullNameEN'] ??
      payload['FullNameEn'] ??
      payload['fullNameEn'] ??
      payload['NameEn'] ??
      payload['nameEn'];

    const nameAr =
      payload['FullNameAR'] ??
      payload['fullNameAR'] ??
      payload['FullNameAr'] ??
      payload['fullNameAr'] ??
      payload['NameAr'] ??
      payload['nameAr'];

    return {
      id: String(payload['userId'] || payload['sub'] || ''),
      userName: String(payload['UserName'] || payload['userName'] || payload['unique_name'] || payload['name'] || ''),
      email: String(payload['email'] || payload['Email'] || ''),
      isLdapUser: String(payload['isLdapUser'] || payload['IsLdapUser'] || '').toLowerCase() === 'true',
      roleIds: [],
      departmentId: departmentId ?? undefined,
      departmentName: (payload['DepartmentName'] || payload['departmentName']) as string | undefined,
      nameEn: (nameEn || undefined) as string | undefined,
      nameAr: (nameAr || undefined) as string | undefined,
      isActive: String(payload['isActive'] || payload['IsActive'] || 'true').toLowerCase() === 'true'
    };
  }

  private decodeTokenPayload(): Record<string, unknown> | null {
    const token = this.storageService.get<string>('auth_token');
    return decodeJwtPayload<Record<string, unknown>>(token);
  }

  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private fetchCurrentUserProfile(): Observable<BackendUserDto | null> {
    // Use /Users/me endpoint which returns more complete user data
    return this.apiService.postRaw<unknown>(API_ENDPOINTS.USERS.ME, {}).pipe(
      map(response => {
        const responseRecord = asRecord(response);
        const succeeded = responseRecord?.['succeeded'] === true;
        const data = responseRecord?.['data'];
        if (succeeded && data) {
          const dataRecord = asRecord(data);
          if (!dataRecord) {
            throw new Error('Unexpected /Users/me payload shape');
          }
          // Map the API response to BackendUserDto format
          return this.mapApiResponseToDto(dataRecord);
        }
        const message = typeof responseRecord?.['message'] === 'string'
          ? responseRecord['message']
          : 'Failed to load current user profile';
        throw new Error(message);
      })
    );
  }

  private mapApiResponseToDto(apiData: LooseRecord): BackendUserDto {
    const department = asRecord(apiData['department']);
    const departmentLegacy = asRecord(apiData['Department']);
    const rank = asRecord(apiData['rank']);
    const rankLegacy = asRecord(apiData['Rank']);

    const departmentId = this.toNumber(
      department?.['id'] ??
      departmentLegacy?.['Id'] ??
      apiData['departmentId'] ??
      apiData['DepartmentId']
    );

    const departmentNameEn = asString(
      department?.['nameEn'] ??
      department?.['NameEn'] ??
      departmentLegacy?.['NameEn']
    );

    const departmentNameAr = asString(
      department?.['nameAr'] ??
      department?.['NameAr'] ??
      departmentLegacy?.['NameAr']
    );

    const departmentName = asString(
      departmentNameEn ??
      departmentNameAr ??
      apiData['departmentName'] ??
      apiData['DepartmentName']
    );

    const nameEn = asString(
      apiData['fullNameEN'] ??
      apiData['FullNameEN'] ??
      apiData['fullNameEn'] ??
      apiData['FullNameEn'] ??
      apiData['nameEn'] ??
      apiData['NameEn']
    );

    const nameAr = asString(
      apiData['fullNameAR'] ??
      apiData['FullNameAR'] ??
      apiData['fullNameAr'] ??
      apiData['FullNameAr'] ??
      apiData['nameAr'] ??
      apiData['NameAr']
    );

    const roleIds: string[] = [];
    const normalizedRoles: Array<{
      id: string;
      name: string;
      nameAr: string;
      isAdmin: boolean;
      isDefaultRole: boolean;
      isSuperAdmin: boolean;
    }> = [];

    const rolesArray = apiData['roles'] ?? apiData['Roles'] ?? [];
    if (Array.isArray(rolesArray)) {
      rolesArray.forEach((roleValue: unknown) => {
        const role = asRecord(roleValue);
        if (!role) return;
        const roleId = String(role['id'] ?? role['Id'] ?? '');
        if (roleId !== '') {
          roleIds.push(roleId);
        }
        const isSuperAdmin = Boolean(role['isSuperAdmin'] ?? role['IsSuperAdmin'] ?? false);
        const isAdmin = Boolean(role['isAdmin'] ?? role['IsAdmin'] ?? isSuperAdmin);
        normalizedRoles.push({
          id: roleId,
          name: String(role['name'] ?? role['Name'] ?? ''),
          nameAr: String(role['nameAr'] ?? role['NameAr'] ?? ''),
          isAdmin,
          isDefaultRole: Boolean(role['isDefaultRole'] ?? role['IsDefaultRole'] ?? false),
          isSuperAdmin
        });
      });
    }

    const militaryId = asString(
      apiData['militaryId'] ??
      apiData['MilitaryId'] ??
      apiData['militoryId'] ??
      apiData['MilitoryId']
    );

    const rankId = this.toNumber(
      apiData['rankId'] ??
      apiData['RankId'] ??
      rank?.['id'] ??
      rankLegacy?.['Id']
    );

    const rankNameEn = asString(
      rank?.['nameEn'] ??
      rank?.['NameEn'] ??
      rankLegacy?.['NameEn'] ??
      apiData['rankNameEn'] ??
      apiData['RankNameEn']
    );

    const rankNameAr = asString(
      rank?.['nameAr'] ??
      rank?.['NameAr'] ??
      rankLegacy?.['NameAr'] ??
      apiData['rankNameAr'] ??
      apiData['RankNameAr']
    );

    const defaultRoleId =
      apiData['defaultRoleId'] ??
      apiData['DefaultRoleId'] ??
      undefined;

    return {
      id: String(apiData['id'] ?? apiData['Id'] ?? ''),
      userName: String(apiData['userName'] ?? apiData['UserName'] ?? ''),
      email: String(apiData['email'] ?? apiData['Email'] ?? ''),
      isLdapUser: Boolean(apiData['isLdapUser'] ?? apiData['IsLdapUser'] ?? false),
      ldapUserName: asString(apiData['ldapUserName'] ?? apiData['LdapUserName']),
      extraEmployeesView: asString(apiData['extraEmployeesView'] ?? apiData['ExtraEmployeesView']),
      departmentId: departmentId ?? undefined,
      departmentName: departmentName,
      departmentNameEn: departmentNameEn,
      departmentNameAr: departmentNameAr,
      nameEn: nameEn,
      nameAr: nameAr,
      rankId: rankId ?? undefined,
      rankNameEn: rankNameEn,
      rankNameAr: rankNameAr,
      isActive: Boolean(apiData['isActive'] ?? apiData['IsActive'] ?? true),
      militaryId: militaryId || undefined,
      militoryId: militaryId || undefined,
      roles: normalizedRoles,
      roleIds: roleIds,
      defaultRoleId: defaultRoleId != null && String(defaultRoleId).trim() !== '' ? String(defaultRoleId) : undefined
    };
  }
}


