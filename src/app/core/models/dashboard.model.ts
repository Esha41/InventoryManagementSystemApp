/**
 * Dashboard Models
 * Interfaces and types for dashboard functionality
 */

import { CardStatus } from '@utils/dashboard.utils';
import { OrderItem } from '@dashboard/pages/overview/components/status-card/status-card.component';

/**
 * Dashboard card configuration and data
 */
export interface DashboardCard {
  title: string;
  status: CardStatus;

  requestStatus?: number | string;
  orders: OrderItem[];
  permissions: string[];
  roles?: string[];
  orderRequestId?: number;
  returnRequestId?: number;
  discardRequestId?: number;
  isMyTurn?: boolean;
  priority?: number;
}

