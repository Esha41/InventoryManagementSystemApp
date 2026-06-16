import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { CartridgeListComponent } from '../cartridge-list/cartridge-list.component';
import { Cartridge } from '@models/cartridge.model';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { ErrorBannerComponent } from '../error-banner/error-banner.component';
import { FilterState, FilterOptions, CartridgeState, CatalogPaginationState, AdditionalTextFiltersPatch } from '../../new-issue-request.state';

@Component({
    selector: 'app-step-selection',
    standalone: true,
    imports: [
        CommonModule,
        TranslateModule,
        CartridgeListComponent,
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
    @Input() serverSideCatalog = false;
    @Input() catalogPagination!: CatalogPaginationState;
    @Input() appliedSearchTerm = '';
    /** Passed through to cartridge list footer (hide on return step 0). */
    @Input() showPreviousButton = true;

    @Output() next = new EventEmitter<void>();
    @Output() previous = new EventEmitter<void>();
    @Output() retryLoad = new EventEmitter<void>();
    @Output() filterChange = new EventEmitter<void>();
    @Output() applyCatalogSearch = new EventEmitter<string>();
    @Output() catalogPageNext = new EventEmitter<void>();
    @Output() catalogPagePrev = new EventEmitter<void>();

    // State changes that need to propagate up or be handled
    @Output() itemTypeChange = new EventEmitter<string>();
    @Output() clearFilters = new EventEmitter<void>();
    @Output() addSelection = new EventEmitter<{ cartridge: Cartridge; quantity: number }>();
    @Output() removeSelection = new EventEmitter<number>();

    allowanceError: string | null = null;

    constructor(private cdr: ChangeDetectorRef) { }

    // Filter Handlers
    onItemTypeChange(value: string): void {
        this.itemTypeChange.emit(value);
    }

    onAmmunitionTypeChange(value: string): void {
        this.filterState.selectedAmmunitionType = value;
        this.triggerFilter();
    }

    onLinkedChange(value: string): void {
        this.filterState.selectedLinked = value;
        this.triggerFilter();
    }

    onPrimaryPurposeChange(value: string): void {
        this.filterState.selectedPrimaryPurposeId = value;
        this.triggerFilter();
    }

    onClassificationChange(value: string): void {
        this.filterState.selectedClassificationId = value;
        this.triggerFilter();
    }

    onCaseTypeChange(value: string): void {
        this.filterState.selectedCaseType = value;
        this.triggerFilter();
    }

    onCompatibilityChange(value: string): void {
        this.filterState.selectedCompatibility = value;
        this.triggerFilter();
    }

    onHazardDivisionChange(value: string): void {
        this.filterState.selectedHazardDivision = value;
        this.triggerFilter();
    }

    onPropellantChange(value: string): void {
        this.filterState.selectedPropellant = value;
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

    onCountryOfManufactureChange(value: string): void {
        this.filterState.selectedCountryOfManufacture = value;
        this.triggerFilter();
    }

    onWeaponUNNumberChange(value: string): void {
        this.filterState.selectedWeaponUNNumber = value;
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

    onExplosiveHazardDivisionChange(value: string): void {
        this.filterState.selectedExplosiveHazardDivision = value;
        this.triggerFilter();
    }

    onExplosiveCompatibilityChange(value: string): void {
        this.filterState.selectedExplosiveCompatibility = value;
        this.triggerFilter();
    }

    onAdditionalTextFiltersApply(patch: AdditionalTextFiltersPatch): void {
        if (patch.selectedNSN !== undefined) {
            this.filterState.selectedNSN = patch.selectedNSN;
        }
        if (patch.selectedAmmunitionArmNumber !== undefined) {
            this.filterState.selectedAmmunitionArmNumber = patch.selectedAmmunitionArmNumber;
        }
        if (patch.selectedAmmunitionPartNo !== undefined) {
            this.filterState.selectedAmmunitionPartNo = patch.selectedAmmunitionPartNo;
        }
        if (patch.selectedPartNo !== undefined) {
            this.filterState.selectedPartNo = patch.selectedPartNo;
        }
        if (patch.selectedWeaponModel !== undefined) {
            this.filterState.selectedWeaponModel = patch.selectedWeaponModel;
        }
        if (patch.selectedWeaponReferenceNo !== undefined) {
            this.filterState.selectedWeaponReferenceNo = patch.selectedWeaponReferenceNo;
        }
        if (patch.selectedArmNumber !== undefined) {
            this.filterState.selectedArmNumber = patch.selectedArmNumber;
        }
        if (patch.selectedExplosivePartNo !== undefined) {
            this.filterState.selectedExplosivePartNo = patch.selectedExplosivePartNo;
        }
        if (patch.selectedExplosiveReferenceNo !== undefined) {
            this.filterState.selectedExplosiveReferenceNo = patch.selectedExplosiveReferenceNo;
        }
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

    onAllowanceError(message: string): void {
        this.allowanceError = message;
        setTimeout(() => {
            this.allowanceError = null;
            this.cdr.markForCheck();
        }, 5000);
    }
}
