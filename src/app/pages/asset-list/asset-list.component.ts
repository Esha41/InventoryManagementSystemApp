import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CardComponent } from '@components/card/card.component';
import { ButtonComponent } from '@components/button/button.component';
import { LucideAngularModule, Search, Filter, Edit, Trash2, Eye, Plus, X, ArrowUpDown, ArrowUp, ArrowDown, FilterX, ChevronLeft, ChevronRight } from 'lucide-angular';
import { AmmunitionService } from '@services/ammunition.service';
import { WeaponService } from '@services/weapon.service';
import { ExplosiveService } from '@services/explosive.service';
import { LookupService } from '@services/lookup.service';
import { TranslationService } from '@services/translation.service';
import { ToastService } from '@services/toast.service';
import { AmmunitionCreateDto, AmmunitionReadDto } from '@models/ammunition.model';
import { BaseItemDto } from '@models/inventory.model';
import { LookupItem } from '@models/lookup.model';
import { forkJoin } from 'rxjs';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { PaginationComponent, RowsPerPageComponent } from '@components/index';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';

interface Asset {
  id: string;
  name: string;
  itemNo: string;
  partNo: string;
  batchNo: string;
  hcc?: string;
  nsn?: string;
  caseType?: string;
  hazardDivision?: string;
  compatibility?: string;
  propellant?: string;
  expiryDate?: string;
  expiryDateRaw?: string;
  readyForIssue: boolean;
}

@Component({
  selector: 'app-asset-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CardComponent,
    ButtonComponent,
    LucideAngularModule,
    TranslateModule,
    DropdownComponent,
    HasPermissionDirective,
    PaginationComponent,
    RowsPerPageComponent
  ],
  templateUrl: './asset-list.component.html',
  styleUrls: ['./asset-list.component.css']
})
export class AssetListComponent implements OnInit {
  readonly Search = Search;
  readonly Filter = Filter;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;
  readonly Eye = Eye;
  readonly Plus = Plus;
  readonly X = X;
  readonly ArrowUpDown = ArrowUpDown;
  readonly ArrowUp = ArrowUp;
  readonly ArrowDown = ArrowDown;
  readonly FilterX = FilterX;
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;

  assets: Asset[] = [];
  loading = false;

  // Tab management
  activeTab: 'ammunition' | 'weapon' | 'explosive' = 'ammunition';

  searchTerm = '';
  selectedHcc: string | null = null;
  selectedCaseType: string | null = null;
  selectedHazardDivision: string | null = null;
  selectedCompatibility: string | null = null;
  selectedPropellant: string | null = null;
  sortColumn: string = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';

  hccList: LookupItem[] = [];
  caseTypeList: LookupItem[] = [];
  hazardDivisionList: LookupItem[] = [];
  compatibilityList: LookupItem[] = [];
  propellantList: LookupItem[] = [];
  units: LookupItem[] = [];
  natureOptions: LookupItem[] = [];
  primaryPurposes: LookupItem[] = [];
  projectileColors: LookupItem[] = [];
  projectailMaterials: LookupItem[] = [];
  readonly lookupOptionLabel = (option: DropdownOption<LookupItem> | LookupItem) => this.getLocalizedName(this.unwrapOption(option));
  readonly linkedOptions = [
    { label: 'assetList.editModal.notLinked', value: false },
    { label: 'assetList.editModal.linked', value: true }
  ];
  readonly readyForIssueOptions = [
    { label: 'common.yes', value: true },
    { label: 'common.no', value: false }
  ];

  // Modals
  showEditModal = false;
  showDeleteModal = false;
  showViewModal = false;
  selectedAsset: any = null;
  editForm: FormGroup;


  // Pagination
  currentPage = 1;
  rowsPerPage = 5;

