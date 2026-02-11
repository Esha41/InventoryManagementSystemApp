import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, Bell, User, Globe, LogOut, ChevronDown, Moon, Sun, Menu } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { UserContextService } from '@services/user-context.service';
import { AuthenticatedUser } from '@models/auth.model';
import { BackendUserDto } from '@models/backend-user.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NotificationService } from '@services/notification.service';
import { ThemeService } from '@services/theme.service';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit, OnDestroy {
  readonly Bell = Bell;
  readonly User = User;
  readonly Globe = Globe;
  readonly LogOut = LogOut;
  readonly ChevronDown = ChevronDown;
  readonly Moon = Moon;
  readonly Sun = Sun;
  readonly Menu = Menu;

  @Output() menuClick = new EventEmitter<void>();

  currentUser: AuthenticatedUser | null = null;
  userDetails: BackendUserDto | null = null;
  showUserMenu = false;
  notificationCount = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    public translationService: TranslationService,
    private authService: BackendAuthService,
    private userContextService: UserContextService,
    private notificationService: NotificationService,
    private translateService: TranslateService,
    public themeService: ThemeService
  ) { }

  ngOnInit(): void {
    this.notificationService.initialize();

    // Register userContextService with authService for cache clearing
    this.authService.setUserContextService(this.userContextService);

    // Subscribe to current user changes and refresh user details
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        // Refresh user details when user changes (force refresh to clear cache)
        if (user) {
          this.userContextService.getCurrentUserDetails(true)
            .pipe(takeUntil(this.destroy$))
            .subscribe(details => {
              this.userDetails = details;
            });
        } else {
          this.userDetails = null;
        }
      });

    this.notificationService.unreadCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => {
        this.notificationCount = count ?? 0;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getUserFullName(): string {
    // Prefer userDetails, fallback to currentUser
    const user = this.userDetails || this.currentUser;
    if (user) {
      const localizedName = getLocalizedName(user, getCurrentLang(this.translateService));
      if (localizedName) {
        return localizedName;
      }
    }
    return this.currentUser?.userName || this.userDetails?.userName || 'User';
  }

  getUserInitials(): string {
    const fullName = this.getUserFullName();
    if (!fullName || fullName === 'User') {
      return 'U';
    }

    // Remove email-like patterns and split by space
    const cleanName = fullName.split('@')[0].trim();
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

  getUserRole(): string {
    // Try to get role from user details first
    if (this.userDetails?.roles && this.userDetails.roles.length > 0) {
      const role = this.userDetails.roles[0];
      return getLocalizedName(role, getCurrentLang(this.translateService)) || role.name || 'User';
    }
    return this.currentUser?.roles?.[0] || 'User';
  }

  getUserEmail(): string {
    return this.userDetails?.email || this.currentUser?.email || '';
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  closeUserMenu(): void {
    this.showUserMenu = false;
  }

  navigateToNotifications(): void {
    this.router.navigate(['/notifications']);
    this.closeUserMenu();
  }

  navigateToProfile(): void {
    this.router.navigate(['/profile']);
    this.closeUserMenu();
  }

  toggleLanguage(): void {
    this.translationService.toggleLanguage();
  }

  getCurrentLanguage(): string {
    return this.translationService.getCurrentLanguage().toUpperCase();
  }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  get isDarkMode(): boolean {
    return this.themeService.isDarkMode();
  }

  logout(): void {
    this.closeUserMenu();

    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/auth/login']);
      },
      error: (error) => {
        // Even if there's an error, redirect to login
        this.router.navigate(['/auth/login']);
      }
    });
  }

  onMenuClick(): void {
    this.menuClick.emit();
  }
}
