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
import { LucideAngularModule, Settings, ChevronLeft, ChevronRight, Database, Badge, Shield, GitBranch, Upload, BookMarked, Megaphone, Bell, Timer, BellRing, Server, Mail } from 'lucide-angular';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PERMISSIONS } from '@constants/permissions.constants';
import { BackendAuthService } from '@services/backend-auth.service';
import { TranslationService } from '@services/translation.service';
import { SidebarRailTooltipDirective } from '@shared/ui/sidebar-rail-tooltip/sidebar-rail-tooltip.directive';

interface SettingsNavItem {
  labelKey: string;
  /** One or more path segments under `/settings/` (e.g. `ldap-settings`, `announcements/create`). */
  link: string;
  permissions: string[];
  /** Shown in the collapsed rail (same pattern as main sidebar). */
  icon: any;
}

@Component({
  selector: 'app-settings-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, LucideAngularModule, SidebarRailTooltipDirective],
  templateUrl: './settings-layout.component.html',
  styleUrls: ['./settings-layout.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsLayoutComponent implements OnInit, OnDestroy {
  readonly Settings = Settings;
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;

  private readonly innerNavStorageKey = 'settings-inner-nav-collapsed';

  /** Narrow “icon rail” on md+; full labels when expanded. */
  innerNavCollapsed = false;

  readonly allNavItems: SettingsNavItem[] = [
    {
      labelKey: 'nav.lookupTables',
      link: 'lookup-tables',
      permissions: [PERMISSIONS.ADMIN.LOOKUP_TABLES.PAGE],
      icon: Database,
    },
    {
      labelKey: 'nav.adminRoles',
      link: 'roles',
      permissions: [PERMISSIONS.ADMIN.ROLES.PAGE, PERMISSIONS.ADMIN.ROLES.VIEW],
      icon: Badge,
    },
    {
      labelKey: 'nav.rolePermissions',
      link: 'role-permissions',
      permissions: [PERMISSIONS.ADMIN.ROLES.EDIT, PERMISSIONS.ADMIN.ROLES.VIEW],
      icon: Shield,
    },
    {
      labelKey: 'nav.workflow',
      link: 'workflow',
      permissions: [PERMISSIONS.WORKFLOW.PAGE, PERMISSIONS.WORKFLOW.VIEW],
      icon: GitBranch,
    },
    {
      labelKey: 'nav.adminImportExport',
      link: 'import-export',
      permissions: [PERMISSIONS.ADMIN.IMPORT_EXPORT.PAGE],
      icon: Upload,
    },
    {
      labelKey: 'nav.helpCenterAdmin',
      link: 'help-center',
      permissions: [PERMISSIONS.ADMIN.HELP_CENTER.PAGE, PERMISSIONS.ADMIN.HELP_CENTER.VIEW],
      icon: BookMarked,
    },
    {
      labelKey: 'nav.announcements',
      link: 'announcements',
      permissions: [PERMISSIONS.ADMIN.ANNOUNCEMENTS.PAGE, PERMISSIONS.ADMIN.ANNOUNCEMENTS.VIEW],
      icon: Megaphone,
    },
    {
      labelKey: 'nav.stockNotificationSettings',
      link: 'stock-notification-settings',
      permissions: [PERMISSIONS.SETTINGS.STOCK_NOTIFICATIONS.PAGE],
      icon: Bell,
    },
    {
      labelKey: 'nav.orderAutoRejectSettings',
      link: 'order-auto-reject-settings',
      permissions: [PERMISSIONS.SETTINGS.ORDER_AUTO_REJECT.PAGE],
      icon: Timer,
    },
    {
      labelKey: 'nav.requesterQtyNotifications',
      link: 'requester-qty-notifications',
      permissions: [PERMISSIONS.SETTINGS.REQUESTER_QTY_NOTIFICATIONS.PAGE],
      icon: BellRing,
    },
    {
      labelKey: 'nav.ldapSettings',
      link: 'ldap-settings',
      permissions: [PERMISSIONS.SETTINGS.LDAP.PAGE_NAV],
      icon: Server,
    },
    {
      labelKey: 'nav.emailSettings',
      link: 'email-settings',
      permissions: [PERMISSIONS.SETTINGS.EMAIL.PAGE, PERMISSIONS.SETTINGS.EMAIL.VIEW],
      icon: Mail,
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
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(this.innerNavStorageKey);
      if (stored === '1') {
        this.innerNavCollapsed = true;
      }
    }
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

  toggleInnerNav(): void {
    this.innerNavCollapsed = !this.innerNavCollapsed;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.innerNavStorageKey, this.innerNavCollapsed ? '1' : '0');
    }
    this.cdr.markForCheck();
  }

  /** Router link commands for a settings sidebar entry. */
  navUrl(item: SettingsNavItem): string[] {
    return ['/settings', ...item.link.split('/').filter(Boolean)];
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
    void this.router.navigate(['/settings', ...first.split('/').filter(Boolean)], { replaceUrl: true });
  }
}