  constructor(
    private ammunitionService: AmmunitionService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
    private lookupService: LookupService,
    private fb: FormBuilder,
    private router: Router,
    private translateService: TranslateService,
    private translationService: TranslationService,
    private toastService: ToastService
  ) {
    this.editForm = this.fb.group({
      id: [0 as number],
      name: ['', Validators.required],
      itemNo: ['', Validators.required],
      partNo: ['', Validators.required],
      batchNo: ['', Validators.required],
      hccId: [null as number | null, Validators.required],
      bulletDiameter: [null as number | null, [Validators.required, Validators.min(0.01)]],
      bulletDiameterUnitId: [null as number | null, Validators.required],
      caseLength: [null as number | null, [Validators.required, Validators.min(0.01)]],
      caseLengthUnitId: [null as number | null, Validators.required],
      isLinked: [false as boolean],
      primer: ['', Validators.required],
      totalWeight: [null as number | null, [Validators.required, Validators.min(0.01)]],
      nsn: [''],
      caseTypeId: [null as number | null, Validators.required],
      propellantId: [null as number | null, Validators.required],
      compatibilityId: [null as number | null, Validators.required],
      hazardDivisionId: [null as number | null, Validators.required],
      readyForIssue: [true as boolean],
      expiryDate: [''],
      natureOptionId: [null as number | null],
      primaryPurposId: [null as number | null],
      projectileColorId: [null as number | null],
      projectailMaterialId: [null as number | null]
    });
  }

  ngOnInit(): void {
    try {
      this.loadAssets();
      this.loadDropdowns();
    } catch (error) {
      console.error('Error initializing asset list component:', error);
      this.loading = false;
    }
  }

  switchTab(tab: 'ammunition' | 'weapon' | 'explosive'): void {
    this.activeTab = tab;
    this.clearFilters();
    this.loadAssets();
  }

  private loadAssets(): void {
    this.loading = true;
    
    try {
      if (this.activeTab === 'ammunition') {
        this.loadAmmunition();
      } else if (this.activeTab === 'weapon') {
        this.loadWeapons();
      } else if (this.activeTab === 'explosive') {
        this.loadExplosives();
      } else {
        // Default to ammunition if tab is invalid
        this.activeTab = 'ammunition';
        this.loadAmmunition();
      }
    } catch (error) {
      console.error('Error in loadAssets:', error);
      this.loading = false;
      this.assets = [];
    }
  }

  private loadAmmunition(): void {
    this.ammunitionService.getAll<AmmunitionReadDto>().subscribe({
      next: (items) => {
        try {
          this.assets = (items || []).map((x: AmmunitionReadDto) => ({
            id: x.id?.toString() || '-',
            name: x.name || 'Unknown',
            itemNo: x.itemNo || '-',
            partNo: x.partNo || '-',
            batchNo: x.batchNo || '-',
            hcc: x.hcc?.nameEn || x.hcc?.nameAr || '-',
            nsn: x.nsn || '-',
            caseType: x.caseType?.nameEn || x.caseType?.nameAr || '-',
            hazardDivision: x.hazardDivision?.nameEn || x.hazardDivision?.nameAr || '-',
            compatibility: x.compatibility?.nameEn || x.compatibility?.nameAr || '-',
            propellant: x.propellant?.nameEn || x.propellant?.nameAr || '-',
            expiryDate: x.expiryDate ? new Date(x.expiryDate).toLocaleDateString() : '-',
            expiryDateRaw: x.expiryDate ? (typeof x.expiryDate === 'string' ? x.expiryDate : new Date(x.expiryDate).toISOString()) : undefined,
            readyForIssue: x.readyForIssue ?? true
          }));
          this.currentPage = 1;
          this.loading = false;
          this.validateCurrentPage();
        } catch (error) {
          console.error('Error mapping ammunition data:', error);
          this.assets = [];
          this.loading = false;
        }
      },
      error: (err) => {
        console.error('Failed to load ammunitions:', err);
        this.showErrorToast(this.translateService.instant('assetList.errors.failedToLoad') || 'Failed to load ammunition');
        this.assets = [];
        this.loading = false;
      }
    });
  }

  private loadWeapons(): void {
    this.weaponService.getAll<BaseItemDto>().subscribe({
      next: (items) => {
        this.assets = (items || []).map((x: BaseItemDto) => ({
          id: x.id?.toString() || '-',
          name: x.name || 'Unknown',
          itemNo: x.itemNo || '-',
          partNo: x.partNo || '-',
          batchNo: x.batchNo || '-',
          hcc: x.hcc?.nameEn || x.hcc?.nameAr || '-',
          nsn: x.nsn || '-',
          caseType: '-',
          hazardDivision: '-',
          compatibility: '-',
          propellant: '-',
          expiryDate: x.expiryDate ? new Date(x.expiryDate).toLocaleDateString() : '-',
          expiryDateRaw: x.expiryDate ? (typeof x.expiryDate === 'string' ? x.expiryDate : new Date(x.expiryDate).toISOString()) : undefined,
          readyForIssue: x.readyForIssue ?? true
        }));
        this.currentPage = 1;
        this.loading = false;
        this.validateCurrentPage();
      },
      error: (err) => {
        console.error('Failed to load weapons:', err);
        this.showErrorToast(this.translateService.instant('assetList.errors.failedToLoad') || 'Failed to load weapons');
        this.assets = [];
        this.loading = false;
      }
    });
  }

