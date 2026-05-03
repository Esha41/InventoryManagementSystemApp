import type { OrderItem } from '@models/dashboard-order-display.model';
import { CardStatus } from '@utils/dashboard.utils';

export interface InventoryDashboardCard {
  title: string;
  status: CardStatus;
  orders: OrderItem[];
  permissions: string[];
  departmentIds?: number[];
  orderRequestId?: number;
  returnRequestId?: number;
  discardRequestId?: number;
  isMyTurn?: boolean;
}

export interface StatisticsData {
  totalItems: number;
  lowStock: number; // Items below threshold
  expiringSoon: number; // Lots expiring in next 30 days
  monthlyActivity: number[]; // Orders per month (current year only)
  monthlyActivityPercentages: number[]; // Percentage distribution
}
