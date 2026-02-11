

export interface Request {
  id: number;
  orderId: string;
  requestDate: string;
  creationDate: string; // Actual creation date from backend
  priority: 'Normal' | 'Urgent' | 'VeryUrgent' | 'Very Urgent' | 'Critical';
  requestType: 'Order' | 'Return' | 'Discard';
  status: 'New' | 'Pending' | 'Confirmed' | 'Rejected' | 'Returned' | 'ReturnedForReview';
  isMyTurn: boolean;
}


