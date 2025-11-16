import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, Bell, User, Globe, LogOut, ChevronDown } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { AuthenticatedUser } from '@models/auth.model';
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
  showUserMenu = false;
  notificationCount = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    public translationService: TranslationService,
    private authService: BackendAuthService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.notificationService.initialize();

    // Subscribe to current user changes
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
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
    return this.currentUser?.userName || 'User';
  }

  getUserInitials(): string {
    if (!this.currentUser) return 'U';
    const name = this.currentUser.userName;
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name[0]?.toUpperCase() || 'U';
  }

  getUserRole(): string {
    return this.currentUser?.roles?.[0] || 'User';
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
