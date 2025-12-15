import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, catchError, of, forkJoin } from 'rxjs';
import { map, delay, switchMap } from 'rxjs/operators';
import { LucideAngularModule, User, Mail, Building2, Shield, Hash, Navigation2, Award, Lock } from 'lucide-angular';
import { BackendAuthService } from '@services/backend-auth.service';
import { AuthenticatedUser } from '@models/auth.model';
import { ChangePasswordRequest } from '@models/change-password.model';
import { UserMeResponse } from '@models/profile.model';
import { TranslationService } from '@services/translation.service';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { ApiResponse } from '@models/api-response.model';
import { mapApiResponseToAuthenticatedUser } from '@utils/profile.mapper';
import { getUserName, getRolesString, getRankName, getUserInitials } from '@utils/profile.utils';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { ChangePasswordModalComponent } from '@components/change-password-modal/change-password-modal.component';
import { ToastService } from '@services/toast.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    LoadingStateComponent,
    ErrorStateComponent,
    ChangePasswordModalComponent
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
  readonly Lock = Lock;

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
    private router: Router
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

    // Fetch both user profile and user claims (for permissions)
    forkJoin({
      profile: this.apiService.postWithAuth<ApiResponse<UserMeResponse>>(API_ENDPOINTS.USERS.ME, {}),
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
          return mapApiResponseToAuthenticatedUser(profile.data, claims.permissions || [], this.translateService);
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
   * Get user initials for avatar
   */
  getUserInitials(): string {
    return getUserInitials(this.currentUser, this.translateService);
  }

  /**
   * Open change password modal
   */
  openChangePasswordModal(): void {
    this.showChangePasswordModal = true;
  }

  /**
   * Close change password modal
   */
  closeChangePasswordModal(): void {
    this.showChangePasswordModal = false;
  }

  /**
   * Handle password change submission
   */
  onChangePassword(request: ChangePasswordRequest): void {
    this.changingPassword = true;

    this.authService.changePassword(request)
      .pipe(
        takeUntil(this.destroy$),
        // Show success toast and wait 2 seconds
        switchMap(() => {
          this.changingPassword = false;
          this.showChangePasswordModal = false;

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

          // Only show error if it's from password change, not from logout/navigation
          if (error?.message) {
            const errorMessage = error.message || this.translateService.instant('profile.changePassword.errorMessage');
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
