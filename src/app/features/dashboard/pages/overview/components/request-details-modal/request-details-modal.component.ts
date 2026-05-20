import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { OrderDto, OrderRequestItemDto } from '@models/order.model';
import { ReturnDto, ReturnItemDto } from '@models/return.model';
import { DiscardDto, DiscardItemDto } from '@models/discard.model';
import { Subject, takeUntil } from 'rxjs';
import { getLocalizedName, getCurrentLang, localizedRequestLineItemName } from '@utils/localization.utils';
import { formatTimeToMilitary } from '@utils/format.utils';
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
import { RequestType } from '@utils/request-type-mapper.utils';
import { hasWeaponAssociations as itemHasWeaponAssociations } from '@utils/weapon-association-label.utils';
import { WeaponAssociationListComponent } from '@components/weapon-association-list/weapon-association-list.component';

/**
 * Unified Request DTO type
 */
export type UnifiedRequestDto = OrderDto | ReturnDto | DiscardDto;

/**
 * Unified Request Item DTO type
 */
export type UnifiedRequestItemDto = OrderRequestItemDto | ReturnItemDto | DiscardItemDto;

@Component({
  selector: 'app-request-details-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule, WeaponAssociationListComponent],
  templateUrl: './request-details-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RequestDetailsModalComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Input() request: UnifiedRequestDto | null = null;
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
   * Get request type from the request object
   */
  getRequestType(): RequestType | null {
    if (!this.request) return null;

    const requestType = this.request.requestType;
    if (typeof requestType === 'number') {
      return requestType as RequestType;
    }

    // Handle string enum values
    const typeStr = String(requestType).toLowerCase();
    if (typeStr === 'order' || typeStr === '1') return RequestType.Order;
    if (typeStr === 'return' || typeStr === '2') return RequestType.Return;
    if (typeStr === 'discard' || typeStr === '3') return RequestType.Discard;

    return null;
  }

  /**
   * Check if request is an Order
   */
  isOrder(): boolean {
    return this.getRequestType() === RequestType.Order;
  }

  /**
   * Check if request is a Return
   */
  isReturn(): boolean {
    return this.getRequestType() === RequestType.Return;
  }

  /**
   * Check if request is a Discard
   */
  isDiscard(): boolean {
    return this.getRequestType() === RequestType.Discard;
  }

  /**
   * Get the request number (handles different property names)
   */
  getRequestNumber(): string {
    if (!this.request) return 'N/A';
    const order = this.request as OrderDto;
    return order.requestNo || order.orderNo || 'N/A';
  }

  /**
   * Get translation key for the request type header
   */
  getRequestTypeHeaderKey(): string {
    if (this.isOrder()) return 'dashboard.orderDetails';
    if (this.isReturn()) return 'dashboard.returnDetails';
    if (this.isDiscard()) return 'dashboard.discardDetails';
    return 'dashboard.requestDetails';
  }

  /**
   * Format request date
   */
  formatRequestDate(): string {
    if (!this.request) return 'N/A';

    if (this.isOrder()) {
      return formatCreationDate(this.request as OrderDto);
    }

    // For Return and Discard
    const creationDate = this.request.creationDate;
    if (!creationDate) return 'N/A';

    try {
      const date = new Date(creationDate);
      if (isNaN(date.getTime())) return 'N/A';

      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const dateStr = `${day}/${month}/${year}`;

      const timeStr = formatTimeToMilitary(date);
      return timeStr ? `${dateStr} ${timeStr}` : dateStr;
    } catch {
      return 'N/A';
    }
  }

  /**
   * Resolve department name
   */
  resolveDepartmentName(): string {
    if (!this.request) return 'N/A';

    if (this.isOrder()) {
      return resolveOrderDepartmentName(this.request as OrderDto, this.translate);
    }

    const currentLang = getCurrentLang(this.translate);
    if (this.request.department) {
      const localized = getLocalizedName(this.request.department, currentLang);
      if (localized) return localized;
    }
    return 'N/A';
  }

  /**
   * Resolve requester name
   */
  resolveRequesterName(): string {
    if (!this.request) return 'N/A';

    if (this.isOrder()) {
      return resolveRequesterName(this.request as OrderDto, this.translate);
    }

    const currentLang = getCurrentLang(this.translate);
    if (this.request.requester) {
      const localized = getLocalizedName(this.request.requester, currentLang);
      if (localized) return localized;
      if (this.request.requester.userName) return this.request.requester.userName;
    }
    return 'N/A';
  }

  /**
   * Resolve request purpose
   */
  resolveRequestPurpose(): string {
    if (!this.request) return 'N/A';

    if (this.isOrder()) {
      return resolveRequestPurpose(this.request as OrderDto, this.translate);
    }

    const currentLang = getCurrentLang(this.translate);
    if (this.request.requestPurpose) {
      const localized = getLocalizedName(this.request.requestPurpose, currentLang);
      if (localized) return localized;
    }
    return 'N/A';
  }

  /**
   * Get priority key
   */
  getPriorityKey(): string {
    if (!this.request) return 'dashboard.priorityLabels.urgent';
    return getOrderPriorityKey(this.request.priority);
  }

  /**
   * Get status key
   */
  getStatusKey(): string {
    if (!this.request) return 'dashboard.statusLabels.new';
    return getOrderStatusKey(this.request.status);
  }

  /**
   * Get order-specific methods (only available for Order requests)
   */
  getOrder(): OrderDto | null {
    return this.isOrder() ? (this.request as OrderDto) : null;
  }

  formatOrderUsageDateFrom(): string {
    const order = this.getOrder();
    return order ? formatOrderUsageDateFrom(order) : 'N/A';
  }

  formatOrderUsageDateTo(): string {
    const order = this.getOrder();
    return order ? formatOrderUsageDateTo(order) : 'N/A';
  }

  /** Usage purpose notes from order payload. */
  getOrderRequestPurposeNotesDisplay(): string {
    const raw = this.getOrder()?.requestPurposeNotes;
    if (raw == null || String(raw).trim() === '') return 'N/A';
    return String(raw);
  }

  /** Usage purpose notes on return/discard (`requestPurposeNotes`). */
  getReturnDiscardRequestPurposeNotesDisplay(): string {
    if (!this.request) return 'N/A';
    const raw = this.request.requestPurposeNotes;
    if (raw == null || String(raw).trim() === '') return 'N/A';
    return String(raw);
  }

  getOrderAllowanceKey(): string {
    const order = this.getOrder();
    return order ? getOrderAllowanceKey(order.isFromAllowance) : 'common.no';
  }

  /**
   * Check if request has items
   */
  hasItems(): boolean {
    if (!this.request || !this.request.requestItems) return false;
    return this.request.requestItems.length > 0;
  }

  /**
   * Get request items
   */
  getRequestItems(): UnifiedRequestItemDto[] {
    return this.request?.requestItems || [];
  }

  hasWeaponAssociations(item: UnifiedRequestItemDto): boolean {
    return itemHasWeaponAssociations(item);
  }

  requestLineItemDisplayName(item: UnifiedRequestItemDto | null | undefined): string {
    return localizedRequestLineItemName(item, getCurrentLang(this.translate));
  }

  /**
   * Navigate to approval page
   */
  navigateToApproval(): void {
    if (this.request?.id) {
      this.router.navigate(['/requests/requests-management', this.request.id, 'workflow-approval']);
    }
  }
}
