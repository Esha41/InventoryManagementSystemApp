/**
 * Dashboard Models
 * Interfaces and types for dashboard functionality
 */

import { CardStatus } from '@utils/dashboard.utils';
import { OrderItem } from '@pages/dashboard/components/status-card/status-card.component';

/**
 * Dashboard card configuration and data
 */
export interface DashboardCard {
  title: string;
  status: CardStatus;
  orders: OrderItem[];
  permissions: string[];
  roles?: string[];
  orderRequestId?: number;
  returnRequestId?: number;
  discardRequestId?: number;
}

