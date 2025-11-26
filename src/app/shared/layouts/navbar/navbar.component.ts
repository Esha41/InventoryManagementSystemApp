import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, Bell, User, Globe, LogOut, ChevronDown } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { UserContextService } from '@services/user-context.service';
import { AuthenticatedUser } from '@models/auth.model';
import { BackendUserDto } from '@models/backend-user.model';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationService } from '@services/notification.service';

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
    private notificationService: NotificationService
  ) {}

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
    // Prefer nameEn or nameAr from user details, fallback to userName
    if (this.userDetails?.nameEn) {
      return this.userDetails.nameEn;
    }
    if (this.userDetails?.nameAr) {
      return this.userDetails.nameAr;
    }
    if (this.currentUser?.nameEn) {
      return this.currentUser.nameEn;
    }
    if (this.currentUser?.nameAr) {
      return this.currentUser.nameAr;
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
      return this.userDetails.roles[0].name || 'User';
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
}
