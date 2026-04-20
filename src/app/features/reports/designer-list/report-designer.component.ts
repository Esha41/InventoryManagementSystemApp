import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Plus, Edit2, Trash2, Globe, Eye, Upload, Users, FileText } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { ButtonComponent } from '@components/button/button.component';
import { PaginationComponent, RowsPerPageComponent, LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { BackendAuthService } from '@services/backend-auth.service';
import { ReportService, Report, ReportTemplate } from '@services/report.service';
import { ToastService } from '@services/toast.service';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';
import { RoleSelectDialogComponent } from '../role-select-dialog/role-select-dialog.component';

@Component({
  selector: 'app-report-designer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    ButtonComponent,
    PaginationComponent,
    RowsPerPageComponent,
    LoadingStateComponent,
    ErrorStateComponent,
    ConfirmDialogComponent,
    RoleSelectDialogComponent
  ],
  templateUrl: './report-designer.component.html',
  styleUrls: ['./report-designer.component.css']
})
export class ReportDesignerComponent implements OnInit {
  readonly Plus = Plus;
  readonly Edit2 = Edit2;
  readonly Trash2 = Trash2;
  readonly Globe = Globe;
  readonly Eye = Eye;
  readonly Upload = Upload;
  readonly Users = Users;
  readonly FileText = FileText;

  reports: Report[] = [];
  filteredReports: Report[] = [];
  searchTerm = '';
  loading = false;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  rowsPerPage = 10;
  totalItems = 0;

  // Delete dialog
  showDeleteDialog = false;
  reportToDelete: Report | null = null;

  /** Built-in layouts shown on this page (Users & Allowance first, then others from API) */
  reportTemplates: ReportTemplate[] = [];
  templatesLoading = false;
  templatesError: string | null = null;

  // Role selection dialog
  showRoleDialog = false;
  reportToMakePublic: Report | null = null;
  selectedRoleIds: string[] = [];

  // File input reference
  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef<HTMLInputElement>;

  // Permissions
  canCreateReport = false;
  canEditReport = false;
  canDeleteReport = false;

  /**
   * Warm up the lazy-loaded designer chunk so navigation feels instant.
   * (The DevExpress designer is heavy; without prefetch the first navigation waits for the chunk download.)
   */
  private designerChunkPrefetch?: Promise<unknown>;
  private prefetchDesignerChunk(): void {
    if (!this.designerChunkPrefetch) {
      this.designerChunkPrefetch = import('@app/features/reports/designer/devexpress-designer.component');
    }
  }

  constructor(
    private translationService: TranslationService,
    private translateService: TranslateService,
    private router: Router,
    private authService: BackendAuthService,
    private reportService: ReportService,
    private toastService: ToastService
  ) { }

  ngOnInit(): void {
    // Check permissions using standard pattern
    this.checkPermissions();
    this.loadReports();
    this.loadReportTemplates();

    // Prefetch designer route in background to reduce first-click delay.
    this.prefetchDesignerChunk();
  }

