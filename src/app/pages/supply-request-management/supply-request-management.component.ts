import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Search, Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { DropdownComponent } from '@components/dropdown/dropdown.component';

export interface SupplyRequest {
  issueNo: string;
  requestType: 'Issue' | 'Return';
  quantity: number;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  requestDate: string;
  status: 'Pending' | 'Processing' | 'Completed' | 'Delivered' | 'Returned' | 'Cancelled';
}

@Component({
  selector: 'app-supply-request-management',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, DropdownComponent],
  templateUrl: './supply-request-management.component.html',
  styleUrls: ['./supply-request-management.component.css']
})
export class SupplyRequestManagementComponent implements OnInit {
  readonly Search = Search;
  readonly Calendar = Calendar;
  readonly ChevronDown = ChevronDown;
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;

  constructor(
    private router: Router,
    private translationService: TranslationService
  ) {}

  requests: SupplyRequest[] = [
    { issueNo: '#1056', requestType: 'Issue', quantity: 30000, priority: 'Low', requestDate: '10 Sept 2024', status: 'Processing' },
    { issueNo: '#1055', requestType: 'Issue', quantity: 200000, priority: 'High', requestDate: '1 Sept 2024', status: 'Completed' },
    { issueNo: '#1054', requestType: 'Return', quantity: 15000, priority: 'Low', requestDate: '29 Aug 2024', status: 'Delivered' },
    { issueNo: '#1053', requestType: 'Issue', quantity: 150000, priority: 'Critical', requestDate: '23 Aug 2024', status: 'Delivered' },
    { issueNo: '#0152', requestType: 'Issue', quantity: 40000, priority: 'Low', requestDate: '19 Aug 2024', status: 'Processing' },
    { issueNo: '#1051', requestType: 'Issue', quantity: 300000, priority: 'High', requestDate: '10 Aug 2024', status: 'Completed' },
    { issueNo: '#0150', requestType: 'Return', quantity: 100000, priority: 'Low', requestDate: '1 Aug 2024', status: 'Processing' },
    { issueNo: '#0149', requestType: 'Issue', quantity: 25000, priority: 'Low', requestDate: '25 July 2024', status: 'Pending' },
    { issueNo: '#0148', requestType: 'Issue', quantity: 75000, priority: 'Medium', requestDate: '22 July 2024', status: 'Processing' },
    { issueNo: '#0147', requestType: 'Return', quantity: 50000, priority: 'Low', requestDate: '15 July 2024', status: 'Completed' }
  ];

  filteredRequests: SupplyRequest[] = [];
  activeTab: string = 'Pending';
  
  tabs = ['Pending', 'New', 'Processing', 'Completed', 'Delivered', 'Returned', 'Cancelled'];
  
  searchTerm: string = '';
  dateFilter: string = '';
  
  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 20;
  totalPages: number = 1;
  readonly itemsPerPageOptions = [1, 2, 5, 10, 20];

  ngOnInit(): void {
    this.filterRequests();
    this.calculateTotalPages();
  }

  onTabChange(tab: string): void {
    this.activeTab = tab;
    this.currentPage = 1;
    this.filterRequests();
    this.calculateTotalPages();
  }

  filterRequests(): void {
    let filtered = [...this.requests];

    // Filter by active tab (status)
    if (this.activeTab !== 'New') {
      filtered = filtered.filter(req => req.status === this.activeTab);
    } else {
      // "New" tab shows all non-completed requests
      filtered = filtered.filter(req => 
        req.status === 'Pending' || req.status === 'Processing'
      );
    }

    // Filter by search term
    if (this.searchTerm) {
      filtered = filtered.filter(req =>
        req.issueNo.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }

    this.filteredRequests = filtered;
    this.calculateTotalPages();
  }

  onSearch(): void {
    this.currentPage = 1;
    this.filterRequests();
  }

  onDateFilterChange(): void {
    this.currentPage = 1;
    this.filterRequests();
  }

  calculateTotalPages(): void {
    this.totalPages = Math.ceil(this.filteredRequests.length / this.itemsPerPage);
  }

  onItemsPerPageChange(value: number | null): void {
    if (!value) {
      return;
    }
    this.itemsPerPage = value;
    this.currentPage = 1;
    this.calculateTotalPages();
  }

  get paginatedRequests(): SupplyRequest[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredRequests.slice(startIndex, endIndex);
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    const startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  onStatusChange(issueNo: string, newStatus: string): void {
    const request = this.requests.find(r => r.issueNo === issueNo);
    if (request) {
      request.status = newStatus as any;
      this.filterRequests();
    }
  }

  onViewDetails(issueNo: string): void {
    this.router.navigate(['/supply-request-management', issueNo]);
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'Critical': return 'text-red-600';
      case 'High': return 'text-orange-600';
      case 'Medium': return 'text-yellow-600';
      case 'Low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  }

  getStatusButtonClass(status: string): string {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800 border-green-300';
      case 'Processing': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Delivered': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Pending': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  formatNumber(num: number): string {
    return num.toLocaleString();
  }

  // Return correct icon for previous button based on RTL/LTR
  get previousIcon() {
    return this.translationService.isRTL() ? ChevronRight : ChevronLeft;
  }

  // Return correct icon for next button based on RTL/LTR
  get nextIcon() {
    return this.translationService.isRTL() ? ChevronLeft : ChevronRight;
  }
}

