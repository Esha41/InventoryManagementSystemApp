import { Component, OnInit } from '@angular/core';
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
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { ApiResponse } from '@models/api-response.model';
import { ToastService } from '@services/toast.service';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslationService } from '@services/translation.service';

export interface AllowanceItem {
  itemId: string;
  quantity: string;
  selectedAmmunition?: AmmunitionReadDto;
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
  styleUrls: ['./allowance.component.css']
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
  items: AllowanceItem[] = [{ itemId: '', quantity: '' }];
  
  departments: DepartmentDto[] = [];
  isLoadingDepartments = false;
  readonly departmentOptionLabel = (option: DropdownOption<DepartmentDto> | DepartmentDto | null) =>
    this.getLocalizedName(this.unwrapOption(option));
  
  // Ammunition search
  ammunitionItems: AmmunitionReadDto[] = [];
  filteredAmmunition: { [key: number]: AmmunitionReadDto[] } = {};
  searchTerms: { [key: number]: string } = {};
  showDropdowns: { [key: number]: boolean } = {};
  private searchSubject = new Subject<{ index: number; term: string }>();
  
  isSubmitted = false;
  isLoading = false;
  errors: { [key: string]: string } = {};
  itemErrors: { [key: number]: { [key: string]: string } } = {};

  constructor(
    private lookupService: LookupService,
    private ammunitionService: AmmunitionService,
    private apiService: ApiService,
    private translateService: TranslateService,
    private translationService: TranslationService,
    private router: Router,
    private toastService: ToastService,
    private route: ActivatedRoute
  ) {
    // Set default year to current year
    const currentYear = new Date().getFullYear();
    this.selectedYear = currentYear.toString();
  }

  ngOnInit(): void {
    this.loadDepartments();
    
    // Setup search debouncing
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(({ index, term }) => {
      this.filterAmmunition(index, term);
    });

    // Load ammunition items first, then check for edit mode
    this.loadAmmunitionItems();
    
    // Check for edit mode from query params after ammunition items are loaded
    this.route.queryParams.subscribe(params => {
      if (params['departmentId'] && params['year'] && (params['edit'] === 'true' || params['edit'] === true || typeof params['edit'] !== 'undefined')) {
        this.selectedDepartment = parseInt(params['departmentId'], 10);
        this.selectedYear = params['year'];
        // Wait for ammunition items to be loaded before loading allowance data
        if (this.ammunitionItems.length > 0) {
          this.loadExistingAllowance(parseInt(params['departmentId'], 10), parseInt(params['year'], 10));
        } else {
          // If ammunition items not loaded yet, wait for them
          this.ammunitionService.getAll<AmmunitionReadDto>().subscribe({
            next: (items: AmmunitionReadDto[]) => {
              this.ammunitionItems = items || [];
              this.loadExistingAllowance(parseInt(params['departmentId'], 10), parseInt(params['year'], 10));
            }
          });
        }
      }
    });
  }

  loadAmmunitionItems(): void {
    this.ammunitionService.getAll<AmmunitionReadDto>().subscribe({
      next: (items: AmmunitionReadDto[]) => {
        this.ammunitionItems = items || [];
        // Initialize filtered list for each existing item
        this.items.forEach((_, index) => {
          if (!this.filteredAmmunition[index]) {
            this.filteredAmmunition[index] = [...this.ammunitionItems];
          }
        });
      },
      error: (error: any) => {
        // Silently handle error - user will see it when trying to use items
      }
    });
  }

  onItemSearch(index: number, term: string): void {
    this.searchTerms[index] = term || '';
    this.searchSubject.next({ index, term: term || '' });
  }

  filterAmmunition(index: number, term: string): void {
    if (!term || term.trim() === '') {
      this.filteredAmmunition[index] = [...this.ammunitionItems];
      return;
    }

    const searchLower = term.toLowerCase().trim();
    this.filteredAmmunition[index] = this.ammunitionItems.filter(item => 
      (item.name?.toLowerCase().includes(searchLower)) ||
      (item.itemNo?.toLowerCase().includes(searchLower)) ||
      (item.batchNo?.toLowerCase().includes(searchLower)) ||
      (item.id?.toString().includes(searchLower))
    );
  }

  selectAmmunition(index: number, item: AmmunitionReadDto): void {
    this.items[index].selectedAmmunition = item;
    this.items[index].itemId = item.id.toString();
    this.searchTerms[index] = `${item.name} - ${item.itemNo} - ${item.batchNo}`;
    this.showDropdowns[index] = false;
    // Clear error when item is selected
    this.onItemSelectionChange(index);
  }

  toggleDropdown(index: number): void {
    this.showDropdowns[index] = !this.showDropdowns[index];
    if (this.showDropdowns[index] && !this.filteredAmmunition[index]) {
      this.filteredAmmunition[index] = [...this.ammunitionItems];
    }
  }

  closeDropdown(index: number): void {
    // Close dropdown when clicking outside
    setTimeout(() => {
      this.showDropdowns[index] = false;
    }, 200);
  }

  getAmmunitionDisplay(item: AmmunitionReadDto): string {
    return `${item.name || ''} - ${item.itemNo || ''} - ${item.batchNo || ''}`.trim();
  }