  checkPermissions(): void {
    // Check permissions using BackendAuthService - ReportDesigner is a plain permission
    const hasReportDesignerPermission = this.authService.hasPermission('ReportDesigner');
    this.canCreateReport = hasReportDesignerPermission;
    this.canEditReport = hasReportDesignerPermission;
    this.canDeleteReport = hasReportDesignerPermission;
  }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  loadReports(): void {
    this.loading = true;
    this.error = null;

    this.reportService.getAll()
      .pipe(
        catchError((err) => {
          console.error('Error loading reports:', err);
          this.error = this.translateService.instant('common.errorLoadingData');
          return of([]);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((reports) => {
        this.reports = reports;
        this.filteredReports = [...this.reports];
        this.updatePagination();
      });
  }

  onSearchChange(term: string): void {
    this.searchTerm = term;
    const normalized = term.toLowerCase().trim();

    if (!normalized) {
      this.filteredReports = [...this.reports];
    } else {
      this.filteredReports = this.reports.filter(report =>
        report.reportName?.toLowerCase().includes(normalized)
      );
    }

    this.currentPage = 1;
    this.updatePagination();
  }

  onCreateReport(): void {
    this.prefetchDesignerChunk();
    this.router.navigate(['/report-designer/designer'], {
      queryParams: {
        reportUrl: 'BaseReportTemplate',
        mode: 'create'
      }
    });
  }

  openTemplateInDesigner(template: ReportTemplate): void {
    this.prefetchDesignerChunk();
    this.router.navigate(['/report-designer/designer'], {
      queryParams: {
        reportUrl: template.url,
        mode: 'create'
      }
    });
  }

  private loadReportTemplates(): void {
    if (!this.canCreateReport) {
      return;
    }
    this.templatesLoading = true;
    this.templatesError = null;
    this.reportService
      .getTemplates()
      .pipe(
        catchError((err) => {
          console.error('Error loading report templates:', err);
          this.templatesError = this.translateService.instant('common.errorLoadingData');
          return of([]);
        }),
        finalize(() => {
          this.templatesLoading = false;
        })
      )
      .subscribe((templates) => {
        const preferredOrder = ['UsersReportTemplate', 'AllowanceItemsReportTemplate', 'BaseReportTemplate'];
        this.reportTemplates = [...templates].sort((a, b) => {
          const rank = (url: string) => {
            const i = preferredOrder.indexOf(url);
            return i === -1 ? preferredOrder.length : i;
          };
          return rank(a.url) - rank(b.url);
        });
      });
  }

  onImportReport(): void {
    // Trigger file input click
    if (this.fileInput) {
      this.fileInput.nativeElement.click();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) {
      return;
    }

    // Validate file type - only .repx files allowed
    const allowedExtensions = ['.repx'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!allowedExtensions.includes(fileExtension)) {
      // Show alert for wrong file type
      alert(this.translateService.instant('reportDesigner.import.invalidFileType', {
        extensions: '.repx'
      }));
      // Reset file input
      input.value = '';
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      // Show alert for file too large
      alert(this.translateService.instant('reportDesigner.import.fileTooLarge', {
        maxSize: '10MB'
      }));
      input.value = '';
      return;
    }

    // Import directly without dialog
    this.loading = true;
    this.error = null;

    // Extract report name from filename (without extension)
    const reportName = file.name.substring(0, file.name.lastIndexOf('.'));
    // Generate URL from report name
    const url = reportName.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '') || `report_${Date.now()}`;

    // Import the report
    this.reportService.import(file, reportName, url, undefined)
      .pipe(
        catchError((err) => {
          console.error('Error importing report:', err);
          const errorMessage = err?.error?.message || err?.message || this.translateService.instant('common.errorImportingData');
          this.error = errorMessage;
           alert(this.error);
          return of(null);
        }),
        finalize(() => {
         this.loading = false;
          input.value = '';
            this.loadReports();
        })
      )
      .subscribe((reportId) => {
        if (reportId) {
          // Reload reports list
          this.loadReports();
        }
      });
  }

  onEdit(report: Report): void {
    // Navigate to DevExpress Report Designer with the report URL
    this.router.navigate(['/report-designer/designer'], {
      queryParams: { reportUrl: report.url }
    });

    //   const reportUrl = `${report.reportName}/${report.url}`;
    // this.router.navigate(['/report-designer/designer'], {
    //   queryParams: { reportUrl }
    // });
  }

  onDelete(report: Report): void {
    this.reportToDelete = report;
    this.showDeleteDialog = true;
  }

  onDeleteConfirm(): void {
    if (this.reportToDelete) {
      this.loading = true;
      this.reportService.delete(this.reportToDelete.id)
        .pipe(
          catchError((err) => {
            console.error('Error deleting report:', err);
            this.error = this.translateService.instant('common.errorDeletingData');
            this.loading = false;
            return of(false);
          }),
          finalize(() => {
            this.loading = false;
          })
        )
        .subscribe((success) => {
          if (success) {
            this.reports = this.reports.filter(r => r.id !== this.reportToDelete!.id);
            this.filteredReports = [...this.reports];
            this.updatePagination();
            this.showDeleteDialog = false;
            this.reportToDelete = null;
          }
        });
    }
  }

  onDeleteCancel(): void {
    this.showDeleteDialog = false;
    this.reportToDelete = null;
  }

  /** ReportStatuses.Published = 2 */
  isPublished(report: Report): boolean {
    return report.reportStatusId === 2;
  }

  onTogglePublicPrivate(report: Report): void {
    const isPublic = !this.isPublished(report);
    
    // Preserve existing roles when toggling status
    // When making public, use existing roles if any
    // When making private, preserve roles so they can be restored later
    const roleIdsToPreserve = report.roles && report.roles.length > 0
      ? report.roles.map(r => r.roleId)
      : [];
    
    // Directly toggle status without showing role dialog
    this.loading = true;
    this.reportService.setReportPublic(report.id, isPublic, roleIdsToPreserve)
      .pipe(
        catchError((err) => {
          console.error('Error setting report public/private:', err);
          this.error = this.translateService.instant('common.errorUpdatingData');
          return of(null);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((updated) => {
        if (updated) {
          const index = this.reports.findIndex(r => r.id === report.id);
          if (index !== -1) {
            // The backend now preserves roles, so updated should already have them
            // But ensure we preserve them in the UI if backend doesn't return them for draft
            if (!updated.roles && report.roles) {
              updated.roles = report.roles;
            }
            this.reports[index] = updated;
            this.filteredReports = [...this.reports];
            // Show success message
            const message = isPublic
              ? this.translateService.instant('reportDesigner.reportSetToPublic')
              : this.translateService.instant('reportDesigner.reportSetToPrivate');
            this.toastService.success(
              message,
              this.translateService.instant('common.success')
            );
          }
        }
      });
  }

  onSelectRoles(report: Report): void {
    // Only allow role selection for published reports
    if (!this.isPublished(report)) {
      this.toastService.warning(
        this.translateService.instant('reportDesigner.selectRolesOnlyForPublished'),
        this.translateService.instant('common.warning')
      );
      return;
    }

    this.reportToMakePublic = report;
    this.selectedRoleIds = [];
    
    // Load existing role associations if any
    this.reportService.getReportRoles(report.id)
      .pipe(
        catchError((err) => {
          console.error('Error loading report roles:', err);
          // Continue with empty array if error
          return of([]);
        })
      )
      .subscribe((roleIds) => {
        this.selectedRoleIds = roleIds;
        this.showRoleDialog = true;
      });
  }

  onRolesSelected(roleIds: string[]): void {
    if (this.reportToMakePublic) {
      this.loading = true;
      // Update roles for the published report (keep it published, just update roles)
      this.reportService.setReportPublic(this.reportToMakePublic.id, true, roleIds)
        .pipe(
          catchError((err) => {
            console.error('Error updating report roles:', err);
            this.error = this.translateService.instant('common.errorUpdatingData');
            return of(null);
          }),
          finalize(() => {
            this.loading = false;
          })
        )
        .subscribe((updated) => {
          if (updated) {
            const index = this.reports.findIndex(r => r.id === this.reportToMakePublic!.id);
            if (index !== -1) {
              this.reports[index] = updated;
              this.filteredReports = [...this.reports];
              // Show success message
              const roleCount = roleIds.length;
              const message = roleCount > 0
                ? this.translateService.instant('reportDesigner.rolesUpdated', { count: roleCount })
                : this.translateService.instant('reportDesigner.rolesCleared');
              this.toastService.success(
                message,
                this.translateService.instant('common.success')
              );
            }
          }
          this.showRoleDialog = false;
          this.reportToMakePublic = null;
          this.selectedRoleIds = [];
        });
    }
  }

  onRoleDialogCancel(): void {
    this.showRoleDialog = false;
    this.reportToMakePublic = null;
    this.selectedRoleIds = [];
  }

  getStatusClass(status: string): string {
    // Map backend status names to CSS classes
    const statusLower = status.toLowerCase();
    if (statusLower.includes('published') || statusLower.includes('active')) {
      return 'bg-[var(--color-success)]/20 text-[var(--color-success)] border-[var(--color-success)]/30';
    }
    if (statusLower.includes('draft') || statusLower.includes('pending')) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
    if (statusLower.includes('archived') || statusLower.includes('inactive')) {
      return 'bg-[var(--color-background-active)] text-[var(--color-text-muted)] border-[var(--color-border)]';
    }
    return 'bg-[var(--color-background-active)] text-[var(--color-text-muted)] border-[var(--color-border)]';
  }

  getStatusDisplayName(report: Report): string {
    // Use the appropriate status name based on current language
    const isRTL = this.translationService.isRTL();
    return isRTL && report.reportStatusNameAr ? report.reportStatusNameAr : report.reportStatusNameEn;
  }

  getRoleDisplayName(role: { roleNameEn?: string; roleNameAr?: string; roleName: string }): string {
    const isRTL = this.translationService.isRTL();
    return isRTL && role.roleNameAr ? role.roleNameAr : (role.roleNameEn || role.roleName);
  }

  formatDate(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString();
  }

  updatePagination(): void {
    this.totalItems = this.filteredReports.length;
    const startIndex = (this.currentPage - 1) * this.rowsPerPage;
    const endIndex = startIndex + this.rowsPerPage;
    // For now, just use filteredReports directly
    // In real implementation, you'd slice here
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.updatePagination();
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
    this.updatePagination();
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.rowsPerPage);
  }

  get paginatedReports(): Report[] {
    const startIndex = (this.currentPage - 1) * this.rowsPerPage;
    const endIndex = startIndex + this.rowsPerPage;
    return this.filteredReports.slice(startIndex, endIndex);
  }
}
