import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { LucideAngularModule, Plus, X, ChevronDown, Search } from 'lucide-angular';
import { DiscardService, CreateDiscardDto, CreateDiscardItemDto } from '@services/discard.service';
import { LookupService } from '@services/lookup.service';
import { AmmunitionService } from '@services/ammunition.service';
import { ToastService } from '@services/toast.service';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { APIOperationResponse } from '@models/api-response.model';
import { LookupItem } from '@models/lookup.model';
import { Subject, takeUntil } from 'rxjs';
import { UserContextService } from '@services/user-context.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { AuthenticatedUser } from '@models/auth.model';
import { BackendUserDto } from '@models/backend-user.model';

interface DiscardItemForm {
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
  selector: 'app-discard-request',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ButtonComponent,
    LucideAngularModule
  ],
  templateUrl: './discard-request.component.html',
  styleUrls: ['./discard-request.component.css']
})
export class DiscardRequestComponent implements OnInit, OnDestroy {
  readonly Plus = Plus;
  readonly X = X;
  readonly ChevronDown = ChevronDown;
  readonly Search = Search;

  // Form fields matching backend CreateDiscardDto
  reason: string = '';
  priority: number = 1; // 1 = High, 2 = Medium, 3 = Low
  notes: string = '';
  departmentId: number | null = null;
  requesterId: number | null = null;
  requestPurposeId: number | null = null;

  // Discard items array
  discardItems: DiscardItemForm[] = [];

  // Dropdown options
  departments: LookupItem[] = [];
  requesters: LookupItem[] = []; // Employees from Lookup API
  requestPurposes: RequestPurpose[] = [];
  items: any[] = []; // Ammunition items
  priorityOptions = [
    { value: 1, labelKey: 'discardRequest.high' },
    { value: 2, labelKey: 'discardRequest.medium' },
    { value: 3, labelKey: 'discardRequest.low' }
  ];

  // Loading states
  isLoading = false;
  isLoadingDepartments = false;
  isLoadingRequesters = false;
  isLoadingRequestPurposes = false;
  isLoadingItems = false;

  isSubmitted = false;
  errors: { [key: string]: string } = {};

  // Searchable dropdown state for discard items
  itemDropdownSearchTerms: string[] = [];
  itemDropdownOpen: boolean[] = [];

  @ViewChildren('itemDropdown') itemDropdownRefs?: QueryList<ElementRef<HTMLElement>>;

  private destroy$ = new Subject<void>();
  currentUserDetails: BackendUserDto | null = null;
  isAdminUser = false;
  private preferredDepartmentId: number | null = null;
  private preferredRequesterId: number | null = null;
  private fallbackDepartmentName = '';
  private fallbackRequesterName = '';
  lockedDepartmentName = '';
  lockedRequesterName = '';

  constructor(
    private discardService: DiscardService,
    private lookupService: LookupService,
    private ammunitionService: AmmunitionService,
    private toastService: ToastService,
    private apiService: ApiService,
    private translate: TranslateService,
    private router: Router,
    private userContextService: UserContextService,
    private backendAuthService: BackendAuthService
  ) {}

