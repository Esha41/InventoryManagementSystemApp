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
import { ProfileDataService, UserMeResponse } from '@services/profile-data.service';

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
    private translationService: TranslationService,
    private profileDataService: ProfileDataService
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  /**
   * Load profile data from localStorage first, then from API
   */
  loadProfile(): void {
    this.loading = true;
    this.error = null;

    // Try to load from localStorage first using the service
    const cachedProfile = this.profileDataService.getProfile();
    if (cachedProfile) {
      this.currentUser = cachedProfile;
      this.loading = false;
    }

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
          const user = this.mapApiResponseToAuthenticatedUser(profile.data, claims.permissions || []);
          // Save all fields including API response data using the service
          this.profileDataService.saveProfile(user, profile.data);
          return user;
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
                this.profileDataService.saveProfile(user);
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
}

