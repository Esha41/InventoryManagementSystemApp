import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { StatusCardComponent, OrderItem } from './components/status-card/status-card.component';
import { BackendAuthService } from '@services/backend-auth.service';

export interface DashboardCard {
  title: string;
  status: 'new-issue' | 'on-progress' | 'completed';
  orders: OrderItem[];
  permissions: string[]; // Required permissions (user needs any of these)
  roles?: string[]; // Optional: specific roles that can see this card
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, TranslateModule, StatusCardComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // All dashboard cards with their permission/role requirements
  private allCards: DashboardCard[] = [
    {
      title: 'dashboard.newIssue',
      status: 'new-issue',
      orders: [
        { orderId: '#0172', requestDate: '25 JULY 2024' },
        { orderId: '#0166', requestDate: '18 APRIL 2024' }
      ],
      permissions: ['request.create', 'request.view'] // Show if user can create or view requests
    },
    {
      title: 'dashboard.onProgress',
      status: 'on-progress',
      orders: [
        { orderId: '#0170', requestDate: '6 MAY 2024' },
        { orderId: '#0169', requestDate: '1 MAY 2024' },
        { orderId: '#0168', requestDate: '24 APRIL 2024' }
      ],
      permissions: ['request.view', 'request.manage'] // Show if user can view or manage requests
    },
    {
      title: 'dashboard.completed',
      status: 'completed',
      orders: [
        { orderId: '#0171', requestDate: '4 JUNE 2024' },
        { orderId: '#0167', requestDate: '20 APRIL 2024' }
      ],
      permissions: ['request.view', 'request.manage'] // Show if user can view or manage requests
    }
  ];

  // Filtered cards based on user permissions and roles
  visibleCards: DashboardCard[] = [];

  constructor(private authService: BackendAuthService) {}

  ngOnInit(): void {
    // Subscribe to user changes and filter cards
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.filterCardsByPermissionsAndRoles();
      });

    // Initial filter
    this.filterCardsByPermissionsAndRoles();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Filter dashboard cards based on user permissions and roles
   * Permissions from ALL user roles are combined by the backend
   */
  private filterCardsByPermissionsAndRoles(): void {
    const user = this.authService.getCurrentUser();
    const isAuthenticated = this.authService.isAuthenticated();
    const hasPermissionsLoaded = user && user.permissions && user.permissions.length > 0;
    const userRoles = user?.roles || [];

    // Debug logging to verify roles and permissions
    console.log('Dashboard Filtering - User Info:', {
      userName: user?.userName,
      userRoles: userRoles,
      totalRoles: userRoles.length,
      totalPermissions: user?.permissions?.length || 0,
      permissions: user?.permissions?.map(p => p.id || p.claimType) || []
    });

    // If not authenticated, show no cards
    if (!isAuthenticated) {
      this.visibleCards = [];
      return;
    }

    // Filter cards based on permissions and roles
    this.visibleCards = this.allCards.filter(card => {
      // If card has role requirements, check roles first
      if (card.roles && card.roles.length > 0) {
        const hasRequiredRole = card.roles.some(requiredRole =>
          userRoles.some(userRole => 
            userRole.toLowerCase() === requiredRole.toLowerCase()
          )
        );
        if (hasRequiredRole) {
          console.log(`Card "${card.title}" visible: User has required role`);
          return true; // User has one of the required roles
        }
      }

      // If card has no permissions requirement, show it (unless roles were specified and didn't match)
      if (!card.permissions || card.permissions.length === 0) {
        // If roles were specified but user doesn't have them, don't show
        return !card.roles || card.roles.length === 0;
      }

      // If permissions haven't loaded yet, don't show cards that require permissions
      if (!hasPermissionsLoaded) {
        console.log(`Card "${card.title}" hidden: Permissions not loaded yet`);
        return false;
      }

      // Check if user has any of the required permissions from ANY role
      // The backend should combine permissions from all roles in user.permissions
      const hasPermission = this.authService.hasAnyPermission(card.permissions);
      
      if (hasPermission) {
        console.log(`Card "${card.title}" visible: User has permission from one of their roles`);
      } else {
        console.log(`Card "${card.title}" hidden: User missing required permissions:`, card.permissions);
        // Debug: Check which permissions user actually has
        const userPermissionIds = user?.permissions?.map(p => p.id || p.claimType).filter(Boolean) || [];
        console.log(`User's actual permissions:`, userPermissionIds);
      }
      
      return hasPermission;
    });

    console.log('Dashboard Filtering Result:', {
      totalCards: this.allCards.length,
      visibleCards: this.visibleCards.length,
      visibleCardTitles: this.visibleCards.map(c => c.title)
    });
  }

  /**
   * Check if a card should be visible
   */
  shouldShowCard(card: DashboardCard): boolean {
    return this.visibleCards.includes(card);
  }
}