  ngOnInit(): void {
    this.initializeUserContext();
    this.loadDropdownData();
    this.addDiscardItem(); // Add one empty item row by default
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeUserContext(): void {
    this.isAdminUser = this.userContextService.isAdminUser();

    this.backendAuthService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => this.applyAuthenticatedUserContext(user));

    this.userContextService
      .getCurrentUserDetails()
      .pipe(takeUntil(this.destroy$))
      .subscribe(details => {
        this.currentUserDetails = details;
        this.applyBackendUserDetails(details);
      });
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

  /**
   * Load all dropdown data
   */
  private loadDropdownData(): void {
    this.loadDepartments();
    this.loadRequesters();
    this.loadRequestPurposes();
    this.loadItems();
  }

  /**
   * Load departments from LookupService
   */
  private loadDepartments(): void {
    this.isLoadingDepartments = true;
    this.lookupService.getDepartments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (departments) => {
          this.departments = departments;
          this.isLoadingDepartments = false;
          this.updateLockedDepartmentName();
          this.applyLockedDepartment();
        },
        error: (error) => {
          console.error('Failed to load departments:', error);
          this.toastService.error('Failed to load departments');
          this.isLoadingDepartments = false;
        }
      });
  }

  /**
   * Load requesters (employees) from LookupService
   */
  private loadRequesters(): void {
    this.isLoadingRequesters = true;
    if (!this.isAdminUser) {
      this.requesters = [];
      this.isLoadingRequesters = false;
      return;
    }

    this.lookupService.getLookupItems('Employee')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (employees) => {
          this.requesters = employees;
          this.isLoadingRequesters = false;
        },
        error: (error) => {
          console.error('Failed to load employees:', error);
          this.toastService.error('Failed to load employees. The requester field will be disabled.');
          this.requesters = [];
          this.isLoadingRequesters = false;
        }
      });
  }

  /**
   * Load request purposes for discard type
   */
  private loadRequestPurposes(): void {
    this.isLoadingRequestPurposes = true;
    this.apiService.getWithAuth<APIOperationResponse<RequestPurpose[]>>(
      API_ENDPOINTS.REQUEST_PURPOSES.FOR_DISCARD
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.succeeded && response.data) {
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
  }

  /**
   * Load items from AmmunitionService
   */
  private loadItems(): void {
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

  /**
   * Add a new discard item row
   */
  addDiscardItem(): void {
    this.discardItems.push({
      itemId: null,
      quantity: null,
      notes: ''
    });
    this.itemDropdownSearchTerms.push('');
    this.itemDropdownOpen.push(false);
  }

  /**
   * Remove a discard item row
   */
  removeDiscardItem(index: number): void {
    this.discardItems.splice(index, 1);
    this.itemDropdownSearchTerms.splice(index, 1);
    this.itemDropdownOpen.splice(index, 1);
  }

  /**
   * Validate form
   */
  private validateForm(): void {
    this.errors = {};

    // Validate required fields
    if (!this.departmentId) {
      this.errors['departmentId'] = 'Department is required';
    }

    if (!this.requestPurposeId) {
      this.errors['requestPurposeId'] = 'Request Purpose is required';
    }

    // Validate discard items
    const validItems = this.discardItems.filter(item => item.itemId && item.quantity);
    if (validItems.length === 0) {
      this.errors['discardItems'] = 'At least one discard item is required';
    }

    // Validate each item
    this.discardItems.forEach((item, index) => {
      if (item.itemId && !item.quantity) {
        this.errors[`discardItems.${index}.quantity`] = 'Quantity is required';
      }
      if (!item.itemId && item.quantity) {
        this.errors[`discardItems.${index}.itemId`] = 'Item is required';
      }
    });
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
    this.discardItems[index].itemId = optionValue;
    this.closeItemDropdown(index);
  }

  getItemOptionLabel(itemOption: any): string {
    return itemOption?.name || itemOption?.itemNo || 'Unknown';
  }

  getSelectedItemLabel(index: number): string {
    const itemId = this.discardItems[index]?.itemId;
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

  /**
   * Handle form submission
   */
  onSendRequest(form: NgForm): void {
    this.isSubmitted = true;
    this.validateForm();

    if (Object.keys(this.errors).length > 0) {
      this.toastService.error('Please correct the form errors.');
      return;
    }

    // Build CreateDiscardDto with explicit number conversions
    const createDiscardDto: CreateDiscardDto = {
      reason: this.reason || undefined,
      priority: Number(this.priority),
      notes: this.notes || undefined,
      departmentId: Number(this.departmentId!),
      requesterId: this.requesterId != null ? Number(this.requesterId) : undefined,
      requestPurposeId: Number(this.requestPurposeId!),
      discardItems: this.discardItems
        .filter(item => item.itemId && item.quantity)
        .map(item => ({
          itemId: Number(item.itemId!),
          quantity: Number(item.quantity!),
          notes: item.notes || undefined
        }))
    };

    // Submit to backend
    this.isLoading = true;
    this.discardService.createDiscard(createDiscardDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (discardId) => {
          this.toastService.success('Discard request created successfully');
          this.resetForm();
          this.isLoading = false;

          // Redirect to dashboard after successful creation
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 1000); // Small delay to show success message
        },
        error: (error) => {
          console.error('Failed to create discard request:', error);

          // Extract error message from response
          let errorMessage = 'Failed to create discard request';
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
            if (errors['$.discardItems']) {
              errorMessages.push(`Discard Items: ${errors['$.discardItems'].join(', ')}`);
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

  private applyAuthenticatedUserContext(user: AuthenticatedUser | null): void {
    if (!user) {
      return;
    }

    this.applyUserContext({
      nameEn: user.nameEn,
      nameAr: user.nameAr,
      userName: user.userName,
      departmentId: user.departmentId,
      departmentName: user.departmentName,
      employeeId: user.employeeId
    });
  }

  private applyBackendUserDetails(details: BackendUserDto | null): void {
    if (!details) {
      return;
    }

    this.applyUserContext({
      nameEn: details.nameEn,
      nameAr: details.nameAr,
      userName: details.userName,
      departmentId: details.departmentId,
      departmentName: details.departmentName,
      employeeId: details.employeeId
    });
  }

  private applyUserContext(context: {
    nameEn?: string | null;
    nameAr?: string | null;
    userName?: string | null;
    departmentId?: number | string | null;
    departmentName?: string | null;
    employeeId?: number | string | null;
  }): void {
    if (this.isAdminUser) {
      this.requesterId = null;
      return;
    }

    const preferredName = this.resolveRequesterDisplayName(context.nameEn, context.nameAr, context.userName);
    if (preferredName) {
      this.lockedRequesterName = preferredName;
      this.fallbackRequesterName = preferredName;
    }

    const departmentId = this.toNumber(context.departmentId);
    if (departmentId !== null) {
      this.preferredDepartmentId = departmentId;
      this.applyLockedDepartment();
      this.updateLockedDepartmentName();
    }

    if (context.departmentName && context.departmentName.trim().length > 0) {
      this.fallbackDepartmentName = context.departmentName;
      this.updateLockedDepartmentName();
    }

    const requesterId = this.toNumber(context.employeeId);
    if (requesterId !== null) {
      this.preferredRequesterId = requesterId;
      this.applyLockedRequester();
    }
  }

  private resolveRequesterDisplayName(
    nameEn?: string | null,
    nameAr?: string | null,
    userName?: string | null
  ): string | null {
    if (nameEn && nameEn.trim().length > 0) {
      return nameEn;
    }
    if (nameAr && nameAr.trim().length > 0) {
      return nameAr;
    }
    if (userName && userName.trim().length > 0) {
      return userName;
    }
    return null;
  }

  /**
   * Reset form
   */
  private resetForm(): void {
    this.reason = '';
    this.priority = 1;
    this.notes = '';
    if (this.isDepartmentLocked) {
      this.departmentId = this.preferredDepartmentId;
      this.lockedDepartmentName = this.buildLockedDepartmentName();
      this.applyLockedRequester();
    } else {
      this.departmentId = null;
      this.requesterId = null;
    }
    this.requestPurposeId = null;
    this.discardItems = [];
    this.itemDropdownOpen = [];
    this.itemDropdownSearchTerms = [];
    this.addDiscardItem(); // Add one empty item row
    this.isSubmitted = false;
    this.errors = {};
  }

  /**
   * Check if field has error
   */
  hasError(fieldName: string): boolean {
    return this.isSubmitted && !!this.errors[fieldName];
  }

  /**
   * Get error message for field
   */
  getError(fieldName: string): string {
    return this.errors[fieldName] || '';
  }

  private toNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private applyLockedDepartment(): void {
    if (this.isDepartmentLocked && this.preferredDepartmentId != null) {
      this.departmentId = this.preferredDepartmentId;
    }
  }

  private applyLockedRequester(): void {
    if (this.isRequesterLocked && this.preferredRequesterId != null) {
      this.requesterId = this.preferredRequesterId;
    }
  }

  private updateLockedDepartmentName(): void {
    this.lockedDepartmentName = this.buildLockedDepartmentName();
  }

  private buildLockedDepartmentName(): string {
    if (this.preferredDepartmentId != null) {
      const match = this.departments.find(d => this.toNumber(d.id) === this.preferredDepartmentId);
      if (match) {
        return match.nameEn || match.nameAr || `Department ${match.id}`;
      }
    }
    return this.currentUserDetails?.departmentName || this.fallbackDepartmentName || '';
  }

  get isDepartmentLocked(): boolean {
    return !this.isAdminUser;
  }

  get isRequesterLocked(): boolean {
    return !this.isAdminUser;
  }
}
