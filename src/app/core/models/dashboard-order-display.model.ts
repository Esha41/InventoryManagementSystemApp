/** Order row shown on dashboard / inventory dashboard cards (UI shape; not backend DTO). */
export interface OrderItem {
  orderId: string;
  requestDate: string;
  departmentNameEn?: string;
  departmentNameAr?: string;
  requesterNameEn?: string;
  requesterNameAr?: string;
  departmentName?: string;
  requesterName?: string;
  items?: ReturnItem[];
  requestId?: number;
}

export interface ReturnItem {
  itemName: string;
  itemNo: string;
  quantity: number;
  notes?: string;
}
