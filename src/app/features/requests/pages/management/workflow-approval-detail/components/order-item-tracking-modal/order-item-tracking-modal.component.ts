import { Component, Input, Output, EventEmitter, OnDestroy, ChangeDetectorRef, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Clock, User, ArrowRight, FileText, Activity, RotateCcw } from 'lucide-angular';
import { ModalComponent } from '@components/modal/modal.component';
import { OrderItemTrackingService, OrderItemHistoryDto, OrderItemActionType } from '../../../../../services/order-item-tracking.service';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import {  getCurrentLang } from '@utils/localization.utils';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';

@Component({
    selector: 'app-order-item-tracking-modal',
    standalone: true,
    imports: [
        CommonModule,
        TranslateModule,
        LucideAngularModule,
        ModalComponent,
        AppDatePipe
    ],
    templateUrl: './order-item-tracking-modal.component.html',
    styles: [`
    :host {
      display: block;
    }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderItemTrackingModalComponent implements OnDestroy, OnChanges {
    readonly Clock = Clock;
    readonly User = User;
    readonly ArrowRight = ArrowRight;
    readonly FileText = FileText;
    readonly Activity = Activity;
    readonly RotateCcw = RotateCcw;

    @Input() isOpen: boolean = false;
    @Input() orderId: number | null = null;
    @Input() requestNo: string | null = null;
    @Input() specificItemId: number | null = null;
    @Input() specificItemName: string | null = null;

    @Output() closed = new EventEmitter<void>();

    history: OrderItemHistoryDto[] = [];
    loading: boolean = false;
    error: boolean = false;

    private destroy$ = new Subject<void>();

    constructor(
        private trackingService: OrderItemTrackingService,
        private cdr: ChangeDetectorRef,
        public translate: TranslateService
    ) { }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['isOpen'] && this.isOpen) {
            this.loadHistory();
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    onClose(): void {
        this.closed.emit();
    }

    loadHistory(): void {
        if (!this.orderId && !this.requestNo) return;

        this.loading = true;
        this.error = false;
        this.history = [];
        this.cdr.markForCheck();

        const request$ = this.specificItemId && this.orderId
            ? this.trackingService.getItemHistory(this.orderId, this.specificItemId)
            : this.trackingService.getOrderItemHistory(this.orderId!, this.requestNo!);

        request$
            .pipe(
                takeUntil(this.destroy$),
                finalize(() => {
                    this.loading = false;
                    this.cdr.markForCheck();
                })
            )
            .subscribe({
                next: (data: OrderItemHistoryDto[]) => {
                    this.history = data;
                    this.cdr.markForCheck();
                },
                error: (err: unknown) => {
                    console.error('Failed to load history', err);
                    this.error = true;
                    this.cdr.markForCheck();
                }
            });
    }

    getActionLabelKey(actionType: string | number): string {
        let key: string | undefined;

        if (typeof actionType === 'string' && isNaN(Number(actionType))) {
            // It's already the key (e.g. "Added")
            key = actionType;
        } else {
            // It's a number (or number string), look up the key
            key = OrderItemActionType[Number(actionType)];
        }

        return key ? `ORDER_TRACKING.ACTION_${key.toUpperCase()}` : 'ORDER_TRACKING.ACTION_UNKNOWN';
    }

    getActionColorClass(actionType: string | number): string {
        let typeVal: number;

        if (typeof actionType === 'string' && isNaN(Number(actionType))) {
            typeVal = OrderItemActionType[actionType as keyof typeof OrderItemActionType];
        } else {
            typeVal = Number(actionType);
        }

        const strongBrand = 'text-white bg-[var(--color-brand)] border-[var(--color-brand)]';
        const softBrand = 'text-[var(--color-brand)] bg-[var(--color-brand)]/10 border-[var(--color-brand)]/30';

        switch (typeVal) {
            case OrderItemActionType.Added:
            case OrderItemActionType.Deleted:
            case OrderItemActionType.QuantityModified:
            case OrderItemActionType.FinalApproved:
                return strongBrand;
            case OrderItemActionType.Supplied:
            case OrderItemActionType.AssetSupplied:
            default:
                return softBrand;
        }
    }

    getUserName(item: OrderItemHistoryDto): string {
        const lang = getCurrentLang(this.translate);
        return lang === 'ar' ? (item.modifiedByUserNameAr || item.modifiedByUserName) : (item.modifiedByUserNameEn || item.modifiedByUserName);
    }
}
