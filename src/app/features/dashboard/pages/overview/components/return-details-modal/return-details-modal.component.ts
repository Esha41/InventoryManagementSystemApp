import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { ReturnDto } from '@models/return.model';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { formatTimeToMilitary } from '@utils/format.utils';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-return-details-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule],
  templateUrl: './return-details-modal.component.html',
  styleUrls: ['./return-details-modal.component.css']
})
export class ReturnDetailsModalComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;

  @Input() returnRequest: ReturnDto | null = null;

  @Output() close = new EventEmitter<void>();

  readonly X = X;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly router: Router,
    private readonly translate: TranslateService,
    private readonly cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Subscribe to language changes to update localized names
    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isOpen) {
          this.cdr.markForCheck();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  /**
   * Get translation key for priority
   * Handles both number and string priority values
   * Backend RequestPriority enum: Normal = 1, Urgent = 2, VeryUrgent = 3, Critical = 4
   */
  getPriorityKey(priority?: number | string | null): string {
    if (priority === null || priority === undefined) {
      return 'dashboard.priorityLabels.urgent';
    }

    // Normalize to number
    let priorityNum: number;
    if (typeof priority === 'string') {
      const priorityLower = priority.toLowerCase().trim().replace(/\s+/g, '');
      if (priorityLower === 'normal' || priorityLower === '1') {
        priorityNum = 1;
      } else if (priorityLower === 'urgent' || priorityLower === '2') {
        priorityNum = 2;
      } else if (priorityLower === 'veryurgent' || priorityLower === '3') {
        priorityNum = 3;
      } else if (priorityLower === 'critical' || priorityLower === '4') {
        priorityNum = 4;
      } else {
        const parsed = parseInt(priority, 10);
        priorityNum = isNaN(parsed) ? 2 : parsed;
      }
    } else {
      priorityNum = priority;
    }

    switch (priorityNum) {
      case 1:
        return 'dashboard.priorityLabels.normal';
      case 2:
        return 'dashboard.priorityLabels.urgent';
      case 3:
        return 'dashboard.priorityLabels.veryUrgent';
      case 4:
        return 'dashboard.priorityLabels.veryUrgent'; // Critical uses same label as VeryUrgent
      default:
        return 'dashboard.priorityLabels.urgent';
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

  formatRequestDate(request: ReturnDto | null): string {
    if (!request) return 'N/A';
    const creationDate = request.creationDate;
    if (!creationDate) return 'N/A';
    
    try {
      const date = new Date(creationDate);
      if (isNaN(date.getTime())) return 'N/A';
      
      // Format date as MM/DD/YYYY (month first)
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      const dateStr = `${month}/${day}/${year}`;
      
      // Format time as military time (HHMM)
      const timeStr = formatTimeToMilitary(date);
      
      return timeStr ? `${dateStr} ${timeStr}` : dateStr;
    } catch {
      return 'N/A';
    }
  }

  resolveDepartmentName(request: ReturnDto | null): string {
    if (!request) return 'N/A';
    const currentLang = getCurrentLang(this.translate);
    if (request.department) {
      const localized = getLocalizedName(request.department, currentLang);
      if (localized) return localized;
    }
    return 'N/A';
  }

  resolveRequesterName(request: ReturnDto | null): string {
    if (!request) return 'N/A';
    const currentLang = getCurrentLang(this.translate);
    if (request.requester) {
      const localized = getLocalizedName(request.requester, currentLang);
      if (localized) return localized;
      if (request.requester.userName) return request.requester.userName;
    }
    return 'N/A';
  }

  resolveRequestPurpose(request: ReturnDto | null): string {
    if (!request) return 'N/A';
    const currentLang = getCurrentLang(this.translate);
    if (request.requestPurpose) {
      const localized = getLocalizedName(request.requestPurpose, currentLang);
      if (localized) return localized;
    }
    return 'N/A';
  }

  resolveDepotName(request: ReturnDto | null): string {
    if (!request) return 'N/A';
    return 'N/A'; // Depot info not available in nested objects
  }

  hasItems(items?: any[] | null): boolean {
    return !!items && items.length > 0;
  }

  navigateToApproval(returnRequestId: number): void {
    this.router.navigate(['/requests-management', returnRequestId, 'workflow-approval']);
  }
}

