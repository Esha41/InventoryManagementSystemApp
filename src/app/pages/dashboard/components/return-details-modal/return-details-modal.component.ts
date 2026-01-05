import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { ReturnDto } from '@services/return.service';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
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

  getPriorityKey(priority?: number | null): string {
    switch (priority) {
      case 1:
        return 'dashboard.priorityLabels.normal';
      case 2:
        return 'dashboard.priorityLabels.urgent';
      case 3:
        return 'dashboard.priorityLabels.veryUrgent';
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

