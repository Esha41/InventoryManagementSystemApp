import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil, filter } from 'rxjs';
import { LucideAngularModule, House, Boxes, Users, ChevronLeft, ChevronRight, List, Badge, FileText, Plus, TrendingUp, Settings, Warehouse, ClipboardList, Package, Building2, BarChart3 } from 'lucide-angular';
import { PERMISSIONS } from '@constants/permissions.constants';
import { BackendAuthService } from '@services/backend-auth.service';
import { TranslationService } from '@services/translation.service';
import { SidebarRailTooltipDirective } from '@shared/ui/sidebar-rail-tooltip/sidebar-rail-tooltip.directive';
import { SidebarCollapsedFlyoutComponent } from '@shared/ui/sidebar-collapsed-flyout/sidebar-collapsed-flyout.component';

interface MenuItem {
  label: string;
  icon?: any;
  route?: string;
  isHeader?: boolean;
  children?: MenuItem[];
  permissions?: string[]; // Required permissions (any of these)
  requireAll?: boolean; // If true, all permissions required
}
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LucideAngularModule,
    TranslateModule,
    SidebarRailTooltipDirective,
    SidebarCollapsedFlyoutComponent,
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit, OnDestroy, OnChanges {
  @Input() mobileOpen = false;
  @Output() closeMobile = new EventEmitter<void>();
  @Output() toggleSidebar = new EventEmitter<boolean>();
  @Input() forceCollapsed: boolean = false;

  isCollapsed = false;
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly Package = Package;
  readonly Building2 = Building2;
  expandedMenus: Set<string> = new Set();

  private destroy$ = new Subject<void>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['forceCollapsed']) {
      if (this.forceCollapsed && !this.isCollapsed) {
        // Force collapse when entering designer
        this.isCollapsed = true;
        this.toggleSidebar.emit(this.isCollapsed);
      } else if (!this.forceCollapsed && this.isCollapsed && changes['forceCollapsed'].previousValue === true) {
        // Expand when navigating back from designer (forceCollapsed changes from true to false)
        this.isCollapsed = false;
        this.toggleSidebar.emit(this.isCollapsed);
      }
    }
  }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  // All menu items with permission requirements
  private allMenuItems: MenuItem[] = [
    {
      label: 'nav.dashboard',
      icon: House,
      route: '/dashboard',
      permissions: [PERMISSIONS.DASHBOARD.VIEW]
    },
    {
      label: 'nav.inventoryDashboard',
      icon: Boxes,
      route: '/inventory-dashboard',
      permissions: [PERMISSIONS.INVENTORY.DASHBOARD_MENU]
    },

    {
      label: 'nav.analytics',
      icon: TrendingUp,
      route: '/admin/analytics-dashboard',
      permissions: [PERMISSIONS.ADMIN.ANALYTICS.PAGE]
    },
    {
      label: 'nav.department',
      icon: Building2,
      permissions: [PERMISSIONS.DEPARTMENT.ALLOWANCE_ITEM.PAGE, PERMISSIONS.DEPARTMENT.ITEM_DEPARTMENT_ASSIGNMENT.PAGE],
      children: [
        {
          label: 'nav.allowance',
          route: '/department/allowance',
          permissions: [PERMISSIONS.DEPARTMENT.ALLOWANCE_ITEM.PAGE]
        },
        {
          label: 'nav.itemDepartmentAssignment',
          route: '/department/item-department-assignment',
          permissions: [PERMISSIONS.DEPARTMENT.ITEM_DEPARTMENT_ASSIGNMENT.PAGE]
        }
      ]
    },
    {
      label: 'nav.requestManagement',
      icon: ClipboardList,
      permissions: [
        PERMISSIONS.REQUESTS.ORDER.PAGE,
        PERMISSIONS.REQUESTS.RETURN_REQUEST.PAGE_NAV,
        // PERMISSIONS.REQUESTS.DISCARD.PAGE_NAV, // discard flow hidden — match commented route in requests.routes.ts
        PERMISSIONS.REQUESTS.REQUEST.PAGE,
        PERMISSIONS.REQUESTS.RECEIVER.PAGE
      ],
      children: [
        {
          label: 'nav.newIssueRequest',
          route: '/requests/new-issue-request',
          permissions: [PERMISSIONS.REQUESTS.ORDER.PAGE]
        },
        {
          label: 'nav.newReturnRequest',
          route: '/requests/return-request',
          permissions: [PERMISSIONS.REQUESTS.RETURN_REQUEST.PAGE_NAV]
        },
        // {
        //   label: 'nav.newDiscardRequest',
        //   route: '/requests/discard-request',
        //   permissions: [PERMISSIONS.REQUESTS.DISCARD.PAGE_NAV]
        // },
        {
          label: 'nav.requestsOverview',
          route: '/requests/requests-management',
          permissions: [PERMISSIONS.REQUESTS.VIEW_REQUEST.PAGE, PERMISSIONS.REQUESTS.REQUEST.PAGE, PERMISSIONS.REQUESTS.RECEIVER.PAGE]
        },
        {
          label: 'nav.orderReport',
          route: '/requests/requests-management/requests-report',
          permissions: [PERMISSIONS.REQUESTS.VIEW_REQUEST.PAGE, PERMISSIONS.REQUESTS.REQUEST.PAGE, PERMISSIONS.REQUESTS.RECEIVER.PAGE]
        }
      ]
    },
    // Temporarily commented out - contains dummy data, will be implemented later
    // {
    //   label: 'nav.forecast',
    //   icon: TrendingUp,
    //   route: '/forecast',
    //   permissions: ['Forecast_view']
    // },
    {
      label: 'nav.inventory',
      isHeader: true
    },
    {
      label: 'nav.addAsset',
      icon: Plus,
      route: '/assets/add-asset',
      permissions: [PERMISSIONS.ASSETS.AMMUNITION.CREATE, PERMISSIONS.ASSETS.WEAPON.CREATE, PERMISSIONS.ASSETS.EXPLOSIVE.CREATE]
    },
    {
      label: 'nav.assetList',
      icon: List,
      route: '/assets/asset-list',
      permissions: [PERMISSIONS.ASSETS.AMMUNITION.PAGE, PERMISSIONS.ASSETS.WEAPON.PAGE, PERMISSIONS.ASSETS.EXPLOSIVE.PAGE]
    },
    {
      label: 'nav.weaponAssetMaster',
      icon: Package,
      route: '/assets/weapon-asset-master',
      permissions: [
        PERMISSIONS.ASSETS.WEAPON_ASSET_MASTER.PAGE,
        PERMISSIONS.ASSETS.ASSET.PAGE,
        PERMISSIONS.ASSETS.ASSET.VIEW
      ]
    },
    // Temporarily commented out - contains dummy data, will be implemented later
    // {
    //   label: 'nav.inventoryForecast',
    //   icon: TrendingUp,
    //   route: '/inventory-forecast',
    //   permissions: ['inventorypage.page', 'inventorypage.view']
    // },
    {
      label: 'nav.warehouse',
      icon: Warehouse,
      route: '/warehouse',
      permissions: [PERMISSIONS.WAREHOUSE.PAGE.PAGE, PERMISSIONS.WAREHOUSE.PAGE.VIEW]
    },
    {
      label: 'nav.depotManagement',
      icon: Warehouse,
      route: '/admin/depot-management',
      permissions: [PERMISSIONS.ADMIN.DEPOTS.PAGE]
    },
    {
      label: 'nav.reports',
      icon: BarChart3,
      permissions: [
        PERMISSIONS.INVENTORY.SUMMARY_REPORT.PAGE,
        PERMISSIONS.INVENTORY.LOW_STOCK_REPORT.PAGE,
        PERMISSIONS.INVENTORY.CRITICAL_STOCK_REPORT.PAGE,
        PERMISSIONS.INVENTORY.EXPIRING_LOTS_REPORT.PAGE,
        PERMISSIONS.REPORTS.DASHBOARD
      ],
      children: [
        {
          label: 'nav.inventoryReports',
          permissions: [PERMISSIONS.INVENTORY.SUMMARY_REPORT.PAGE, PERMISSIONS.INVENTORY.LOW_STOCK_REPORT.PAGE, PERMISSIONS.INVENTORY.CRITICAL_STOCK_REPORT.PAGE, PERMISSIONS.INVENTORY.EXPIRING_LOTS_REPORT.PAGE],
          children: [
            {
              label: 'nav.inventorySummary',
              route: '/inventory-summary',
              permissions: [PERMISSIONS.INVENTORY.SUMMARY_REPORT.PAGE]
            },
            {
              label: 'nav.lowStock',
              route: '/inventory-dashboard/low-stock',
              permissions: [PERMISSIONS.INVENTORY.LOW_STOCK_REPORT.PAGE]
            },
            {
              label: 'nav.criticalStock',
              route: '/inventory-dashboard/critical-stock',
              permissions: [PERMISSIONS.INVENTORY.CRITICAL_STOCK_REPORT.PAGE]
            },
            {
              label: 'nav.expiringLots',
              route: '/inventory-dashboard/expiring-lots',
              permissions: [PERMISSIONS.INVENTORY.EXPIRING_LOTS_REPORT.PAGE]
            }
          ]
        },
        {
          label: 'nav.reportDashboard',
          route: '/reports/report-dashboard',
          permissions: [PERMISSIONS.REPORTS.DASHBOARD]
        }
      ]
    },
    {
      label: 'nav.biTool',
      icon: FileText,
      permissions: [PERMISSIONS.REPORTS.DESIGNER, PERMISSIONS.REPORTS.SCHEDULED],
      children: [
        {
          label: 'nav.reportDesigner',
          route: '/reports/report-designer',
          permissions: [PERMISSIONS.REPORTS.DESIGNER]
        },
        {
          label: 'nav.scheduledReports',
          route: '/reports/scheduled-reports',
          permissions: [PERMISSIONS.REPORTS.SCHEDULED]
        }
      ]
    },
    {
      label: 'nav.admin',
      isHeader: true,
      permissions: [PERMISSIONS.ADMIN.SYSTEM_USERS.PAGE, PERMISSIONS.ADMIN.DASHBOARD.PAGE]
    },
    {
      label: 'nav.adminDashboard',
      icon: Badge,
      route: '/admin/dashboard',
      permissions: [PERMISSIONS.ADMIN.DASHBOARD.PAGE, PERMISSIONS.ADMIN.DASHBOARD.VIEW]
    },
    {
      label: 'nav.manageAdmins',
      icon: Users,
      route: '/admin/manage-admins',
      permissions: [PERMISSIONS.ADMIN.SYSTEM_USERS.PAGE]
    },
    {
      label: 'nav.settingsConfiguration',
      icon: Settings,
      route: '/settings',
      permissions: [
        PERMISSIONS.SETTINGS.LDAP.PAGE_NAV,
        PERMISSIONS.SETTINGS.EMAIL.PAGE,
        PERMISSIONS.SETTINGS.EMAIL.VIEW,
        PERMISSIONS.SETTINGS.STOCK_NOTIFICATIONS.PAGE,
        PERMISSIONS.SETTINGS.ORDER_AUTO_REJECT.PAGE,
        PERMISSIONS.SETTINGS.REQUESTER_QTY_NOTIFICATIONS.PAGE,
        PERMISSIONS.ADMIN.LOOKUP_TABLES.PAGE,
        PERMISSIONS.ADMIN.ROLES.PAGE,
        PERMISSIONS.ADMIN.ROLES.EDIT,
        PERMISSIONS.ADMIN.ROLES.VIEW,
        PERMISSIONS.ADMIN.IMPORT_EXPORT.PAGE,
        PERMISSIONS.ADMIN.HELP_CENTER.PAGE,
        PERMISSIONS.ADMIN.HELP_CENTER.VIEW,
        PERMISSIONS.ADMIN.ANNOUNCEMENTS.PAGE,
        PERMISSIONS.ADMIN.ANNOUNCEMENTS.VIEW,
        PERMISSIONS.WORKFLOW.PAGE,
        PERMISSIONS.WORKFLOW.VIEW,
      ],
    },
  ];

  menuItems: MenuItem[] = [];

  constructor(
    private authService: BackendAuthService,
    private router: Router,
    private translationService: TranslationService
  ) { }

  ngOnInit(): void {
    // Check if sidebar should be force collapsed initially
    if (this.forceCollapsed && !this.isCollapsed) {
      this.isCollapsed = true;
      this.toggleSidebar.emit(this.isCollapsed);
    }

    // Subscribe to user changes and filter menu items
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.filterMenuItems();
      });

    // Subscribe to route changes to auto-expand submenus
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: any) => {
        this.checkAndExpandMenus(event.url);
      });

    // Initial filter and menu expansion check
    this.filterMenuItems();
    this.checkAndExpandMenus(this.router.url);
  }

  private checkAndExpandMenus(url: string): void {
    // Auto-expand warehouse menu if on warehouse routes
    if (url.startsWith('/warehouse')) {
      this.expandedMenus.add('nav.warehouse');
    }
    // Auto-expand department menu if on department routes
    if (url.startsWith('/department')) {
      this.expandedMenus.add('nav.department');
    }

    // Auto-expand reports menu if on report routes
    if (
      url.startsWith('/inventory-summary') ||
      url.startsWith('/inventory-dashboard/low-stock') ||
      url.startsWith('/inventory-dashboard/critical-stock') ||
      url.startsWith('/inventory-dashboard/expiring-lots')
    ) {
      this.expandedMenus.add('nav.reports');
      this.expandedMenus.add('nav.inventoryReports');
    }
    if (url.startsWith('/reports/report-dashboard')) {
      this.expandedMenus.add('nav.reports');
    }

    if (
      url.startsWith('/requests/new-issue-request') ||
      url.startsWith('/requests/return-request') ||
      // url.startsWith('/requests/discard-request') ||
      url.startsWith('/requests/requests-management')
    ) {
      this.expandedMenus.add('nav.requestManagement');
    }

    // Auto-expand BI Tool menu if on report designer or scheduled reports route
    if (url.startsWith('/reports/report-designer') || url.startsWith('/reports/scheduled-reports')) {
      this.expandedMenus.add('nav.biTool');
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Filter menu items based on user permissions
   * Sidebar is always visible, but menu items are filtered by permissions
   */
  private filterMenuItems(): void {
    const user = this.authService.getCurrentUser();
    const isAuthenticated = this.authService.isAuthenticated();
    const hasPermissionsLoaded = user && user.permissions && user.permissions.length > 0;

    // Filter menu items - sidebar always shows, but items are filtered by permissions
    this.menuItems = this.allMenuItems.map(item => {
      // If item has children, filter the children first (including nested children)
      if (item.children && item.children.length > 0) {
        const filteredChildren = item.children.map(child => {
          // If child has nested children, filter them recursively
          if (child.children && child.children.length > 0) {
            const filteredNestedChildren = child.children.filter(nestedChild => {
              // Headers are always shown
              if (nestedChild.isHeader) {
                return true;
              }
              // Nested children without permissions inherit parent visibility
              if (!nestedChild.permissions || nestedChild.permissions.length === 0) {
                return true;
              }
              if (!isAuthenticated) {
                return false;
              }
              if (!hasPermissionsLoaded) {
                return false;
              }
              const hasNestedPermission = nestedChild.requireAll
                ? this.authService.hasAllPermissions(nestedChild.permissions)
                : this.authService.hasAnyPermission(nestedChild.permissions);
              return hasNestedPermission;
            });
            return { ...child, children: filteredNestedChildren };
          }
          // Regular child without nested children
          return child;
        }).filter(child => {
          // Headers are always shown (they don't have routes or permissions)
          if (child.isHeader) {
            return true;
          }
          // If child has nested children, only show if at least one nested child is visible
          if (child.children && child.children.length > 0) {
            const visibleNestedChildren = child.children.filter(nc => !nc.isHeader).length;
            return visibleNestedChildren > 0;
          }
          // Children without permissions inherit parent visibility
          if (!child.permissions || child.permissions.length === 0) {
            return true;
          }
          // If not authenticated, don't show children with permissions
          if (!isAuthenticated) {
            return false;
          }
          // If permissions haven't loaded yet, don't show children that require permissions
          if (!hasPermissionsLoaded) {
            return false;
          }
          // Check if user has required permissions for child
          const hasChildPermission = child.requireAll
            ? this.authService.hasAllPermissions(child.permissions)
            : this.authService.hasAnyPermission(child.permissions);
          return hasChildPermission;
        });

        // Return item with filtered children
        return { ...item, children: filteredChildren };
      }
      return item;
    }).filter(item => {
      // Items without permissions (like Dashboard) are always visible
      if (!item.permissions || item.permissions.length === 0) {
        // But if it has children, only show if at least one child is visible
        if (item.children && item.children.length > 0) {
          return item.children.length > 0;
        }
        return true;
      }

      // If not authenticated, don't show items with permissions
      if (!isAuthenticated) {
        return false;
      }

      // If permissions haven't loaded yet, don't show items that require permissions
      // This prevents briefly showing all items before permissions are checked
      if (!hasPermissionsLoaded) {
        return false;
      }

      // Check if user has required permissions
      const hasPermission = item.requireAll
        ? this.authService.hasAllPermissions(item.permissions)
        : this.authService.hasAnyPermission(item.permissions);



      // If item has children, only show it if at least one child is visible
      // This ensures parent menus (like "Department") are hidden when all children 
      // (like "Allowance") are filtered out due to missing permissions
      if (item.children && item.children.length > 0) {
        // Count only non-header children (headers don't count as visible items)
        // For nested children, count children that have visible nested children
        const visibleNonHeaderChildren = item.children.filter(child => {
          if (child.isHeader) return false;
          // If child has nested children, check if any nested child is visible
          if (child.children && child.children.length > 0) {
            return child.children.filter(nc => !nc.isHeader).length > 0;
          }
          return true;
        }).length;
        // Only show parent if at least one non-header child is visible (regardless of parent permissions)
        const shouldShow = visibleNonHeaderChildren > 0;
        // Auto-expand warehouse and inventory menus if they have visible children
        // Reports should remain collapsed by default and only expand when on report routes
        if (item.label === 'nav.warehouse' || item.label === 'nav.inventory') {
          // Auto-expand menu if it has visible children
          if (shouldShow && visibleNonHeaderChildren > 0) {
            this.expandedMenus.add(item.label);
          }
        }
        return shouldShow;
      }

      return hasPermission;
    });

    // Remove headers that have no visible items after them
    // Headers should only be shown if there's at least one visible menu item following them
    // (before the next header, which marks a new section)
    this.menuItems = this.menuItems.filter((item, index) => {
      // Keep all non-header items
      if (!item.isHeader) return true;

      // For headers, check if there are any visible items after this header
      // Look at all items after this header until we hit another header
      for (let i = index + 1; i < this.menuItems.length; i++) {
        const nextItem = this.menuItems[i];
        // If we hit another header, this section has no items - remove this header
        if (nextItem.isHeader) {
          return false;
        }
        // Found a visible non-header item - keep this header
        return true;
      }
      // Reached end of list with no items after header - remove this header
      return false;
    });


  }

  /**
   * Check if user has permission to access a menu item
   */
  hasPermission(item: MenuItem): boolean {
    if (!item.permissions || item.permissions.length === 0) {
      return true;
    }

    if (item.requireAll) {
      return this.authService.hasAllPermissions(item.permissions);
    } else {
      return this.authService.hasAnyPermission(item.permissions);
    }
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.toggleSidebar.emit(this.isCollapsed);
  }

  onParentSubmenuClick(_event: MouseEvent, label: string): void {
    if (!this.isCollapsed) {
      this.toggleSubmenu(label);
    }
  }

  isSubmenuRouteActive(item: MenuItem): boolean {
    const url = this.router.url.split('?')[0];
    return this.menuItemContainsRoute(item, url);
  }

  private menuItemContainsRoute(item: MenuItem, url: string): boolean {
    if (item.route && (url === item.route || url.startsWith(item.route + '/'))) {
      return true;
    }
    return (item.children ?? []).some(child => this.menuItemContainsRoute(child, url));
  }

  onCloseMobile(): void {
    this.closeMobile.emit();
  }

  toggleSubmenu(label: string): void {
    if (this.expandedMenus.has(label)) {
      this.expandedMenus.delete(label);
    } else {
      this.expandedMenus.add(label);
    }
  }

  isSubmenuExpanded(label: string): boolean {
    return this.expandedMenus.has(label);
  }

  hasChildren(item: MenuItem): boolean {
    return !!(item.children && item.children.length > 0);
  }
}
