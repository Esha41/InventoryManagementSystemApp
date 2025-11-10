import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CardComponent } from '@components/card/card.component';
import { ButtonComponent } from '@components/button/button.component';
import { LucideAngularModule, Search, Filter, Edit, Trash2, Eye, Plus, X } from 'lucide-angular';
import { AmmunitionService } from '@services/ammunition.service';
import { LookupService } from '@services/lookup.service';
import { TranslationService } from '@services/translation.service';
import { forkJoin } from 'rxjs';
import { PaginationComponent } from '@pages/requests-management/components/pagination/pagination.component';
import { RowsPerPageComponent } from '@pages/requests-management/components/rows-per-page/rows-per-page.component';

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

  assets: Asset[] = [];
  loading = false;

  searchTerm = '';
  selectedHcc = '';
  selectedCaseType = '';
  selectedHazardDivision = '';
  selectedCompatibility = '';
  selectedPropellant = '';

  hccList: any[] = [];
  caseTypeList: any[] = [];
  hazardDivisionList: any[] = [];
  compatibilityList: any[] = [];
  propellantList: any[] = [];
  units: any[] = [];
  natureOptions: any[] = [];
  primaryPurposes: any[] = [];
  projectileColors: any[] = [];
  projectailMaterials: any[] = [];

  // Modals
  showEditModal = false;
  showDeleteModal = false;
  showViewModal = false;
  selectedAsset: any = null;
  editForm: FormGroup;

  // Toast
  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  // Pagination
  currentPage = 1;
  rowsPerPage = 10;

  constructor(
    private ammunitionService: AmmunitionService,
    private lookupService: LookupService,
    private fb: FormBuilder,
    private router: Router,
    private translateService: TranslateService,
    private translationService: TranslationService
  ) {
    this.editForm = this.fb.group({
      id: [0 as number],
      name: ['', Validators.required],
      itemNo: ['', Validators.required],
      partNo: ['', Validators.required],
      batchNo: [''],
      hccId: [null as number | null, Validators.required],
      bulletDiameter: [null as number | null],
      bulletDiameterUnitId: [null as number | null, Validators.required],
      caseLength: [null as number | null],
      caseLengthUnitId: [null as number | null, Validators.required],
      isLinked: [false as boolean],
      primer: [''],
      totalWeight: [null as number | null],
      nsn: ['', Validators.required],
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
    this.loadAssets();
    this.loadDropdowns();
  }

  private loadAssets(): void {
    this.loading = true;
    this.ammunitionService.getAll<any>().subscribe({
      next: (items) => {
        this.assets = (items || []).map((x: any) => ({
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
          readyForIssue: x.readyForIssue ?? true
        }));
        this.currentPage = 1;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load ammunitions:', err);
        this.assets = [];
        this.loading = false;
      }
    });
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
    const filtered = this.filteredAssets;
    const startIndex = (this.currentPage - 1) * this.rowsPerPage;
    return filtered.slice(startIndex, startIndex + this.rowsPerPage);
  }

  get filteredAssets(): Asset[] {
    return this.assets.filter(asset => {
      const matchesSearch = !this.searchTerm || 
        asset.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        asset.itemNo.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        asset.partNo.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        asset.batchNo.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesHcc = !this.selectedHcc || asset.hcc === this.selectedHcc;
      const matchesCaseType = !this.selectedCaseType || asset.caseType === this.selectedCaseType;
      const matchesHazardDivision = !this.selectedHazardDivision || asset.hazardDivision === this.selectedHazardDivision;
      const matchesCompatibility = !this.selectedCompatibility || asset.compatibility === this.selectedCompatibility;
      const matchesPropellant = !this.selectedPropellant || asset.propellant === this.selectedPropellant;

      return matchesSearch && matchesHcc && matchesCaseType && matchesHazardDivision && 
             matchesCompatibility && matchesPropellant;
    });
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }
    this.currentPage = page;
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
  }

  onFilterChange(): void {
    this.currentPage = 1;
  }

  onEdit(assetId: string): void {
    this.loading = true;
    this.ammunitionService.getById<any>(parseInt(assetId)).subscribe({
      next: (data) => {
        this.selectedAsset = data;
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
    this.selectedAsset = this.assets.find(a => a.id === assetId);
    this.showDeleteModal = true;
  }

  onView(assetId: string): void {
    this.loading = true;
    this.ammunitionService.getById<any>(parseInt(assetId)).subscribe({
      next: (data) => {
        this.selectedAsset = data;
        this.showViewModal = true;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load ammunition:', err);
        this.showErrorToast(this.translateService.instant('assetList.errors.failedToLoadDetails'));
        this.loading = false;
      }
    });
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
      name: string; itemNo: string; partNo: string; batchNo?: string;
      hccId: number; bulletDiameter: number | null; bulletDiameterUnitId: number;
      caseLength: number | null; caseLengthUnitId: number; isLinked: boolean;
      primer?: string; totalWeight: number | null; nsn: string; caseTypeId: number;
      propellantId: number; compatibilityId: number; hazardDivisionId: number;
      readyForIssue: boolean; expiryDate?: string;
      natureOptionId: number | null; primaryPurposId: number | null;
      projectileColorId: number | null; projectailMaterialId: number | null;
    };

    const v = this.editForm.value as EditFormModel;
    const id = v.id;

    // Builder maps null/empty to undefined for optional fields
    const buildDto = (m: EditFormModel) => ({
      name: m.name,
      itemNo: m.itemNo,
      partNo: m.partNo,
      batchNo: m.batchNo || undefined,
      hccId: m.hccId,
      bulletDiameter: m.bulletDiameter ?? 0,
      bulletDiameterUnitId: m.bulletDiameterUnitId,
      caseLength: m.caseLength ?? 0,
      caseLengthUnitId: m.caseLengthUnitId,
      isLinked: m.isLinked,
      primer: m.primer || undefined,
      totalWeight: m.totalWeight ?? 0,
      nsn: m.nsn ? m.nsn.trim() : undefined,
      caseTypeId: m.caseTypeId,
      propellantId: m.propellantId,
      compatibilityId: m.compatibilityId,
      hazardDivisionId: m.hazardDivisionId,
      readyForIssue: m.readyForIssue,
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
    this.toastMessage = message;
    this.toastType = 'success';
    this.showToast = true;
    setTimeout(() => {
      this.showToast = false;
      setTimeout(() => (this.toastMessage = ''), 300);
    }, 3000);
  }

  private showErrorToast(message: string): void {
    this.toastMessage = message;
    this.toastType = 'error';
    this.showToast = true;
    setTimeout(() => {
      this.showToast = false;
      setTimeout(() => (this.toastMessage = ''), 300);
    }, 3000);
  }
}
