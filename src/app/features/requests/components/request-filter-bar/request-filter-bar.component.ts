import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Search, X, Filter } from 'lucide-angular';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { CardStatus } from '@utils/dashboard.utils';

export type PriorityFilter = 'all' | 'Normal' | 'Urgent' | 'VeryUrgent';
export type StatusFilter = CardStatus | 'all' | 'action-required' | 'auto-rejected';
/** Filter orders by auto-reject days remaining */
export type AutoRejectFilter = 'all' | 'expiring-1day' | 'expiring-3days' | 'expiring-7days';

@Component({
    selector: 'app-request-filter-bar',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TranslateModule,
        LucideAngularModule,
        DropdownComponent
    ],
    templateUrl: './request-filter-bar.component.html',
    styleUrls: ['./request-filter-bar.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None
})
export class RequestFilterBarComponent {
    @Input() showStatusFilter = true;
    @Input() showPriorityFilter = false;
    @Input() showSearchBar = true;
    @Input() showResultCount = true;
    @Input() showAutoRejectFilter = false;
    @Input() searchPlaceholder = 'dashboard.searchOrders';
    @Input() useSearchButton = false;

    @Input() statusFilter: StatusFilter = 'all';
    @Input() priorityFilter: PriorityFilter = 'all';
    @Input() autoRejectFilter: AutoRejectFilter = 'all';
    @Input() searchQuery = '';
    @Input() resultCount = 0;

    @Output() statusFilterChange = new EventEmitter<StatusFilter>();
    @Output() priorityFilterChange = new EventEmitter<PriorityFilter>();
    @Output() autoRejectFilterChange = new EventEmitter<AutoRejectFilter>();
    @Output() searchQueryChange = new EventEmitter<string>();
    @Output() searchTriggered = new EventEmitter<string>();
    @Output() filtersCleared = new EventEmitter<void>();

    readonly Search = Search;
    readonly X = X;
    readonly Filter = Filter;

    readonly statusFilterOptions: DropdownOption<StatusFilter>[] = [
        { label: 'dashboard.filters.all', value: 'all' },
        { label: 'requestsManagement.actionRequired', value: 'action-required' },
        { label: 'dashboard.statusLabels.new', value: 'new' },
        { label: 'dashboard.statusLabels.underProcess', value: 'on-progress' },
        { label: 'requestsManagement.orderReport.workflowStatus.completed', value: 'completed' },
        { label: 'dashboard.statusLabels.rejected', value: 'declined' },
        { label: 'dashboard.statusLabels.autoRejected', value: 'auto-rejected' },
        { label: 'dashboard.statusLabels.cancelled', value: 'cancelled' },
        { label: 'dashboard.statusLabels.returnedForReview', value: 'returned' }
    ];

    readonly priorityFilterOptions: DropdownOption<PriorityFilter>[] = [
        { label: 'dashboard.filters.all', value: 'all' },
        { label: 'dashboard.priorityLabels.normal', value: 'Normal' },
        { label: 'dashboard.priorityLabels.urgent', value: 'Urgent' },
        { label: 'dashboard.priorityLabels.veryUrgent', value: 'VeryUrgent' }
    ];

    readonly autoRejectFilterOptions: DropdownOption<AutoRejectFilter>[] = [
        { label: 'dashboard.filters.all', value: 'all' },
        { label: 'autoRejectCountdown.filter.expiring1Day', value: 'expiring-1day' },
        { label: 'autoRejectCountdown.filter.expiring3Days', value: 'expiring-3days' },
        { label: 'autoRejectCountdown.filter.expiring7Days', value: 'expiring-7days' }
    ];

    constructor(private readonly translate: TranslateService) { }

    readonly statusFilterLabelFn = (option: DropdownOption<StatusFilter> | StatusFilter): string => {
        if (typeof option === 'object' && option !== null && 'label' in option) {
            return this.translate.instant(option.label as string);
        }
        return '';
    };

    readonly priorityFilterLabelFn = (option: DropdownOption<PriorityFilter> | PriorityFilter): string => {
        if (typeof option === 'object' && option !== null && 'label' in option) {
            return this.translate.instant(option.label as string);
        }
        return '';
    };

    readonly autoRejectFilterLabelFn = (option: DropdownOption<AutoRejectFilter> | AutoRejectFilter): string => {
        if (typeof option === 'object' && option !== null && 'label' in option) {
            return this.translate.instant(option.label as string);
        }
        return '';
    };

    onStatusChange(value: StatusFilter): void {
        this.statusFilter = value;
        this.statusFilterChange.emit(value);
    }

    onPriorityChange(value: PriorityFilter): void {
        this.priorityFilter = value;
        this.priorityFilterChange.emit(value);
    }

    onAutoRejectChange(value: AutoRejectFilter): void {
        this.autoRejectFilter = value;
        this.autoRejectFilterChange.emit(value);
    }

    onSearchChange(value: string): void {
        this.searchQuery = value;
        if (!this.useSearchButton) {
            this.searchQueryChange.emit(value);
        }
    }

    onSearchClick(): void {
        this.searchTriggered.emit(this.searchQuery);
    }

    clearSearch(): void {
        this.searchQuery = '';
        this.searchQueryChange.emit('');
        this.searchTriggered.emit('');
    }

    get hasActiveFilters(): boolean {
        const statusActive = this.showStatusFilter && this.statusFilter !== 'all';
        const priorityActive = this.showPriorityFilter && this.priorityFilter !== 'all';
        const autoRejectActive = this.showAutoRejectFilter && this.autoRejectFilter !== 'all';
        const searchActive = this.showSearchBar && !!this.searchQuery?.trim();
        return statusActive || priorityActive || autoRejectActive || searchActive;
    }

    clearAllFilters(): void {
        if (!this.hasActiveFilters) {
            return;
        }
        this.filtersCleared.emit();
    }
}
