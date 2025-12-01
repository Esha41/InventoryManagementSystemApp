
export interface Request {
  id: number;
  orderId: string;
  requestDate: string;
  priority: 'High' | 'Medium' | 'Low' | 'Critical';
  requestType: 'Order' | 'Return' | 'Discard';
  status: 'Pending' | 'Confirmed' | 'Rejected';
}