  loadDepartments(): void {
    this.isLoadingDepartments = true;
    this.lookupService.getDepartments().subscribe({
      next: (departments: DepartmentDto[]) => {
        this.departments = departments;
        this.isLoadingDepartments = false;
      },
      error: (error: any) => {
        this.isLoadingDepartments = false;
      }
    });
  }

  private getLocalizedName(entity: any): string {
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

    return getLocalizedName(entity, getCurrentLang(this.translateService));
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
    this.filteredAmmunition[newIndex] = [...this.ammunitionItems];
  }

  removeItem(index: number): void {
    if (this.items.length > 1) {
      this.items.splice(index, 1);
      delete this.itemErrors[index];
      delete this.searchTerms[index];
      delete this.showDropdowns[index];
      delete this.filteredAmmunition[index];
      
      // Reindex errors, search terms, dropdowns, and filtered ammunition
      const newErrors: { [key: number]: { [key: string]: string } } = {};
      const newSearchTerms: { [key: number]: string } = {};
      const newShowDropdowns: { [key: number]: boolean } = {};
      const newFilteredAmmunition: { [key: number]: AmmunitionReadDto[] } = {};
      
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
      
      Object.keys(this.filteredAmmunition).forEach(key => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          newFilteredAmmunition[oldIndex - 1] = this.filteredAmmunition[oldIndex];
        } else if (oldIndex < index) {
          newFilteredAmmunition[oldIndex] = this.filteredAmmunition[oldIndex];
        }
      });
      
      this.itemErrors = newErrors;
      this.searchTerms = newSearchTerms;
      this.showDropdowns = newShowDropdowns;
      this.filteredAmmunition = newFilteredAmmunition;
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
      } else if (!item.selectedAmmunition) {
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

    // Prepare request data according to API structure
    const requestData = {
      departmentId: typeof this.selectedDepartment === 'number' 
        ? this.selectedDepartment 
        : parseInt(this.selectedDepartment as string, 10),
      year: year,
      items: this.items.map(item => ({
        itemId: parseInt(item.itemId.trim(), 10),
        itemType: 1, // Default item type as per API example
        quantity: parseInt(item.quantity.trim(), 10)
      }))
    };

    this.isLoading = true;
    this.errors = {};

    this.apiService.postWithAuth<ApiResponse<any>>(
      API_ENDPOINTS.ALLOWANCE.BULK,
      requestData
    ).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.translateService.get(['allowance.success.sentSuccessfully', 'toast.success']).subscribe(translations => {
          this.toastService.success(
            translations['allowance.success.sentSuccessfully'],
            translations['toast.success']
          );
        });
        // Navigate back to list after successful submission
        this.router.navigate(['/allowance']);
      },
      error: (error) => {
        this.isLoading = false;
        
        // Extract error message from various possible locations
        let errorMessage = this.translateService.instant('allowance.errors.failedToSend');
        if (error?.error?.message) {
          errorMessage = error.error.message;
        } else if (error?.error?.error?.message) {
          errorMessage = error.error.error.message;
        } else if (error?.message) {
          errorMessage = error.message;
        } else if (typeof error?.error === 'string') {
          errorMessage = error.error;
        }
        
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
    this.items = [{ itemId: '', quantity: '' }];
    this.errors = {};
    this.itemErrors = {};
    this.searchTerms = {};
    this.showDropdowns = {};
    this.isSubmitted = false;
  }

  onBack(): void {
    this.router.navigate(['/allowance']);
  }

  loadExistingAllowance(departmentId: number, year: number): void {
    const endpoint = API_ENDPOINTS.ALLOWANCE.BY_DEPARTMENT_AND_YEAR(departmentId, year);
    this.apiService.getWithAuth<ApiResponse<any>>(endpoint).subscribe({
      next: (response) => {
        const items = response.data?.items || response.data?.Items || [];
        
        if (items && items.length > 0) {
          this.items = items.map((item: any, index: number) => {
            const ammo = this.ammunitionItems.find(a => a.id === item.itemId);
            this.filteredAmmunition[index] = ammo 
              ? [ammo, ...this.ammunitionItems.filter(a => a.id !== item.itemId)]
              : [...this.ammunitionItems];
            
            // Set search term to display the selected item
            if (ammo) {
              this.searchTerms[index] = this.getAmmunitionDisplay(ammo);
            }
            
            return {
              itemId: item.itemId.toString(),
              quantity: item.quantity.toString(),
              selectedAmmunition: ammo
            };
          });
        } else {
          this.items = [{ itemId: '', quantity: '' }];
        }
      },
      error: (error) => {
        this.translateService.get(['toast.error', 'allowance.errors.failedToLoad']).subscribe(translations => {
          this.toastService.error(
            translations['allowance.errors.failedToLoad'] || 'Failed to load allowance data',
            translations['toast.error']
          );
        });
        // Start with empty form on error
        this.items = [{ itemId: '', quantity: '' }];
      }
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
      } else if (!item.selectedAmmunition) {
        this.itemErrors[itemIndex] = this.itemErrors[itemIndex] || {};
        this.itemErrors[itemIndex]['itemId'] = this.translateService.instant('allowance.errors.itemIdInvalid');
      } else {
        this.clearItemError(itemIndex, 'itemId');
      }
    }
  }

}

