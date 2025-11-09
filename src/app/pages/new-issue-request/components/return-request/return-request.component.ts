import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { LucideAngularModule, Plus, X, ChevronDown, Search } from 'lucide-angular';
import { ReturnService, CreateReturnDto, CreateReturnItemDto } from '@services/return.service';
import { LookupService } from '@services/lookup.service';
import { AmmunitionService } from '@services/ammunition.service';
import { ToastService } from '@services/toast.service';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { APIOperationResponse } from '@models/api-response.model';
import { LookupItem } from '@models/lookup.model';
import { Subject, takeUntil } from 'rxjs';

interface ReturnItemForm {
  itemId: number | null;
  quantity: number | null;
  notes: string;
}

interface RequestPurpose {
  id: number;
  nameAr: string;
  nameEn: string;
}

@Component({
  selector: 'app-return-request',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ButtonComponent,
    LucideAngularModule
  ],
  templateUrl: './return-request.component.html',
  styleUrls: ['./return-request.component.css']
})
export class ReturnRequestComponent implements OnInit, OnDestroy {
  readonly Plus = Plus;
  readonly X = X;
  readonly ChevronDown = ChevronDown;
  readonly Search = Search;

  
  reason: string = '';
  priority: number = 1; // 1 = High, 2 = Medium, 3 = Low
  notes: string = '';
  departmentId: number | null = null;
  requesterId: number | null = null;
  requestPurposeId: number | null = null;

  // Return items array
  returnItems: ReturnItemForm[] = [];

  // Dropdown options
  departments: LookupItem[] = [];
  requesters: LookupItem[] = []; // Employees from Lookup API
  requestPurposes: RequestPurpose[] = [];
  items: any[] = []; // Ammunition items
  priorityOptions = [
    { value: 1, labelKey: 'returnRequest.high' },
    { value: 2, labelKey: 'returnRequest.medium' },
    { value: 3, labelKey: 'returnRequest.low' }
  ];

  // Loading states
  isLoading = false;
  isLoadingDepartments = false;
  isLoadingRequesters = false;
  isLoadingRequestPurposes = false;
  isLoadingItems = false;

  isSubmitted = false;
  errors: { [key: string]: string } = {};

  // Searchable dropdown state for return items
  itemDropdownSearchTerms: string[] = [];
  itemDropdownOpen: boolean[] = [];

  @ViewChildren('itemDropdown') itemDropdownRefs?: QueryList<ElementRef<HTMLElement>>;

  private destroy$ = new Subject<void>();

  constructor(
    private returnService: ReturnService,
    private lookupService: LookupService,
    private ammunitionService: AmmunitionService,
    private toastService: ToastService,
    private apiService: ApiService,
    private translate: TranslateService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDropdownData();
    this.addReturnItem(); // Add one empty item row by default
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.itemDropdownRefs) {
      return;
    }
    const target = event.target as Node;
    const clickedInside = this.itemDropdownRefs.toArray().some(ref => ref.nativeElement.contains(target));

