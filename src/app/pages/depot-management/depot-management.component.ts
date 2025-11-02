import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, Plus, Edit, Trash2, X } from 'lucide-angular';
import { LookupService } from '@services/lookup.service';
import { DepotDto } from '@models/depot.model';
import { ApiService } from '@services/api.service';
import { APIOperationResponse } from '@models/api-response.model';

@Component({
  selector: 'app-depot-management',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule],
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

  private destroy$ = new Subject<void>();

  constructor(
    private lookupService: LookupService,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.loadDepots();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDepots(): void {
    this.loading = true;
    this.errorMessage = null;

    this.lookupService.getDepots()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (depots) => {
          this.depots = depots.filter(d => !d.isDeleted);
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading depots:', error);
          this.errorMessage = 'Failed to load depots';
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
    this.currentDepot = { ...depot };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.currentDepot = this.getEmptyDepot();
    this.errorMessage = null;
  }

  saveDepot(): void {
    if (!this.validateDepot()) {
      this.errorMessage = 'Please fill in all required fields';
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    const request$ = this.isEditMode
      ? this.apiService.putWithAuth<APIOperationResponse<DepotDto>>(
          `/Lookup/Depot/${this.currentDepot.id}`,
          this.currentDepot
        )
      : this.apiService.postWithAuth<APIOperationResponse<DepotDto>>(
          '/Lookup/Depot',
          this.currentDepot
        );

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.succeeded) {
          this.successMessage = this.isEditMode
            ? 'Depot updated successfully!'
            : 'Depot created successfully!';
          this.closeModal();
          this.lookupService.clearCacheFor('depots');
          this.loadDepots();
          setTimeout(() => (this.successMessage = null), 3000);
        } else {
          this.errorMessage = response.message || 'Failed to save depot';
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error saving depot:', error);
        this.errorMessage = error.message || 'Failed to save depot';
        this.loading = false;
      }
    });
  }

  deleteDepot(depot: DepotDto): void {
    if (!confirm(`Are you sure you want to delete ${depot.nameEn}?`)) {
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    // Soft delete by updating the depot with isDeleted = true
    const deletedDepot = { ...depot, isDeleted: true };

    this.apiService
      .deleteWithAuth<APIOperationResponse<DepotDto>>(
        `/Lookup/Depot/${depot.id}`
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.succeeded) {
            this.successMessage = 'Depot deleted successfully!';
            this.lookupService.clearCacheFor('depots');
            this.loadDepots();
            setTimeout(() => (this.successMessage = null), 3000);
          } else {
            this.errorMessage = response.message || 'Failed to delete depot';
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error deleting depot:', error);
          this.errorMessage = error.message || 'Failed to delete depot';
          this.loading = false;
        }
      });
  }

  validateDepot(): boolean {
    return !!(
      this.currentDepot.nameEn &&
      this.currentDepot.nameAr &&
      this.currentDepot.location
    );
  }

  private getEmptyDepot(): DepotDto {
    return {
      id: 0,
      nameAr: '',
      nameEn: '',
      location: '',
      latitude: 0,
      longitude: 0,
      isDeleted: false
    };
  }
}

