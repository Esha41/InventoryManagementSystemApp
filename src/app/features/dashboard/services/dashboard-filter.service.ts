/**
 * Dashboard Filter Service
 * Handles filtering and sorting logic for dashboard cards
 */

import { Injectable } from '@angular/core';
import { BackendAuthService } from '@services/backend-auth.service';
import { DashboardCard } from '@models/dashboard.model';
import { CardStatus } from '@utils/dashboard.utils';
import { OrderItem } from '@dashboard/pages/overview/components/status-card/status-card.component';

export interface FilterOptions {
  statusFilter: CardStatus | 'all' | 'action-required';
  searchQuery: string;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
}

export interface FilterResult {
  filteredCards: DashboardCard[];
  showContactAdminNotice: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardFilterService {
  constructor(private readonly authService: BackendAuthService) {}

  /**
   * Filter cards by permissions, roles, status, search, and apply sorting
   */
  filterCards(
    allCards: DashboardCard[],
    options: FilterOptions
  ): FilterResult {
    const user = this.authService.getCurrentUser();
    const isAuthenticated = this.authService.isAuthenticated();
    const hasPermissionsLoaded = user?.permissions && user.permissions.length > 0;
    const userRoles = user?.roles || [];

    if (!isAuthenticated) {
      return {
        filteredCards: [],
        showContactAdminNotice: false
      };
    }

    // Filter by permissions and roles
    let filteredCards = allCards.filter(card => {
      if (card.roles && card.roles.length > 0) {
        const hasRequiredRole = card.roles.some(requiredRole =>
          userRoles.some(userRole =>
            userRole.toLowerCase() === requiredRole.toLowerCase()
          )
        );
        if (hasRequiredRole) {
          return true;
        }
      }

      if (!card.permissions || card.permissions.length === 0) {
        return !card.roles || card.roles.length === 0;
      }

      if (!hasPermissionsLoaded) {
        return false;
      }

      return this.authService.hasAnyPermission(card.permissions);
    });

    // Apply status filter
    if (options.statusFilter !== 'all') {
      if (options.statusFilter === 'action-required') {
        filteredCards = filteredCards.filter(card => card.isMyTurn);
      } else {
        filteredCards = filteredCards.filter(card => card.status === options.statusFilter);
      }
    }

    // Apply search filter
    if (options.searchQuery && options.searchQuery.trim().length > 0) {
      const query = options.searchQuery.trim().toLowerCase();
      filteredCards = filteredCards.filter(card => {
        // Search in order IDs, department names, requester names
        return card.orders.some((order: OrderItem) =>
          (order.orderId && order.orderId.toLowerCase().includes(query)) ||
          (order.departmentName && order.departmentName.toLowerCase().includes(query)) ||
          (order.departmentNameEn && order.departmentNameEn.toLowerCase().includes(query)) ||
          (order.departmentNameAr && order.departmentNameAr.toLowerCase().includes(query)) ||
          (order.requesterName && order.requesterName.toLowerCase().includes(query)) ||
          (order.requesterNameEn && order.requesterNameEn.toLowerCase().includes(query)) ||
          (order.requesterNameAr && order.requesterNameAr.toLowerCase().includes(query))
        );
      });
    }

    // Apply sorting
    if (options.sortColumn) {
      filteredCards = this.sortCards(filteredCards, options.sortColumn, options.sortDirection);
    }

    const permissionsArray = Array.isArray(user?.permissions) ? user.permissions : [];
    const showContactAdminNotice = isAuthenticated && permissionsArray.length === 0 && filteredCards.length === 0;

    return {
      filteredCards,
      showContactAdminNotice
    };
  }

  /**
   * Sort cards based on column and direction
   */
  sortCards(cards: DashboardCard[], column: string, direction: 'asc' | 'desc'): DashboardCard[] {
    const sorted = [...cards];
    sorted.sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (column) {
        case 'orderNumber':
          valA = a.orders[0]?.orderId || a.title || '';
          valB = b.orders[0]?.orderId || b.title || '';
          break;
        case 'usageDate': {
          valA = a.orders[0]?.requestDate || '';
          valB = b.orders[0]?.requestDate || '';
          const dateA = this.parseDate(valA);
          const dateB = this.parseDate(valB);
          if (dateA && dateB) {
            return direction === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
          }
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
          break;
        }
        case 'department':
          valA = a.orders[0]?.departmentName || 'N/A';
          valB = b.orders[0]?.departmentName || 'N/A';
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
          break;
        case 'requester':
          valA = a.orders[0]?.requesterName || 'N/A';
          valB = b.orders[0]?.requesterName || 'N/A';
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
          break;
        case 'status':
          valA = a.status || '';
          valB = b.status || '';
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
          break;
        default:
          return 0;
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }

  /**
   * Parse date string to Date object
   * Handles various date formats including DD/MM/YYYY, MM/DD/YYYY, and ISO formats
   */
  private parseDate(dateStr: string): Date | null {
    if (!dateStr || dateStr === 'N/A') return null;
    
    // Try parsing as ISO date first
    let date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    // Try parsing DD/MM/YYYY or MM/DD/YYYY format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      // Try DD/MM/YYYY format (common in many locales)
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      // Try MM/DD/YYYY format
      const month2 = parseInt(parts[0], 10) - 1;
      const day2 = parseInt(parts[1], 10);
      const year2 = parseInt(parts[2], 10);
      if (!isNaN(day2) && !isNaN(month2) && !isNaN(year2)) {
        date = new Date(year2, month2, day2);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
    
    return null;
  }
}

