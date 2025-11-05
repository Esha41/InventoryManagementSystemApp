import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { LookupService, DepartmentDto } from '@services/lookup.service';
import { AmmunitionService } from '@services/ammunition.service';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { ApiResponse } from '@models/api-response.model';

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
    ButtonComponent
  ],
  templateUrl: './allowance.component.html',
  styleUrls: ['./allowance.component.css']
})
export class AllowanceComponent implements OnInit {
  selectedDepartment: string = '';
  selectedDate: string = '';
  items: AllowanceItem[] = [{ itemId: '', quantity: '' }];
  
  departments: DepartmentDto[] = [];
  isLoadingDepartments = false;
  
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
    private apiService: ApiService
  ) {
    // Set default date to today
    const today = new Date();
    this.selectedDate = this.formatDateForInput(today);
  }

  ngOnInit(): void {
    this.loadDepartments();
    this.loadAmmunitionItems();
    
    // Setup search debouncing
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(({ index, term }) => {
      this.filterAmmunition(index, term);
    });
  }

  loadAmmunitionItems(): void {
    this.ammunitionService.getAll<AmmunitionReadDto>().subscribe({
      next: (items: AmmunitionReadDto[]) => {
        console.log('Loaded ammunition items:', items);
        this.ammunitionItems = items || [];
        // Initialize filtered list for each existing item
        this.items.forEach((_, index) => {
          if (!this.filteredAmmunition[index]) {
            this.filteredAmmunition[index] = [...this.ammunitionItems];
          }
        });
      },
      error: (error: any) => {
        console.error('Failed to load ammunition items:', error);
      }
    });
  }

  onItemSearch(index: number, term: string): void {
    this.searchTerms[index] = term;
    this.searchSubject.next({ index, term });
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

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  loadDepartments(): void {
    this.isLoadingDepartments = true;
    this.lookupService.getDepartments().subscribe({
      next: (departments: DepartmentDto[]) => {
        this.departments = departments;
        this.isLoadingDepartments = false;
      },
      error: (error: any) => {
        console.error('Failed to load departments:', error);
        this.isLoadingDepartments = false;
      }
    });
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
    if (!this.selectedDepartment || this.selectedDepartment.trim() === '') {
      this.errors['department'] = 'Department is required';
      isValid = false;
    }

    // Validate date
    if (!this.selectedDate || this.selectedDate.trim() === '') {
      this.errors['date'] = 'Date is required';
      isValid = false;
    }

    // Validate items
    this.items.forEach((item, index) => {
      const itemError: { [key: string]: string } = {};
      
      if (!item.itemId || item.itemId.trim() === '') {
        itemError['itemId'] = 'Item ID is required';
        isValid = false;
      } else if (!item.selectedAmmunition) {
        itemError['itemId'] = 'Please select a valid item from the list';
        isValid = false;
      }

      if (!item.quantity || item.quantity.trim() === '') {
        itemError['quantity'] = 'Quantity is required';
        isValid = false;
      } else if (!/^\d+$/.test(item.quantity.trim())) {
        itemError['quantity'] = 'Quantity must be a valid number';
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

    // Extract year from selected date
    const dateObj = new Date(this.selectedDate);
    const year = dateObj.getFullYear();

    // Prepare request data according to API structure
    const requestData = {
      departmentId: parseInt(this.selectedDepartment, 10),
      year: year,
      items: this.items.map(item => ({
        itemId: parseInt(item.itemId.trim(), 10),
        itemType: 1, // Default item type as per API example
        quantity: parseInt(item.quantity.trim(), 10)
      }))
    };

    console.log('Sending allowance request to API:', requestData);

    this.isLoading = true;
    this.errors = {};

    this.apiService.postWithAuth<ApiResponse<any>>(
      API_ENDPOINTS.ALLOWANCE.BULK,
      requestData
    ).subscribe({
      next: (response) => {
        console.log('Allowance request sent successfully:', response);
        this.isLoading = false;
        alert('Allowance request sent successfully!');
        this.resetForm();
      },
      error: (error) => {
        console.error('Failed to send allowance request:', error);
        console.error('Error details:', {
          status: error?.status,
          statusText: error?.statusText,
          message: error?.message,
          error: error?.error,
          url: error?.url
        });
        this.isLoading = false;
        
        // Extract error message from various possible locations
        let errorMessage = 'Failed to send allowance request';
        if (error?.error?.message) {
          errorMessage = error.error.message;
        } else if (error?.error?.error?.message) {
          errorMessage = error.error.error.message;
        } else if (error?.message) {
          errorMessage = error.message;
        } else if (typeof error?.error === 'string') {
          errorMessage = error.error;
        }
        
        this.errors['submit'] = errorMessage;
      }
    });
  }

  resetForm(): void {
    this.selectedDepartment = '';
    const today = new Date();
    this.selectedDate = this.formatDateForInput(today);
    this.items = [{ itemId: '', quantity: '' }];
    this.errors = {};
    this.itemErrors = {};
    this.searchTerms = {};
    this.showDropdowns = {};
    this.isSubmitted = false;
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
}