  private loadExplosives(): void {
    this.explosiveService.getAll<BaseItemDto>().subscribe({
      next: (items) => {
        this.assets = (items || []).map((x: BaseItemDto) => ({
          id: x.id?.toString() || '-',
          name: x.name || 'Unknown',
          itemNo: x.itemNo || '-',
          partNo: x.partNo || '-',
          batchNo: x.batchNo || '-',
          hcc: x.hcc?.nameEn || x.hcc?.nameAr || '-',
          nsn: x.nsn || '-',
          caseType: '-',
          hazardDivision: '-',
          compatibility: '-',
          propellant: '-',
          expiryDate: x.expiryDate ? new Date(x.expiryDate).toLocaleDateString() : '-',
          expiryDateRaw: x.expiryDate ? (typeof x.expiryDate === 'string' ? x.expiryDate : new Date(x.expiryDate).toISOString()) : undefined,
          readyForIssue: x.readyForIssue ?? true
        }));
        this.currentPage = 1;
        this.loading = false;
        this.validateCurrentPage();
      },
      error: (err) => {
        console.error('Failed to load explosives:', err);
        this.showErrorToast(this.translateService.instant('assetList.errors.failedToLoad') || 'Failed to load explosives');
        this.assets = [];
        this.loading = false;
      }
    });
  }

  get canEdit(): boolean {
    return this.activeTab === 'ammunition';
  }

  private loadDropdowns(): void {
    forkJoin({
      hccs: this.lookupService.getHccs(),
      caseTypes: this.lookupService.getCaseTypes(),
      hazardDivisions: this.lookupService.getHazardDivisions(),
      compatibilities: this.lookupService.getCompatibilities(),
      propellants: this.lookupService.getPropellants(),
      units: this.lookupService.getUnits(),
      natureOptions: this.lookupService.getNatureOptions(),
      primaryPurposes: this.lookupService.getPrimaryPurposes(),
      projectileColors: this.lookupService.getColors(),
      projectailMaterials: this.lookupService.getProjectailMaterials()
    }).subscribe({
      next: (data) => {
        this.hccList = data.hccs || [];
        this.caseTypeList = data.caseTypes || [];
        this.hazardDivisionList = data.hazardDivisions || [];
        this.compatibilityList = data.compatibilities || [];
        this.propellantList = data.propellants || [];
        this.units = data.units || [];
        this.natureOptions = data.natureOptions || [];
        this.primaryPurposes = data.primaryPurposes || [];
        this.projectileColors = data.projectileColors || [];
        this.projectailMaterials = data.projectailMaterials || [];
      },
      error: (err) => console.error('Failed to load lookups:', err)
    });
  }

  get totalPages(): number {
    const totalItems = this.filteredAssets.length;
    if (totalItems === 0) {
      return 1;
    }
    return Math.ceil(totalItems / this.rowsPerPage);
  }

