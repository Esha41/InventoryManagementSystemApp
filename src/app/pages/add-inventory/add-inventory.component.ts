import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { LucideAngularModule, Save, X, Plus, Trash2, ArrowLeft } from 'lucide-angular';
import { InventoryService } from '@services/inventory.service';
import { LookupService, SupplierDto, ManufacturerDto, CountryDto } from '@services/lookup.service';
import { AmmunitionService } from '@services/ammunition.service';
import { CreateInventoryDto, CreateInventoryDetailDto } from '@models/inventory.model';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';

interface InventoryItemForm {
  itemId: number;
  itemName: string;
  lot: number;
  supplierId?: number;
  manufacturerId?: number;
  countryId?: number;
  itemQuantity: number;
}

@Component({
  selector: 'app-add-inventory',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    LucideAngularModule,
    DropdownComponent
  ],
  templateUrl: './add-inventory.component.html',
  styleUrls: ['./add-inventory.component.css']
})
export class AddInventoryComponent implements OnInit, OnDestroy {
  readonly Save = Save;
  readonly X = X;
  readonly Plus = Plus;
  readonly Trash2 = Trash2;
  readonly ArrowLeft = ArrowLeft;

  warehouseId!: number;
  warehouseName: string = '';

  // Form data
  invoiceNumber: string = '';
  invoiceDate: string = '';
  receivedDate: string = '';
  notes: string = '';
  items: InventoryItemForm[] = [];

  // Lookup data
  availableItems: any[] = [];
  suppliers: SupplierDto[] = [];
  manufacturers: ManufacturerDto[] = [];
  countries: CountryDto[] = [];
  readonly supplierOptionLabel = (option: DropdownOption<SupplierDto> | SupplierDto | null) =>
    this.getLocalizedName(this.unwrapOption(option));
  readonly manufacturerOptionLabel = (option: DropdownOption<ManufacturerDto> | ManufacturerDto | null) =>
    this.getLocalizedName(this.unwrapOption(option));
  readonly countryOptionLabel = (option: DropdownOption<CountryDto> | CountryDto | null) =>
    this.getLocalizedName(this.unwrapOption(option));
  readonly itemOptionLabel = (option: DropdownOption<any> | any | null) => {
    const item = this.unwrapOption(option);
    if (!item) {
      return '';
    }
    const name = item.name || '';
    const itemNo = item.itemNo ? ` (${item.itemNo})` : '';
    return `${name}${itemNo}`.trim();
  };

  loading = false;
  submitting = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private inventoryService: InventoryService,
    private lookupService: LookupService,
    private ammunitionService: AmmunitionService
  ) {}

  ngOnInit(): void {
    // Get warehouse ID from route
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.warehouseId = parseInt(params['id'], 10);
      if (this.warehouseId) {
        this.loadData();
      }
    });

    // Add initial item
    this.addItem();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadData(): void {
    this.loading = true;

    forkJoin({
      depot: this.lookupService.getDepots(),
      items: this.ammunitionService.getAll(),
      suppliers: this.lookupService.getSuppliers(),
      manufacturers: this.lookupService.getManufacturers(),
      countries: this.lookupService.getCountries()
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ depot, items, suppliers, manufacturers, countries }) => {
        const currentDepot = depot.find(d => d.id === this.warehouseId);
        this.warehouseName = currentDepot?.nameEn || `Warehouse ${this.warehouseId}`;
        
        this.availableItems = items;
        this.suppliers = suppliers;
        this.manufacturers = manufacturers;
        this.countries = countries;
        
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading data:', error);
        this.errorMessage = 'Failed to load form data';
        this.loading = false;
      }
    });
  }

  addItem(): void {
    this.items.push({
      itemId: 0,
      itemName: '',
      lot: 1,
      supplierId: undefined,
      manufacturerId: undefined,
      countryId: undefined,
      itemQuantity: 1000
    });
  }

  removeItem(index: number): void {
    if (this.items.length > 1) {
      this.items.splice(index, 1);
    }
  }

  private getLocalizedName(entity: { nameEn?: string; nameAr?: string } | null | undefined): string {
    if (!entity) {
      return '';
    }
    return entity.nameEn || entity.nameAr || '';
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

  onItemChange(index: number): void {
    const item = this.items[index];
    const selectedItem = this.availableItems.find(i => i.id === item.itemId);
    if (selectedItem) {
      item.itemName = selectedItem.name;
    }
  }

  onSubmit(): void {
    // Validate form
    if (!this.invoiceNumber.trim()) {
      this.errorMessage = 'Invoice number is required';
      return;
    }

    if (this.items.length === 0) {
      this.errorMessage = 'At least one item is required';
      return;
    }

    // Validate dates (cannot be in the future)
    const now = new Date();
    now.setHours(23, 59, 59, 999); // End of today

    if (this.invoiceDate) {
      const invoiceDate = new Date(this.invoiceDate);
      if (invoiceDate > now) {
        this.errorMessage = 'Invoice date cannot be in the future';
        return;
      }
    }

    if (this.receivedDate) {
      const receivedDate = new Date(this.receivedDate);
      if (receivedDate > now) {
        this.errorMessage = 'Received date cannot be in the future';
        return;
      }
    }

    // Validate items
    for (const item of this.items) {
      if (!item.itemId || item.itemId === 0) {
        this.errorMessage = 'Please select an item for all entries';
        return;
      }
      if (!item.lot || item.lot <= 0) {
        this.errorMessage = 'Lot number must be greater than 0';
        return;
      }
      if (!item.itemQuantity || item.itemQuantity <= 0) {
        this.errorMessage = 'Quantity must be greater than 0';
        return;
      }
    }

    // Prepare DTO - convert empty strings to undefined
    const createDto: CreateInventoryDto = {
      depoId: this.warehouseId,
      invoiceNumber: this.invoiceNumber.trim(),
      invoiceDate: this.invoiceDate && this.invoiceDate.trim() ? this.invoiceDate : undefined,
      recievedDate: this.receivedDate && this.receivedDate.trim() ? this.receivedDate : undefined,
      notes: this.notes?.trim() || undefined,
      inventoryDetails: this.items.map(item => ({
        itemId: item.itemId,
        lot: item.lot,
        supplierId: item.supplierId || undefined,
        manufacturerId: item.manufacturerId || undefined,
        countryId: item.countryId || undefined,
        itemQuantity: item.itemQuantity
      }))
    };

    this.submitting = true;
    this.errorMessage = null;
    this.successMessage = null;

    this.inventoryService.create(createDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.successMessage = 'Inventory created successfully!'; // Will use toast instead
          this.submitting = false;
          
          // Redirect after 2 seconds
          setTimeout(() => {
            this.router.navigate(['/warehouse', this.warehouseId, 'inventory']);
          }, 2000);
        },
        error: (error) => {
          console.error('Error creating inventory:', error);
          this.errorMessage = error.error?.message || 'Failed to create inventory';
          this.submitting = false;
        }
      });
  }

  onCancel(): void {
    this.router.navigate(['/warehouse', this.warehouseId, 'inventory']);
  }

  /**
   * Get max date for date inputs (today)
   */
  getMaxDate(): string {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return today.toISOString().split('T')[0];
  }
}

