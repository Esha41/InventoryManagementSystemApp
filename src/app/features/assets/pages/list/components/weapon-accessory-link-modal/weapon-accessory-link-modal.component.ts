import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, X, Plus, Trash2 } from 'lucide-angular';
import { ButtonComponent } from '@components/button/button.component';
import { LoadingStateComponent } from '@components/loading-state/loading-state.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { defaultPageSize } from '@constants/app.constants';
import { TranslationService } from '@services/translation.service';
import { AccessoryService } from '@assets/services/accessory.service';
import { WeaponAccessoryService } from '@assets/services/weapon-accessory.service';
import { AccessoryDto } from '@models/accessory.model';
import { WeaponAccessoryDto } from '@models/weapon-accessory.model';
import { ToastService } from '@services/toast.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { getCurrentLang, getLocalizedName } from '@utils/localization.utils';

interface LinkedAccessoryRow {
  accessoryId: number;
  itemNo?: string | null;
  name: string;
  nameAr?: string | null;
  defaultQuantity: number;
}

@Component({
  selector: 'app-weapon-accessory-link-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    ButtonComponent,
    LoadingStateComponent,
    DropdownComponent,
    PaginationComponent,
    RowsPerPageComponent
  ],
  templateUrl: './weapon-accessory-link-modal.component.html',
  styleUrls: ['./weapon-accessory-link-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeaponAccessoryLinkModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() weaponId: number | null = null;
  @Input() weaponName = '';

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly X = X;
  readonly Plus = Plus;
  readonly Trash2 = Trash2;

  loading = false;
  saving = false;
  allAccessories: AccessoryDto[] = [];
  linkedItems: LinkedAccessoryRow[] = [];
  selectedAccessoryId: number | null = null;
  addQuantity = 1;
  rowsPerPage = defaultPageSize;
  currentPage = 1;

  private initialLinkedItemsSnapshot = '';
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly accessoryService: AccessoryService,
    private readonly weaponAccessoryService: WeaponAccessoryService,
    private readonly translateService: TranslateService,
    private readonly translationService: TranslationService,
    private readonly toastService: ToastService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get paginatedLinkedItems(): LinkedAccessoryRow[] {
    const page = this.getValidatedPage();
    const startIndex = (page - 1) * this.rowsPerPage;
    return this.linkedItems.slice(startIndex, startIndex + this.rowsPerPage);
  }

  get totalPages(): number {
    const total = this.linkedItems.length;
    return total === 0 ? 0 : Math.ceil(total / this.rowsPerPage);
  }

  ngOnInit(): void {
    this.translateService.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen && this.weaponId) {
      this.loadData();
    }
    if (changes['isOpen'] && !this.isOpen) {
      this.resetForm();
    }
  }

  get accessoryDropdownOptions(): DropdownOption<number>[] {
    const linkedIds = new Set(this.linkedItems.map(item => item.accessoryId));
    return this.allAccessories
      .filter(accessory => !linkedIds.has(accessory.id))
      .map(accessory => ({
        label: this.getAccessoryLabel(accessory),
        value: accessory.id
      }));
  }

  getAccessoryLabel(accessory: AccessoryDto): string {
    const name = getLocalizedName(accessory, getCurrentLang(this.translateService)) || accessory.name;
    const itemNo = accessory.itemNo?.trim();
    return itemNo ? `${name} — ${itemNo}` : name;
  }

  getRowDisplayName(row: LinkedAccessoryRow): string {
    return getLocalizedName(
      { name: row.name, nameAr: row.nameAr },
      getCurrentLang(this.translateService)
    ) || row.name;
  }

  getRowItemNo(row: LinkedAccessoryRow): string {
    return row.itemNo?.trim() || '-';
  }

  get linkedCount(): number {
    return this.linkedItems.length;
  }

  get canSave(): boolean {
    return !this.loading && !this.saving && this.hasLinkedListChanges();
  }

  close(): void {
    this.closed.emit();
  }

  onAddQuantityChange(value: string | number): void {
    const n = typeof value === 'number' ? value : parseInt(String(value), 10);
    this.addQuantity = Number.isFinite(n) && n > 0 ? n : 1;
    this.cdr.markForCheck();
  }

  onLinkedQuantityChange(row: LinkedAccessoryRow, value: string | number): void {
    const n = typeof value === 'number' ? value : parseInt(String(value), 10);
    row.defaultQuantity = Number.isFinite(n) && n > 0 ? n : 1;
    this.cdr.markForCheck();
  }

  addAccessory(): void {
    if (!this.selectedAccessoryId) {
      this.toastService.error(
        this.translateService.instant('assetList.weaponAccessoryLink.selectAccessoryFirst')
      );
      return;
    }

    if (!this.addQuantity || this.addQuantity < 1) {
      this.toastService.error(
        this.translateService.instant('assetList.weaponAccessoryLink.invalidQuantity')
      );
      return;
    }

    const accessory = this.allAccessories.find(a => a.id === this.selectedAccessoryId);
    if (!accessory) return;

    if (this.linkedItems.some(item => item.accessoryId === accessory.id)) {
      this.toastService.error(
        this.translateService.instant('assetList.weaponAccessoryLink.duplicateAccessory')
      );
      return;
    }

    this.linkedItems = [
      ...this.linkedItems,
      {
        accessoryId: accessory.id,
        itemNo: accessory.itemNo,
        name: accessory.name,
        nameAr: accessory.nameAr,
        defaultQuantity: this.addQuantity
      }
    ];

    this.selectedAccessoryId = null;
    this.addQuantity = 1;
    this.resetPagination();
    this.cdr.markForCheck();
  }

  removeAccessory(accessoryId: number): void {
    this.linkedItems = this.linkedItems.filter(item => item.accessoryId !== accessoryId);
    this.resetPagination();
    this.cdr.markForCheck();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.cdr.markForCheck();
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
    this.cdr.markForCheck();
  }

  trackByAccessoryId(_index: number, row: LinkedAccessoryRow): number {
    return row.accessoryId;
  }

  getValidatedPage(): number {
    const maxPages = this.totalPages;
    if (maxPages > 0 && this.currentPage > maxPages) {
      this.currentPage = maxPages;
    }
    return this.currentPage;
  }

  private resetPagination(): void {
    const maxPages = this.totalPages;
    if (maxPages > 0 && this.currentPage > maxPages) {
      this.currentPage = maxPages;
    } else if (maxPages === 0) {
      this.currentPage = 1;
    }
  }

  save(): void {
    if (!this.weaponId) return;

    const invalidQty = this.linkedItems.some(item => !item.defaultQuantity || item.defaultQuantity < 1);
    if (invalidQty) {
      this.toastService.error(
        this.translateService.instant('assetList.weaponAccessoryLink.invalidQuantity')
      );
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();

    this.weaponAccessoryService.replaceForWeapon(this.weaponId, {
      weaponId: this.weaponId,
      accessories: this.linkedItems.map(item => ({
        accessoryId: item.accessoryId,
        defaultQuantity: item.defaultQuantity
      }))
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.saving = false;
          if (res.succeeded) {
            this.toastService.success(
              this.translateService.instant('assetList.weaponAccessoryLink.saveSuccess')
            );
            this.saved.emit();
            this.close();
          } else {
            this.toastService.error(res.message || 'Failed to save accessory links');
          }
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.saving = false;
          this.toastService.error(
            ErrorHandler.extractErrorMessage(err, 'Failed to save accessory links')
          );
          this.cdr.markForCheck();
        }
      });
  }

  private loadData(): void {
    if (!this.weaponId) return;

    this.loading = true;
    this.resetForm();
    this.cdr.markForCheck();

    forkJoin({
      accessories: this.accessoryService.getAll<AccessoryDto>(),
      links: this.weaponAccessoryService.getByWeaponId(this.weaponId)
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ accessories, links }) => {
          this.allAccessories = accessories ?? [];
          const linkMap = new Map<number, WeaponAccessoryDto>();
          (links ?? []).forEach(link => linkMap.set(link.accessoryId, link));

          this.linkedItems = this.allAccessories
            .filter(accessory => linkMap.has(accessory.id))
            .map(accessory => {
              const link = linkMap.get(accessory.id)!;
              return {
                accessoryId: accessory.id,
                itemNo: accessory.itemNo,
                name: accessory.name,
                nameAr: accessory.nameAr,
                defaultQuantity: link.defaultQuantity > 0 ? link.defaultQuantity : 1
              };
            });

          this.captureLinkedItemsSnapshot();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.loading = false;
          this.toastService.error(
            ErrorHandler.extractErrorMessage(err, 'Failed to load accessories')
          );
          this.cdr.markForCheck();
        }
      });
  }

  private hasLinkedListChanges(): boolean {
    return this.snapshotLinkedItems(this.linkedItems) !== this.initialLinkedItemsSnapshot;
  }

  private captureLinkedItemsSnapshot(): void {
    this.initialLinkedItemsSnapshot = this.snapshotLinkedItems(this.linkedItems);
  }

  private snapshotLinkedItems(items: LinkedAccessoryRow[]): string {
    return JSON.stringify(
      [...items]
        .map(item => ({ accessoryId: item.accessoryId, defaultQuantity: item.defaultQuantity }))
        .sort((a, b) => a.accessoryId - b.accessoryId)
    );
  }

  private resetForm(): void {
    this.allAccessories = [];
    this.linkedItems = [];
    this.selectedAccessoryId = null;
    this.addQuantity = 1;
    this.currentPage = 1;
    this.initialLinkedItemsSnapshot = '';
  }
}

