import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, Plus, Edit, Trash2, X } from 'lucide-angular';
import { LookupService } from '@services/lookup.service';
import { DepotDto } from '@models/depot.model';
import { ApiService } from '@services/api.service';
import { APIOperationResponse } from '@models/api-response.model';
import { ToastService } from '@services/toast.service';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { API_ENDPOINTS } from '@constants/app.constants';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { LoadingStateComponent } from '@components/index';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { ProfileDataService } from '@services/profile-data.service';

@Component({
  selector: 'app-depot-management',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, ConfirmDialogComponent, HasPermissionDirective, LoadingStateComponent],
  templateUrl: './depot-management.component.html',
  styleUrls: ['./depot-management.component.css']
})
export class DepotManagementComponent implements OnInit, OnDestroy {
  readonly Plus = Plus;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;
  readonly X = X;

  depots: DepotDto[] = [];
  loading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  // Modal state
  showModal = false;
  isEditMode = false;
  currentDepot: DepotDto = this.getEmptyDepot();

  // Delete confirmation dialog state
  showDeleteDialog = false;
  depotToDelete?: DepotDto;

  // Super admin check
  isSuperAdmin = false;

  private destroy$ = new Subject<void>();

  constructor(
    private lookupService: LookupService,
    private apiService: ApiService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private profileDataService: ProfileDataService
  ) { }

  ngOnInit(): void {
    // Check if user is super admin
    const profileData = this.profileDataService.getFullProfileData();
    this.isSuperAdmin = profileData?.isSuperAdmin || false;

    this.loadDepots();

    // Subscribe to language changes to update depot names
    this.translateService.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // Re-map depots to update localized names
        this.depots = this.depots.map(depot => ({
          ...depot,
          displayName: getLocalizedName(depot, getCurrentLang(this.translateService))
        }));
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDepots(): void {
    this.loading = true;
    this.errorMessage = null;

    this.apiService.getWithAuth<APIOperationResponse<DepotDto[]>>(API_ENDPOINTS.DEPOT.BASE)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.succeeded && response.data) {
            this.depots = response.data
              .filter(depot => !depot.isDeleted)
              .map(depot => ({
                ...depot,
                code: depot.code || depot.Code || '',
                Code: depot.Code || depot.code || '',
                location: depot.location || ''
              }));
          } else {
            this.errorMessage = response.message || 'Failed to load depots';
          }
          this.loading = false;
        },
        error: (error) => {
          this.errorMessage = error.message || 'Failed to load depots';
          this.loading = false;
        }
      });
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.currentDepot = this.getEmptyDepot();
    this.showModal = true;
  }

  openEditModal(depot: DepotDto): void {
    this.isEditMode = true;
    this.currentDepot = {
      ...depot,
      code: depot.code || depot.Code || '',
      Code: depot.Code || depot.code || ''
    };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.currentDepot = this.getEmptyDepot();
    this.errorMessage = null;
  }

  saveDepot(): void {
    if (!this.validateDepot()) {
      this.translateService.get('depotManagement.errors.fillRequiredFields').subscribe(translation => {
        this.errorMessage = translation || 'Please fill in all required fields';
      });
      return;
    }

    if (this.currentDepot.Code) {
      this.currentDepot.Code = this.currentDepot.Code.trim();
      this.currentDepot.code = this.currentDepot.Code;
    }

    this.loading = true;
    this.errorMessage = null;

    const request$ = this.isEditMode
      ? this.apiService.putWithAuth<APIOperationResponse<DepotDto>>(
        `${API_ENDPOINTS.DEPOT.BASE}/${this.currentDepot.id}`,
        this.currentDepot
      )
      : this.apiService.postWithAuth<APIOperationResponse<DepotDto>>(
        API_ENDPOINTS.DEPOT.BASE,
        this.currentDepot
      );

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.succeeded) {
          this.translateService.get([
            this.isEditMode ? 'toast.depotUpdated' : 'toast.depotCreated',
            'toast.success'
          ]).subscribe(translations => {
            const messageKey = this.isEditMode ? 'toast.depotUpdated' : 'toast.depotCreated';
            this.toastService.success(translations[messageKey], translations['toast.success']);
          });
          this.closeModal();
          this.lookupService.clearCacheFor('depots');
          this.loadDepots();
        } else {
          this.translateService.get(['toast.failedToSaveDepot', 'toast.error']).subscribe(translations => {
            this.toastService.error(
              response.message || translations['toast.failedToSaveDepot'],
              translations['toast.error']
            );
          });
        }
        this.loading = false;
      },
      error: (error) => {
        this.translateService.get(['toast.failedToSaveDepot', 'toast.error']).subscribe(translations => {
          this.toastService.error(
            error.message || translations['toast.failedToSaveDepot'],
            translations['toast.error']
          );
        });
        this.loading = false;
      }
    });
  }

  deleteDepot(depot: DepotDto): void {
    this.depotToDelete = depot;
    this.showDeleteDialog = true;
  }

  onDeleteConfirm(): void {
    if (!this.depotToDelete) return;

    this.loading = true;
    this.errorMessage = null;
    this.showDeleteDialog = false;

    this.apiService
      .deleteWithAuth<APIOperationResponse<DepotDto>>(
        `${API_ENDPOINTS.DEPOT.BASE}/${this.depotToDelete.id}`
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.succeeded) {
            this.translateService.get(['toast.depotDeleted', 'toast.success']).subscribe(translations => {
              this.toastService.success(translations['toast.depotDeleted'], translations['toast.success']);
            });
            this.lookupService.clearCacheFor('depots');
            this.loadDepots();
          } else {
            this.translateService.get(['toast.failedToDeleteDepot', 'toast.error']).subscribe(translations => {
              this.toastService.error(
                response.message || translations['toast.failedToDeleteDepot'],
                translations['toast.error']
              );
            });
          }
          this.loading = false;
          this.depotToDelete = undefined;
        },
        error: (err) => {
          // Extract the actual error message from various possible error structures
          let errorMessage = 'Failed to delete depot';

          // Check for userMessage from error interceptor first
          if (err?.userMessage) {
            errorMessage = err.userMessage;
          } else if (err instanceof Error && err.message) {
            // The API service's handleError wraps the error in an Error object with message property
            errorMessage = err.message;
          } else if (err?.error?.message) {
            // Direct error response from backend
            errorMessage = err.error.message;
          } else if (err?.message) {
            // Error message at top level
            errorMessage = err.message;
          } else if (typeof err === 'string') {
            // String error
            errorMessage = err;
          }

          this.translateService.get('toast.error').subscribe(translations => {
            this.toastService.error(
              errorMessage,
              translations['toast.error']
            );
          });
          this.loading = false;
          this.depotToDelete = undefined;
        }
      });
  }

  onDeleteCancel(): void {
    this.showDeleteDialog = false;
    this.depotToDelete = undefined;
  }

  validateDepot(): boolean {
    return !!(
      this.currentDepot.nameEn &&
      this.currentDepot.nameAr &&
      (this.currentDepot.Code || this.currentDepot.code) &&
      this.currentDepot.location
    );
  }

  private getEmptyDepot(): DepotDto {
    return {
      id: 0,
      nameAr: '',
      nameEn: '',
      code: '',
      Code: '',
      location: '',
      latitude: 0,
      longitude: 0,
      isDeleted: false
    };
  }

  /**
   * Get localized depot name for display
   */
  getDepotDisplayName(depot: DepotDto | null | undefined): string {
    if (!depot) return '';
    return getLocalizedName(depot, getCurrentLang(this.translateService)) || depot.code || '';
  }
}

