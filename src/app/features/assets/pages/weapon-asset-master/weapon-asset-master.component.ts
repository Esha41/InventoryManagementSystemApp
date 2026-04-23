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
  Eye,
  User,
  Building,
  Search,
  X,
  FilterX
} from 'lucide-angular';
import { AssetService } from '@assets/services/asset.service';
import { AssetHistoryService, AssetHistoryDto } from '@assets/services/asset-history.service';
import { LookupService } from '@services/lookup.service';
import { EmployeeService } from '@admin/services/employee.service';
import { AssetDto, AssetStatus, EmployeeDto, getAssetStatusLabel } from '@models/asset.model';
import { ItemType } from '@models/inventory.model';
import { FilterData, PagedListRequest } from '@models/pagination.model';
import { LookupItem } from '@models/lookup.model';
import {
  CardComponent,
  LoadingStateComponent,
  PaginationComponent,
  RowsPerPageComponent
} from '@components/index';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { trackById } from '@utils/trackby.utils';
import { ToastService } from '@services/toast.service';
import { ButtonComponent } from '@components/button/button.component';

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
    AppDatePipe,
    DropdownComponent,
    ButtonComponent
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
  /** Draft values in the additional-filters panel (applied only after "Apply filters"). */
  filterPrimaryPurposeIds: number[] = [];
  filterStatuses: AssetStatus[] = [];
  filterSupplierIds: number[] = [];
  filterManufacturerIds: number[] = [];
  /** Draft: filter by custodian (employee) id(s). */
  filterEmployeeIds: number[] = [];
  filterCustody: CustodyFilter = 'all';
  /** `yyyy-MM-dd` from `<input type="date">`; filters `CreationDate` on the server. */
  filterDateFrom = '';
  filterDateTo = '';

  /** Values sent to the API (kept in sync by Apply filters, Clear, and initial load). */
  appliedFilterDateFrom = '';
  appliedFilterDateTo = '';
  appliedPrimaryPurposeIds: number[] = [];
  appliedFilterStatuses: AssetStatus[] = [];
  appliedSupplierIds: number[] = [];
  appliedManufacturerIds: number[] = [];
  appliedEmployeeIds: number[] = [];
  appliedFilterCustody: CustodyFilter = 'all';
  appliedDepotIds: number[] = [];

  /** When true, date / custody / advanced filter row is visible. */
  showMoreFilters = false;

  private readonly destroy$ = new Subject<void>();

  depots: LookupItem[] = [];
  /** Draft depot selection (multi); `appliedDepotIds` drives the API. */
  selectedDepotIds: number[] = [];

  primaryPurposes: LookupItem[] = [];
  suppliers: LookupItem[] = [];
  manufacturers: LookupItem[] = [];
  employees: EmployeeDto[] = [];

  readonly statusFilterOptions: { value: AssetStatus; labelKey: string }[] = [
    { value: AssetStatus.ReadyToIssue, labelKey: 'assetStatus.readyToIssue' },
    { value: AssetStatus.InMaintenance, labelKey: 'assetStatus.inMaintenance' },
    { value: AssetStatus.UnserviceableRepairable, labelKey: 'assetStatus.unserviceableRepairable' },
    { value: AssetStatus.UnserviceableUnrepairable, labelKey: 'assetStatus.unserviceableUnrepairable' },
    { value: AssetStatus.AwaitingDisposal, labelKey: 'assetStatus.awaitingDisposal' },
    { value: AssetStatus.Disposed, labelKey: 'assetStatus.disposed' }
  ];

  /** Checkout / check-in: include `all` as a real option so the trigger shows the same translated label as other filters. */
  readonly custodyDropdownOptions: DropdownOption<CustodyFilter>[] = [
    { label: 'weaponAssetMaster.filters.all', value: 'all' },
    { label: 'weaponAssetMaster.filters.custodyCheckout', value: 'checkout' },
    { label: 'weaponAssetMaster.filters.custodyCheckin', value: 'checkin' }
  ];

  get statusDropdownOptions(): DropdownOption<AssetStatus>[] {
    return this.statusFilterOptions.map((o) => ({ label: o.labelKey, value: o.value }));
  }

  readonly depotDropdownLabelFn = (option: DropdownOption<LookupItem> | LookupItem | null): string => {
    const item = this.unwrapLookupOption(option);
    return item ? this.depotOptionLabel(item) : '';
  };

  readonly lookupDropdownLabelFn = (option: DropdownOption<LookupItem> | LookupItem | null): string => {
    const item = this.unwrapLookupOption(option);
    return item ? this.lookupOptionLabel(item) : '';
  };

  readonly employeeDropdownLabelFn = (option: DropdownOption<EmployeeDto> | EmployeeDto | null): string => {
    const e = this.unwrapEmployeeOption(option);
    if (!e) return '';
    const lang = getCurrentLang(this.translateService);
    const name = getLocalizedName({ nameEn: e.nameEn, nameAr: e.nameAr }, lang)?.trim();
    if (name && e.militaryId) return `${name} (${e.militaryId})`;
    if (name) return name;
    return e.militaryId?.trim() || String(e.id);
  };

  private unwrapEmployeeOption(option: DropdownOption<EmployeeDto> | EmployeeDto | null): EmployeeDto | null {
    if (option == null) return null;
    if (typeof option === 'object' && 'value' in option && (option as DropdownOption<EmployeeDto>).value !== undefined) {
      return (option as DropdownOption<EmployeeDto>).value as EmployeeDto;
    }
    return option as EmployeeDto;
  }

  private unwrapLookupOption(option: DropdownOption<LookupItem> | LookupItem | null): LookupItem | null {
    if (option == null) return null;
    if (typeof option === 'object' && 'value' in option && (option as DropdownOption<LookupItem>).value !== undefined) {
      return (option as DropdownOption<LookupItem>).value as LookupItem;
    }
    return option as LookupItem;
  }

  expandedAssetIds = new Set<number>();
  historyByAssetId = new Map<number, AssetHistoryDto[]>();
  loadingHistory = new Set<number>();

  /** Quick view popup (row details + return dates + created by). */
  viewModalAsset: AssetDto | null = null;

  sortColumn: SortColumn = 'serial';
  sortDirection: 'asc' | 'desc' = 'asc';

  readonly ChevronDown = ChevronDown;
  readonly ChevronRight = ChevronRight;
  readonly History = History;
  readonly ArrowRight = ArrowRight;
  readonly Eye = Eye;
  readonly User = User;
  readonly Building = Building;
  readonly Search = Search;
  readonly X = X;
  readonly FilterX = FilterX;
  readonly trackById = trackById;

  constructor(
    private assetService: AssetService,
    private assetHistoryService: AssetHistoryService,
    private lookupService: LookupService,
    private employeeService: EmployeeService,
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

    this.employeeService
      .getEmployees()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => {
          this.employees = (list ?? []).filter((e) => e && !e.isDeleted);
          this.cdr.markForCheck();
        },
        error: () => {
          this.employees = [];
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

  clearSearch(): void {
    this.searchInput = '';
    this.applySearch();
  }

  toggleMoreFilters(): void {
    if (!this.showMoreFilters) {
      this.syncDraftFiltersFromApplied();
    }
    this.showMoreFilters = !this.showMoreFilters;
    this.cdr.markForCheck();
  }

  /** Copies draft filter controls into applied state and reloads the list. */
  applyAdditionalFilters(): void {
    this.appliedFilterDateFrom = this.filterDateFrom?.trim() ?? '';
    this.appliedFilterDateTo = this.filterDateTo?.trim() ?? '';
    this.appliedPrimaryPurposeIds = [...this.filterPrimaryPurposeIds];
    this.appliedFilterStatuses = [...this.filterStatuses];
    this.appliedSupplierIds = [...this.filterSupplierIds];
    this.appliedManufacturerIds = [...this.filterManufacturerIds];
    this.appliedEmployeeIds = [...this.filterEmployeeIds];
    this.appliedFilterCustody = this.filterCustody;
    this.appliedDepotIds = [...this.selectedDepotIds];
    this.currentPage = 1;
    this.showMoreFilters = false;
    this.loadAssets();
    this.cdr.markForCheck();
  }

  private syncDraftFiltersFromApplied(): void {
    this.filterDateFrom = this.appliedFilterDateFrom;
    this.filterDateTo = this.appliedFilterDateTo;
    this.filterPrimaryPurposeIds = [...this.appliedPrimaryPurposeIds];
    this.filterStatuses = [...this.appliedFilterStatuses];
    this.filterSupplierIds = [...this.appliedSupplierIds];
    this.filterManufacturerIds = [...this.appliedManufacturerIds];
    this.filterEmployeeIds = [...this.appliedEmployeeIds];
    this.filterCustody = this.appliedFilterCustody;
    this.selectedDepotIds = [...this.appliedDepotIds];
  }

  clearColumnFilters(): void {
    this.searchInput = '';
    this.appliedSearchTerm = '';
    this.filterPrimaryPurposeIds = [];
    this.filterStatuses = [];
    this.filterSupplierIds = [];
    this.filterManufacturerIds = [];
    this.filterEmployeeIds = [];
    this.filterCustody = 'all';
    this.selectedDepotIds = [];
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.appliedFilterDateFrom = '';
    this.appliedFilterDateTo = '';
    this.appliedPrimaryPurposeIds = [];
    this.appliedFilterStatuses = [];
    this.appliedSupplierIds = [];
    this.appliedManufacturerIds = [];
    this.appliedEmployeeIds = [];
    this.appliedFilterCustody = 'all';
    this.appliedDepotIds = [];
    this.currentPage = 1;
    this.loadAssets();
  }

  hasActiveFilters(): boolean {
    return (
      !!this.appliedSearchTerm ||
      this.appliedPrimaryPurposeIds.length > 0 ||
      this.appliedFilterStatuses.length > 0 ||
      this.appliedSupplierIds.length > 0 ||
      this.appliedManufacturerIds.length > 0 ||
      this.appliedEmployeeIds.length > 0 ||
      this.appliedDepotIds.length > 0 ||
      this.appliedFilterCustody !== 'all' ||
      !!this.appliedFilterDateFrom?.trim() ||
      !!this.appliedFilterDateTo?.trim()
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

  openViewModal(asset: AssetDto, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.viewModalAsset = asset;
    if (!this.historyByAssetId.has(asset.id)) {
      this.loadHistory(asset.id);
    }
    this.cdr.markForCheck();
  }

  closeViewModal(): void {
    this.viewModalAsset = null;
    this.cdr.markForCheck();
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

  hasExpandedHistoryContent(asset: AssetDto): boolean {
    return this.getAssignmentHistoryEntries(asset.id).length > 0;
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

    this.appendOrEqNumericIds(filters, 'PrimaryPurposId', this.appliedPrimaryPurposeIds);
    this.appendOrEqStatuses(filters, this.appliedFilterStatuses);
    this.appendOrEqNumericIds(filters, 'SupplierId', this.appliedSupplierIds);
    this.appendOrEqNumericIds(filters, 'ManufacturerId', this.appliedManufacturerIds);
    this.appendOrEqNumericIds(filters, 'CurrentAssignment.CustodianId', this.appliedEmployeeIds);

    // Multiple depots: OR in filter body. Single depot uses query param only (see loadAssets).
    if (this.appliedDepotIds.length > 1) {
      this.appendOrEqNumericIds(filters, 'DepotId', this.appliedDepotIds);
    }

    // Server FilterProvider only supports eq, neq, comparison, contains, etc. — not isnull/isnotnull.
    // Asset.IsAssigned is the canonical flag for checked-out vs in-depot custody.
    if (this.appliedFilterCustody === 'checkout') {
      filters.push({ field: 'IsAssigned', operator: 'eq', value: 'true' });
    } else if (this.appliedFilterCustody === 'checkin') {
      filters.push({ field: 'IsAssigned', operator: 'eq', value: 'false' });
    }

    const { from: creationFrom, to: creationTo } = this.getNormalizedCreationDateRange();
    if (creationFrom) {
      filters.push({
        field: 'CreationDate',
        operator: 'gte',
        value: this.toUtcIsoStartOfLocalDay(creationFrom)
      });
    }
    if (creationTo) {
      filters.push({
        field: 'CreationDate',
        operator: 'lte',
        value: this.toUtcIsoEndOfLocalDay(creationTo)
      });
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

  /** One or more `eq` on the same field combined with OR (multi-select). */
  private appendOrEqNumericIds(filters: FilterData[], field: string, ids: number[]): void {
    const sanitized = (ids ?? []).filter((id) => id != null && id > 0);
    if (sanitized.length === 0) {
      return;
    }
    if (sanitized.length === 1) {
      filters.push({ field, operator: 'eq', value: String(sanitized[0]) });
      return;
    }
    filters.push({
      logic: 'or',
      filters: sanitized.map((id) => ({ field, operator: 'eq' as const, value: String(id) }))
    });
  }

  private appendOrEqStatuses(filters: FilterData[], statuses: AssetStatus[]): void {
    const list = (statuses ?? []).filter((s) => s != null);
    if (list.length === 0) {
      return;
    }
    if (list.length === 1) {
      filters.push({ field: 'Status', operator: 'eq', value: String(list[0]) });
      return;
    }
    filters.push({
      logic: 'or',
      filters: list.map((s) => ({ field: 'Status', operator: 'eq' as const, value: String(s) }))
    });
  }

  /** If both dates are set and from is after to, swap so the range is valid. */
  private getNormalizedCreationDateRange(): { from?: string; to?: string } {
    let from = this.appliedFilterDateFrom?.trim() ?? '';
    let to = this.appliedFilterDateTo?.trim() ?? '';
    if (!from && !to) {
      return {};
    }
    if (from && to && from > to) {
      const tmp = from;
      from = to;
      to = tmp;
    }
    return { from: from || undefined, to: to || undefined };
  }

  private toUtcIsoStartOfLocalDay(yMd: string): string {
    const [y, m, d] = yMd.split('-').map((v) => parseInt(v, 10));
    return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
  }

  private toUtcIsoEndOfLocalDay(yMd: string): string {
    const [y, m, d] = yMd.split('-').map((v) => parseInt(v, 10));
    return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
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

    const depotId =
      this.appliedDepotIds.length === 1 && this.appliedDepotIds[0] > 0 ? this.appliedDepotIds[0] : null;

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

  depotName(asset: AssetDto): string {
    const d = asset.depot;
    if (!d) return '—';
    const lang = getCurrentLang(this.translateService);
    const name = getLocalizedName(d, lang);
    return name.trim() || '—';
  }
}
