import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, catchError, of, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { LucideAngularModule, User, Mail, Building2, Shield, Hash, Navigation2, Award } from 'lucide-angular';
import { BackendAuthService } from '@services/backend-auth.service';
import { AuthenticatedUser, ClaimDto } from '@models/auth.model';
import { TranslationService } from '@services/translation.service';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { ApiResponse } from '@models/api-response.model';

// Interface for the API response from /Users/me
interface UserMeResponse {
  id: string;
  userName: string;
  email: string;
  isLdapUser?: boolean;
  ldapUserName?: string;
  isSuperAdmin?: boolean;
  extraEmployeesView?: string;
  deparmentId?: number | null; // Note: API has typo "deparmentId"
  roles?: Array<{ id: string; name: string }>;
  fullNameEN?: string;
  fullNameAR?: string;
  rankId?: number | null;
  militoryId?: string | number | null; // Note: API has typo "militoryId"
  department?: {
    id: number;
    code?: string;
    nameEn?: string;
    nameAr?: string;
    isDeleted?: boolean;
  };
  rank?: {
    id: number;
    nameEn?: string;
    nameAr?: string;
    isDeleted?: boolean;
  };
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit, OnDestroy {
  readonly User = User;
  readonly Mail = Mail;
  readonly Building2 = Building2;
  readonly Shield = Shield;
  readonly Hash = Hash;
  readonly Navigation2 = Navigation2;
  readonly Award = Award;

  currentUser: AuthenticatedUser | null = null;
  loading = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private authService: BackendAuthService,
    private apiService: ApiService,
    private translateService: TranslateService,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  /**
   * Load profile data from API
   */
  loadProfile(): void {
    this.loading = true;
    this.error = null;

    // Fetch both user profile and user claims (for permissions)
    forkJoin({
      profile: this.apiService.getWithAuth<ApiResponse<UserMeResponse>>(API_ENDPOINTS.USERS.ME),
      claims: this.authService.getUserClaims().pipe(
        catchError(() => {
          // If getUserClaims fails, return empty permissions
          return of({
            id: '',
            userName: '',
            email: '',
            roles: [],
            permissions: []
          } as AuthenticatedUser);
        })
      )
    })
      .pipe(
        takeUntil(this.destroy$),
        map(({ profile, claims }) => {
          if (!profile.succeeded || !profile.data) {
            throw new Error(profile.message || 'Failed to load profile');
          }
          return this.mapApiResponseToAuthenticatedUser(profile.data, claims.permissions || []);
        }),
        catchError(error => {
          this.error = error?.message || this.translateService.instant('profile.errorLoadingProfile');
          this.loading = false;
          // Fallback to auth service user if API fails
          this.authService.currentUser$
            .pipe(takeUntil(this.destroy$))
            .subscribe(user => {
              if (user) {
                this.currentUser = user;
              }
            });
          return of(null);
        })
      )
      .subscribe({
        next: (user) => {
          if (user) {
            this.currentUser = user;
            this.loading = false;
          }
        }
      });
  }

  /**
   * Map API response to AuthenticatedUser
   */
  private mapApiResponseToAuthenticatedUser(apiUser: UserMeResponse, permissions: ClaimDto[] = []): AuthenticatedUser {
    // Extract role names from roles array
    const roleNames: string[] = apiUser.roles
      ? apiUser.roles.map(role => role.name).filter(name => !!name)
      : [];

    // Extract department name from nested department object
    const departmentName = apiUser.department
      ? (this.translateService.currentLang === 'ar' && apiUser.department.nameAr
          ? apiUser.department.nameAr
          : apiUser.department.nameEn) || apiUser.department.nameEn || apiUser.department.nameAr
      : undefined;

    // Get department ID from nested object or from deparmentId field (handle API typo)
    const departmentId = apiUser.department?.id ?? apiUser.deparmentId ?? undefined;

    // Extract rank name from nested rank object
    const rankNameEn = apiUser.rank?.nameEn ?? undefined;
    const rankNameAr = apiUser.rank?.nameAr ?? undefined;
    const rankId = apiUser.rank?.id ?? apiUser.rankId ?? undefined;

    // Handle military ID - can be string or number from API, filter out empty strings
    const militaryId = apiUser.militoryId !== null && apiUser.militoryId !== undefined && apiUser.militoryId !== ''
      ? String(apiUser.militoryId)
      : undefined;

    return {
      id: apiUser.id,
      userName: apiUser.userName || '',
      email: apiUser.email || '',
      roles: roleNames,
      permissions: permissions || [],
      isLdapUser: apiUser.isLdapUser || false,
      ldapUserName: apiUser.ldapUserName ?? undefined,
      organizationId: undefined, // Not in API response
      departmentId: departmentId,
      departmentName: departmentName,
      nameEn: apiUser.fullNameEN ?? undefined,
      nameAr: apiUser.fullNameAR ?? undefined,
      rankId: rankId,
      rankNameEn: rankNameEn,
      rankNameAr: rankNameAr,
      militaryId: militaryId
    };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  /**
   * Get localized user name
   */
  getUserName(): string {
    if (!this.currentUser) return '';
    const currentLang = this.translateService.currentLang || 'en';
    if (currentLang === 'ar' && this.currentUser.nameAr) {
      return this.currentUser.nameAr;
    }
    return this.currentUser.nameEn || this.currentUser.userName || '';
  }

  /**
   * Get roles as comma-separated string
   */
  getRolesString(): string {
    if (!this.currentUser || !this.currentUser.roles || this.currentUser.roles.length === 0) {
      return this.translateService.instant('profile.noRoles');
    }
    return this.currentUser.roles.join(', ');
  }

  /**
   * Get localized rank name
   */
  getRankName(): string {
    if (!this.currentUser) return '';
    const currentLang = this.translateService.currentLang || 'en';
    if (currentLang === 'ar' && this.currentUser.rankNameAr) {
      return this.currentUser.rankNameAr;
    }
    return this.currentUser.rankNameEn || '';
  }

  /**
   * Get user initials for avatar
   */
  getUserInitials(): string {
    if (!this.currentUser) return 'U';
    
    const name = this.getUserName();
    if (!name || name === '') {
      return this.currentUser.userName?.[0]?.toUpperCase() || 'U';
    }
    
    // Remove email-like patterns and split by space
    const cleanName = name.split('@')[0].trim();
    const parts = cleanName.split(/\s+/);
    
    if (parts.length >= 2) {
      // Get first letter of first and last name
      const first = parts[0][0]?.toUpperCase() || '';
      const last = parts[parts.length - 1][0]?.toUpperCase() || '';
      return (first + last) || 'U';
    }
    
    // Single name - use first two letters if available
    if (cleanName.length >= 2) {
      return cleanName.substring(0, 2).toUpperCase();
    }
    
    return cleanName[0]?.toUpperCase() || 'U';
  }
}

