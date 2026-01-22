import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Plus, Edit2, Trash2, Globe, Eye } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { ButtonComponent } from '@components/button/button.component';
import { PaginationComponent, RowsPerPageComponent, LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';

export interface Report {
  id: number;
  name: string;
  status: 'Draft' | 'Published' | 'Archived';
  createdDate: Date;
  isPublic: boolean;
}

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
    ConfirmDialogComponent
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

  reports: Report[] = [];
  filteredReports: Report[] = [];
  loading = false;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  rowsPerPage = 10;
  totalItems = 0;

  // Delete dialog
  showDeleteDialog = false;
  reportToDelete: Report | null = null;

  constructor(
    private translationService: TranslationService,
    private translateService: TranslateService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadReports();
  }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  loadReports(): void {
    this.loading = true;
    this.error = null;

    // TODO: Replace with actual API call
    // For now, using mock data
    setTimeout(() => {
      this.reports = [
        {
          id: 1,
          name: 'Inventory Summary Report',
          status: 'Published',
          createdDate: new Date('2024-01-15'),
          isPublic: true
        },
        {
          id: 2,
          name: 'Monthly Sales Report',
          status: 'Draft',
          createdDate: new Date('2024-02-20'),
          isPublic: false
        },
        {
          id: 3,
          name: 'Asset Tracking Report',
          status: 'Published',
          createdDate: new Date('2024-03-10'),
          isPublic: true
        }
      ];
      this.filteredReports = [...this.reports];
      this.updatePagination();
      this.loading = false;
    }, 500);
  }

  onCreateReport(): void {
    // Navigate to DevExpress Report Designer
    this.router.navigate(['/report-designer/designer']);
  }

  onEdit(report: Report): void {
    // TODO: Navigate to edit report page
    console.log('Edit report:', report);
  }

  onDelete(report: Report): void {
    this.reportToDelete = report;
    this.showDeleteDialog = true;
  }

  onDeleteConfirm(): void {
    if (this.reportToDelete) {
      // TODO: Replace with actual API call
      this.reports = this.reports.filter(r => r.id !== this.reportToDelete!.id);
      this.filteredReports = [...this.reports];
      this.updatePagination();
      this.showDeleteDialog = false;
      this.reportToDelete = null;
    }
  }

  onDeleteCancel(): void {
    this.showDeleteDialog = false;
    this.reportToDelete = null;
  }

  onTogglePublic(report: Report): void {
    // TODO: Replace with actual API call
    report.isPublic = !report.isPublic;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Published':
        return 'bg-[var(--color-success)]/20 text-[var(--color-success)] border-[var(--color-success)]/30';
      case 'Draft':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Archived':
        return 'bg-[var(--color-background-active)] text-[var(--color-text-muted)] border-[var(--color-border)]';
      default:
        return 'bg-[var(--color-background-active)] text-[var(--color-text-muted)] border-[var(--color-border)]';
    }
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString();
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
