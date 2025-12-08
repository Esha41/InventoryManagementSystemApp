import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { DiscardDto } from '@services/discard.service';

@Component({
  selector: 'app-discard-details-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule],
  templateUrl: './discard-details-modal.component.html',
  styleUrls: ['./discard-details-modal.component.css']
})
export class DiscardDetailsModalComponent {
  @Input() isOpen = false;

  @Input() discardRequest: DiscardDto | null = null;

  @Output() close = new EventEmitter<void>();

  readonly X = X;

  constructor(private readonly router: Router) {}
  
  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  getPriorityKey(priority?: number | null): string {
    switch (priority) {
      case 2:
        return 'dashboard.priorityLabels.medium';
      case 3:
        return 'dashboard.priorityLabels.low';
      default:
        return 'dashboard.priorityLabels.high';
    }
  }

  getStatusKey(status?: number | null): string {
    switch (status) {
      case 2:
        return 'dashboard.statusLabels.underProcess';
      case 3:
        return 'dashboard.statusLabels.approved';
      case 4:
        return 'dashboard.statusLabels.rejected';
      case 5:
        return 'dashboard.statusLabels.cancelled';
      default:
        return 'dashboard.statusLabels.new';
    }
  }

  formatRequestDate(request: DiscardDto | null): string {
    if (!request) return 'N/A';
    // Use current date if no date field available
    return this.formatDate(new Date());
  }

  private formatDate(source?: string | Date): string {
    let date: Date;

    if (source instanceof Date) {
      date = source;
    } else if (typeof source === 'string') {
      const parsed = new Date(source);
      date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    } else {
      date = new Date();
    }

    const day = date.getDate();
    const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${month} ${year}`;
  }

  resolveDepartmentName(request: DiscardDto | null): string {
    if (!request) return 'N/A';
    return request.departmentName || 'N/A';
  }

  resolveRequestPurpose(request: DiscardDto | null): string {
    if (!request) return 'N/A';
    return request.requestPurposeName || 'N/A';
  }

  resolveDepotName(request: DiscardDto | null): string {
    if (!request) return 'N/A';
    return request.depotName || 'N/A';
  }

  hasItems(items?: any[] | null): boolean {
    return !!items && items.length > 0;
  }

  navigateToApproval(discardRequestId: number): void {
    this.router.navigate(['/requests-management', discardRequestId, 'workflow-approval']);
  }
}

