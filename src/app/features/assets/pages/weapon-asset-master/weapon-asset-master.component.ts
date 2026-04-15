import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import {
  LucideAngularModule,
  ChevronDown,
  ChevronRight,
  History,
  ArrowRight,
  User,
  Building,
  Search,
  FilterX
} from 'lucide-angular';
import { AssetService } from '@services/asset.service';
import { AssetHistoryService, AssetHistoryDto } from '@services/asset-history.service';
import { LookupService } from '@services/lookup.service';
import { AssetDto, AssetStatus, getAssetStatusLabel } from '@models/asset.model';
import { ItemType } from '@models/inventory.model';
import { FilterData, PagedListRequest } from '@models/pagination.model';
import { LookupItem } from '@models/lookup.model';
import {
  CardComponent,
  LoadingStateComponent,
  PaginationComponent,
  RowsPerPageComponent
} from '@components/index';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { trackById } from '@utils/trackby.utils';
import { ToastService } from '@services/toast.service';

/** Backend `AssetHistoryActionType.Created` */
const HISTORY_ACTION_CREATED = 1;

type SortColumn = 'serial' | 'name' | 'status';
type CustodyFilter = 'all' | 'checkout' | 'checkin';

@Component({
  selector: 'app-weapon-asset-master',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    LucideAngularModule,
    CardComponent,
    LoadingStateComponent,
    PaginationComponent,
    RowsPerPageComponent,
    AppDatePipe
  ],
  templateUrl: './weapon-asset-master.component.html',
  styleUrls: ['./weapon-asset-master.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeaponAssetMasterComponent implements OnInit, OnDestroy {
  items: AssetDto[] = [];
  loading = false;
  refreshing = false;
  hasLoadedOnce = false;
  totalCount = 0;
  totalPages = 1;

  currentPage = 1;
  rowsPerPage = 10;

  searchInput = '';
  appliedSearchTerm = '';
  filterPrimaryPurposeId: number | null = null;
  filterStatus: AssetStatus | null = null;
  filterSupplierId: number | null = null;
  filterManufacturerId: number | null = null;
  filterCustody: CustodyFilter = 'all';

  private readonly destroy$ = new Subject<void>();

  depots: LookupItem[] = [];
  selectedDepotId: number | null = null;

  primaryPurposes: LookupItem[] = [];
  suppliers: LookupItem[] = [];
  manufacturers: LookupItem[] = [];

  readonly statusFilterOptions: { value: AssetStatus; labelKey: string }[] = [
    { value: AssetStatus.ReadyToIssue, labelKey: 'assetStatus.readyToIssue' },
    { value: AssetStatus.Assigned, labelKey: 'assetStatus.assigned' },
    { value: AssetStatus.InMaintenance, labelKey: 'assetStatus.inMaintenance' },
    { value: AssetStatus.UnserviceableRepairable, labelKey: 'assetStatus.unserviceableRepairable' },
    { value: AssetStatus.UnserviceableUnrepairable, labelKey: 'assetStatus.unserviceableUnrepairable' },
    { value: AssetStatus.AwaitingDisposal, labelKey: 'assetStatus.awaitingDisposal' },
    { value: AssetStatus.Disposed, labelKey: 'assetStatus.disposed' }
  ];

  expandedAssetIds = new Set<number>();
  historyByAssetId = new Map<number, AssetHistoryDto[]>();
  loadingHistory = new Set<number>();

  sortColumn: SortColumn = 'serial';
  sortDirection: 'asc' | 'desc' = 'asc';

  readonly ChevronDown = ChevronDown;
  readonly ChevronRight = ChevronRight;
  readonly History = History;
  readonly ArrowRight = ArrowRight;
  readonly User = User;
  readonly Building = Building;
  readonly Search = Search;
  readonly FilterX = FilterX;
  readonly trackById = trackById;

  constructor(
    private assetService: AssetService,
    private assetHistoryService: AssetHistoryService,
    private lookupService: LookupService,
    private translateService: TranslateService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.lookupService
      .getDepots()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => {
          this.depots = list ?? [];
          this.cdr.markForCheck();
        },
        error: () => {
          this.depots = [];
          this.cdr.markForCheck();
        }
      });

    this.lookupService
      .getPrimaryPurposes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => {
          this.primaryPurposes = list ?? [];
          this.cdr.markForCheck();
        },
        error: () => {
          this.primaryPurposes = [];
          this.cdr.markForCheck();
        }
      });

    this.lookupService
      .getSuppliers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => {
          this.suppliers = list ?? [];
          this.cdr.markForCheck();
        },
        error: () => {
          this.suppliers = [];
          this.cdr.markForCheck();
        }
      });

    this.lookupService
      .getManufacturers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => {
          this.manufacturers = list ?? [];
          this.cdr.markForCheck();
        },
        error: () => {
          this.manufacturers = [];
          this.cdr.markForCheck();
        }
      });

    this.loadAssets();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  applySearch(): void {
    this.appliedSearchTerm = this.searchInput.trim();
    this.currentPage = 1;
    this.loadAssets();
  }

  onSelectFilterChange(): void {
    this.currentPage = 1;
    this.loadAssets();
  }

  onDepotChange(): void {
    this.currentPage = 1;
    this.loadAssets();
  }

  clearColumnFilters(): void {
    this.searchInput = '';
    this.appliedSearchTerm = '';
    this.filterPrimaryPurposeId = null;
    this.filterStatus = null;
    this.filterSupplierId = null;
    this.filterManufacturerId = null;
    this.filterCustody = 'all';
    this.selectedDepotId = null;
    this.currentPage = 1;
    this.loadAssets();
  }

  hasActiveFilters(): boolean {
    return (
      !!this.appliedSearchTerm ||
      this.filterPrimaryPurposeId != null ||
      this.filterStatus != null ||
      this.filterSupplierId != null ||
      this.filterManufacturerId != null ||
      (this.selectedDepotId != null && this.selectedDepotId > 0) ||
      this.filterCustody !== 'all'
    );
  }

  lookupOptionLabel(item: LookupItem): string {
    const lang = getCurrentLang(this.translateService);
    return getLocalizedName(item, lang);
  }

  depotOptionLabel(d: LookupItem): string {
    const lang = getCurrentLang(this.translateService);
    const code = d.code ?? d.depotCode;
    const name = getLocalizedName(d, lang);
    return code ? `${code} — ${name}` : name;
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadAssets();
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
    this.loadAssets();
  }

  toggleExpand(assetId: number, event: Event): void {
    event.stopPropagation();
    if (this.expandedAssetIds.has(assetId)) {
      this.expandedAssetIds.delete(assetId);
    } else {
      this.expandedAssetIds.add(assetId);
      if (!this.historyByAssetId.has(assetId)) {
        this.loadHistory(assetId);
      }
    }
    this.cdr.markForCheck();
  }

  isExpanded(assetId: number): boolean {
    return this.expandedAssetIds.has(assetId);
  }

  getExpandIcon(expanded: boolean) {
    return expanded ? this.ChevronDown : this.ChevronRight;
  }

  private loadHistory(assetId: number): void {
    this.loadingHistory.add(assetId);
    this.cdr.markForCheck();

    this.assetHistoryService
      .getByAssetId(assetId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (rows) => {
          const sorted = [...(rows ?? [])].sort((a, b) => {
            const t = new Date(a.actionDate).getTime() - new Date(b.actionDate).getTime();
            if (t !== 0) return t;
            return a.actionType - b.actionType;
          });
          this.historyByAssetId.set(assetId, sorted);
          this.loadingHistory.delete(assetId);
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingHistory.delete(assetId);
          this.toastService.error(this.translateService.instant('weaponAssetMaster.historyLoadError'));
          this.cdr.markForCheck();
        }
      });
  }

  getHistory(assetId: number): AssetHistoryDto[] {
    return this.historyByAssetId.get(assetId) ?? [];
  }

  getCreatedHistoryEntry(assetId: number): AssetHistoryDto | null {
    const rows = this.getHistory(assetId).filter((e) => e.actionType === HISTORY_ACTION_CREATED);
    if (rows.length === 0) return null;
    return rows.reduce((earliest, e) =>
      new Date(e.actionDate).getTime() < new Date(earliest.actionDate).getTime() ? e : earliest
    );
  }

  getAssignmentHistoryEntries(assetId: number): AssetHistoryDto[] {
    return this.getHistory(assetId).filter((e) => e.actionType !== HISTORY_ACTION_CREATED);
  }

  hasAssignmentLocationFields(entry: AssetHistoryDto): boolean {
    return !!(
      entry.previousCustodianName ||
      entry.newCustodianName ||
      entry.previousDepartmentName ||
      entry.newDepartmentName ||
      entry.previousLocation ||
      entry.newLocation
    );
  }

  getCreatedDisplay(asset: AssetDto): { dateIso: string } | null {
    const h = this.getCreatedHistoryEntry(asset.id);
    if (h) {
      return { dateIso: h.actionDate };
    }
    return null;
  }

  hasExpandedHistoryContent(asset: AssetDto): boolean {
    return this.getCreatedDisplay(asset) != null || this.getAssignmentHistoryEntries(asset.id).length > 0;
  }

  isLoadingHistory(assetId: number): boolean {
    return this.loadingHistory.has(assetId);
  }

  setSort(column: SortColumn): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.currentPage = 1;
    this.loadAssets();
  }

  sortIndicator(column: SortColumn): string {
    if (this.sortColumn !== column) return '';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  private buildFilter(): FilterData {
    const filters: FilterData[] = [{ field: 'Item.ItemType', operator: 'eq', value: String(ItemType.Weapon) }];

    const term = this.appliedSearchTerm;
    if (term) {
      filters.push({
        logic: 'or',
        filters: [
          { field: 'Item.Name', operator: 'contains', value: term },
          { field: 'Item.ItemNo', operator: 'contains', value: term },
          { field: 'Item.Nsn', operator: 'contains', value: term },
          { field: 'Item.PartNo', operator: 'contains', value: term },
          { field: 'SerialNumber', operator: 'contains', value: term },
          { field: 'CurrentAssignment.Custodian.NameEn', operator: 'contains', value: term },
          { field: 'CurrentAssignment.Custodian.NameAr', operator: 'contains', value: term },
          { field: 'CurrentAssignment.Custodian.MilitaryId', operator: 'contains', value: term },
          { field: 'CurrentAssignment.Department.NameEn', operator: 'contains', value: term },
          { field: 'CurrentAssignment.Department.NameAr', operator: 'contains', value: term },
          { field: 'CurrentAssignment.Department.Code', operator: 'contains', value: term },
          { field: 'Notes', operator: 'contains', value: term }
        ]
      });
    }

    if (this.filterPrimaryPurposeId != null && this.filterPrimaryPurposeId > 0) {
      filters.push({
        field: 'PrimaryPurposId',
        operator: 'eq',
        value: String(this.filterPrimaryPurposeId)
      });
    }

    if (this.filterStatus != null) {
      filters.push({ field: 'Status', operator: 'eq', value: String(this.filterStatus) });
    }

    if (this.filterSupplierId != null && this.filterSupplierId > 0) {
      filters.push({ field: 'SupplierId', operator: 'eq', value: String(this.filterSupplierId) });
    }

    if (this.filterManufacturerId != null && this.filterManufacturerId > 0) {
      filters.push({ field: 'ManufacturerId', operator: 'eq', value: String(this.filterManufacturerId) });
    }

    // Server FilterProvider only supports eq, neq, comparison, contains, etc. — not isnull/isnotnull.
    // Asset.IsAssigned is the canonical flag for checked-out vs in-depot custody.
    if (this.filterCustody === 'checkout') {
      filters.push({ field: 'IsAssigned', operator: 'eq', value: 'true' });
    } else if (this.filterCustody === 'checkin') {
      filters.push({ field: 'IsAssigned', operator: 'eq', value: 'false' });
    }

    const sortField = this.resolveSortField();
    const sortDirection = this.sortDirection === 'asc' ? 1 : 2;

    return {
      logic: 'and',
      filters,
      sortField,
      sortDirection
    };
  }

  private resolveSortField(): string {
    const map: Record<SortColumn, string> = {
      serial: 'SerialNumber',
      name: 'Item.Name',
      status: 'Status'
    };
    return map[this.sortColumn];
  }

  private loadAssets(): void {
    if (!this.hasLoadedOnce) {
      this.loading = true;
    } else {
      this.refreshing = true;
    }
    this.cdr.markForCheck();

    const request: PagedListRequest = {
      page: this.currentPage,
      pageSize: this.rowsPerPage,
      filter: this.buildFilter()
    };

    const depotId = this.selectedDepotId && this.selectedDepotId > 0 ? this.selectedDepotId : null;

    this.assetService
      .getAssetsPaginated(depotId, request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.items = res?.items ?? [];
          this.totalCount = res?.totalCount ?? 0;
          this.totalPages = res?.totalPages && res.totalPages > 0 ? res.totalPages : 1;
          this.hasLoadedOnce = true;
          this.loading = false;
          this.refreshing = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.items = [];
          this.totalCount = 0;
          this.totalPages = 1;
          this.hasLoadedOnce = true;
          this.loading = false;
          this.refreshing = false;
          this.toastService.error(this.translateService.instant('weaponAssetMaster.loadError'));
          this.cdr.markForCheck();
        }
      });
  }

  itemName(asset: AssetDto): string {
    return asset.item?.name?.trim() || '—';
  }

  custodianName(asset: AssetDto): string {
    const c = asset.custodian;
    if (!c) return '—';
    const lang = getCurrentLang(this.translateService);
    return getLocalizedName(c, lang) || '—';
  }

  departmentName(asset: AssetDto): string {
    const d = asset.department;
    if (!d) return '—';
    const lang = getCurrentLang(this.translateService);
    return getLocalizedName(d, lang) || '—';
  }

  statusLabel(asset: AssetDto): string {
    const key = getAssetStatusLabel(asset.status);
    return this.translateService.instant(key);
  }

  supplierName(asset: AssetDto): string {
    if (!asset.supplier) return '—';
    return this.lookupOptionLabel(asset.supplier);
  }

  manufacturerName(asset: AssetDto): string {
    if (!asset.manufacturer) return '—';
    return this.lookupOptionLabel(asset.manufacturer);
  }

  primaryPurposeName(asset: AssetDto): string {
    if (!asset.primaryPurpos) return '—';
    return this.lookupOptionLabel(asset.primaryPurpos);
  }

  createdDepotName(asset: AssetDto): string {
    const d = asset.createdDepot;
    if (!d) return '—';
    const lang = getCurrentLang(this.translateService);
    const name = getLocalizedName(d, lang);
    return name.trim() || '—';
  }
}
