import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Search, X, Filter } from 'lucide-angular';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { CardStatus } from '@utils/dashboard.utils';

export type PriorityFilter = 'all' | 'Normal' | 'Urgent' | 'VeryUrgent';
export type StatusFilter = CardStatus | 'all' | 'action-required';

/**
 * Reusable filter bar component for request-based pages
 * Supports status filtering, priority filtering, and search functionality
 * 
 * @example
 * <app-request-filter-bar
 *   [showPriorityFilter]="true"
 *   [resultCount]="filteredCount"
 *   (statusFilterChange)="onStatusChange($event)"
 *   (priorityFilterChange)="onPriorityChange($event)"
 *   (searchQueryChange)="onSearchChange($event)">
 * </app-request-filter-bar>
 */
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
    // Configuration inputs
    @Input() showStatusFilter = true;
    @Input() showPriorityFilter = false;
    @Input() showSearchBar = true;
    @Input() showResultCount = true;
    @Input() searchPlaceholder = 'dashboard.searchOrders';
    @Input() layout: 'unified' | 'separate' = 'unified'; // unified = dashboard style, separate = requests-management style
    @Input() useSearchButton = false;

    // Filter values
    @Input() statusFilter: StatusFilter = 'all';
    @Input() priorityFilter: PriorityFilter = 'all';
    @Input() searchQuery = '';
    @Input() resultCount = 0;

    // Output events
    @Output() statusFilterChange = new EventEmitter<StatusFilter>();
    @Output() priorityFilterChange = new EventEmitter<PriorityFilter>();
    @Output() searchQueryChange = new EventEmitter<string>();
    @Output() searchTriggered = new EventEmitter<string>();

    // Icons
    readonly Search = Search;
    readonly X = X;
    readonly Filter = Filter;

    // Filter options
    readonly statusFilterOptions: DropdownOption<StatusFilter>[] = [
        { label: 'dashboard.filters.all', value: 'all' },
        { label: 'requestsManagement.actionRequired', value: 'action-required' },
        { label: 'dashboard.statusLabels.new', value: 'new' },
        { label: 'dashboard.statusLabels.underProcess', value: 'on-progress' },
        { label: 'requestsManagement.orderReport.workflowStatus.completed', value: 'completed' },
        { label: 'dashboard.statusLabels.rejected', value: 'declined' },
        { label: 'dashboard.statusLabels.returnedForReview', value: 'returned' }
    ];

    readonly priorityFilterOptions: DropdownOption<PriorityFilter>[] = [
        { label: 'dashboard.filters.all', value: 'all' },
        { label: 'dashboard.priorityLabels.normal', value: 'Normal' },
        { label: 'dashboard.priorityLabels.urgent', value: 'Urgent' },
        { label: 'dashboard.priorityLabels.veryUrgent', value: 'VeryUrgent' }
    ];

    constructor(private readonly translate: TranslateService) { }

    /**
     * Translation function for dropdown labels
     */
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

    /**
     * Handle status filter change
     */
    onStatusChange(value: StatusFilter): void {
        this.statusFilter = value;
        this.statusFilterChange.emit(value);
    }

    /**
     * Handle priority filter change
     */
    onPriorityChange(value: PriorityFilter): void {
        this.priorityFilter = value;
        this.priorityFilterChange.emit(value);
    }

    /**
     * Handle search query change
     */
    onSearchChange(value: string): void {
        this.searchQuery = value;
        if (!this.useSearchButton) {
            this.searchQueryChange.emit(value);
        }
    }

    /**
     * Trigger search manually
     */
    onSearchClick(): void {
        this.searchTriggered.emit(this.searchQuery);
    }

    /**
     * Clear search query
     */
    clearSearch(): void {
        this.searchQuery = '';
        this.searchQueryChange.emit('');
        this.searchTriggered.emit('');
    }
}