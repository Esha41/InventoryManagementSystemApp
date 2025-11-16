import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LucideAngularModule, Plus, Edit2, Trash2, Search } from 'lucide-angular';
import { ApiService } from '@services/api.service';
import { LookupService, DepartmentDto } from '@services/lookup.service';
import { LookupItem } from '@models/lookup.model';
import { AmmunitionService } from '@services/ammunition.service';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { API_ENDPOINTS } from '@constants/app.constants';
import { ApiResponse } from '@models/api-response.model';
import { ButtonComponent } from '@components/button/button.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { TranslationService } from '@services/translation.service';
import { ToastService } from '@services/toast.service';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { RowsPerPageComponent } from '@pages/requests-management/components/rows-per-page/rows-per-page.component';
import { PaginationComponent } from '@pages/requests-management/components/pagination/pagination.component';

export interface AllowanceItemDto {
  id: number;
  itemId: number;
  departmentId: number;
  year: number;
  quantity: number;
  itemType?: number;
}

export interface AllowanceItemDetailDto {
  id: number;
  itemId: number;
  year: number;
  quantity: number;
  itemType?: number;
  itemName?: string;
  itemNo?: string;
  batchNo?: string;
}

export interface AllowanceItemByDepartmentDto {
  departmentId: number;
  departmentCode: string;
  departmentNameAr: string;
  departmentNameEn: string;
  year: number;
  itemType?: number;
  items: AllowanceItemDetailDto[];
}

export interface AllowanceTableRow {
  id: number;
  departmentId: number;
  departmentName: string;
  year: number;
  itemId: number;
  itemName: string;
  itemNo: string;
  batchNo: string;
  quantity: number;
  // Keep items array for edit/delete operations (all items in same department/year group)
  items: AllowanceItemDetailDto[];
}

@Component({
  selector: 'app-allowance-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    LucideAngularModule,
    ButtonComponent,
    DropdownComponent,
    ConfirmDialogComponent,
    RowsPerPageComponent,
    PaginationComponent
  ],
  templateUrl: './allowance-list.component.html',
  styleUrls: ['./allowance-list.component.css']
})
export class AllowanceListComponent implements OnInit, OnDestroy {
  readonly Plus = Plus;
  readonly Edit2 = Edit2;
  readonly Trash2 = Trash2;
  readonly Search = Search;

  allowances: AllowanceTableRow[] = []; // Individual item rows
  allAllowances: AllowanceTableRow[] = []; // All allowances for pagination
  filteredAllowances: AllowanceTableRow[] = []; // Filtered allowances
  loading = true;
  error: string | null = null;
  
  // Filter dropdowns
  departments: LookupItem[] = [];
  selectedDepartment: number | string | null = null;
  allItems: AmmunitionReadDto[] = []; // All items from API
  filteredItems: AmmunitionReadDto[] = []; // Items filtered by selected department
  selectedItem: number | string | null = null;
  
  // Dropdown label functions
  readonly departmentOptionLabel = (option: DropdownOption<LookupItem> | LookupItem | null) =>
    this.getLocalizedName(this.unwrapOption(option));
  readonly itemOptionLabel = (option: DropdownOption<AmmunitionReadDto> | AmmunitionReadDto | null) => {
    const item = this.unwrapOption(option);
    if (!item) return '';
    return item.name || item.itemNo || `Item ${item.id}`;
  };

  // Pagination
  currentPage = 1;
  rowsPerPage = 10;
  totalItems = 0;

