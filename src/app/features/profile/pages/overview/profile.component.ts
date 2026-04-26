import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, Optional, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, catchError, of, forkJoin } from 'rxjs';
import { map, delay, switchMap } from 'rxjs/operators';
import { LucideAngularModule, User, Users, Mail, Building2, Shield, Hash, Navigation2, Award, Lock, RotateCcw } from 'lucide-angular';
import { BackendAuthService } from '@services/backend-auth.service';
import { AuthenticatedUser, UserRoleDetail } from '@models/auth.model';
import { ChangePasswordRequest } from '@profile/models/change-password.model';
import { UserMeResponse } from '@profile/models/profile.model';
import { TranslationService } from '@services/translation.service';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { mapApiResponseToAuthenticatedUser } from '@utils/profile.mapper';
import { getUserName, getRolesString, getRankName, getDepartmentName, getUserInitials, getActiveRoleDisplay } from '@utils/profile.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { ChangePasswordModalComponent } from '@components/change-password-modal/change-password-modal.component';
import { DelegationListComponent } from './delegation-list/delegation-list.component';
import { ToastService } from '@services/toast.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { ONBOARDING_TOUR } from '@core/tokens/onboarding-tour.token';
import { IOnboardingTourProvider } from '@core/interfaces/onboarding-tour-provider.interface';
import { SwitchRoleModalService } from '@auth/components/switch-role-modal/switch-role-modal.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    LoadingStateComponent,
    ErrorStateComponent,
    ChangePasswordModalComponent,
    DelegationListComponent
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent implements OnInit, OnDestroy {
  readonly User = User;
  readonly Users = Users;
  readonly Mail = Mail;
  readonly Building2 = Building2;
  readonly Shield = Shield;
  readonly Hash = Hash;
  readonly Navigation2 = Navigation2;
  readonly Award = Award;
  readonly Lock = Lock;
  readonly RotateCcw = RotateCcw;

  currentUser: AuthenticatedUser | null = null;
  loading = true;
  error: string | null = null;
  showChangePasswordModal = false;
  changingPassword = false;

  private destroy$ = new Subject<void>();

  constructor(
    private authService: BackendAuthService,
    private apiService: ApiService,
    private translateService: TranslateService,
    private translationService: TranslationService,
    private toastService: ToastService,
    @Optional() @Inject(ONBOARDING_TOUR) private onboardingTourService: IOnboardingTourProvider | null,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private switchRoleModal: SwitchRoleModalService
  ) { }

  ngOnInit(): void {
    this.loadProfile();
  }

  /**
   * Load profile data from API
   */
  loadProfile(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    // Fetch both user profile and user claims (for permissions)
    forkJoin({
      profile: this.apiService.post<UserMeResponse>(API_ENDPOINTS.USERS.ME, {}),
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
          if (!profile) {
            throw new Error('Failed to load profile');
          }
          return mapApiResponseToAuthenticatedUser(profile, claims.permissions || [], this.translateService);
        }),
        catchError(error => {
          this.error = ErrorHandler.extractAndTranslateErrorMessage(error, this.translateService.instant('profile.errorLoadingProfile'), this.translateService);
          this.loading = false;
          this.cdr.markForCheck();
          // Fallback to auth service user if API fails
          this.authService.currentUser$
            .pipe(takeUntil(this.destroy$))
            .subscribe(user => {
              if (user) {
                this.currentUser = user;
                this.cdr.markForCheck();
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
            this.cdr.markForCheck();
          }
        }
      });
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
    return getUserName(this.currentUser, this.translateService);
  }

  /**
   * Get roles as comma-separated string
   */
  getRolesString(): string {
    return getRolesString(this.currentUser, this.translateService);
  }

  /**
   * Get localized rank name
   */
  getRankName(): string {
    return getRankName(this.currentUser, this.translateService);
  }

  /**
   * Get localized department name
   */
  getDepartmentName(): string {
    return getDepartmentName(this.currentUser, this.translateService);
  }

  /**
   * Get user initials for avatar
   */
  getUserInitials(): string {
    return getUserInitials(this.currentUser, this.translateService);
  }

  /** Session / default role label (localized name only, no "Active role" prefix). */
  getSessionRoleDisplay(): string {
    return getActiveRoleDisplay(this.currentUser, this.translateService);
  }

  getRoleDetails(): UserRoleDetail[] {
    return this.currentUser?.roleDetails?.length ? this.currentUser.roleDetails : [];
  }

  /** Show roles block when API/JWT exposed at least one role. */
  hasRolesSection(): boolean {
    return this.getRoleDetails().length > 0 || (this.currentUser?.roles?.length ?? 0) > 0;
  }

  /** When roleDetails are missing, list JWT string role names. */
  getFallbackRoleNames(): string[] {
    return (this.currentUser?.roles || []).filter(r => !!r?.trim());
  }

  roleDisplayName(role: UserRoleDetail): string {
    return getLocalizedName(
      { name: role.name, nameAr: role.nameAr },
      getCurrentLang(this.translateService)
    ) || role.name;
  }

  /** Current session role row (aligned with getActiveRoleDisplay / defaultRoleId). */
  isRoleActive(role: UserRoleDetail): boolean {
    const details = this.currentUser?.roleDetails;
    if (!details?.length) {
      return false;
    }
    const defId = this.currentUser?.defaultRoleId?.toLowerCase().trim();
    if (defId) {
      return (role.id || '').toLowerCase().trim() === defId;
    }
    const flagged = details.find(r => r.isDefaultRole);
    if (flagged) {
      return (role.id || '') === (flagged.id || '');
    }
    return (role.id || '') === (details[0].id || '');
  }

  /** JWT-only role list: mark row that matches session display (see getActiveRoleDisplay). */
  isFallbackRoleActive(name: string): boolean {
    if (this.getRoleDetails().length > 0) {
      return false;
    }
    const session = getActiveRoleDisplay(this.currentUser, this.translateService);
    return !!session && session === name;
  }

  showSwitchRole(): boolean {
    const n = this.getRoleDetails().length || this.currentUser?.roles?.length || 0;
    return n > 1;
  }

  navigateToSwitchRole(): void {
    this.switchRoleModal.open();
  }

  getProfileEmail(): string {
    return this.currentUser?.email || '';
  }

  /**
   * Open change password modal
   */
  openChangePasswordModal(): void {
    this.showChangePasswordModal = true;
    this.cdr.markForCheck();
  }

  /**
   * Close change password modal
   */
  closeChangePasswordModal(): void {
    this.showChangePasswordModal = false;
    this.cdr.markForCheck();
  }

  /**
   * Handle password change submission
   */
  replayTour(): void {
    this.onboardingTourService?.resetTour();
    this.router.navigate(['/dashboard']).then(() => {
      setTimeout(() => this.onboardingTourService?.startTour(), 500);
    });
  }

  onChangePassword(request: ChangePasswordRequest): void {
    this.changingPassword = true;
    this.cdr.markForCheck();

    this.authService.changePassword(request)
      .pipe(
        takeUntil(this.destroy$),
        // Show success toast and wait 2 seconds
        switchMap(() => {
          this.changingPassword = false;
          this.showChangePasswordModal = false;
          this.cdr.markForCheck();

          this.toastService.success(
            this.translateService.instant('profile.changePassword.successMessage'),
            this.translateService.instant('profile.changePassword.successTitle')
          );

          // Use RxJS delay operator instead of setTimeout
          return of(true).pipe(delay(2000));
        }),
        // Then logout
        switchMap(() => this.authService.logout())
      )
      .subscribe({
        next: () => {
          // Use Angular Router instead of window.location
          this.router.navigate(['/auth/login']);
        },
        error: (error) => {
          this.changingPassword = false;
          this.cdr.markForCheck();

          // Only show error if it's from password change, not from logout/navigation
          if (error) {
            const errorMessage = ErrorHandler.extractAndTranslateErrorMessage(error, this.translateService.instant('profile.changePassword.errorMessage'), this.translateService);
            this.toastService.error(
              errorMessage,
              this.translateService.instant('profile.changePassword.errorTitle')
            );
          } else {
            // If logout fails, still navigate to login
            this.router.navigate(['/auth/login']);
          }
        }
      });
  }
}
