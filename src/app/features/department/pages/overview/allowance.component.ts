import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight } from 'lucide-angular';
import { ButtonComponent } from '@components/button/button.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { LookupService, DepartmentDto } from '@services/lookup.service';
import { AmmunitionService } from '@services/ammunition.service';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponService } from '@services/weapon.service';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveService } from '@services/explosive.service';
import { ExplosiveDto } from '@models/explosive.model';
import { ItemType } from '@models/inventory.model';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { ApiResponse } from '@models/api-response.model';
import { ToastService } from '@services/toast.service';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { getLocalizedName, getCurrentLang, type Localizable } from '@utils/localization.utils';
import { TranslationService } from '@services/translation.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { UserContextService } from '@services/user-context.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import type { Observable } from 'rxjs';

export type AllowanceItemType = AmmunitionReadDto | WeaponDto | ExplosiveDto;

/** API response item shape for allowance by department/year */
export interface AllowanceApiItem {
  itemId: number | string;
  itemType?: number | string;
  quantity: number | string;
}

export interface AllowanceItem {
  itemId: string;
  quantity: string;
  selectedItem?: AllowanceItemType;
}

@Component({
  selector: 'app-allowance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    ButtonComponent,
    DropdownComponent,
    HasPermissionDirective
  ],
  templateUrl: './allowance.component.html',
  styleUrls: ['./allowance.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AllowanceComponent implements OnInit {
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  selectedDepartment: number | string | null = null;
  selectedYear: string = ''; // Changed from selectedDate to selectedYear (string input for year only)
  selectedItemType: 'Ammunition' | 'Weapon' | 'Explosive' = 'Ammunition';
  items: AllowanceItem[] = [{ itemId: '', quantity: '' }];

  departments: DepartmentDto[] = [];
  filteredDepartments: DepartmentDto[] = []; // Filtered departments based on user permissions
  isLoadingDepartments = false;
  isAdminUser = false;
  userDepartmentId: number | null = null;
  readonly departmentOptionLabel = (option: DropdownOption<DepartmentDto> | DepartmentDto | null) =>
    this.getLocalizedName(this.unwrapOption(option));

  // Item type options - will be populated with translations
  itemTypeOptions: { value: 'Ammunition' | 'Weapon' | 'Explosive'; label: string }[] = [];

  // Items search (supports all types)
  allItems: AllowanceItemType[] = [];
  filteredItems: { [key: number]: AllowanceItemType[] } = {};
  searchTerms: { [key: number]: string } = {};
  showDropdowns: { [key: number]: boolean } = {};
  private searchSubject = new Subject<{ index: number; term: string }>();

  isSubmitted = false;
  isLoading = false;
  errors: { [key: string]: string } = {};
  itemErrors: { [key: number]: { [key: string]: string } } = {};
  targetItemId: number | null = null;
  allExistingItems: AllowanceApiItem[] = [];

  constructor(
    private lookupService: LookupService,
    private ammunitionService: AmmunitionService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
    private apiService: ApiService,
    private translateService: TranslateService,
    private translationService: TranslationService,
    private router: Router,
    private toastService: ToastService,
    private route: ActivatedRoute,
    private backendAuthService: BackendAuthService,
    private userContextService: UserContextService,
    private cdr: ChangeDetectorRef
  ) {
    // Set default year to current year
    const currentYear = new Date().getFullYear();
    this.selectedYear = currentYear.toString();

    // Initialize user context
    this.initializeUserContext();
  }

  private initializeUserContext(): void {
    // Check if user can view all departments (admin or has permission)
    const hasPermission = this.backendAuthService.hasPermission('AllowanceItemViewAllDepartments');
    this.isAdminUser = this.userContextService.isAdminUser() || hasPermission;

    // Get user's department ID
    const currentUser = this.backendAuthService.getCurrentUser();
    if (currentUser?.departmentId) {
      this.userDepartmentId = currentUser.departmentId;
    }
  }

  ngOnInit(): void {
    this.loadDepartments();
    this.loadItemTypeOptions();

    // Setup search debouncing
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(({ index, term }) => {
      this.filterItems(index, term);
      this.cdr.markForCheck();
    });

    // Subscribe to language changes to reload data with new localized names
    this.translateService.onLangChange.subscribe(() => {
      this.loadDepartments();
      this.loadItemTypeOptions();
      this.loadItems();
      this.cdr.markForCheck();
    });

    // Check for edit mode from query params
    this.route.queryParams.subscribe(params => {
      this.cdr.markForCheck();
      if (params['departmentId'] && params['year'] && (params['edit'] === 'true' || params['edit'] === true || typeof params['edit'] !== 'undefined')) {
        this.selectedDepartment = parseInt(params['departmentId'], 10);
        this.selectedYear = params['year'];
        this.targetItemId = params['itemId'] ? parseInt(params['itemId'], 10) : null;

        // Set item type from query params if provided
        if (params['itemType']) {
          const itype = params['itemType'].toString();

          if (itype === '1' || itype === 'Ammunition') {
            this.selectedItemType = 'Ammunition';
          } else if (itype === '2' || itype === 'Weapon') {
            this.selectedItemType = 'Weapon';
          } else if (itype === '3' || itype === 'Explosive') {
            this.selectedItemType = 'Explosive';
          }
        }

        // Load items with the correct type, then load allowance data
        this.loadItems().then(() => {
          this.loadExistingAllowance(parseInt(params['departmentId'], 10), parseInt(params['year'], 10));
        });
      } else {
        // Not in edit mode, load default items
        this.loadItems();
      }
    });
  }

  loadItems(): Promise<void> {
    return new Promise((resolve) => {
      let load$: Observable<AllowanceItemType[]>;

      if (this.selectedItemType === 'Weapon') {
        load$ = this.weaponService.getAll<WeaponDto>();
      } else if (this.selectedItemType === 'Explosive') {
        load$ = this.explosiveService.getAll<ExplosiveDto>();
      } else {
        // Ammunition (default)
        load$ = this.ammunitionService.getAll<AmmunitionReadDto>();
      }

      load$.subscribe({
        next: (items: AllowanceItemType[]) => {
          this.allItems = items || [];
          // Initialize filtered list for each existing item
          this.items.forEach((_, index) => {
            if (!this.filteredItems[index]) {
              this.filteredItems[index] = [...this.allItems];
            }
          });
          this.cdr.markForCheck();
          resolve();
        },
        error: (_error: unknown) => {
          // Silently handle error - user will see it when trying to use items
          this.allItems = [];
          this.cdr.markForCheck();
          resolve();
        }
      });
    });
  }

  onItemTypeChange(): void {
    // Clear current selections when item type changes
    this.items = [{ itemId: '', quantity: '' }];
    this.searchTerms = {};
    this.showDropdowns = {};
    this.filteredItems = {};
    this.allItems = [];
    // Reload items for the new type
    this.loadItems();
  }

  onItemSearch(index: number, term: string): void {
    this.searchTerms[index] = term || '';
    this.searchSubject.next({ index, term: term || '' });
  }

  filterItems(index: number, term: string): void {
    if (!term || term.trim() === '') {
      this.filteredItems[index] = [...this.allItems];
      return;
    }

    const searchLower = term.toLowerCase().trim();
    this.filteredItems[index] = this.allItems.filter(item =>
      (item.name?.toLowerCase().includes(searchLower)) ||
      (item.itemNo?.toLowerCase().includes(searchLower)) ||
      (item.nsn?.toLowerCase().includes(searchLower)) ||
      (item.id?.toString().includes(searchLower))
    );
  }

  selectItem(index: number, item: AllowanceItemType): void {
    this.items[index].selectedItem = item;
    this.items[index].itemId = item.id.toString();
    this.searchTerms[index] = `${item.name} - ${item.itemNo} - ${item.nsn || ''}`.trim();
    this.showDropdowns[index] = false;
    // Clear error when item is selected
    this.onItemSelectionChange(index);
  }

  toggleDropdown(index: number): void {
    this.showDropdowns[index] = !this.showDropdowns[index];
    if (this.showDropdowns[index] && !this.filteredItems[index]) {
      this.filteredItems[index] = [...this.allItems];
    }
  }

  closeDropdown(index: number): void {
    // Close dropdown when clicking outside
    setTimeout(() => {
      this.showDropdowns[index] = false;
    }, 200);
  }

  getItemDisplay(item: AllowanceItemType): string {
    return `${item.name || ''} - ${item.itemNo || ''} - ${item.nsn || ''}`.trim();
  }


  loadItemTypeOptions(): void {
    this.translateService.get([
      'allowance.ammunition',
      'allowance.weapon',
      'allowance.explosive'
    ]).subscribe(translations => {
      this.itemTypeOptions = [
        { value: 'Ammunition', label: translations['allowance.ammunition'] },
        { value: 'Weapon', label: translations['allowance.weapon'] },
        { value: 'Explosive', label: translations['allowance.explosive'] }
      ];
      this.cdr.markForCheck();
    });
  }

  loadDepartments(): void {
    this.isLoadingDepartments = true;
    this.cdr.markForCheck();
    this.lookupService.getDepartments().subscribe({
      next: (departments: DepartmentDto[]) => {
        this.departments = departments;

        // Filter departments for non-admin users
        if (!this.isAdminUser && this.userDepartmentId !== null) {
          // Non-admin users can only see their own department
          this.filteredDepartments = departments.filter(dept => dept.id === this.userDepartmentId);

          // Pre-select user's department if not already selected
          if (!this.selectedDepartment && this.filteredDepartments.length > 0) {
            this.selectedDepartment = this.userDepartmentId;
          }
        } else {
          // Admin users can see all departments
          this.filteredDepartments = departments;
        }

        this.isLoadingDepartments = false;
        this.cdr.markForCheck();
      },
      error: (_error: unknown) => {
        this.isLoadingDepartments = false;
        this.cdr.markForCheck();
      }
    });
  }

  private getLocalizedName(entity: DepartmentDto | string | number | { label?: string } | null | undefined): string {
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

    return getLocalizedName(entity as Localizable, getCurrentLang(this.translateService));
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

  addItem(): void {
    const newIndex = this.items.length;
    this.items.push({ itemId: '', quantity: '' });
    this.searchTerms[newIndex] = '';
    this.showDropdowns[newIndex] = false;
    this.filteredItems[newIndex] = [...this.allItems];
  }

  removeItem(index: number): void {
    if (this.items.length > 1) {
      this.items.splice(index, 1);
      delete this.itemErrors[index];
      delete this.searchTerms[index];
      delete this.showDropdowns[index];
      delete this.filteredItems[index];

      // Reindex errors, search terms, dropdowns, and filtered items
      const newErrors: { [key: number]: { [key: string]: string } } = {};
      const newSearchTerms: { [key: number]: string } = {};
      const newShowDropdowns: { [key: number]: boolean } = {};
      const newFilteredItems: { [key: number]: AllowanceItemType[] } = {};

      Object.keys(this.itemErrors).forEach(key => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          newErrors[oldIndex - 1] = this.itemErrors[oldIndex];
        } else if (oldIndex < index) {
          newErrors[oldIndex] = this.itemErrors[oldIndex];
        }
      });

      Object.keys(this.searchTerms).forEach(key => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          newSearchTerms[oldIndex - 1] = this.searchTerms[oldIndex];
        } else if (oldIndex < index) {
          newSearchTerms[oldIndex] = this.searchTerms[oldIndex];
        }
      });

      Object.keys(this.showDropdowns).forEach(key => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          newShowDropdowns[oldIndex - 1] = this.showDropdowns[oldIndex];
        } else if (oldIndex < index) {
          newShowDropdowns[oldIndex] = this.showDropdowns[oldIndex];
        }
      });

      Object.keys(this.filteredItems).forEach(key => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          newFilteredItems[oldIndex - 1] = this.filteredItems[oldIndex];
        } else if (oldIndex < index) {
          newFilteredItems[oldIndex] = this.filteredItems[oldIndex];
        }
      });

      this.itemErrors = newErrors;
      this.searchTerms = newSearchTerms;
      this.showDropdowns = newShowDropdowns;
      this.filteredItems = newFilteredItems;
    }
  }

  validateForm(): boolean {
    this.errors = {};
    this.itemErrors = {};
    let isValid = true;

    // Validate department
    if (!this.selectedDepartment || this.selectedDepartment === '' || this.selectedDepartment === null) {
      this.errors['department'] = this.translateService.instant('allowance.errors.departmentRequired');
      isValid = false;
    }

    // Validate year
    if (!this.selectedYear || this.selectedYear.trim() === '') {
      this.errors['year'] = this.translateService.instant('allowance.errors.yearRequired');
      isValid = false;
    } else {
      const year = parseInt(this.selectedYear.trim(), 10);
      if (isNaN(year) || year < 1900 || year > 5000) {
        this.errors['year'] = this.translateService.instant('allowance.errors.yearInvalid');
        isValid = false;
      }
    }

    // Validate items
    this.items.forEach((item, index) => {
      const itemError: { [key: string]: string } = {};

      if (!item.itemId || item.itemId.trim() === '') {
        itemError['itemId'] = this.translateService.instant('allowance.errors.itemIdRequired');
        isValid = false;
      } else if (!item.selectedItem) {
        itemError['itemId'] = this.translateService.instant('allowance.errors.itemIdInvalid');
        isValid = false;
      }

      if (!item.quantity || item.quantity.trim() === '') {
        itemError['quantity'] = this.translateService.instant('allowance.errors.quantityRequired');
        isValid = false;
      } else if (!/^\d+$/.test(item.quantity.trim())) {
        itemError['quantity'] = this.translateService.instant('allowance.errors.quantityInvalid');
        isValid = false;
      }

      if (Object.keys(itemError).length > 0) {
        this.itemErrors[index] = itemError;
      }
    });

    return isValid;
  }

  onSend(form: NgForm): void {
    this.isSubmitted = true;

    if (!this.validateForm()) {
      return;
    }

    // Get year from selectedYear string
    const year = parseInt(this.selectedYear.trim(), 10);

    // Determine itemType based on selectedItemType
    let itemType: number;
    if (this.selectedItemType === 'Weapon') {
      itemType = ItemType.Weapon; // 2
    } else if (this.selectedItemType === 'Explosive') {
      itemType = ItemType.Explosive; // 3
    } else {
      itemType = ItemType.Ammunition; // 1
    }

    // Prepare request data according to API structure
    const requestData = {
      departmentId: typeof this.selectedDepartment === 'number'
        ? this.selectedDepartment
        : parseInt(this.selectedDepartment as string, 10),
      year: year,
      items: [
        ...this.items.map(item => ({
          itemId: parseInt(item.itemId.trim(), 10),
          itemType: itemType,
          quantity: parseInt(item.quantity.trim(), 10)
        })),
        // Include other items that were not being edited if in single-item edit mode
        ...(this.targetItemId !== null
          ? this.allExistingItems
            .filter(ei => ei.itemId !== this.targetItemId)
            .map(ei => ({
              itemId: ei.itemId,
              itemType: ei.itemType || itemType,
              quantity: ei.quantity
            }))
          : [])
      ]
    };

    this.isLoading = true;
    this.errors = {};
    this.cdr.markForCheck();

    this.apiService.postWithAuth<ApiResponse<unknown>>(
      API_ENDPOINTS.ALLOWANCE.BULK,
      requestData
    ).subscribe({
      next: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
        this.translateService.get(['allowance.success.sentSuccessfully', 'toast.success']).subscribe(translations => {
          this.toastService.success(
            translations['allowance.success.sentSuccessfully'],
            translations['toast.success']
          );
        });
        // Navigate back to list after successful submission
        this.router.navigate(['/allowance']);
      },
      error: (error: unknown) => {
        this.isLoading = false;
        this.cdr.markForCheck();

        // Handle 403 Forbidden (authorization errors)
        const err = error as { status?: number };
        if (err?.status === 403) {
          const forbiddenMessage = this.translateService.instant('allowance.errors.unauthorizedAccess');
          this.translateService.get(['toast.error']).subscribe(translations => {
            this.toastService.error(forbiddenMessage, translations['toast.error']);
          });
          this.errors['submit'] = forbiddenMessage;
          return;
        }

        const errorMessage = ErrorHandler.extractErrorMessage(error, this.translateService.instant('allowance.errors.failedToSend'));
        this.translateService.get(['toast.error']).subscribe(translations => {
          this.toastService.error(errorMessage, translations['toast.error']);
        });
        this.errors['submit'] = errorMessage;
      }
    });
  }

  resetForm(): void {
    this.selectedDepartment = null;
    const currentYear = new Date().getFullYear();
    this.selectedYear = currentYear.toString();
    this.selectedItemType = 'Ammunition';
    this.items = [{ itemId: '', quantity: '' }];
    this.errors = {};
    this.itemErrors = {};
    this.searchTerms = {};
    this.showDropdowns = {};
    this.filteredItems = {};
    this.allItems = [];
    this.isSubmitted = false;
    this.loadItems();
  }

  onBack(): void {
    this.router.navigate(['/allowance']);
  }

  loadExistingAllowance(departmentId: number, year: number): void {
    const endpoint = API_ENDPOINTS.ALLOWANCE.BY_DEPARTMENT_AND_YEAR(departmentId, year);
    type AllowanceResponseData = { items?: AllowanceApiItem[]; Items?: AllowanceApiItem[] };
    this.apiService.getWithAuth<ApiResponse<AllowanceResponseData>>(endpoint).subscribe({
      next: (response) => {
        const data = response.data as AllowanceResponseData | undefined;
        const items = data?.items || data?.Items || [];

        if (items && items.length > 0) {
          this.allExistingItems = items;
          // Items are already loaded with correct type from query params
          // Just map them to the form
          this.mapItemsToForm(items);
        } else {
          this.items = [{ itemId: '', quantity: '' }];
        }
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        // Handle 403 Forbidden (authorization errors)
        const err = error as { status?: number };
        if (err?.status === 403) {
          const forbiddenMessage = this.translateService.instant('allowance.errors.unauthorizedAccess');
          this.translateService.get(['toast.error']).subscribe(translations => {
            this.toastService.error(forbiddenMessage, translations['toast.error']);
          });
          this.cdr.markForCheck();
          // Redirect back to list if unauthorized
          setTimeout(() => {
            this.router.navigate(['/allowance']);
          }, 2000);
          return;
        }

        this.translateService.get(['toast.error', 'allowance.errors.failedToLoad']).subscribe(translations => {
          this.toastService.error(
            translations['allowance.errors.failedToLoad'] || 'Failed to load allowance data',
            translations['toast.error']
          );
        });
        // Start with empty form on error
        this.items = [{ itemId: '', quantity: '' }];
        this.cdr.markForCheck();
      }
    });
  }

  private mapItemsToForm(items: AllowanceApiItem[]): void {
    const itemsMap = new Map(this.allItems.map(a => [a.id, a]));

    // Filter items if targetItemId is provided
    let itemsToMap = items;
    if (this.targetItemId !== null) {
      itemsToMap = items.filter(item => Number(item.itemId) === this.targetItemId);
    }

    this.items = itemsToMap.map((item: AllowanceApiItem, index: number) => {
      const itemIdNum = Number(item.itemId);
      const foundItem = itemsMap.get(itemIdNum);
      this.filteredItems[index] = foundItem
        ? [foundItem, ...this.allItems.filter(a => Number(a.id) !== itemIdNum)]
        : [...this.allItems];

      // Set search term to display the selected item
      if (foundItem) {
        this.searchTerms[index] = this.getItemDisplay(foundItem);
      }

      return {
        itemId: item.itemId.toString(),
        quantity: item.quantity.toString(),
        selectedItem: foundItem
      };
    });
  }

  hasError(field: string): boolean {
    return this.isSubmitted && !!this.errors[field];
  }

  getError(field: string): string {
    return this.errors[field] || '';
  }

  hasItemError(itemIndex: number, field: string): boolean {
    return this.isSubmitted && !!this.itemErrors[itemIndex]?.[field];
  }

  getItemError(itemIndex: number, field: string): string {
    return this.itemErrors[itemIndex]?.[field] || '';
  }


  clearError(field: string): void {
    if (this.errors[field]) {
      delete this.errors[field];
    }
  }


  clearItemError(itemIndex: number, field: string): void {
    if (this.itemErrors[itemIndex] && this.itemErrors[itemIndex][field]) {
      delete this.itemErrors[itemIndex][field];
      if (Object.keys(this.itemErrors[itemIndex]).length === 0) {
        delete this.itemErrors[itemIndex];
      }
    }
  }


  onDepartmentChange(): void {
    this.clearError('department');
    if (this.isSubmitted) {
      if (this.selectedDepartment && this.selectedDepartment !== '' && this.selectedDepartment !== null) {
        this.clearError('department');
      } else {
        this.errors['department'] = this.translateService.instant('allowance.errors.departmentRequired');
      }
    }
  }


  onYearChange(): void {
    if (this.isSubmitted) {
      if (!this.selectedYear || !this.selectedYear.trim()) {
        this.errors['year'] = this.translateService.instant('allowance.errors.yearRequired');
      } else {
        const year = parseInt(this.selectedYear.trim(), 10);
        if (isNaN(year) || year < 1900 || year > 5000) {
          this.errors['year'] = this.translateService.instant('allowance.errors.yearInvalid');
        } else {
          this.clearError('year');
        }
      }
    } else {

      this.clearError('year');
    }
  }


  onQuantityChange(itemIndex: number): void {
    this.clearItemError(itemIndex, 'quantity');

    if (this.isSubmitted && this.items[itemIndex]) {
      const quantity = this.items[itemIndex].quantity;
      if (!quantity || quantity.trim() === '') {
        this.itemErrors[itemIndex] = this.itemErrors[itemIndex] || {};
        this.itemErrors[itemIndex]['quantity'] = this.translateService.instant('allowance.errors.quantityRequired');
      } else if (!/^\d+$/.test(quantity.trim())) {
        this.itemErrors[itemIndex] = this.itemErrors[itemIndex] || {};
        this.itemErrors[itemIndex]['quantity'] = this.translateService.instant('allowance.errors.quantityInvalid');
      } else {
        this.clearItemError(itemIndex, 'quantity');
      }
    }
  }


  onItemSelectionChange(itemIndex: number): void {
    this.clearItemError(itemIndex, 'itemId');

    if (this.isSubmitted && this.items[itemIndex]) {
      const item = this.items[itemIndex];
      if (!item.itemId || item.itemId.trim() === '') {
        this.itemErrors[itemIndex] = this.itemErrors[itemIndex] || {};
        this.itemErrors[itemIndex]['itemId'] = this.translateService.instant('allowance.errors.itemIdRequired');
      } else if (!item.selectedItem) {
        this.itemErrors[itemIndex] = this.itemErrors[itemIndex] || {};
        this.itemErrors[itemIndex]['itemId'] = this.translateService.instant('allowance.errors.itemIdInvalid');
      } else {
        this.clearItemError(itemIndex, 'itemId');
      }
    }
  }

}

