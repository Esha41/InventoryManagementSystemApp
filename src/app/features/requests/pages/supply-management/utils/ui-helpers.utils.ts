/**
 * UI Helper Utilities
 * Functions for UI-related operations like CSS classes, colors, etc.
 */

import { SupplyRequest } from '@models/supply-request.model';

/**
 * Get priority color CSS classes
 * Backend RequestPriority enum: Normal = 1, Urgent = 2, VeryUrgent = 3, Critical = 4
 * Colors: Normal = Green, Urgent = Orange, VeryUrgent = Red, Critical = Red
 */
export function getPriorityColor(priority: SupplyRequest['priority']): string {
  switch (priority) {
    case 'Critical': return 'text-red-600';
    case 'VeryUrgent': return 'text-red-600';
    case 'Urgent': return 'text-orange-600';
    case 'Normal': return 'text-green-600';
    default: return 'text-gray-600';
  }
}

/**
 * Get status button CSS classes
 */
export function getStatusButtonClass(status: SupplyRequest['status']): string {
  switch (status) {
    case 'Completed': return 'bg-green-100 text-green-800 border-green-300';
    case 'Processing': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'Delivered': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'Pending': return 'bg-gray-100 text-gray-800 border-gray-300';
    case 'Returned': return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'Cancelled': return 'bg-red-100 text-red-800 border-red-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

/**
 * Get pagination page numbers
 */
export function getPageNumbers(currentPage: number, totalPages: number, maxVisiblePages: number = 5): number[] {
  const pages: number[] = [];
  const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  
  return pages;
}

