import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LucideAngularModule, ArrowLeft, ArrowRight } from 'lucide-angular';
import { ButtonComponent } from '@components/button/button.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { LookupService, DepartmentDto } from '@services/lookup.service';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { ToastService } from '@services/toast.service';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { getLocalizedName, getCurrentLang, type Localizable } from '@utils/localization.utils';
import { TranslationService } from '@services/translation.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { UserContextService } from '@services/user-context.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { trackById, trackByIndex } from '@utils/trackby.utils';
import { ItemType } from '@models/inventory.model';
import type {
  AllowanceItem,
  AllowanceItemType,
  AllowanceApiItem,
  AllowanceItemTypeKey,
} from './models/allowance.model';
import { AllowanceService } from './services/allowance.service';

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
    HasPermissionDirective,
  ],
  templateUrl: './allowance.component.html',
  styleUrls: ['./allowance.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllowanceComponent implements OnInit, OnDestroy {
  private readonly lookupService = inject(LookupService);
  private readonly apiService = inject(ApiService);
  private readonly translateService = inject(TranslateService);
  private readonly translationService = inject(TranslationService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly backendAuthService = inject(BackendAuthService);
  private readonly userContextService = inject(UserContextService);
  private readonly allowanceService = inject(AllowanceService);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject = new Subject<{ index: number; term: string }>();

  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly trackById = trackById;
  readonly trackByIndex = trackByIndex;

  selectedDepartment: number | string | null = null;
  selectedYear: string = '';
  selectedItemType: AllowanceItemTypeKey = 'Ammunition';
  items: AllowanceItem[] = [{ itemId: '', quantity: '' }];

  departments: DepartmentDto[] = [];
  filteredDepartments: DepartmentDto[] = [];
  isLoadingDepartments = false;
  isAdminUser = false;
  userDepartmentId: number | null = null;
  readonly departmentOptionLabel = (option: DropdownOption<DepartmentDto> | DepartmentDto | null) =>
    this.getLocalizedName(this.unwrapOption(option));

  itemTypeOptions: { value: AllowanceItemTypeKey; label: string }[] = [];

  allItems: AllowanceItemType[] = [];
  filteredItems: Record<number, AllowanceItemType[]> = {};
  searchTerms: Record<number, string> = {};
  showDropdowns: Record<number, boolean> = {};

  isSubmitted = false;
  isLoading = false;
  errors: Record<string, string> = {};
  itemErrors: Record<number, Record<string, string>> = {};
  targetItemId: number | null = null;
  allExistingItems: AllowanceApiItem[] = [];

  constructor() {
    this.selectedYear = new Date().getFullYear().toString();
    this.initializeUserContext();
  }

  private initializeUserContext(): void {
    const hasPermission = this.backendAuthService.hasPermission('AllowanceItemViewAllDepartments');
    this.isAdminUser = this.userContextService.isAdminUser() || hasPermission;
    const currentUser = this.backendAuthService.getCurrentUser();
    if (currentUser?.departmentId) {
      this.userDepartmentId = currentUser.departmentId;
    }
  }

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  ngOnInit(): void {
    this.setupSearchDebounce();
    this.setupLangChange();
    this.setupQueryParams();
    this.loadDepartments();
    this.loadItemTypeOptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearchDebounce(): void {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(({ index, term }) => {
        this.filterItems(index, term);
        this.cdr.markForCheck();
      });
  }

  private setupLangChange(): void {
    this.translateService.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadDepartments();
        this.loadItemTypeOptions();
        this.loadItems();
        this.cdr.markForCheck();
      });
  }

  private setupQueryParams(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.cdr.markForCheck();
      const hasEditParams =
        params['departmentId'] &&
        params['year'] &&
        (params['edit'] === 'true' || params['edit'] === true || typeof params['edit'] !== 'undefined');

      if (hasEditParams) {
        this.selectedDepartment = parseInt(params['departmentId'], 10);
        this.selectedYear = params['year'];
        this.targetItemId = params['itemId'] ? parseInt(params['itemId'], 10) : null;

        if (params['itemType']) {
          const itype = params['itemType'].toString();
          if (itype === '1' || itype === 'Ammunition') this.selectedItemType = 'Ammunition';
          else if (itype === '2' || itype === 'Weapon') this.selectedItemType = 'Weapon';
          else if (itype === '3' || itype === 'Explosive') this.selectedItemType = 'Explosive';
        }

        this.loadItems().then(() => {
          this.loadExistingAllowance(
            parseInt(params['departmentId'], 10),
            parseInt(params['year'], 10)
          );
        });
      } else {
        this.loadItems();
      }
    });
  }

  loadItems(): Promise<void> {
    return new Promise((resolve) => {
      this.allowanceService
        .getItemsByType(this.selectedItemType)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (items) => {
            this.allItems = items || [];
            this.items.forEach((_, index) => {
              if (!this.filteredItems[index]) {
                this.filteredItems[index] = [...this.allItems];
              }
            });
            this.cdr.markForCheck();
            resolve();
          },
          error: () => {
            this.allItems = [];
            this.cdr.markForCheck();
            resolve();
          },
        });
    });
  }

  onItemTypeChange(): void {
    this.items = [{ itemId: '', quantity: '' }];
    this.searchTerms = {};
    this.showDropdowns = {};
    this.filteredItems = {};
    this.allItems = [];
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
    this.filteredItems[index] = this.allItems.filter(
      (item) =>
        item.name?.toLowerCase().includes(searchLower) ||
        item.itemNo?.toLowerCase().includes(searchLower) ||
        item.nsn?.toLowerCase().includes(searchLower) ||
        item.id?.toString().includes(searchLower)
    );
  }

  selectItem(index: number, item: AllowanceItemType): void {
    this.items[index].selectedItem = item;
    this.items[index].itemId = item.id.toString();
    this.searchTerms[index] = `${item.name} - ${item.itemNo} - ${item.nsn || ''}`.trim();
    this.showDropdowns[index] = false;
    this.onItemSelectionChange(index);
  }

  toggleDropdown(index: number): void {
    this.showDropdowns[index] = !this.showDropdowns[index];
    if (this.showDropdowns[index] && !this.filteredItems[index]) {
      this.filteredItems[index] = [...this.allItems];
    }
  }

  closeDropdown(index: number): void {
    setTimeout(() => {
      this.showDropdowns[index] = false;
    }, 200);
  }

  getItemDisplay(item: AllowanceItemType): string {
    return `${item.name || ''} - ${item.itemNo || ''} - ${item.nsn || ''}`.trim();
  }

  loadItemTypeOptions(): void {
    this.translateService
      .get(['allowance.ammunition', 'allowance.weapon', 'allowance.explosive'])
      .pipe(takeUntil(this.destroy$))
      .subscribe((translations) => {
        this.itemTypeOptions = [
          { value: 'Ammunition', label: translations['allowance.ammunition'] },
          { value: 'Weapon', label: translations['allowance.weapon'] },
          { value: 'Explosive', label: translations['allowance.explosive'] },
        ];
        this.cdr.markForCheck();
      });
  }

  loadDepartments(): void {
    this.isLoadingDepartments = true;
    this.cdr.markForCheck();
    this.allowanceService
      .getDepartments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (departments) => {
          this.departments = departments;
          if (!this.isAdminUser && this.userDepartmentId !== null) {
            this.filteredDepartments = departments.filter((d) => d.id === this.userDepartmentId);
            if (!this.selectedDepartment && this.filteredDepartments.length > 0) {
              this.selectedDepartment = this.userDepartmentId;
            }
          } else {
            this.filteredDepartments = departments;
          }
          this.isLoadingDepartments = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingDepartments = false;
          this.cdr.markForCheck();
        },
      });
  }

  private getLocalizedName(
    entity: DepartmentDto | string | number | { label?: string } | null | undefined
  ): string {
    if (!entity) return '';
    if (typeof entity === 'string') return entity;
    if (typeof entity === 'number') return String(entity);
    if (typeof entity === 'object' && 'label' in entity && typeof entity.label === 'string') {
      return entity.label;
    }
    return getLocalizedName(entity as Localizable, getCurrentLang(this.translateService));
  }

  private unwrapOption<T>(option: DropdownOption<T> | T | null): T | null {
    if (!option) return null;
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
    if (this.items.length <= 1) return;
    this.items.splice(index, 1);
    delete this.itemErrors[index];
    delete this.searchTerms[index];
    delete this.showDropdowns[index];
    delete this.filteredItems[index];

    const reindex = <T extends Record<number, unknown>>(obj: T): T => {
      const result = {} as T;
      Object.keys(obj).forEach((key) => {
        const oldIndex = parseInt(key, 10);
        if (oldIndex > index) (result as Record<number, unknown>)[oldIndex - 1] = obj[oldIndex];
        else if (oldIndex < index) (result as Record<number, unknown>)[oldIndex] = obj[oldIndex];
      });
      return result;
    };

    this.itemErrors = reindex(this.itemErrors);
    this.searchTerms = reindex(this.searchTerms);
    this.showDropdowns = reindex(this.showDropdowns);
    this.filteredItems = reindex(this.filteredItems);
  }

  validateForm(): boolean {
    this.errors = {};
    this.itemErrors = {};
    let isValid = true;

    if (!this.selectedDepartment || this.selectedDepartment === '' || this.selectedDepartment === null) {
      this.errors['department'] = this.translateService.instant('allowance.errors.departmentRequired');
      isValid = false;
    }

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

    this.items.forEach((item, index) => {
      const itemError: Record<string, string> = {};
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
      if (Object.keys(itemError).length > 0) this.itemErrors[index] = itemError;
    });

    return isValid;
  }

  onSend(form: NgForm): void {
    this.isSubmitted = true;
    if (!this.validateForm()) return;

    const year = parseInt(this.selectedYear.trim(), 10);
    const itemType =
      this.selectedItemType === 'Weapon'
        ? ItemType.Weapon
        : this.selectedItemType === 'Explosive'
          ? ItemType.Explosive
          : ItemType.Ammunition;

    const departmentId =
      typeof this.selectedDepartment === 'number'
        ? this.selectedDepartment
        : parseInt(this.selectedDepartment as string, 10);

    const requestData = {
      departmentId,
      year,
      items: [
        ...this.items.map((item) => ({
          itemId: parseInt(item.itemId.trim(), 10),
          itemType,
          quantity: parseInt(item.quantity.trim(), 10),
        })),
        ...(this.targetItemId !== null
          ? this.allExistingItems
              .filter((ei) => ei.itemId !== this.targetItemId)
              .map((ei) => ({
                  itemId: Number(ei.itemId),
                  itemType: Number(ei.itemType ?? itemType),
                  quantity: Number(ei.quantity),
                }))
          : []),
      ],
    };

    this.isLoading = true;
    this.errors = {};
    this.cdr.markForCheck();

    this.apiService.post<void>(
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
        this.router.navigate(['/department/allowance']);
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
    this.selectedYear = new Date().getFullYear().toString();
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
    this.router.navigate(['/department/allowance'], { queryParams: this.getBackQueryParams() });
  }

  /** Preserve pagination when navigating back to list (Angular best practice: URL-driven state) */
  private getBackQueryParams(): { page?: number } {
    const page = this.route.snapshot.queryParamMap.get('page');
    if (page) {
      const parsed = parseInt(page, 10);
      if (!isNaN(parsed) && parsed >= 1) {
        return { page: parsed };
      }
    }
    return {};
  }

  loadExistingAllowance(departmentId: number, year: number): void {
    const endpoint = API_ENDPOINTS.ALLOWANCE.BY_DEPARTMENT_AND_YEAR(departmentId, year);
    type AllowanceResponseData = { items?: AllowanceApiItem[]; Items?: AllowanceApiItem[] };
    this.apiService.get<AllowanceResponseData>(endpoint).subscribe({
      next: (data) => {
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
            this.router.navigate(['/department/allowance']);
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
    const itemsMap = new Map(this.allItems.map((a) => [a.id, a]));
    let itemsToMap = items;
    if (this.targetItemId !== null) {
      itemsToMap = items.filter((item) => Number(item.itemId) === this.targetItemId);
    }

    this.items = itemsToMap.map((item, index) => {
      const itemIdNum = Number(item.itemId);
      const foundItem = itemsMap.get(itemIdNum);
      this.filteredItems[index] = foundItem
        ? [foundItem, ...this.allItems.filter((a) => Number(a.id) !== itemIdNum)]
        : [...this.allItems];
      if (foundItem) this.searchTerms[index] = this.getItemDisplay(foundItem);
      return {
        itemId: item.itemId.toString(),
        quantity: item.quantity.toString(),
        selectedItem: foundItem,
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
    if (this.errors[field]) delete this.errors[field];
  }

  clearItemError(itemIndex: number, field: string): void {
    if (this.itemErrors[itemIndex]?.[field]) {
      delete this.itemErrors[itemIndex][field];
      if (Object.keys(this.itemErrors[itemIndex]).length === 0) {
        delete this.itemErrors[itemIndex];
      }
    }
  }

  onDepartmentChange(): void {
    this.clearError('department');
    if (this.isSubmitted && (!this.selectedDepartment || this.selectedDepartment === '' || this.selectedDepartment === null)) {
      this.errors['department'] = this.translateService.instant('allowance.errors.departmentRequired');
    }
  }

  onYearChange(): void {
    if (this.isSubmitted) {
      if (!this.selectedYear?.trim()) {
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
      const q = this.items[itemIndex].quantity;
      if (!q?.trim()) {
        (this.itemErrors[itemIndex] ??= {})['quantity'] = this.translateService.instant(
          'allowance.errors.quantityRequired'
        );
      } else if (!/^\d+$/.test(q.trim())) {
        (this.itemErrors[itemIndex] ??= {})['quantity'] = this.translateService.instant(
          'allowance.errors.quantityInvalid'
        );
      } else {
        this.clearItemError(itemIndex, 'quantity');
      }
    }
  }

  onItemSelectionChange(itemIndex: number): void {
    this.clearItemError(itemIndex, 'itemId');
    if (this.isSubmitted && this.items[itemIndex]) {
      const item = this.items[itemIndex];
      if (!item.itemId?.trim()) {
        (this.itemErrors[itemIndex] ??= {})['itemId'] = this.translateService.instant(
          'allowance.errors.itemIdRequired'
        );
      } else if (!item.selectedItem) {
        (this.itemErrors[itemIndex] ??= {})['itemId'] = this.translateService.instant(
          'allowance.errors.itemIdInvalid'
        );
      } else {
        this.clearItemError(itemIndex, 'itemId');
      }
    }
  }
}