    if (!clickedInside) {
      this.closeAllItemDropdowns();
    }
  }

  private loadDropdownData(): void {
    // Load departments
    this.isLoadingDepartments = true;
    this.lookupService.getDepartments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (departments) => {
          this.departments = departments;
          this.isLoadingDepartments = false;
        },
        error: (error) => {
          console.error('Failed to load departments:', error);
          this.toastService.error('Failed to load departments');
          this.isLoadingDepartments = false;
        }
      });

    // Load requesters (employees) from Lookup API - Employees are seeded in backend
    // Employees table should exist in database (created via migrations)
    this.isLoadingRequesters = true;
    this.lookupService.getLookupItems('Employee')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (employees) => {
          this.requesters = employees;
          this.isLoadingRequesters = false;
        },
        error: (error) => {
          console.error('Failed to load employees:', error);
          // The requester field is optional, so we can continue without it
          this.toastService.error('Failed to load employees. The requester field will be disabled.');
          this.requesters = []; // Set empty array so dropdown doesn't break
          this.isLoadingRequesters = false;
        }
      });

    // Load request purposes for return
    this.isLoadingRequestPurposes = true;
    this.apiService.getWithAuth<APIOperationResponse<RequestPurpose[]>>(API_ENDPOINTS.REQUEST_PURPOSES.FOR_RETURN)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Handle both APIOperationResponse and direct array
          if (response.succeeded && response.data) {
            this.requestPurposes = response.data;
          } else if (Array.isArray(response)) {
            this.requestPurposes = response;
          } else if (response.data && Array.isArray(response.data)) {
            this.requestPurposes = response.data;
          }
          this.isLoadingRequestPurposes = false;
        },
        error: (error) => {
          console.error('Failed to load request purposes:', error);
          this.toastService.error('Failed to load request purposes');
          this.isLoadingRequestPurposes = false;
        }
      });

    // Load items (ammunition)
    this.isLoadingItems = true;
    this.ammunitionService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          this.items = items || [];
          this.isLoadingItems = false;
        },
        error: (error) => {
          console.error('Failed to load items:', error);
          this.toastService.error('Failed to load items');
          this.isLoadingItems = false;
        }
      });
  }

  addReturnItem(): void {
    this.returnItems.push({
      itemId: null,
      quantity: null,
      notes: ''
    });
    this.itemDropdownSearchTerms.push('');
    this.itemDropdownOpen.push(false);
  }

  removeReturnItem(index: number): void {
    this.returnItems.splice(index, 1);
    this.itemDropdownSearchTerms.splice(index, 1);
    this.itemDropdownOpen.splice(index, 1);
  }

  getItemName(itemId: number): string {
    const item = this.items.find(i => i.id === itemId || i.itemNo === itemId);
    return item ? (item.name || item.itemNo || 'Unknown') : 'Unknown';
  }

  getRequesterName(requesterId: number): string {
    const requester = this.requesters.find(r => r.id === requesterId);
    return requester ? (requester.nameEn || requester.nameAr || 'Unknown') : 'Unknown';
  }

  getDepartmentName(departmentId: number): string {
    const dept = this.departments.find(d => d.id === departmentId);
    return dept ? (dept.nameEn || dept.nameAr || 'Unknown') : 'Unknown';
  }

  getRequestPurposeName(purposeId: number): string {
    const purpose = this.requestPurposes.find(p => p.id === purposeId);
    return purpose ? (purpose.nameEn || purpose.nameAr || 'Unknown') : 'Unknown';
  }

  toggleItemDropdown(index: number): void {
    if (this.isLoadingItems) {
      return;
    }
    this.itemDropdownOpen = this.itemDropdownOpen.map((open, i) => (i === index ? !open : false));
    if (!this.itemDropdownOpen[index]) {
      this.itemDropdownSearchTerms[index] = '';
    }
  }

  closeItemDropdown(index: number): void {
    if (this.itemDropdownOpen[index]) {
      this.itemDropdownOpen[index] = false;
      this.itemDropdownSearchTerms[index] = '';
    }
  }

  closeAllItemDropdowns(): void {
    this.itemDropdownOpen = this.itemDropdownOpen.map(() => false);
    this.itemDropdownSearchTerms = this.itemDropdownSearchTerms.map(() => '');
  }

  onItemSelect(index: number, itemOption: any): void {
    const optionValue = itemOption.id ?? itemOption.itemNo ?? null;
    this.returnItems[index].itemId = optionValue;
    this.closeItemDropdown(index);
  }

  getItemOptionLabel(itemOption: any): string {
    return itemOption?.name || itemOption?.itemNo || 'Unknown';
  }

  getSelectedItemLabel(index: number): string {
    const itemId = this.returnItems[index]?.itemId;
    if (itemId === null || itemId === undefined) {
      return '';
    }
    const selected = this.items.find(option => this.isSameItem(option, itemId));
    return selected ? this.getItemOptionLabel(selected) : '';
  }

  getFilteredItems(index: number): any[] {
    if (!this.items?.length) {
      return [];
    }
    const term = (this.itemDropdownSearchTerms[index] || '').trim().toLowerCase();
    if (!term) {
      return this.items;
    }
    return this.items.filter(option => {
      const label = this.getItemOptionLabel(option).toLowerCase();
      const code = option?.itemNo ? String(option.itemNo).toLowerCase() : '';
      return label.includes(term) || code.includes(term);
    });
  }

  isOptionSelected(option: any, itemId: any): boolean {
    return this.isSameItem(option, itemId);
  }

  private isSameItem(option: any, itemId: any): boolean {
    const optionValue = option?.id ?? option?.itemNo;
    if (optionValue === undefined || optionValue === null) {
      return false;
    }
    return String(optionValue) === String(itemId);
  }

  onSendRequest(form: NgForm): void {
    this.isSubmitted = true;
    this.errors = {};

    // Validate form
    if (!this.departmentId) {
      this.errors['departmentId'] = 'Department is required';
    }

    if (!this.requestPurposeId) {
      this.errors['requestPurposeId'] = 'Request purpose is required';
    }

    if (this.returnItems.length === 0) {
      this.errors['returnItems'] = 'At least one return item is required';
    }

    // Validate return items
    this.returnItems.forEach((item, index) => {
      if (!item.itemId) {
        this.errors[`returnItem_${index}_itemId`] = 'Item is required';
      }
      if (!item.quantity || item.quantity <= 0) {
        this.errors[`returnItem_${index}_quantity`] = 'Quantity must be greater than 0';
      }
    });

    if (Object.keys(this.errors).length > 0) {
      return;
    }

    // Build CreateReturnDto - ensure all numeric values are numbers, not strings
    const createReturnDto: CreateReturnDto = {
      reason: this.reason || undefined,
      priority: Number(this.priority), // Convert to number
      notes: this.notes || undefined,
      departmentId: Number(this.departmentId!), // Convert to number
      requesterId: this.requesterId ? Number(this.requesterId) : undefined, // Convert to number if exists
      requestPurposeId: Number(this.requestPurposeId!), // Convert to number
      returnItems: this.returnItems
        .filter(item => item.itemId && item.quantity)
        .map(item => ({
          itemId: Number(item.itemId!), // Convert to number
          quantity: Number(item.quantity!), // Convert to number
          notes: item.notes || undefined
        }))
    };

    // Submit to backend
    this.isLoading = true;
    this.returnService.createReturn(createReturnDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (returnId) => {
          this.toastService.success('Return request created successfully');
          this.resetForm();
          this.isLoading = false;
          
          // Redirect to dashboard after successful creation
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 1000); // Small delay to show success message
        },
        error: (error) => {
          console.error('Failed to create return request:', error);
          
          // Extract error message from response
          let errorMessage = 'Failed to create return request';
          if (error.error?.errors) {
            // Handle validation errors
            const errors = error.error.errors;
            const errorMessages: string[] = [];
            
            if (errors.dto) {
              errorMessages.push(...errors.dto);
            }
            if (errors['$.priority']) {
              errorMessages.push(`Priority: ${errors['$.priority'].join(', ')}`);
            }
            if (errors['$.departmentId']) {
              errorMessages.push(`Department: ${errors['$.departmentId'].join(', ')}`);
            }
            if (errors['$.requestPurposeId']) {
              errorMessages.push(`Request Purpose: ${errors['$.requestPurposeId'].join(', ')}`);
            }
            if (errors['$.returnItems']) {
              errorMessages.push(`Return Items: ${errors['$.returnItems'].join(', ')}`);
            }
            
            if (errorMessages.length > 0) {
              errorMessage = errorMessages.join('; ');
            } else if (error.error?.title) {
              errorMessage = error.error.title;
            }
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          this.toastService.error(errorMessage);
          this.isLoading = false;
        }
      });
  }

  hasError(fieldName: string): boolean {
    return this.isSubmitted && !!this.errors[fieldName];
  }

  getError(fieldName: string): string {
    return this.errors[fieldName] || '';
  }

  private resetForm(): void {
    this.reason = '';
    this.priority = 1;
    this.notes = '';
    this.departmentId = null;
    this.requesterId = null;
    this.requestPurposeId = null;
    this.returnItems = [];
    this.itemDropdownSearchTerms = [];
    this.itemDropdownOpen = [];
    this.addReturnItem(); // Add one empty item row
    this.isSubmitted = false;
    this.errors = {};
  }
}
