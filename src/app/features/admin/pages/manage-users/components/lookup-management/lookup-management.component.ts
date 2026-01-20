import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { CardComponent } from '@components/card/card.component';
import { LucideAngularModule, Plus, Edit, Trash2 } from 'lucide-angular';
import { LookupItem, LookupTableConfig, CreateUpdateLookupDto } from '@models/lookup.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastService } from '@services/toast.service';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { LookupManagementService } from '@services/lookup-management.service';
import { LookupFiltersComponent } from '../lookup-filters/lookup-filters.component';
import { LookupFormModalComponent } from '@components/lookup-form-modal/lookup-form-modal.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';

/**
 * Lookup Management Component
 * Handles lookup management tab content
 */
@Component({
  selector: 'app-lookup-management',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    LucideAngularModule,
    TranslateModule,
    LoadingStateComponent,
    ErrorStateComponent,
    LookupFiltersComponent,
    LookupFormModalComponent,
    ConfirmDialogComponent
  ],
  templateUrl: './lookup-management.component.html',
  styleUrls: ['./lookup-management.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LookupManagementComponent implements OnInit, OnDestroy {
  readonly Plus = Plus;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;

  lookupTables: LookupTableConfig[] = [];
  selectedTable?: LookupTableConfig;
  lookupItems: LookupItem[] = [];
  lookupSearchTerm = '';
  isLoadingLookups = false;
  lookupErrorMessage = '';

  // Lookup modal states
  showLookupModal = false;
  showLookupDeleteConfirm = false;
  lookupModalMode: 'create' | 'edit' = 'create';
  selectedLookupItem?: LookupItem;
  lookupModalLoading = false;

  private destroy$ = new Subject<void>();

  constructor(
    private lookupManagementService: LookupManagementService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.lookupTables = this.lookupManagementService.getLookupTables();
    if (this.lookupTables.length > 0 && !this.selectedTable) {
      this.selectedTable = this.lookupTables[0];
      this.loadLookupItems();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTableSelect(table: LookupTableConfig | undefined): void {
    this.selectedTable = table;
    if (table) {
      this.loadLookupItems();
    }
    this.cdr.markForCheck();
  }

  loadLookupItems(): void {
    if (!this.selectedTable) return;

    this.isLoadingLookups = true;
    this.lookupErrorMessage = '';
    this.lookupManagementService.loadLookupItems(this.selectedTable.apiEndpoint)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          this.lookupItems = items;
          this.isLoadingLookups = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.isLoadingLookups = false;
          this.lookupErrorMessage = 'Failed to load lookup items: ' + (error.message || 'Unknown error');
          this.cdr.markForCheck();
        }
      });
  }

  get filteredLookupItems(): LookupItem[] {
    return this.lookupManagementService.filterLookupItems(this.lookupItems, this.lookupSearchTerm);
  }

  onSearchChange(searchTerm: string): void {
    this.lookupSearchTerm = searchTerm;
    this.cdr.markForCheck();
  }

  onAddLookup(): void {
    if (!this.selectedTable) return;
    this.lookupModalMode = 'create';
    this.selectedLookupItem = undefined;
    this.showLookupModal = true;
    this.cdr.markForCheck();
  }

  onEditLookup(item: LookupItem): void {
    if (!this.selectedTable) return;
    this.lookupModalMode = 'edit';
    this.selectedLookupItem = item;
    this.showLookupModal = true;
    this.cdr.markForCheck();
  }

  onDeleteLookup(item: LookupItem): void {
    if (!this.selectedTable) return;
    this.selectedLookupItem = item;
    this.showLookupDeleteConfirm = true;
    this.cdr.markForCheck();
  }

  confirmLookupDelete(): void {
    if (!this.selectedTable || !this.selectedLookupItem) return;

    const dto: CreateUpdateLookupDto = {
      nameEn: this.selectedLookupItem.nameEn,
      nameAr: this.selectedLookupItem.nameAr,
      code: this.selectedLookupItem.code
    };

    this.lookupManagementService.deleteLookupItem(
      this.selectedTable.apiEndpoint,
      this.selectedLookupItem.id!,
      dto
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (success) => {
          if (success) {
            const itemName = this.lookupManagementService.getLookupItemName(this.selectedLookupItem);
            this.translateService.get(['toast.success', 'lookupManagement.deleteItem']).subscribe(translations => {
              this.toastService.success(
                `"${itemName}" ${translations['lookupManagement.deleteItem'] || 'deleted'} successfully`,
                translations['toast.success']
              );
            });
            this.showLookupDeleteConfirm = false;
            this.selectedLookupItem = undefined;
            this.cdr.markForCheck();
            this.loadLookupItems();
          }
        },
        error: (error) => {
          this.lookupErrorMessage = error.message || 'Failed to delete lookup item';
          this.cdr.markForCheck();
          this.translateService.get(['toast.error']).subscribe(translations => {
            this.toastService.error(
              error.message || 'Failed to delete lookup item',
              translations['toast.error']
            );
          });
        }
      });
  }

  onLookupSaved(dto: CreateUpdateLookupDto): void {
    if (!this.selectedTable) return;

    this.lookupModalLoading = true;
    this.isLoadingLookups = true;
    this.lookupErrorMessage = '';

    const operation = this.lookupModalMode === 'create'
      ? this.lookupManagementService.createLookupItem(this.selectedTable.apiEndpoint, dto)
      : this.lookupManagementService.updateLookupItem(
        this.selectedTable.apiEndpoint,
        this.selectedLookupItem!.id!,
        dto
      );

    operation
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (item) => {
          const isCreate = this.lookupModalMode === 'create';
          const itemName = this.lookupManagementService.getLookupItemName(dto);

          this.translateService.get([
            'toast.success',
            'lookupManagement.addItem',
            'lookupManagement.edit'
          ]).subscribe(translations => {
            const message = isCreate
              ? `${translations['lookupManagement.addItem'] || 'Item'} "${itemName}" added successfully`
              : `"${itemName}" ${translations['lookupManagement.edit'] || 'updated'} successfully`;

            this.toastService.success(message, translations['toast.success']);
          });

          this.lookupModalLoading = false;
          this.isLoadingLookups = false;
          this.showLookupModal = false;
          this.selectedLookupItem = undefined;
          this.cdr.markForCheck();
          this.loadLookupItems();
        },
        error: (error) => {
          this.lookupModalLoading = false;
          this.isLoadingLookups = false;
          this.lookupErrorMessage = error.message || `Failed to ${this.lookupModalMode} lookup item`;
          this.cdr.markForCheck();

          this.translateService.get(['toast.error']).subscribe(translations => {
            this.toastService.error(
              error.message || `Failed to ${this.lookupModalMode} lookup item`,
              translations['toast.error']
            );
          });
        }
      });
  }

  getLookupItemName(item: LookupItem | null | undefined): string {
    return this.lookupManagementService.getLookupItemName(item);
  }

  getItemTypeName(item: LookupItem): string {
    return this.lookupManagementService.getItemTypeName(item);
  }

  getItemType(item: LookupItem): number {
    return this.lookupManagementService.getItemType(item);
  }
}