  get paginatedAssets(): Asset[] {
    // Ensure currentPage is valid before slicing
    this.validateCurrentPage();
    const startIndex = (this.currentPage - 1) * this.rowsPerPage;
    return this.filteredAssets.slice(startIndex, startIndex + this.rowsPerPage);
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

  get hccFilterOptions(): Array<{ label: string; value: string }> {
    return this.mapToFilterOptions(this.hccList);
  }

  get caseTypeFilterOptions(): Array<{ label: string; value: string }> {
    return this.mapToFilterOptions(this.caseTypeList);
  }

  get hazardDivisionFilterOptions(): Array<{ label: string; value: string }> {
    return this.mapToFilterOptions(this.hazardDivisionList);
  }

  get compatibilityFilterOptions(): Array<{ label: string; value: string }> {
    return this.mapToFilterOptions(this.compatibilityList);
  }

  get filteredAssets(): Asset[] {
    let filtered = this.assets.filter(asset => {
      const matchesSearch = !this.searchTerm || 
        asset.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        asset.itemNo.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        asset.partNo.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        asset.batchNo.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesHcc = !this.selectedHcc || this.selectedHcc === null || asset.hcc === this.selectedHcc;
      const matchesCaseType = !this.selectedCaseType || this.selectedCaseType === null || asset.caseType === this.selectedCaseType;
      const matchesHazardDivision = !this.selectedHazardDivision || this.selectedHazardDivision === null || asset.hazardDivision === this.selectedHazardDivision;
      const matchesCompatibility = !this.selectedCompatibility || this.selectedCompatibility === null || asset.compatibility === this.selectedCompatibility;
      const matchesPropellant = !this.selectedPropellant || this.selectedPropellant === null || asset.propellant === this.selectedPropellant;

      return matchesSearch && matchesHcc && matchesCaseType && matchesHazardDivision && 
             matchesCompatibility && matchesPropellant;
    });

    // Apply sorting
    return this.sortAssets(filtered);
  }

  onPageChange(page: number): void {
    const maxPages = this.totalPages;
    if (page < 1 || page > maxPages || maxPages === 0) {
      return;
    }
    this.currentPage = page;
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
    // Validate after changing rows per page
    this.validateCurrentPage();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    // Validate after search/filter in case filtered results have fewer pages
    this.validateCurrentPage();
  }

  sortByColumn(column: string): void {
    if (this.sortColumn === column) {
      // Toggle direction
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New column, default to ascending
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.currentPage = 1;
    // Validate after sorting
    this.validateCurrentPage();
  }

  private sortAssets(assets: Asset[]): Asset[] {
    if (!this.sortColumn) {
      return assets;
    }

    return [...assets].sort((a, b) => {
      let compareResult = 0;

      switch (this.sortColumn) {
        case 'name':
          compareResult = a.name.localeCompare(b.name);
          break;
        case 'itemNo':
          compareResult = a.itemNo.localeCompare(b.itemNo);
          break;
        case 'partNo':
          compareResult = a.partNo.localeCompare(b.partNo);
          break;
        case 'batchNo':
          compareResult = a.batchNo.localeCompare(b.batchNo);
          break;
        case 'hcc':
          compareResult = (a.hcc || '').localeCompare(b.hcc || '');
          break;
        case 'nsn':
          compareResult = (a.nsn || '').localeCompare(b.nsn || '');
          break;
        case 'caseType':
          compareResult = (a.caseType || '').localeCompare(b.caseType || '');
          break;
        case 'hazardDivision':
          compareResult = (a.hazardDivision || '').localeCompare(b.hazardDivision || '');
          break;
        case 'expiryDate':
          compareResult = this.compareExpiryDates(a, b);
          break;
        case 'readyForIssue':
          compareResult = (a.readyForIssue === b.readyForIssue) ? 0 : (a.readyForIssue ? -1 : 1);
          break;
        default:
          return 0;
      }

      return this.sortDirection === 'asc' ? compareResult : -compareResult;
    });
  }

  private compareExpiryDates(a: Asset, b: Asset): number {
    // Handle missing dates - put them at the end
    if (!a.expiryDateRaw && !b.expiryDateRaw) return 0;
    if (!a.expiryDateRaw) return 1;
    if (!b.expiryDateRaw) return -1;

    const dateA = new Date(a.expiryDateRaw).getTime();
    const dateB = new Date(b.expiryDateRaw).getTime();
    return dateA - dateB;
  }

  onEdit(assetId: string): void {
    if (this.activeTab !== 'ammunition') return;
    this.loading = true;
    this.ammunitionService.getById<AmmunitionReadDto>(parseInt(assetId)).subscribe({
      next: (data) => {
        if (!data) {
          this.showErrorToast(this.translateService.instant('assetList.errors.failedToLoadDetails'));
          this.loading = false;
          return;
        }
        
        // Map to Asset interface for selectedAsset
        this.selectedAsset = {
          id: data.id.toString(),
          name: data.name || 'Unknown',
          itemNo: data.itemNo || '-',
          partNo: data.partNo || '-',
          batchNo: data.batchNo || '-',
          hcc: data.hcc?.nameEn || data.hcc?.nameAr || '-',
          nsn: data.nsn || '-',
          caseType: data.caseType?.nameEn || data.caseType?.nameAr || '-',
          hazardDivision: data.hazardDivision?.nameEn || data.hazardDivision?.nameAr || '-',
          compatibility: data.compatibility?.nameEn || data.compatibility?.nameAr || '-',
          propellant: data.propellant?.nameEn || data.propellant?.nameAr || '-',
          expiryDate: data.expiryDate ? new Date(data.expiryDate).toLocaleDateString() : '-',
          readyForIssue: data.readyForIssue ?? true
        };
        
        this.editForm.patchValue({
          id: data.id,
          name: data.name,
          itemNo: data.itemNo,
          partNo: data.partNo,
          batchNo: data.batchNo || '',
          hccId: data.hccId,
          bulletDiameter: data.bulletDiameter || 0,
          bulletDiameterUnitId: data.bulletDiameterUnitId,
          caseLength: data.caseLength || 0,
          caseLengthUnitId: data.caseLengthUnitId,
          isLinked: data.isLinked || false,
          primer: data.primer || '',
          totalWeight: data.totalWeight || 0,
          nsn: data.nsn || '',
          caseTypeId: data.caseTypeId,
          propellantId: data.propellantId,
          compatibilityId: data.compatibilityId,
          hazardDivisionId: data.hazardDivisionId,
          readyForIssue: data.readyForIssue ?? true,
          expiryDate: data.expiryDate ? new Date(data.expiryDate).toISOString().split('T')[0] : '',
          natureOptionId: data.natureOptionId ?? null,
          primaryPurposId: data.primaryPurposId ?? null,
          projectileColorId: data.projectileColorId ?? null,
          projectailMaterialId: data.projectailMaterialId ?? null
        });
        this.showEditModal = true;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load ammunition:', err);
        this.showErrorToast(this.translateService.instant('assetList.errors.failedToLoadDetails'));
        this.loading = false;
      }
    });
  }

  onDelete(assetId: string): void {
    if (this.activeTab !== 'ammunition') return;
    this.selectedAsset = this.assets.find(a => a.id === assetId);
    this.showDeleteModal = true;
  }

  onView(assetId: string): void {
    if (this.activeTab === 'ammunition') {
      this.loading = true;
      this.ammunitionService.getById<AmmunitionReadDto>(parseInt(assetId)).subscribe({
      next: (data) => {
        if (data) {
        
          this.selectedAsset = {
            id: data.id.toString(),
            name: data.name || 'Unknown',
            itemNo: data.itemNo || '-',
            partNo: data.partNo || '-',
            batchNo: data.batchNo || '-',
            hcc: data.hcc, 
            nsn: data.nsn || '-',
            caseType: data.caseType, 
            hazardDivision: data.hazardDivision, 
            compatibility: data.compatibility,
            propellant: data.propellant, 
            bulletDiameter: data.bulletDiameter,
            bulletDiameterUnit: data.bulletDiameterUnit,
            caseLength: data.caseLength,
            caseLengthUnit: data.caseLengthUnit, 
            primer: data.primer || '-',
            totalWeight: data.totalWeight,
            isLinked: data.isLinked ?? false,
            expiryDate: data.expiryDate ? (typeof data.expiryDate === 'string' ? data.expiryDate : new Date(data.expiryDate).toISOString()) : undefined,
            readyForIssue: data.readyForIssue ?? true
          };
        }
        this.showViewModal = true;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load ammunition:', err);
        this.showErrorToast(this.translateService.instant('assetList.errors.failedToLoadDetails'));
        this.loading = false;
      }
    });
    } else {
      // For weapons and explosives, just show basic info
      const asset = this.assets.find(a => a.id === assetId);
      if (asset) {
        this.selectedAsset = asset;
        this.showViewModal = true;
      }
    }
  }

  confirmDelete(): void {
    if (!this.selectedAsset) return;

    this.loading = true;
    this.ammunitionService.delete(parseInt(this.selectedAsset.id)).subscribe({
      next: () => {
        this.showDeleteModal = false;
        this.selectedAsset = null;
        this.showSuccessToast(this.translateService.instant('assetList.success.deleted'));
        this.loadAssets();
      },
      error: (err) => {
        console.error('Failed to delete:', err);
        this.showErrorToast(this.translateService.instant('assetList.errors.failedToDelete'));
        this.loading = false;
      }
    });
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.selectedAsset = null;
  }

  saveEdit(): void {
    if (this.editForm.invalid) {
      this.showErrorToast(this.translateService.instant('assetList.errors.fillRequiredFields'));
      return;
    }

    this.loading = true;
    type EditFormModel = {
      id: number;
      name: string; itemNo: string; partNo?: string; batchNo?: string;
      hccId: number; bulletDiameter: number | null; bulletDiameterUnitId: number;
      caseLength: number | null; caseLengthUnitId: number; isLinked: boolean;
      primer?: string; totalWeight: number | null; nsn?: string; caseTypeId: number;
      propellantId: number; compatibilityId: number; hazardDivisionId: number;
      readyForIssue: boolean; expiryDate?: string;
      natureOptionId: number | null; primaryPurposId: number | null;
      projectileColorId: number | null; projectailMaterialId: number | null;
    };

    const v = this.editForm.value as EditFormModel;
    const id = v.id;

    // Builder maps null/empty to undefined for optional fields
    // Note: Backend uses CreateUpdateAmmunitionDto (same as create, without id/lot)
    const buildDto = (m: EditFormModel): AmmunitionCreateDto => ({
      name: m.name,
      itemNo: m.itemNo,
      partNo: m.partNo?.trim() || 'N/A',
      batchNo: m.batchNo || '',
      hccId: m.hccId,
      bulletDiameter: m.bulletDiameter ?? 0,
      bulletDiameterUnitId: m.bulletDiameterUnitId,
      caseLength: m.caseLength ?? 0,
      caseLengthUnitId: m.caseLengthUnitId,
      isLinked: m.isLinked,
      primer: m.primer?.trim() || '',
      totalWeight: m.totalWeight ?? 0,
      nsn: m.nsn?.trim() || undefined,
      caseTypeId: m.caseTypeId,
      propellantId: m.propellantId,
      compatibilityId: m.compatibilityId,
      hazardDivisionId: m.hazardDivisionId,
      readyForIssue: m.readyForIssue ?? true,
      expiryDate: m.expiryDate || undefined,
      natureOptionId: m.natureOptionId ?? undefined,
      primaryPurposId: m.primaryPurposId ?? undefined,
      projectileColorId: m.projectileColorId ?? undefined,
      projectailMaterialId: m.projectailMaterialId ?? undefined
    });

    this.ammunitionService.update(id, buildDto(v)).subscribe({
      next: (response) => {
        if (response.succeeded) {
          this.showEditModal = false;
          this.selectedAsset = null;
          this.showSuccessToast(this.translateService.instant('assetList.success.updated'));
          this.loadAssets();
        } else {
          this.showErrorToast(response.message || this.translateService.instant('assetList.errors.failedToUpdate'));
          this.loading = false;
        }
      },
      error: (err) => {
        console.error('Failed to update:', err);
        this.showErrorToast(this.translateService.instant('assetList.errors.failedToUpdate'));
        this.loading = false;
      }
    });
  }

  cancelEdit(): void {
    this.showEditModal = false;
    this.selectedAsset = null;
    this.editForm.reset();
  }

  closeViewModal(): void {
    this.showViewModal = false;
    this.selectedAsset = null;
  }

  navigateToAddAsset(): void {
    this.router.navigate(['/add-asset']);
  }

  private mapToFilterOptions(list: any[]): Array<{ label: string; value: string }> {
    return (list || []).map(item => {
      const label = this.getLocalizedName(item);
      return {
        label,
        value: label
      };
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

    const currentLang = this.translateService.currentLang || this.translateService.defaultLang || 'en';
    if (currentLang === 'ar') {
      return entity.nameAr || entity.nameEN || entity.nameEn || '';
    }
    return entity.nameEn || entity.nameEN || entity.nameAr || '';
  }

  private unwrapOption<T>(option: DropdownOption<T> | T): T {
    if (option && typeof option === 'object' && option !== null && 'value' in option) {
      return option.value as T;
    }
    return option as T;
  }

  getReadyForIssueColor(ready: boolean): string {
    return ready ? 'bg-[var(--color-success)]' : 'bg-[var(--color-error)]';
  }

  getReadyForIssueText(ready: boolean): string {
    return ready ? this.translateService.instant('assetList.ready') : this.translateService.instant('assetList.notReady');
  }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  private showSuccessToast(message: string): void {
    const title = this.translateService.instant('toast.success');
    this.toastService.success(message, title);
  }

  private showErrorToast(message: string): void {
    const title = this.translateService.instant('toast.error');
    this.toastService.error(message, title);
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedHcc = null;
    this.selectedCaseType = null;
    this.selectedHazardDivision = null;
    this.selectedCompatibility = null;
    this.selectedPropellant = null;
    this.currentPage = 1;
  }
}
