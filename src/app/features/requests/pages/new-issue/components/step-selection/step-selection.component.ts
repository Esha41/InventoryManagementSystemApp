import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { CartridgeListComponent, Cartridge } from '../cartridge-list/cartridge-list.component';
import { ItemDetailsComponent } from '@shared/components/item-details/item-details.component';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { ErrorBannerComponent } from '../error-banner/error-banner.component';
import { FilterState, FilterOptions, CartridgeState } from '../../new-issue-request.state';
// Removed incorrect import
import { IssueRequestFilterService as FilterService } from '@requests/services/issue-request-filter.service'; // Direct service
import { IssueRequestCartridgeManagementService } from '@requests/services/issue-request-cartridge-management.service';

@Component({
    selector: 'app-step-selection',
    standalone: true,
    imports: [
        CommonModule,
        TranslateModule,
        CartridgeListComponent,
        ItemDetailsComponent,
        LoadingStateComponent,
        ErrorStateComponent,
        ErrorBannerComponent
    ],
    templateUrl: './step-selection.component.html',
    styleUrls: ['./step-selection.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class StepSelectionComponent {
    @Input() cartridgeState!: CartridgeState;
    @Input() filterState!: FilterState;
    @Input() filterOptions!: FilterOptions;
    @Input() fromReserve: string = 'No';
    @Input() canProceed: boolean = false;
    @Input() selectedCartridges: Cartridge[] = [];
    @Input() displayedItemTypeOptions: string[] = [];

    @Output() next = new EventEmitter<void>();
    @Output() previous = new EventEmitter<void>();
    @Output() retryLoad = new EventEmitter<void>();
    @Output() filterChange = new EventEmitter<void>(); // Tells parent to re-filter? Or we do it here?

    // State changes that need to propagate up or be handled
    @Output() itemTypeChange = new EventEmitter<string>();
    @Output() clearFilters = new EventEmitter<void>();
    @Output() addSelection = new EventEmitter<{ cartridge: Cartridge; quantity: number }>();
    @Output() removeSelection = new EventEmitter<number>();

    allowanceError: string | null = null;

    constructor(
        private cdr: ChangeDetectorRef,
        private filterService: FilterService
    ) { }

    // Filter Handlers
    onItemTypeChange(value: string): void {
        this.itemTypeChange.emit(value);
    }

    onAmmunitionTypeChange(value: string): void {
        this.filterState.selectedAmmunitionType = value;
        this.triggerFilter();
    }

    onBulletDiameterChange(value: string): void {
        this.filterState.selectedBulletDiameter = value;
        this.triggerFilter();
    }

    onLinkedChange(value: string): void {
        this.filterState.selectedLinked = value;
        this.triggerFilter();
    }

    onNatureChange(value: string): void {
        this.filterState.selectedNature = value;
        this.triggerFilter();
    }

    onWeaponTypeChange(value: string): void {
        this.filterState.selectedWeaponType = value;
        this.triggerFilter();
    }

    onCaliberChange(value: string): void {
        this.filterState.selectedCaliber = value;
        this.triggerFilter();
    }

    onExplosiveTypeChange(value: string): void {
        this.filterState.selectedExplosiveType = value;
        this.triggerFilter();
    }

    onUnNumberChange(value: string): void {
        this.filterState.selectedUNNumber = value;
        this.triggerFilter();
    }

    onNSNChange(value: string): void {
        this.filterState.selectedNSN = value;
        this.triggerFilter();
    }

    onSearchChange(value: string): void {
        this.filterState.searchTerm = value;
        this.triggerFilter();
    }

    triggerFilter(): void {
        // We can do filtering here locally if we have the service, 
        // OR emit to parent. Given we want to reduce parent size, let's try to emit a generic "Refilter" 
        // but ultimately the parent holds the "allCartridges".
        // Actually, if we pass allCartridges here, we can filter here.
        // Let's emit for now to be safe, or just call the local helper if we want to move logic down.
        this.filterChange.emit();
    }

    onCartridgeClick(cartridge: Cartridge): void {
        this.cartridgeState.selectedCartridgeForView = cartridge;
        this.cartridgeState.showCartridgeDetails = true;
    }

    onCloseCartridgeDetails(): void {
        this.cartridgeState.showCartridgeDetails = false;
        this.cartridgeState.selectedCartridgeForView = null;
    }

    onSelectCartridge(): void {
        if (!this.cartridgeState.selectedCartridgeForView) return;

        const cartridge = this.cartridgeState.allCartridges.find(c => c.id === this.cartridgeState.selectedCartridgeForView?.id) || this.cartridgeState.selectedCartridgeForView;
        const quantity = cartridge.quantity && cartridge.quantity > 0 ? cartridge.quantity : 1;

        this.addSelection.emit({ cartridge, quantity });
        this.cartridgeState.showCartridgeDetails = false;
        this.cartridgeState.selectedCartridgeForView = null;
    }

    onAllowanceError(message: string): void {
        this.allowanceError = message;
        setTimeout(() => {
            this.allowanceError = null;
            this.cdr.markForCheck();
        }, 5000);
    }
}
