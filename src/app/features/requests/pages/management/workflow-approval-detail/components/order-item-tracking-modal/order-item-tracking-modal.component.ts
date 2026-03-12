import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Clock, User, ArrowRight, FileText, Activity, RotateCcw } from 'lucide-angular';
import { ModalComponent } from '@components/modal/modal.component';
import { OrderItemTrackingService, OrderItemHistoryDto, OrderItemActionType } from '../../../../../services/order-item-tracking.service';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
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
export class OrderItemTrackingModalComponent implements OnInit, OnDestroy, OnChanges {
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

    ngOnInit(): void { }

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
        this.isOpen = false;
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
                error: (err: any) => {
                    console.error('Failed to load history', err);
                    this.error = true;
                    this.cdr.markForCheck();
                }
            });
    }

    getActionLabelKey(actionType: any): string {
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

    getActionColorClass(actionType: any): string {
        // Normalize to number for switch case
        let typeVal: number;

        if (typeof actionType === 'string' && isNaN(Number(actionType))) {
            // Map "Added" -> 1
            typeVal = OrderItemActionType[actionType as keyof typeof OrderItemActionType];
        } else {
            typeVal = Number(actionType);
        }

        switch (typeVal) {
            case OrderItemActionType.Added: return 'text-green-700 bg-green-50 border-green-200';
            case OrderItemActionType.Deleted: return 'text-red-700 bg-red-50 border-red-200';
            case OrderItemActionType.QuantityModified: return 'text-blue-700 bg-blue-50 border-blue-200';
            case OrderItemActionType.FinalApproved: return 'text-purple-700 bg-purple-50 border-purple-200';
            case OrderItemActionType.Supplied:
            case OrderItemActionType.AssetSupplied: return 'text-teal-700 bg-teal-50 border-teal-200';
            default: return 'text-gray-700 bg-gray-50 border-gray-200';
        }
    }

    getUserName(item: OrderItemHistoryDto): string {
        const lang = getCurrentLang(this.translate);
        return lang === 'ar' ? (item.modifiedByUserNameAr || item.modifiedByUserName) : (item.modifiedByUserNameEn || item.modifiedByUserName);
    }
}
