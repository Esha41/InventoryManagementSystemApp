import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, SlidersHorizontal } from 'lucide-angular';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PERMISSIONS } from '@constants/permissions.constants';
import { BackendAuthService } from '@services/backend-auth.service';
import { TranslationService } from '@services/translation.service';

interface SettingsNavItem {
  labelKey: string;
  link: string;
  permissions: string[];
}

@Component({
  selector: 'app-settings-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, LucideAngularModule],
  templateUrl: './settings-layout.component.html',
  styleUrls: ['./settings-layout.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsLayoutComponent implements OnInit, OnDestroy {
  readonly SlidersHorizontal = SlidersHorizontal;

  readonly allNavItems: SettingsNavItem[] = [
    {
      labelKey: 'nav.ldapSettings',
      link: 'ldap-settings',
      permissions: [PERMISSIONS.SETTINGS.LDAP.PAGE_NAV],
    },
    {
      labelKey: 'nav.emailSettings',
      link: 'email-settings',
      permissions: [PERMISSIONS.SETTINGS.EMAIL.PAGE, PERMISSIONS.SETTINGS.EMAIL.VIEW],
    },
    {
      labelKey: 'nav.stockNotificationSettings',
      link: 'stock-notification-settings',
      permissions: [PERMISSIONS.SETTINGS.STOCK_NOTIFICATIONS.PAGE],
    },
    {
      labelKey: 'nav.orderAutoRejectSettings',
      link: 'order-auto-reject-settings',
      permissions: [PERMISSIONS.SETTINGS.ORDER_AUTO_REJECT.PAGE],
    },
    {
      labelKey: 'nav.requesterQtyNotifications',
      link: 'requester-qty-notifications',
      permissions: [PERMISSIONS.SETTINGS.REQUESTER_QTY_NOTIFICATIONS.PAGE],
    },
  ];

  visibleNavItems: SettingsNavItem[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private authService: BackendAuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    public translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.refreshNav();
    });
    this.refreshNav();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  private refreshNav(): void {
    const user = this.authService.getCurrentUser();
    const isAuthenticated = this.authService.isAuthenticated();
    const permsLoaded = user?.permissions && user.permissions.length > 0;

    this.visibleNavItems = this.allNavItems.filter(item => {
      if (!item.permissions.length) {
        return true;
      }
      if (!isAuthenticated || !permsLoaded) {
        return false;
      }
      return this.authService.hasAnyPermission(item.permissions);
    });
    this.maybeRedirectToFirstChild();
    this.cdr.markForCheck();
  }

  /** Land on `/settings`: open first allowed submenu page (middle column + content). */
  private maybeRedirectToFirstChild(): void {
    if (!this.visibleNavItems.length) {
      return;
    }
    const path = this.router.url.split('?')[0].replace(/\/$/, '');
    const segments = path.split('/').filter(Boolean);
    if (segments.length !== 1 || segments[0] !== 'settings') {
      return;
    }
    const first = this.visibleNavItems[0].link;
    void this.router.navigate(['/settings', first], { replaceUrl: true });
  }
}
