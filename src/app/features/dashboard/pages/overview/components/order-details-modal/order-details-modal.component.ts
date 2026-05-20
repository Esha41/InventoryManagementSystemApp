import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { OrderDto, OrderRequestItemDto } from '@models/order.model';
import { Subject, takeUntil } from 'rxjs';
import {
  formatCreationDate,
  resolveRequestPurpose,
  resolveOrderDepartmentName,
  resolveRequesterName,
  getOrderPriorityKey,
  getOrderStatusKey,
  getOrderAllowanceKey,
  formatOrderUsageDateFrom,
  formatOrderUsageDateTo
} from '@dashboard/utils/dashboard-order.utils';
import { getCurrentLang, localizedRequestLineItemName } from '@utils/localization.utils';
import type { RequestManagementRequestItemDto } from '@models/request-management-base.model';
import { hasWeaponAssociations as itemHasWeaponAssociations } from '@utils/weapon-association-label.utils';
import { WeaponAssociationListComponent } from '@components/weapon-association-list/weapon-association-list.component';

@Component({
  selector: 'app-order-details-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule, WeaponAssociationListComponent],
  templateUrl: './order-details-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderDetailsModalComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Input() orderRequest: OrderDto | null = null;
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

  navigateToApproval(orderRequestId: number): void {
    this.router.navigate(['/requests/requests-management', orderRequestId, 'workflow-approval']);
  }

  // Formatting methods - delegated to utility functions
  formatCreationDate = (order: OrderDto | null) => formatCreationDate(order);
  resolveRequestPurpose = (order: OrderDto | null) => resolveRequestPurpose(order, this.translate);
  resolveOrderDepartmentName = (order: OrderDto | null) => resolveOrderDepartmentName(order, this.translate);
  resolveRequesterName = (order: OrderDto | null) => resolveRequesterName(order, this.translate);
  getOrderPriorityKey = getOrderPriorityKey;
  getOrderStatusKey = getOrderStatusKey;
  getOrderAllowanceKey = getOrderAllowanceKey;
  formatOrderUsageDateFrom = formatOrderUsageDateFrom;
  formatOrderUsageDateTo = formatOrderUsageDateTo;

  hasOrderItems(items?: OrderRequestItemDto[] | null): boolean {
    return !!items && items.length > 0;
  }

  hasWeaponAssociations(item: OrderRequestItemDto | null | undefined): boolean {
    return itemHasWeaponAssociations(item);
  }

  requestLineItemDisplayName(item: RequestManagementRequestItemDto | null | undefined): string {
    return localizedRequestLineItemName(item, getCurrentLang(this.translate));
  }
}

