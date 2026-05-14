import { Component, OnInit, OnDestroy, AfterViewInit, HostListener, ElementRef, ViewChildren, QueryList, ChangeDetectionStrategy, ChangeDetectorRef, Optional, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { LucideAngularModule, Plus, X, ChevronDown, Search, Send } from 'lucide-angular';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { ReturnService } from '@requests/services/return.service';
import { CreateReturnDto } from '@models/return.model';
import { LookupService } from '@services/lookup.service';
import { AmmunitionService } from '@assets/services/ammunition.service';
import { WeaponService } from '@assets/services/weapon.service';
import { ExplosiveService } from '@assets/services/explosive.service';
import { ToastService } from '@services/toast.service';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { FilterData, PaginatedList, PagedRequest } from '@models/api-response.model';
import { LookupItem } from '@models/lookup.model';
import { Subject, takeUntil, filter, take, switchMap } from 'rxjs';
import { Observable } from 'rxjs';
import { UserContextService } from '@services/user-context.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { BackendUserService } from '@services/backend-user.service';
import { AuthenticatedUser } from '@models/auth.model';
import { BackendUserDto } from '@models/backend-user.model';
import { getLocalizedName, getCurrentLang, Localizable } from '@utils/localization.utils';
import { getFileSizeFromFile, removeFile, validateFile, showFileValidationErrors } from '@utils/file.utils';
import { ConfirmationDialogComponent, ConfirmationType } from '@components/confirmation-dialog/confirmation-dialog.component';
import { VirtualPagedListLoader } from '@components/virtual-paged-list-loader/virtual-paged-list.loader';
import { ErrorHandler } from '@utils/error-handler.utils';
import { ONBOARDING_TOUR } from '@core/tokens/onboarding-tour.token';
import { IOnboardingTourProvider } from '@core/interfaces/onboarding-tour-provider.interface';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';

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

type CatalogListItem = AmmunitionReadDto | WeaponDto | ExplosiveDto;

@Component({
  selector: 'app-return-request',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ButtonComponent,
    LucideAngularModule,
    DropdownComponent,
    ConfirmationDialogComponent
  ],
  templateUrl: './return-request.component.html',
  styleUrls: ['./return-request.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReturnRequestComponent implements OnInit, OnDestroy, AfterViewInit {
  private static readonly CATALOG_PAGE_SIZE = 20;

  readonly Plus = Plus;
  readonly X = X;
  readonly ChevronDown = ChevronDown;
  readonly Search = Search;
  readonly Send = Send;

  // Item type selection
  selectedItemType: 'Ammunition' | 'Weapon' | 'Explosive' = 'Ammunition';

  reason: string = '';
  priority: number = 1;
  notes: string = '';
  requestPurposeNotes: string = '';
  departmentId: number | null = null;
  requesterId: string | null = null;
  requestPurposeId: number | null = null;

  returnItems: ReturnItemForm[] = [];

  // File upload
  selectedFiles: File[] = [];
  fileInputElement: HTMLInputElement | null = null;

  departments: LookupItem[] = [];
  requesters: LookupItem[] = [];
  requestPurposes: RequestPurpose[] = [];
  readonly itemCatalog: VirtualPagedListLoader<CatalogListItem>;
  priorityOptions = [
    { value: 1, labelKey: 'common.priorityLevels.Normal' },
    { value: 2, labelKey: 'common.priorityLevels.Urgent' },
    { value: 3, labelKey: 'common.priorityLevels.VeryUrgent' }
  ];

  isLoading = false;
  isLoadingDepartments = false;
  isLoadingRequesters = false;
  isLoadingRequestPurposes = false;

  isSubmitted = false;
  errors: { [key: string]: string } = {};

  itemDropdownOpen: boolean[] = [];

  @ViewChildren('itemDropdown') itemDropdownRefs?: QueryList<ElementRef<HTMLElement>>;

  // Confirmation dialog state
  showConfirmDialog = false;
  confirmDialogTitle = '';
  confirmDialogMessage = '';
  confirmDialogType: ConfirmationType = 'success';
  confirmDialogConfirmText = '';
  confirmDialogCancelText = '';

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
    private returnService: ReturnService,
    private lookupService: LookupService,
    private ammunitionService: AmmunitionService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
    private toastService: ToastService,
    private apiService: ApiService,
    private translate: TranslateService,
    private router: Router,
    private userContextService: UserContextService,
    private backendAuthService: BackendAuthService,
    private backendUserService: BackendUserService,
    private cdr: ChangeDetectorRef,
    @Optional() @Inject(ONBOARDING_TOUR) private onboardingTourService: IOnboardingTourProvider | null
  ) {
    this.itemCatalog = new VirtualPagedListLoader<CatalogListItem>({
      destroy$: this.destroy$,
      fetchPage: (page) => this.getReturnCatalogPaginated(page),
      markForCheck: () => this.cdr.markForCheck(),
      onFetchError: () => {
        this.translate
          .get(['toast.error', 'returnRequest.errors.failedToLoadItems'])
          .pipe(takeUntil(this.destroy$))
          .subscribe((translations: Record<string, string>) => {
            this.toastService.error(
              translations['returnRequest.errors.failedToLoadItems'] || 'Failed to load items',
              translations['toast.error']
            );
          });
      },
      afterPageLoaded: () => this.ensureReturnCatalogSelectionsMerged(),
      getItemId: (row) => Number(row.id)
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.onboardingTourService?.checkAndStartPageTour('return-request'), 300);
  }

  ngOnInit(): void {
    this.initializeUserContext();
    this.loadDropdownData();
    this.addReturnItem();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeUserContext(): void {
    this.isAdminUser = this.userContextService.isAdminUser();

    this.backendAuthService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.isAdminUser = this.userContextService.isAdminUser();
        this.applyAuthenticatedUserContext(user);
        this.cdr.markForCheck();
      });

    // Wait for a real user before calling getCurrentUserDetails so that
    // authService.getCurrentUser() is non-null and the API call is made.
    this.backendAuthService.currentUser$
      .pipe(
        filter(user => !!user),
        take(1),
        switchMap(() => this.userContextService.getCurrentUserDetails()),
        takeUntil(this.destroy$)
      )
      .subscribe(details => {
        this.currentUserDetails = details;
        this.applyBackendUserDetails(details);
        this.cdr.markForCheck();
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
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:scroll')
  @HostListener('document:scroll')
  onScroll(): void {
    if (this.itemDropdownOpen.some(open => open)) {
      this.closeAllItemDropdowns();
      this.cdr.markForCheck();
    }
  }

  private loadDropdownData(): void {
    this.loadDepartments();
    this.loadRequesters();
    this.loadRequestPurposes();
    this.itemCatalog.loadInitial();
  }

  private buildReturnCatalogPagedRequest(page: number, searchTerm: string): PagedRequest {
    const term = searchTerm.trim();
    let filter: FilterData | undefined;
    if (term) {
      filter = {
        logic: 'or',
        filters: [
          { field: 'Name', operator: 'contains', value: term },
          { field: 'ItemNo', operator: 'contains', value: term }
        ]
      };
    }
    return {
      page,
      pageSize: ReturnRequestComponent.CATALOG_PAGE_SIZE,
      filter
    };
  }

  private getReturnCatalogPaginated(page: number): Observable<PaginatedList<CatalogListItem>> {
    const req = this.buildReturnCatalogPagedRequest(page, this.itemCatalog.searchTerm);
    if (this.selectedItemType === 'Weapon') {
      return this.weaponService.getAllPaginated(req) as Observable<PaginatedList<CatalogListItem>>;
    }
    if (this.selectedItemType === 'Explosive') {
      return this.explosiveService.getAllPaginated(req) as Observable<PaginatedList<CatalogListItem>>;
    }
    return this.ammunitionService.getAllPaginated(req) as Observable<PaginatedList<CatalogListItem>>;
  }

  private ensureReturnCatalogSelectionsMerged(): void {
    for (let i = 0; i < this.returnItems.length; i++) {
      const id = this.returnItems[i]?.itemId;
      if (id == null) {
        continue;
      }
      if (this.itemCatalog.items.some((row) => Number(row.id) === Number(id))) {
        continue;
      }
      this.fetchCatalogRowById(Number(id))
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (row) => {
            if (!row || this.itemCatalog.items.some((x) => Number(x.id) === Number(row.id))) {
              return;
            }
            this.itemCatalog.items = [row, ...this.itemCatalog.items];
            this.cdr.markForCheck();
          },
          error: () => {}
        });
    }
  }

  private fetchCatalogRowById(id: number): Observable<CatalogListItem> {
    if (this.selectedItemType === 'Weapon') {
      return this.weaponService.getById(id) as Observable<CatalogListItem>;
    }
    if (this.selectedItemType === 'Explosive') {
      return this.explosiveService.getById(id) as Observable<CatalogListItem>;
    }
    return this.ammunitionService.getById(id) as Observable<CatalogListItem>;
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
          this.cdr.markForCheck();
        },
        error: () => {
          this.translate.get(['toast.error', 'returnRequest.errors.failedToLoadDepartments']).pipe(takeUntil(this.destroy$)).subscribe((translations: Record<string, string>) => {
            this.toastService.error(
              translations['returnRequest.errors.failedToLoadDepartments'] || 'Failed to load departments',
              translations['toast.error']
            );
          });
          this.isLoadingDepartments = false;
          this.cdr.markForCheck();
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

    this.backendUserService.getUsers({ page: 1, pageSize: 1000 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: PaginatedList<BackendUserDto>) => {
          const users = response.items || [];
          this.requesters = users.map((user: BackendUserDto) => ({
            id: Number(user.id) || 0,
            nameEn: user.nameEn || user.userName || '',
            nameAr: user.nameAr || user.userName || '',
            code: user.userName || ''
          } as LookupItem));
          this.isLoadingRequesters = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.translate.get(['toast.error', 'returnRequest.errors.failedToLoadUsers']).pipe(takeUntil(this.destroy$)).subscribe((translations: Record<string, string>) => {
            this.toastService.error(
              translations['returnRequest.errors.failedToLoadUsers'] || 'Failed to load users',
              translations['toast.error']
            );
          });
          this.requesters = [];
          this.isLoadingRequesters = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadRequestPurposes(): void {
    this.isLoadingRequestPurposes = true;
    this.apiService.get<RequestPurpose[]>(API_ENDPOINTS.REQUEST_PURPOSES.FOR_RETURN)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          if (Array.isArray(data)) {
            this.requestPurposes = data;
          }
          this.isLoadingRequestPurposes = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.translate.get(['toast.error', 'returnRequest.errors.failedToLoadRequestPurposes']).pipe(takeUntil(this.destroy$)).subscribe((translations: Record<string, string>) => {
            this.toastService.error(
              translations['returnRequest.errors.failedToLoadRequestPurposes'] || 'Failed to load request purposes',
              translations['toast.error']
            );
          });
          this.isLoadingRequestPurposes = false;
          this.cdr.markForCheck();
        }
      });
  }

  onItemTypeChange(itemType: 'Ammunition' | 'Weapon' | 'Explosive'): void {
    if (this.selectedItemType !== itemType) {
      this.selectedItemType = itemType;
      this.returnItems.forEach((item) => {
        item.itemId = null;
      });
      this.itemCatalog.loadInitial();
    }
  }

  addReturnItem(): void {
    this.returnItems.push({
      itemId: null,
      quantity: null,
      notes: ''
    });
    this.itemDropdownOpen.push(false);
  }

  removeReturnItem(index: number): void {
    this.returnItems.splice(index, 1);
    this.itemDropdownOpen.splice(index, 1);
  }

  getItemName(itemId: number): string {
    const item = this.itemCatalog.items.find(i => i.id === itemId || String(i.itemNo) === String(itemId));
    return item ? (item.name || item.itemNo || 'Unknown') : 'Unknown';
  }

  getRequesterName(requesterId: string): string {
    // requesterId is now a string (user ID), find in requesters list by converting id to string
    const requester = this.requesters.find(r => String(r.id) === requesterId);
    return requester ? (requester.nameEn || requester.nameAr || 'Unknown') : 'Unknown';
  }

  getDepartmentName(departmentId: number): string {
    const dept = this.departments.find(d => d.id === departmentId);
    return dept ? (dept.nameEn || dept.nameAr || 'Unknown') : 'Unknown';
  }

  getRequestPurposeName(purposeId: number): string {
    const purpose = this.requestPurposes.find(p => p.id === purposeId);
    return purpose ? getLocalizedName(purpose, getCurrentLang(this.translate)) : 'Unknown';
  }

  private getLocalizedName(
    entity: LookupItem | RequestPurpose | string | number | { label: string } | null | undefined
  ): string {
    if (!entity) {
      return '';
    }

    if (typeof entity === 'string') {
      return entity;
    }

    if (typeof entity === 'number') {
      return String(entity);
    }

    if (typeof entity === 'object' && 'label' in entity && typeof entity.label === 'string') {
      return entity.label;
    }

    return getLocalizedName(entity as Localizable, getCurrentLang(this.translate));
  }

  private unwrapOption<T>(option: DropdownOption<T> | T | null): T | null {
    if (!option) {
      return null;
    }
    if (typeof option === 'object' && option !== null && 'value' in option) {
      return option.value as T;
    }
    return option as T;
  }

  toggleItemDropdown(index: number): void {
    if (this.itemCatalog.loading) {
      return;
    }
    const wasOpen = this.itemDropdownOpen[index];
    this.itemDropdownOpen = this.itemDropdownOpen.map((open, i) => (i === index ? !open : false));
    // Opening this row: clear shared search so a previous row's query doesn't stick in the input
    // (switching rows does not go through closeItemDropdown / closeAllItemDropdowns).
    if (!wasOpen && this.itemDropdownOpen[index]) {
      const hadSearch = this.itemCatalog.searchTerm.trim().length > 0;
      this.itemCatalog.resetSharedSearch(hadSearch);
      this.cdr.markForCheck();
      return;
    }
    if (wasOpen && !this.itemDropdownOpen[index]) {
      const hadSearch = this.itemCatalog.searchTerm.trim().length > 0;
      this.itemCatalog.resetSharedSearch(hadSearch);
    }
  }

  closeItemDropdown(index: number): void {
    if (this.itemDropdownOpen[index]) {
      const hadSearch = this.itemCatalog.searchTerm.trim().length > 0;
      this.itemDropdownOpen[index] = false;
      this.itemCatalog.resetSharedSearch(hadSearch);
    }
  }

  closeAllItemDropdowns(): void {
    const hadSearch = this.itemCatalog.searchTerm.trim().length > 0;
    this.itemDropdownOpen = this.itemDropdownOpen.map(() => false);
    this.itemCatalog.resetSharedSearch(hadSearch);
  }

  onItemSelect(index: number, itemOption: CatalogListItem): void {
    const optionValue = itemOption.id ?? itemOption.itemNo ?? null;
    this.returnItems[index].itemId = optionValue;
    this.closeItemDropdown(index);
    // Clear error when item is selected
    this.clearItemError(index, 'itemId');
    if (this.isSubmitted && optionValue) {
      this.clearItemError(index, 'itemId');
    }
  }

  getItemOptionLabel(itemOption: CatalogListItem): string {
    return itemOption?.name || itemOption?.itemNo || 'Unknown';
  }

  getSelectedItemLabel(index: number): string {
    const itemId = this.returnItems[index]?.itemId;
    if (itemId === null || itemId === undefined) {
      return '';
    }
    const selected = this.itemCatalog.items.find(option => this.isSameItem(option, itemId));
    return selected ? this.getItemOptionLabel(selected) : '';
  }

  isOptionSelected(option: CatalogListItem, itemId: string | number | null): boolean {
    return this.isSameItem(option, itemId);
  }

  private isSameItem(option: CatalogListItem, itemId: string | number | null): boolean {
    const optionValue = option?.id ?? option?.itemNo;
    if (optionValue === undefined || optionValue === null) {
      return false;
    }
    return String(optionValue) === String(itemId);
  }

  onSendRequest(_form: NgForm): void {
    this.isSubmitted = true;
    this.errors = {};

    if (!this.departmentId) {
      this.errors['departmentId'] = 'Department is required';
    }

    if (!this.requestPurposeId) {
      this.errors['requestPurposeId'] = 'Request purpose is required';
    }
    if (this.requestPurposeId && !this.requestPurposeNotes.trim()) {
      this.errors['requestPurposeNotes'] = this.translate.instant('returnRequest.errors.requestPurposeNotesRequired');
    }

    if (this.returnItems.length === 0) {
      this.errors['returnItems'] = 'At least one return item is required';
    }

    this.returnItems.forEach((item, index) => {
      if (!item.itemId) {
        this.errors[`returnItem_${index}_itemId`] = 'Item is required';
      }
      const qty = Number(item.quantity);
      if (!item.quantity || !Number.isInteger(qty) || qty <= 0 || !Number.isFinite(qty)) {
        this.errors[`returnItem_${index}_quantity`] = 'Quantity must be a positive whole number';
      }
    });

    if (this.selectedFiles.length === 0) {
      this.errors['selectedFiles'] = this.translate.instant('returnRequest.errors.filesRequired');
    }

    if (Object.keys(this.errors).length > 0) {
      return;
    }

    // Show confirmation dialog
    this.translate.get([
      'returnRequest.confirmDialog.title',
      'returnRequest.confirmDialog.message',
      'common.yes',
      'common.cancel'
    ]).pipe(takeUntil(this.destroy$)).subscribe((translations: Record<string, string>) => {
      this.confirmDialogTitle = translations['returnRequest.confirmDialog.title'] || 'Confirm Request';
      this.confirmDialogMessage = translations['returnRequest.confirmDialog.message'] || 'Are you sure you want to submit this return request?';
      this.confirmDialogConfirmText = translations['common.yes'] || 'Yes';
      this.confirmDialogCancelText = translations['common.cancel'] || 'Cancel';
      this.confirmDialogType = 'success';
      this.showConfirmDialog = true;
    });
  }

  onConfirmSubmit(): void {
    this.showConfirmDialog = false;
    this.submitReturnRequest();
  }

  onCancelConfirm(): void {
    this.showConfirmDialog = false;
  }

  private submitReturnRequest(): void {
    const createReturnDto: CreateReturnDto = {
      reason: this.reason || undefined,
      priority: Number(this.priority),
      notes: this.notes || undefined,
      requestPurposeNotes: this.requestPurposeNotes || undefined,
      departmentId: Number(this.departmentId!),
      requesterId: undefined,
      requestPurposeId: Number(this.requestPurposeId!),
      returnItems: this.returnItems
        .filter(item => item.itemId && item.quantity)
        .map(item => ({
          itemId: Number(item.itemId!),
          quantity: Number(item.quantity!),
          notes: item.notes || undefined
        }))
    };

    this.isLoading = true;
    const filesToUpload = this.selectedFiles.length > 0 ? this.selectedFiles : undefined;
    this.returnService.createReturn(createReturnDto, filesToUpload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (_returnId) => {
          // Toast notification is handled by backend SignalR notification
          this.resetForm();
          this.isLoading = false;

          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 1000);
        },
        error: (error: unknown) => {
          const errorMessage = ErrorHandler.extractAndTranslateErrorMessage(error, 'Failed to create return request', this.translate);

          this.translate.get(['toast.error']).pipe(takeUntil(this.destroy$)).subscribe((translations: Record<string, string>) => {
            this.toastService.error(errorMessage, translations['toast.error']);
          });
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

  clearError(fieldName: string): void {
    if (this.errors[fieldName]) delete this.errors[fieldName];
  }

  clearItemError(index: number, field: string): void {
    const errorKey = `returnItem_${index}_${field}`;
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
    if (!this.requestPurposeId) {
      this.requestPurposeNotes = '';
      this.clearError('requestPurposeNotes');
      return;
    }
    if (this.isSubmitted && this.requestPurposeNotes.trim().length === 0) {
      this.errors['requestPurposeNotes'] = this.translate.instant('returnRequest.errors.requestPurposeNotesRequired');
    }
  }

  onRequestPurposeNotesChange(): void {
    this.clearError('requestPurposeNotes');
    if (this.isSubmitted && this.requestPurposeId && this.requestPurposeNotes.trim().length === 0) {
      this.errors['requestPurposeNotes'] = this.translate.instant('returnRequest.errors.requestPurposeNotesRequired');
    }
  }

  onQuantityChange(index: number): void {
    this.clearItemError(index, 'quantity');
    if (this.isSubmitted && this.returnItems[index]?.quantity && this.returnItems[index].quantity! > 0) {
      this.clearItemError(index, 'quantity');
    }
  }

  /**
   * Block invalid characters in quantity field (e, E, +, -, .) to allow only positive integers.
   */
  onQuantityKeydown(event: KeyboardEvent): void {
    const allowedKeys = ['Backspace', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete', 'Home', 'End'];
    if (allowedKeys.includes(event.key)) return;
    if (/[0-9]/.test(event.key)) return;
    if (['e', 'E', '+', '-', '.'].includes(event.key)) {
      event.preventDefault();
    }
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
    if (!details) {
      return;
    }

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
    this.requestPurposeNotes = '';
    if (this.isDepartmentLocked) {
      this.departmentId = this.preferredDepartmentId;
      this.lockedDepartmentName = this.buildLockedDepartmentName();
      this.applyLockedRequester();
    } else {
      this.departmentId = null;
      this.requesterId = null;
    }
    this.requestPurposeId = null;
    this.returnItems = [];
    this.itemDropdownOpen = [];
    this.addReturnItem();
    this.selectedFiles = [];
    if (this.fileInputElement) {
      this.fileInputElement.value = '';
    }
    this.isSubmitted = false;
    this.errors = {};
    // Reset item type to default and reload catalog (first page from API)
    this.selectedItemType = 'Ammunition';
    this.itemCatalog.loadInitial();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const newFiles = Array.from(input.files);
      const invalidFiles: string[] = [];
      const validFiles: File[] = [];

      // Validate file types and sizes, separate valid/invalid files
      newFiles.forEach(file => {
        const validation = validateFile(file);
        if (!validation.isValid) {
          invalidFiles.push(validation.errorMessage);
        } else {
          validFiles.push(file);
        }
      });

      // Show error message if any files are invalid
      if (invalidFiles.length > 0) {
        showFileValidationErrors(this.translate, this.toastService, invalidFiles, 'returnRequest');
      }

      // Add only valid files to the selection
      if (validFiles.length > 0) {
        this.selectedFiles = [...this.selectedFiles, ...validFiles];
        this.clearError('selectedFiles');
      }

      this.fileInputElement = input;
      // Clear the input so the same file can be selected again
      input.value = '';
    }
  }

  removeFile(index: number): void {
    removeFile(this.selectedFiles, index, this.fileInputElement);
    if (this.selectedFiles.length > 0) {
      this.clearError('selectedFiles');
    }
  }

  getFileSize = getFileSizeFromFile;

  private toNumber(value: unknown): number | null {
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

  private updateLockedDepartmentName(): void {
    this.lockedDepartmentName = this.buildLockedDepartmentName();
  }

  private buildLockedDepartmentName(): string {
    if (this.preferredDepartmentId != null) {
      const match = this.departments.find(d => this.toNumber(d.id) === this.preferredDepartmentId);
      if (match) return match.nameEn || match.nameAr || `Department ${match.id}`;
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
