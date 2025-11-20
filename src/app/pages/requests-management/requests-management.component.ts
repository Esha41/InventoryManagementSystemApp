import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ChevronDown } from 'lucide-angular';
import { PaginationComponent } from './components/pagination/pagination.component';
import { RowsPerPageComponent } from './components/rows-per-page/rows-per-page.component';
import { StatusDropdownComponent } from './components/status-dropdown/status-dropdown.component';
import { OrderDetailsModalComponent } from './components/order-details-modal/order-details-modal.component';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';

export interface Request {
  orderId: string;
  requestDate: string;
  priority: 'High' | 'Medium' | 'Low' | 'Critical';
  requestType: 'Issue' | 'Return' | 'Discard';
  status: 'Pending' | 'Confirmed' | 'Rejected';
}

interface BaseRequestDto {
  id: number;
  requestNo: string;
  requestType: number; // RequestType enum: 1=Order, 2=Return, 3=Discard
  reason: string;
  priority: number; // RequestPriority enum: 0=Low, 1=Medium, 2=High, 3=Critical
  status: number; // RequestStatus enum: 1=New, 2=UnderProcess, 3=Approved, 4=Rejected
  requestDate: string | Date;
}

@Component({
  selector: 'app-requests-management',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, PaginationComponent, RowsPerPageComponent, StatusDropdownComponent, OrderDetailsModalComponent],
  templateUrl: './requests-management.component.html',
  styleUrls: ['./requests-management.component.css']
})
export class RequestsManagementComponent implements OnInit {
  readonly ChevronDown = ChevronDown;

  requests: Request[] = [];
  loading = false;

  currentPage: number = 1;
  rowsPerPage: number = 5;
  totalItems: number = 0;

  isModalOpen = false;
  selectedOrder: Request | null = null;

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadRequests();
  }

  loadRequests(): void {
    this.loading = true;
    this.apiService.getWithAuth<BaseRequestDto[]>(
      API_ENDPOINTS.WORKFLOW_APPROVAL.ALL_BASE_REQUESTS
    ).subscribe({
      next: (response: any) => {
        // Handle both direct array response and wrapped response
        const data: BaseRequestDto[] = Array.isArray(response) 
          ? response 
          : (response?.data || []);
        
        this.requests = this.mapToRequests(data);
        this.totalItems = this.requests.length;
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load requests:', error);
        this.loading = false;
        this.requests = [];
      }
    });
  }

  private mapToRequests(data: BaseRequestDto[]): Request[] {
    return data.map(item => ({
      orderId: `#${item.requestNo || item.id.toString().padStart(4, '0')}`,
      requestDate: this.formatDate(item.requestDate),
      priority: this.mapPriority(item.priority),
      requestType: this.mapRequestType(item.requestType),
      status: this.mapStatus(item.status)
    }));
  }

  private formatDate(date: string | Date | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  private mapPriority(priority: number): 'High' | 'Medium' | 'Low' | 'Critical' {
    // RequestPriority enum: 0=Low, 1=Medium, 2=High, 3=Critical
    switch (priority) {
      case 0: return 'Low';
      case 1: return 'Medium';
      case 2: return 'High';
      case 3: return 'Critical';
      default: return 'Low';
    }
  }

  private mapRequestType(type: number): 'Issue' | 'Return' | 'Discard' {
    // RequestType enum: 1=Order/Issue, 2=Return, 3=Discard
    switch (type) {
      case 1: return 'Issue';
      case 2: return 'Return';
      case 3: return 'Discard';
      default: return 'Issue';
    }
  }

  private mapStatus(status: number): 'Pending' | 'Confirmed' | 'Rejected' {
    // RequestStatus enum: 1=New, 2=UnderProcess, 3=Approved, 4=Rejected
    switch (status) {
      case 1:
      case 2: return 'Pending';
      case 3: return 'Confirmed';
      case 4: return 'Rejected';
      default: return 'Pending';
    }
  }

  get paginatedRequests(): Request[] {
    const start = (this.currentPage - 1) * this.rowsPerPage;
    const end = start + this.rowsPerPage;
    return this.requests.slice(start, end);
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.rowsPerPage);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1; // Reset to first page when changing rows per page
  }

  onStatusChange(orderId: string, newStatus: string): void {
    const request = this.requests.find(r => r.orderId === orderId);
    if (request) {
      request.status = newStatus as 'Pending' | 'Confirmed' | 'Rejected';
    }
  }

  openOrderDetails(order: Request): void {
    this.selectedOrder = order;
    this.isModalOpen = true;
  }

  closeOrderDetails(): void {
    this.isModalOpen = false;
    this.selectedOrder = null;
  }
}
