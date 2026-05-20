/**
 * Dashboard Models
 * Interfaces and types for dashboard functionality
 */

import { CardStatus } from '@utils/dashboard.utils';
import type { OrderItem } from '@models/dashboard-order-display.model';

/**
 * Dashboard card configuration and data
 */
export interface DashboardCard {
  title: string;
  status: CardStatus;

  requestStatus?: number;
  orders: OrderItem[];
  permissions: string[];
  roles?: string[];
  orderRequestId?: number;
  returnRequestId?: number;
  discardRequestId?: number;
  isMyTurn?: boolean;
  priority?: number;
}

