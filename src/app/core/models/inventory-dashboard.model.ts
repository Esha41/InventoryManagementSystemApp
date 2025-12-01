import { OrderItem } from '@pages/dashboard/components/status-card/status-card.component';
import { OverstockItemView } from '@pages/dashboard/components/overstock-card/overstock-card.component';
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
}

export interface StatisticsData {
  totalItems: number;
  totalQuantity: number;
  expiringSoon: number; // Items expiring in next 30 days
  lowStock: number; // Items below threshold
  overstockItems: OverstockItemView[];
  monthlyActivity: number[]; // Orders per month (current year only)
  monthlyActivityPercentages: number[]; // Percentage distribution
}
