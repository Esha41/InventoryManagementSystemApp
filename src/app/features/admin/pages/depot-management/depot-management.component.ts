import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, Plus, Edit, Trash2, X, Users } from 'lucide-angular';
import { LookupService } from '@services/lookup.service';
import { DepotDto } from '@models/depot.model';
import { ApiService } from '@services/api.service';
import { APIOperationResponse } from '@models/api-response.model';
import { ToastService } from '@services/toast.service';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { API_ENDPOINTS } from '@constants/app.constants';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { LoadingStateComponent } from '@components/index';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { ProfileDataService } from '@services/profile-data.service';
import { DepotUserAssignmentModalComponent } from './components/depot-user-assignment-modal/depot-user-assignment-modal.component';
import { trackById } from '@utils/trackby.utils';

@Component({
  selector: 'app-depot-management',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, ConfirmDialogComponent, HasPermissionDirective, LoadingStateComponent, DepotUserAssignmentModalComponent],
  templateUrl: './depot-management.component.html',
  styleUrls: ['./depot-management.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DepotManagementComponent implements OnInit, OnDestroy {
  readonly Plus = Plus;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;
  readonly X = X;
  readonly Users = Users;
  readonly trackById = trackById;

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

  // Assign users modal state
  showAssignUsersModal = false;
  assignUsersDepot?: DepotDto;

  // Super admin check
  isSuperAdmin = false;

  private destroy$ = new Subject<void>();

  constructor(
    private lookupService: LookupService,
    private apiService: ApiService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private profileDataService: ProfileDataService,
    private cdr: ChangeDetectorRef
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
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDepots(): void {
    this.loading = true;
    this.errorMessage = null;
    this.cdr.markForCheck();

    this.lookupService.getDepotList()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (depots) => {
          this.depots = (depots ?? [])
            .filter(depot => !depot.isDeleted)
            .map(depot => ({
              ...depot,
              code: depot.code || depot.Code || '',
              Code: depot.Code || depot.code || '',
              location: depot.location || ''
            }));
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load depots');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.currentDepot = this.getEmptyDepot();
    this.showModal = true;
    this.cdr.markForCheck();
  }

  openEditModal(depot: DepotDto): void {
    this.isEditMode = true;
    this.currentDepot = {
      ...depot,
      code: depot.code || depot.Code || '',
      Code: depot.Code || depot.code || ''
    };
    this.showModal = true;
    this.cdr.markForCheck();
  }

  closeModal(): void {
    this.showModal = false;
    this.currentDepot = this.getEmptyDepot();
    this.errorMessage = null;
    this.cdr.markForCheck();
  }

  saveDepot(): void {
    const validationResult = this.validateDepot();
    if (!validationResult.valid) {
      this.errorMessage = validationResult.errorMessage || '';
      return;
    }

    if (this.currentDepot.Code) {
      this.currentDepot.Code = this.currentDepot.Code.trim();
      this.currentDepot.code = this.currentDepot.Code;
    }

    this.loading = true;
    this.errorMessage = null;
    this.cdr.markForCheck();

    const request$ = this.isEditMode
      ? this.apiService.put<DepotDto>(
        `${API_ENDPOINTS.DEPOT.BASE}/${this.currentDepot.id}`,
        this.currentDepot
      )
      : this.apiService.post<DepotDto>(
        API_ENDPOINTS.DEPOT.BASE,
        this.currentDepot
      );

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.translateService.get([
          this.isEditMode ? 'toast.depotUpdated' : 'toast.depotCreated',
          'toast.success'
        ]).pipe(takeUntil(this.destroy$)).subscribe(translations => {
          const messageKey = this.isEditMode ? 'toast.depotUpdated' : 'toast.depotCreated';
          this.toastService.success(translations[messageKey], translations['toast.success']);
        });
        this.closeModal();
        this.lookupService.clearCacheFor('depots');
        this.loadDepots();
        this.loading = false;
        this.cdr.markForCheck();
      },
        error: (error) => {
        const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to save depot');
        this.translateService.get(['toast.failedToSaveDepot', 'toast.error']).subscribe(translations => {
            this.toastService.error(
              errorMessage || translations['toast.failedToSaveDepot'],
              translations['toast.error']
            );
          });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  deleteDepot(depot: DepotDto): void {
    this.depotToDelete = depot;
    this.showDeleteDialog = true;
    this.cdr.markForCheck();
  }

  onDeleteConfirm(): void {
    if (!this.depotToDelete) return;

    this.loading = true;
    this.errorMessage = null;
    this.showDeleteDialog = false;
    this.cdr.markForCheck();

   
    const deleteDto = {
      Code: this.depotToDelete.code || this.depotToDelete.Code || '',
      NameAr: this.depotToDelete.nameAr || '',
      NameEn: this.depotToDelete.nameEn || '',
      Location: this.depotToDelete.location || '',
      Latitude: this.depotToDelete.latitude || 0,
      Longitude: this.depotToDelete.longitude || 0,
      IsDeleted: this.depotToDelete.isDeleted || false
    };

  
    this.apiService
      .deleteRaw<DepotDto>(
        `${API_ENDPOINTS.DEPOT.BASE}/${this.depotToDelete.id}`,
        deleteDto
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: APIOperationResponse<DepotDto>) => {
          if (response.succeeded) {
            this.translateService.get(['toast.depotDeleted', 'toast.success']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
              this.toastService.success(translations['toast.depotDeleted'], translations['toast.success']);
            });
            this.lookupService.clearCacheFor('depots');
            this.loadDepots();
          } else {
            this.translateService.get(['toast.failedToDeleteDepot', 'toast.error']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
              this.toastService.error(
                response.message || translations['toast.failedToDeleteDepot'],
                translations['toast.error']
              );
            });
          }
          this.loading = false;
          this.depotToDelete = undefined;
          this.cdr.markForCheck();
        },
        error: (err) => {
          const errorMessage = ErrorHandler.extractErrorMessage(err, 'Failed to delete depot');
          this.translateService.get('toast.error').pipe(takeUntil(this.destroy$)).subscribe(translations => {
            this.toastService.error(
              errorMessage,
              translations['toast.error']
            );
          });
          this.loading = false;
          this.depotToDelete = undefined;
          this.cdr.markForCheck();
        }
      });
  }

  onDeleteCancel(): void {
    this.showDeleteDialog = false;
    this.depotToDelete = undefined;
    this.cdr.markForCheck();
  }

  openAssignUsersModal(depot: DepotDto): void {
    this.assignUsersDepot = depot;
    this.showAssignUsersModal = true;
    this.cdr.markForCheck();
  }

  onAssignUsersModalClosed(): void {
    this.showAssignUsersModal = false;
    this.assignUsersDepot = undefined;
    this.cdr.markForCheck();
  }

  onAssignUsersSaved(): void {
    this.showAssignUsersModal = false;
    this.assignUsersDepot = undefined;
    this.lookupService.clearCacheFor('Depot');
    this.cdr.markForCheck();
  }

  validateDepot(): { valid: boolean; errorMessage?: string } {
    if (!this.currentDepot.nameEn || !this.currentDepot.nameAr ||
        !(this.currentDepot.Code || this.currentDepot.code) || !this.currentDepot.location) {
      return { valid: false, errorMessage: this.translateService.instant('depotManagement.errors.fillRequiredFields') };
    }

    const lat = Number(this.currentDepot.latitude);
    const lng = Number(this.currentDepot.longitude);

    if (!Number.isNaN(lat) && (lat < -90 || lat > 90)) {
      return { valid: false, errorMessage: this.translateService.instant('depotManagement.errors.invalidLatitude') };
    }
    if (!Number.isNaN(lng) && (lng < -180 || lng > 180)) {
      return { valid: false, errorMessage: this.translateService.instant('depotManagement.errors.invalidLongitude') };
    }

    return { valid: true };
  }

  /**
   * Prevent letters (e.g. 'e' for scientific notation) in latitude/longitude inputs.
   * Only allows digits, decimal point, minus, and navigation keys.
   */
  onCoordinateKeydown(event: KeyboardEvent): void {
    const allowedKeys = ['Backspace', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete', 'Home', 'End'];
    if (allowedKeys.includes(event.key)) return;
    const input = event.target as HTMLInputElement;
    if (event.key === '-' && (!input.value || input.selectionStart === 0)) return;
    if (event.key === '.' && !input.value.includes('.')) return;
    if (/[0-9]/.test(event.key)) return;
    event.preventDefault();
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

