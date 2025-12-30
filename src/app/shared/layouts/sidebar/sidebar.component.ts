import { Component, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil, filter } from 'rxjs';
import { LucideAngularModule, LayoutDashboard, Users, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, List, Shield, FileText, Plus, TrendingUp, File, RotateCcw, Settings, Warehouse, ClipboardList, Package, Building2, GitBranch, Mail, Upload } from 'lucide-angular';
import { BackendAuthService } from '@services/backend-auth.service';
import { TranslationService } from '@services/translation.service';

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
  imports: [CommonModule, RouterModule, LucideAngularModule, TranslateModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Output() toggleSidebar = new EventEmitter<boolean>();

  isCollapsed = false;
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;
  readonly Package = Package;
  readonly Building2 = Building2;
  readonly GitBranch = GitBranch;
  expandedMenus: Set<string> = new Set();

  private destroy$ = new Subject<void>();

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  // All menu items with permission requirements
  private allMenuItems: MenuItem[] = [
    {
      label: 'nav.dashboard',
      icon: LayoutDashboard,
      route: '/dashboard',
      permissions: ['dashboard_view']
    },
    {
      label: 'nav.inventoryDashboard',
      icon: LayoutDashboard,
      route: '/inventory-dashboard',
      permissions: ['InventoryDashboard']
    },
    // Temporarily commented out - not needed for now but accessible from other routes
    // {
    //   label: 'nav.supplyManagement',
    //   icon: ClipboardList,
    //   route: '/supply-request-management',
    //   permissions: ['inventory.page', 'inventory.view']
    // },
    // {
    //   label: 'nav.supplyOrder',
    //   icon: Package,
    //   route: '/supply-order',
    //   permissions: ['supply.page', 'supply.view']
    // },
    {
      label: 'nav.department',
      icon: Building2,
      permissions: ['allowanceitem.page'],
      children: [
        {
          label: 'nav.allowance',
          route: '/allowance',
          permissions: ['allowanceitem.page']
        }
      ]
    },
    {
      label: 'nav.orderManagement',
      icon: ClipboardList,
      permissions: ['order.create', 'return.create', 'discard.create'],
      children: [
        {
          label: 'nav.newIssueRequest',
          route: '/new-issue-request',
          permissions: ['order.create']
        },
        {
          label: 'nav.returnRequest',
          route: '/return-request',
          permissions: ['return.create']
        },
        {
          label: 'nav.discardRequest',
          route: '/discard-request',
          permissions: ['discard.create']
        }
      ]
    },
    {
      label: 'nav.requestsManagement',
      icon: FileText,
      permissions: ['viewrequest.page', 'viewrequest.view', 'order.view', 'request.page', 'request.view'],
      children: [
        {
          label: 'nav.requestsOverview',
          route: '/requests-management',
          permissions: ['viewrequest.page', 'viewrequest.view', 'order.view', 'request.page', 'request.view']
        },
        {
          label: 'nav.orderReport',
          route: '/requests-management/order-report',
          permissions: ['viewrequest.page', 'viewrequest.view', 'order.view', 'request.page', 'request.view']
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
      route: '/add-asset',
      permissions: ['addnewassetpage.page', 'ammunition.create']
    },
    {
      label: 'nav.assetList',
      icon: List,
      route: '/asset-list',
      permissions: ['ammunition.page']
    },
    // Temporarily commented out - contains dummy data, will be implemented later
    // {
    //   label: 'nav.inventoryForecast',
    //   icon: TrendingUp,
    //   route: '/inventory-forecast',
    //   permissions: ['inventorypage.page', 'inventorypage.view']
    // },
    {
      label: 'nav.inventorySummary',
      icon: Package,
      route: '/inventory-summary',
      permissions: ['inventorypage.page', 'inventorypage.view']
    },
    {
      label: 'nav.warehouse',
      icon: Warehouse,
      route: '/warehouse',
      permissions: ['warehousepage.page', 'warehousepage.view']
    },
    {
      label: 'nav.depotManagement',
      icon: Warehouse,
      route: '/depot-management',
      permissions: ['depots.page', 'depots.view']
    },
    {
      label: 'nav.admin',
      isHeader: true,
      permissions: ['systemusers.page', 'systemusers.view', 'roles.page', 'roles.view']
    },
    {
      label: 'nav.manageAdmins',
      icon: Users,
      route: '/manage-admins',
      permissions: ['systemusers.page', 'systemusers.view']
    },
    {
      label: 'nav.adminRoles',
      icon: Shield,
      route: '/admin-roles',
      permissions: ['roles.page', 'roles.view']
    },
    {
      label: 'nav.rolePermissions',
      icon: Settings,
      route: '/role-permissions',
      permissions: ['roles.edit', 'roles.view']
    },
    {
      label: 'nav.ldapSettings',
      icon: Settings,
      route: '/ldap-settings',
      permissions: ['systemusers.page', 'systemusers.view']
    },
    {
      label: 'nav.emailSettings',
      icon: Mail,
      route: '/email-settings',
      permissions: ['systemusers.page', 'systemusers.view']
    },
    {
      label: 'nav.adminImportExport',
      icon: Upload,
      route: '/admin-import-export',
      permissions: ['systemusers.page', 'systemusers.view']
    },
    {
      label: 'nav.workflow',
      icon: GitBranch,
      route: '/workflow',
      permissions: ['workflowtype.page', 'workflowtype.view']
    }
  ];

  menuItems: MenuItem[] = [];

  constructor(
    private authService: BackendAuthService,
    private router: Router,
    private translationService: TranslationService
  ) { }

  ngOnInit(): void {
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
    // Auto-expand requests management menu if inside its routes
    if (url.startsWith('/requests-management')) {
      this.expandedMenus.add('nav.requestsManagement');
    }
    // Auto-expand department menu if on department/allowance routes
    if (url.startsWith('/allowance') || url.startsWith('/department')) {
      this.expandedMenus.add('nav.department');
    }

    if (url.startsWith('/new-issue-request') || url.startsWith('/return-request') || url.startsWith('/discard-request')) {
      this.expandedMenus.add('nav.orderManagement');
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
      // If item has children, filter the children first
      if (item.children && item.children.length > 0) {
        const filteredChildren = item.children.filter(child => {
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
          // If user doesn't have permission (e.g., 'allowanceitem.page'), child will be filtered out
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
        // Only show parent if at least one child is visible (regardless of parent permissions)
        // Example: If user doesn't have 'allowanceitem.page', the "Allowance" child is filtered out,
        // and the "Department" parent will also be hidden since children.length === 0
        const shouldShow = item.children.length > 0;
        if (item.label === 'nav.warehouse') {
          // Auto-expand warehouse menu if it has visible children
          if (shouldShow && item.children.length > 0) {
            this.expandedMenus.add(item.label);
          }
        }
        return shouldShow;
      }

      return hasPermission;
    });

    // Remove headers that have no children after them
    this.menuItems = this.menuItems.filter((item, index) => {
      if (!item.isHeader) return true;

      // Check if there are any non-header items after this header
      const hasChildren = this.menuItems.slice(index + 1).some(nextItem => !nextItem.isHeader);
      return hasChildren;
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

  showTooltip(event: MouseEvent): void {
    if (!this.isCollapsed) return;

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const tooltip = target.querySelector('.menu-tooltip') as HTMLElement;
    const isRTL = this.translationService.isRTL();

    if (tooltip) {
      // Position tooltip based on RTL/LTR
      if (isRTL) {
        // In RTL, position tooltip to the left of the sidebar
        tooltip.style.left = `${rect.left}px`;
        tooltip.style.right = 'auto';
        tooltip.style.transform = 'translateX(-100%) translateY(-50%)';
        // Add RTL class for arrow direction
        tooltip.classList.add('rtl-tooltip');
        tooltip.classList.remove('ltr-tooltip');
      } else {
        // In LTR, position tooltip to the right of the sidebar
        tooltip.style.left = `${rect.right + 8}px`;
        tooltip.style.right = 'auto';
        tooltip.style.transform = 'translateY(-50%)';
        // Add LTR class for arrow direction
        tooltip.classList.add('ltr-tooltip');
        tooltip.classList.remove('rtl-tooltip');
      }
      tooltip.style.top = `${rect.top + rect.height / 2}px`;
    }
  }

  hideTooltip(): void {
    // Tooltip will hide automatically via CSS group-hover
  }
}
