import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { LucideAngularModule, Plus, X, ChevronDown, Search } from 'lucide-angular';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
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
import { BackendUserService } from '@services/backend-user.service';
import { AuthenticatedUser } from '@models/auth.model';
import { BackendUserDto } from '@models/backend-user.model';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

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
    LucideAngularModule,
    DropdownComponent
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
  requesterId: string | null = null;
  requestPurposeId: number | null = null;

  // Discard items array
  discardItems: DiscardItemForm[] = [];

  departments: LookupItem[] = [];
  requesters: LookupItem[] = [];
  requestPurposes: RequestPurpose[] = [];
  items: any[] = [];
  priorityOptions = [
    { value: 1, labelKey: 'discardRequest.high' },
    { value: 2, labelKey: 'discardRequest.medium' },
    { value: 3, labelKey: 'discardRequest.low' }
  ];

  isLoading = false;
  isLoadingDepartments = false;
  isLoadingRequesters = false;
  isLoadingRequestPurposes = false;
  isLoadingItems = false;

  isSubmitted = false;
  errors: { [key: string]: string } = {};

  itemDropdownSearchTerms: string[] = [];
  itemDropdownOpen: boolean[] = [];

  @ViewChildren('itemDropdown') itemDropdownRefs?: QueryList<ElementRef<HTMLElement>>;

  private destroy$ = new Subject<void>();
  currentUserDetails: BackendUserDto | null = null;
  isAdminUser = false;
  private preferredDepartmentId: number | null = null;
  private preferredRequesterId: string | null = null;
  private fallbackDepartmentName = '';
  private fallbackRequesterName = '';
  lockedDepartmentName = '';
  lockedRequesterName = '';
  readonly departmentOptionLabel = (option: DropdownOption<LookupItem> | LookupItem | null) =>
    this.getLocalizedName(this.unwrapOption(option));
  readonly requesterOptionLabel = (option: DropdownOption<LookupItem> | LookupItem | null) =>
    this.getLocalizedName(this.unwrapOption(option));
  readonly requestPurposeOptionLabel = (option: DropdownOption<RequestPurpose> | RequestPurpose | null) =>
    this.getLocalizedName(this.unwrapOption(option));

  constructor(
    private discardService: DiscardService,
    private lookupService: LookupService,
    private ammunitionService: AmmunitionService,
    private toastService: ToastService,
    private apiService: ApiService,
    private translate: TranslateService,
    private router: Router,
    private userContextService: UserContextService,
    private backendAuthService: BackendAuthService,
    private backendUserService: BackendUserService
  ) {}

  ngOnInit(): void {
    this.initializeUserContext();
    this.loadDropdownData();
    this.addDiscardItem();
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

  private loadDropdownData(): void {
    this.loadDepartments();
    this.loadRequesters();
    this.loadRequestPurposes();
    this.loadItems();
  }

  private loadDepartments(): void {
    this.isLoadingDepartments = true;
    this.lookupService.getDepartments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (departments) => {
          this.departments = departments;
          this.isLoadingDepartments = false;
          if (this.currentUserDetails) {
            this.applyBackendUserDetails(this.currentUserDetails);
          }
          const authUser = this.backendAuthService.getCurrentUser();
          if (authUser) {
            this.applyAuthenticatedUserContext(authUser);
          }
          this.updateLockedDepartmentName();
          this.applyLockedDepartment();
        },
        error: () => {
          this.translate.get(['toast.error', 'discardRequest.errors.failedToLoadDepartments']).subscribe((translations: any) => {
            this.toastService.error(
              translations['discardRequest.errors.failedToLoadDepartments'] || 'Failed to load departments',
              translations['toast.error']
            );
          });
          this.isLoadingDepartments = false;
        }
      });
  }

  private loadRequesters(): void {
    this.isLoadingRequesters = true;
    if (!this.isAdminUser) {
      this.requesters = [];
      this.isLoadingRequesters = false;
      return;
    }

    this.backendUserService.getUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.requesters = users.map(user => ({
            id: Number(user.id) || 0,
            nameEn: user.nameEn || user.userName || '',
            nameAr: user.nameAr || user.userName || '',
            code: user.userName || ''
          } as LookupItem));
          this.isLoadingRequesters = false;
        },
        error: () => {
          this.toastService.error('Failed to load users.');
          this.requesters = [];
          this.isLoadingRequesters = false;
        }
      });
  }

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
        error: () => {
          this.translate.get(['toast.error', 'discardRequest.errors.failedToLoadRequestPurposes']).subscribe((translations: any) => {
            this.toastService.error(
              translations['discardRequest.errors.failedToLoadRequestPurposes'] || 'Failed to load request purposes',
              translations['toast.error']
            );
          });
          this.isLoadingRequestPurposes = false;
        }
      });
  }

  private loadItems(): void {
    this.isLoadingItems = true;
    this.ammunitionService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          this.items = items || [];
          this.isLoadingItems = false;
        },
        error: () => {
          this.translate.get(['toast.error', 'discardRequest.errors.failedToLoadItems']).subscribe((translations: any) => {
            this.toastService.error(
              translations['discardRequest.errors.failedToLoadItems'] || 'Failed to load items',
              translations['toast.error']
            );
          });
          this.isLoadingItems = false;
        }
      });
  }

  addDiscardItem(): void {
    this.discardItems.push({
      itemId: null,
      quantity: null,
      notes: ''
    });
    this.itemDropdownSearchTerms.push('');
    this.itemDropdownOpen.push(false);
  }

  removeDiscardItem(index: number): void {
    this.discardItems.splice(index, 1);
    this.itemDropdownSearchTerms.splice(index, 1);
    this.itemDropdownOpen.splice(index, 1);
  }

  private validateForm(): void {
    this.errors = {};

    if (!this.departmentId) this.errors['departmentId'] = 'Department is required';

    if (!this.requestPurposeId) this.errors['requestPurposeId'] = 'Request Purpose is required';

    const validItems = this.discardItems.filter(item => item.itemId && item.quantity);
    if (validItems.length === 0) this.errors['discardItems'] = 'At least one discard item is required';

    this.discardItems.forEach((item, index) => {
      if (item.itemId && !item.quantity) this.errors[`discardItems.${index}.quantity`] = 'Quantity is required';
      if (!item.itemId && item.quantity) this.errors[`discardItems.${index}.itemId`] = 'Item is required';
    });
  }

  toggleItemDropdown(index: number): void {
    if (this.isLoadingItems) return;

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
    // Clear error when item is selected
    this.clearItemError(index, 'itemId');
    if (this.isSubmitted && optionValue) this.clearItemError(index, 'itemId');
  }

  getItemOptionLabel(itemOption: any): string {
    return itemOption?.name || itemOption?.itemNo || 'Unknown';
  }

  getSelectedItemLabel(index: number): string {
    const itemId = this.discardItems[index]?.itemId;
    if (itemId === null || itemId === undefined) return '';

    const selected = this.items.find(option => this.isSameItem(option, itemId));
    return selected ? this.getItemOptionLabel(selected) : '';
  }

  getFilteredItems(index: number): any[] {
    if (!this.items?.length) return [];

    const term = (this.itemDropdownSearchTerms[index] || '').trim().toLowerCase();
    if (!term) return this.items;

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
    if (optionValue === undefined || optionValue === null) return false;

    return String(optionValue) === String(itemId);
  }

  private getLocalizedName(entity: any): string {
    if (!entity) return '';

    if (typeof entity === 'string') return entity;
    if (typeof entity === 'number') return String(entity);
    if (typeof entity === 'object' && 'label' in entity && typeof entity.label === 'string') return entity.label;

    return getLocalizedName(entity, getCurrentLang(this.translate));
  }

  private unwrapOption<T>(option: DropdownOption<T> | T | null): T | null {
    if (!option) return null;

    if (typeof option === 'object' && option !== null && 'value' in option) return option.value as T;
    return option as T;
  }

  onSendRequest(form: NgForm): void {
    this.isSubmitted = true;
    this.validateForm();

    if (Object.keys(this.errors).length > 0) {
      this.translate.get(['toast.error', 'discardRequest.errors.correctFormErrors']).subscribe((translations: any) => {
        this.toastService.error(
          translations['discardRequest.errors.correctFormErrors'] || 'Please correct the form errors',
          translations['toast.error']
        );
      });
      return;
    }

    const createDiscardDto: CreateDiscardDto = {
      reason: this.reason || undefined,
      priority: Number(this.priority),
      notes: this.notes || undefined,
      departmentId: Number(this.departmentId!),
      requesterId: undefined,
      requestPurposeId: Number(this.requestPurposeId!),
      discardItems: this.discardItems
        .filter(item => item.itemId && item.quantity)
        .map(item => ({
          itemId: Number(item.itemId!),
          quantity: Number(item.quantity!),
          notes: item.notes || undefined
        }))
    };

    this.isLoading = true;
    this.discardService.createDiscard(createDiscardDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (discardId) => {
          this.translate.get(['toast.success', 'discardRequest.success.created']).subscribe((translations: any) => {
            this.toastService.success(
              translations['discardRequest.success.created'] || 'Discard request created successfully',
              translations['toast.success']
            );
          });
          this.resetForm();
          this.isLoading = false;

          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 1000);
        },
        error: (error) => {
          let errorMessage = 'Failed to create discard request';
          if (error.error?.errors) {
            const errors = error.error.errors;
            const errorMessages: string[] = [];

            if (errors.dto) errorMessages.push(...errors.dto);
            if (errors['$.priority']) errorMessages.push(`Priority: ${errors['$.priority'].join(', ')}`);
            if (errors['$.departmentId']) errorMessages.push(`Department: ${errors['$.departmentId'].join(', ')}`);
            if (errors['$.requestPurposeId']) errorMessages.push(`Request Purpose: ${errors['$.requestPurposeId'].join(', ')}`);
            if (errors['$.discardItems']) errorMessages.push(`Discard Items: ${errors['$.discardItems'].join(', ')}`);

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
    if (!user) return;

    this.applyUserContext({
      nameEn: user.nameEn,
      nameAr: user.nameAr,
      userName: user.userName,
      departmentId: user.departmentId,
      departmentName: user.departmentName
    });
  }

  private applyBackendUserDetails(details: BackendUserDto | null): void {
    if (!details) return;

    this.applyUserContext({
      nameEn: details.nameEn,
      nameAr: details.nameAr,
      userName: details.userName,
      departmentId: details.departmentId,
      departmentName: details.departmentName
    });
  }

  private applyUserContext(context: {
    nameEn?: string | null;
    nameAr?: string | null;
    userName?: string | null;
    departmentId?: number | string | null;
    departmentName?: string | null;
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

    // Set RequesterId to the current user's ID (string)
    const currentUser = this.backendAuthService.getCurrentUser();
    if (currentUser?.id) {
      this.preferredRequesterId = currentUser.id;
    } else {
      this.preferredRequesterId = null;
    }
    this.applyLockedRequester();
  }

  private resolveRequesterDisplayName(
    nameEn?: string | null,
    nameAr?: string | null,
    userName?: string | null
  ): string | null {
    if (nameEn && nameEn.trim().length > 0) return nameEn;
    if (nameAr && nameAr.trim().length > 0) return nameAr;
    if (userName && userName.trim().length > 0) return userName;
    return null;
  }

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
    this.addDiscardItem();
    this.isSubmitted = false;
    this.errors = {};
  }

  hasError(fieldName: string): boolean {
    return this.isSubmitted && !!this.errors[fieldName];
  }

  getError(fieldName: string): string {
    return this.errors[fieldName] || '';
  }

  clearError(fieldName: string): void {
    if (this.errors[fieldName]) delete this.errors[fieldName];
  }

  clearItemError(index: number, field: string): void {
    const errorKey = `discardItems.${index}.${field}`;
    this.clearError(errorKey);
  }

  onPriorityChange(): void {
    this.clearError('priority');
  }

  onDepartmentChange(): void {
    this.clearError('departmentId');
    if (this.isSubmitted && this.departmentId) this.clearError('departmentId');
  }

  onRequestPurposeChange(): void {
    this.clearError('requestPurposeId');
    if (this.isSubmitted && this.requestPurposeId) this.clearError('requestPurposeId');
  }

  onQuantityChange(index: number): void {
    this.clearItemError(index, 'quantity');
    if (this.isSubmitted && this.discardItems[index]?.quantity) this.clearItemError(index, 'quantity');
  }

  private toNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private applyLockedDepartment(): void {
    if (this.isDepartmentLocked && this.preferredDepartmentId != null) this.departmentId = this.preferredDepartmentId;
  }

  private applyLockedRequester(): void {
    if (this.isRequesterLocked && this.preferredRequesterId != null) this.requesterId = this.preferredRequesterId;
  }

  getRequesterName(requesterId: string): string {
    // requesterId is now a string (user ID), find in requesters list by converting id to string
    const requester = this.requesters.find(r => String(r.id) === requesterId);
    return requester ? getLocalizedName(requester, getCurrentLang(this.translate)) || 'Unknown' : 'Unknown';
  }

  private updateLockedDepartmentName(): void {
    this.lockedDepartmentName = this.buildLockedDepartmentName();
  }

  private buildLockedDepartmentName(): string {
    if (this.preferredDepartmentId != null) {
      const match = this.departments.find(d => this.toNumber(d.id) === this.preferredDepartmentId);
      if (match) return getLocalizedName(match, getCurrentLang(this.translate)) || `Department ${match.id}`;
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