  // Delete dialog state
  showDeleteDialog = false;
  selectedAllowance: AllowanceTableRow | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private apiService: ApiService,
    private lookupService: LookupService,
    private ammunitionService: AmmunitionService,
    private router: Router,
    private translateService: TranslateService,
    private translationService: TranslationService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadAllowances();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  loadAllowances(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      allowances: this.apiService.getWithAuth<ApiResponse<AllowanceItemDto[]>>(
        API_ENDPOINTS.ALLOWANCE.BASE
      ),
      departments: this.lookupService.getDepartments(),
      ammunitionItems: this.ammunitionService.getAll<AmmunitionReadDto>()
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ allowances, departments, ammunitionItems }) => {
        if (allowances.succeeded && allowances.data) {
          this.processAllowanceData(allowances.data, departments, ammunitionItems || []);
        } else {
          this.error = allowances.message || this.translateService.instant('allowance.errors.failedToLoad');
          this.loading = false;
        }
      },
      error: (error) => {
        this.error = this.translateService.instant('allowance.errors.failedToLoad');
        this.loading = false;
      }
    });
  }

  private processAllowanceData(items: AllowanceItemDto[], departments: DepartmentDto[], ammunitionItems: AmmunitionReadDto[]): void {
    // Store departments and items for dropdowns
    this.departments = departments.map(dept => ({
      id: dept.id,
      nameEn: dept.nameEn,
      nameAr: dept.nameAr,
      code: dept.code
    } as LookupItem));
    this.allItems = ammunitionItems || [];
    this.filteredItems = [...this.allItems]; // Initially show all items

    const departmentMap = new Map<number, string>();
    departments.forEach(dept => {
      if (dept.id !== undefined) {
        departmentMap.set(dept.id, dept.nameEn || dept.nameAr || `Department ${dept.id}`);
      }
    });

  
    const ammunitionMap = new Map<number, AmmunitionReadDto>();
    ammunitionItems.forEach(ammo => {
      ammunitionMap.set(ammo.id, ammo);
    });


    const groupedItems = new Map<string, AllowanceItemDetailDto[]>();
    
    items.forEach(item => {
      const ammunition = ammunitionMap.get(item.itemId);
      const key = `${item.departmentId}_${item.year}`;
      
      if (!groupedItems.has(key)) {
        groupedItems.set(key, []);
      }
      
      groupedItems.get(key)!.push({
        id: item.id,
        itemId: item.itemId,
        year: item.year,
        quantity: item.quantity,
        itemType: item.itemType,
        itemName: ammunition?.name,
        itemNo: ammunition?.itemNo,
        batchNo: ammunition?.batchNo
      });
    });
    
  
    const rows: AllowanceTableRow[] = items.map(item => {
      const ammunition = ammunitionMap.get(item.itemId);
      const key = `${item.departmentId}_${item.year}`;
      
      return {
        id: item.id,
        departmentId: item.departmentId,
        departmentName: departmentMap.get(item.departmentId) || `Department ${item.departmentId}`,
        year: item.year,
        itemId: item.itemId,
        itemName: ammunition?.name || '',
        itemNo: ammunition?.itemNo || '',
        batchNo: ammunition?.batchNo || '',
        quantity: item.quantity,
        items: groupedItems.get(key)! 
      };
    });

  
    this.allAllowances = rows.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.departmentName !== b.departmentName) return a.departmentName.localeCompare(b.departmentName);
      return (a.itemName || a.itemNo || '').localeCompare(b.itemName || b.itemNo || '');
    });

    this.currentPage = 1;
    this.validateCurrentPage();
    this.updatePagination();
    this.loading = false;
  }

  unwrapOption<T>(option: DropdownOption<T> | T | null): T | null {
    if (option === null || option === undefined) return null;
    if (typeof option === 'object' && 'value' in option) {
      return (option as DropdownOption<T>).value;
    }
    return option as T;
  }

  getLocalizedName(item: LookupItem | null): string {
    if (!item) return '';
    const currentLang = this.translateService.currentLang || 'en';
    if (currentLang === 'ar' && item.nameAr) {
      return item.nameAr;
    }
    return item.nameEn || item.nameAr || '';
  }

  onDepartmentChange(): void {
    this.selectedItem = null; // Clear item selection when department changes
    this.updateFilteredItems();
    this.currentPage = 1;
    this.applyFilters();
  }

  updateFilteredItems(): void {
    // Always show all items in the dropdown
    // Filtering by department/item happens in applyFilters()
    this.filteredItems = [...this.allItems];
  }

  onItemChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  applyFilters(): void {
    let filtered = [...this.allAllowances];

    // Filter by department
    if (this.selectedDepartment !== null && this.selectedDepartment !== undefined && this.selectedDepartment !== '') {
      filtered = filtered.filter(allowance => {
        const allowanceDeptId = allowance.departmentId;
        return allowanceDeptId !== undefined && allowanceDeptId !== null && 
               (allowanceDeptId === Number(this.selectedDepartment) || String(allowanceDeptId) === String(this.selectedDepartment));
      });
    }

    // Filter by item
    if (this.selectedItem !== null && this.selectedItem !== undefined && this.selectedItem !== '') {
      filtered = filtered.filter(allowance => {
        const allowanceItemId = allowance.itemId;
        return allowanceItemId !== undefined && allowanceItemId !== null && 
               (allowanceItemId === Number(this.selectedItem) || String(allowanceItemId) === String(this.selectedItem));
      });
    }

    this.filteredAllowances = filtered;
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalItems = this.allAllowances.length;
    this.validateCurrentPage();
    const startIndex = (this.currentPage - 1) * this.rowsPerPage;
    const endIndex = startIndex + this.rowsPerPage;
    this.allowances = this.filteredAllowances.slice(startIndex, endIndex);
  }

  private validateCurrentPage(): void {
    const maxPages = this.totalPages;
    if (this.currentPage > maxPages && maxPages > 0) {
      this.currentPage = maxPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
  }

  onPageChange(page: number): void {
    const maxPages = this.totalPages;
    if (page < 1 || page > maxPages || maxPages === 0) {
      return;
    }
    this.currentPage = page;
    this.updatePagination();
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
    this.validateCurrentPage();
    this.updatePagination();
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.rowsPerPage);
  }

  onAddAllowance(): void {
    this.router.navigate(['/allowance/add']);
  }

  formatDate(year: number): string {
    return `${year}`;
  }


  onEdit(allowance: AllowanceTableRow): void {
    this.router.navigate(['/allowance/add'], {
      queryParams: {
        departmentId: allowance.departmentId,
        year: allowance.year,
        edit: 'true'
      }
    });
  }

  onDelete(allowance: AllowanceTableRow): void {
    
    this.selectedAllowance = {
      id: allowance.id,
      departmentId: allowance.departmentId,
      departmentName: allowance.departmentName,
      year: allowance.year,
      itemId: allowance.itemId,
      itemName: allowance.itemName || allowance.itemNo || `Item ${allowance.itemId}`,
      quantity: allowance.quantity,
      isSingleItem: true 
    } as any;
    this.showDeleteDialog = true;
  }

  onDeleteConfirm(): void {
    if (!this.selectedAllowance) return;

   
    const isSingleItem = (this.selectedAllowance as any).isSingleItem;
    
    if (isSingleItem) {
     
      const itemId = (this.selectedAllowance as any).id;
      const endpoint = `${API_ENDPOINTS.ALLOWANCE.BASE}/${itemId}`;
      
      this.apiService.deleteWithAuth<any>(endpoint)
        .pipe(
          takeUntil(this.destroy$),
          catchError((err: any) => {
            const isNotFound = err?.status === 404 || err?.message === 'Resource not found.';
            if (isNotFound) {
             
              return of({ ok: true, notFound: true });
            }
            return of({ ok: false, error: err });
          })
        )
        .subscribe({
          next: (result: any) => {
            if (result && result.ok === false) {
              const errorMessage = result.error?.error?.message || result.error?.message || this.translateService.instant('allowance.failedToDeleteItem');
              this.translateService.get(['toast.error', 'allowance.failedToDeleteItem']).subscribe(tr => {
                this.toastService.error(errorMessage, tr['toast.error']);
              });
            } else {
              this.translateService.get(['toast.success', 'allowance.itemDeletedSuccessfully']).subscribe(tr => {
                this.toastService.success(tr['allowance.itemDeletedSuccessfully'], tr['toast.success']);
              });
            }
            
            this.showDeleteDialog = false;
            this.selectedAllowance = null;
            this.loadAllowances();
          },
          error: (error: any) => {
            this.translateService.get(['toast.error', 'allowance.failedToDeleteItem']).subscribe(tr => {
              this.toastService.error(tr['allowance.failedToDeleteItem'], tr['toast.error']);
            });
            this.showDeleteDialog = false;
            this.selectedAllowance = null;
          }
        });
    } else {
     
      const deptId = this.selectedAllowance.departmentId;
      const year = this.selectedAllowance.year;

      
      this.apiService.getWithAuth<ApiResponse<AllowanceItemDto[]>>(API_ENDPOINTS.ALLOWANCE.BASE)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (resp) => {
            const all = resp?.data || [];
            const ids = all.filter(i => i.departmentId === deptId && i.year === year).map(i => i.id);

            if (ids.length === 0) {
            
              this.translateService.get(['toast.success', 'allowance.alreadyDeleted']).subscribe(tr => {
                this.toastService.success(tr['allowance.alreadyDeleted'], tr['toast.success']);
              });
              this.showDeleteDialog = false;
              this.selectedAllowance = null;
              this.loadAllowances();
              return;
            }

            const deleteObservables = ids.map(id => {
              const endpoint = `${API_ENDPOINTS.ALLOWANCE.BASE}/${id}`;
              return this.apiService.deleteWithAuth<any>(endpoint).pipe(
                catchError((err: any) => {
                  const isNotFound = err?.status === 404 || err?.message === 'Resource not found.';
                  if (isNotFound) return of({ ok: true, id, notFound: true });
                  return of({ ok: false, id, error: err });
                })
              );
            });

            forkJoin(deleteObservables)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (results: any[]) => {
                  const hasHardError = results.some(r => r && r.ok === false);
                  if (hasHardError) {
                    const firstErr = results.find(r => r && r.ok === false)?.error;
                    const errorMessage = firstErr?.error?.message || firstErr?.message || this.translateService.instant('allowance.failedToDelete');
                    this.translateService.get(['toast.error', 'allowance.failedToDelete']).subscribe(tr => {
                      this.toastService.error(errorMessage, tr['toast.error']);
                    });
                  } else {
                    this.translateService.get(['toast.success', 'allowance.deletedSuccessfully']).subscribe(tr => {
                      this.toastService.success(tr['allowance.deletedSuccessfully'], tr['toast.success']);
                    });
                  }

                  this.showDeleteDialog = false;
                  this.selectedAllowance = null;
                  this.loadAllowances();
                },
                error: () => {
                  this.translateService.get(['toast.error', 'allowance.failedToDelete']).subscribe(tr => {
                    this.toastService.error(tr['allowance.failedToDelete'], tr['toast.error']);
                  });
                  this.showDeleteDialog = false;
                }
              });
          },
          error: () => {
            this.translateService.get(['toast.error', 'allowance.failedToLoadForDeletion']).subscribe(tr => {
              this.toastService.error(tr['allowance.failedToLoadForDeletion'], tr['toast.error']);
            });
            this.showDeleteDialog = false;
          }
        });
    }
  }

  onDeleteCancel(): void {
    this.showDeleteDialog = false;
    this.selectedAllowance = null;
  }
}

