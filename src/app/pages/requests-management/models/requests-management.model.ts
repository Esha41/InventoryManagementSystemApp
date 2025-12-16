

export interface Request {
  id: number;
  orderId: string;
  requestDate: string;
  creationDate: string; // Actual creation date from backend
  priority: 'High' | 'Medium' | 'Low' | 'Critical';
  requestType: 'Order' | 'Return' | 'Discard';
  status: 'New' | 'Pending' | 'Confirmed' | 'Rejected' | 'Returned' | 'ReturnedForReview';
}


