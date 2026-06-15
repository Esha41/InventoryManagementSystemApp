import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  OnChanges,
  SimpleChanges,
  ChangeDetectorRef,
  OnInit,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { getCurrentLang, localizedCartridgeDisplayName } from '@utils/localization.utils';
import { LucideAngularModule, ChevronDown } from 'lucide-angular';
import { ButtonComponent } from '@components/button/button.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { ASSET_LIST_MORE_FILTER_TEXT_INPUT_CLASS } from '@assets/pages/list/components/asset-filter-bar/asset-filter-bar.ui-classes';
import { AdditionalTextFiltersPatch, CatalogPaginationState } from '../../new-issue-request.state';
import { ConfigService } from '@services/config.service';
import { ItemTypeValidationService } from '@admin/services/item-type-validation.service';
import { Cartridge } from '@models/cartridge.model';

@Component({
  selector: 'app-cartridge-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, ButtonComponent, DropdownComponent, RouterLink],
  templateUrl: './cartridge-list.component.html',
  styleUrls: ['./cartridge-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CartridgeListComponent implements OnChanges, OnInit, OnDestroy {
  @Input() cartridges: Cartridge[] = [];

  // Filter Options
  @Input() itemTypeOptions: string[] = [];

  // Ammunition Options
  @Input() ammunitionTypeOptions: Array<string | DropdownOption<string>> = [];
  @Input() caliberOptions: DropdownOption<string>[] = [];
  @Input() linkedOptions: Array<string | DropdownOption<string>> = [];
  @Input() primaryPurposeOptions: DropdownOption<string>[] = [];
  @Input() classificationOptions: DropdownOption<string>[] = [];
  @Input() caseTypeOptions: DropdownOption<string>[] = [];
  @Input() compatibilityOptions: DropdownOption<string>[] = [];
  @Input() hazardDivisionOptions: DropdownOption<string>[] = [];
  @Input() propellantOptions: DropdownOption<string>[] = [];
  @Input() countryOptions: DropdownOption<string>[] = [];

  // Weapon Options
  @Input() weaponTypeOptions: Array<DropdownOption<string>> = [];

  // Explosive Options
  @Input() explosiveTypeOptions: Array<DropdownOption<string>> = [];

  // Selected Values
  @Input() selectedItemType: string = '';

  // Ammunition Selections
  @Input() selectedAmmunitionType: string = '';
  @Input() selectedLinked: string = '';
  @Input() selectedPrimaryPurposeId: string = '';
  @Input() selectedClassificationId: string = '';
  @Input() selectedCaseType: string = '';
  @Input() selectedCompatibility: string = '';
  @Input() selectedHazardDivision: string = '';
  @Input() selectedPropellant: string = '';
  @Input() selectedAmmunitionArmNumber: string = '';
  @Input() selectedAmmunitionPartNo: string = '';

  // Weapon Selections
  @Input() selectedWeaponType: string = '';
  @Input() selectedCaliber: string = '';
  @Input() selectedCountryOfManufacture: string = '';
  @Input() selectedWeaponUNNumber: string = '';
  @Input() selectedPartNo: string = '';
  @Input() selectedWeaponModel: string = '';
  @Input() selectedWeaponReferenceNo: string = '';

  // Explosive Selections
  @Input() selectedExplosiveType: string = '';
  @Input() selectedUNNumber: string = '';
  @Input() selectedExplosiveHazardDivision: string = '';
  @Input() selectedExplosiveCompatibility: string = '';
  @Input() selectedArmNumber: string = '';
  @Input() selectedExplosivePartNo: string = '';
  @Input() selectedExplosiveReferenceNo: string = '';

  @Input() selectedNSN: string = '';
  @Input() canProceed: boolean = false;
  @Input() fromReserve: boolean = false;
  @Input() selectedCartridges: Cartridge[] = []; // Currently selected cartridges for validation
  @Input() serverSideCatalog = false;
  @Input() catalogPagination: CatalogPaginationState | null = null;
  @Input() appliedSearchTerm = '';
  /** Server catalog: true while paginating or refreshing results (list shows with overlay). */
  @Input() catalogPageLoading = false;
  @Input() showPreviousButton = true;

  @Output() allowanceError = new EventEmitter<string>();
  @Output() itemTypeValidationError = new EventEmitter<string>();
  @Output() filterChange = new EventEmitter<void>();
  @Output() confirmSelection = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();
  @Output() clearFilters = new EventEmitter<void>();

  // Filter Change Outputs
  @Output() itemTypeChange = new EventEmitter<string>();

  @Output() ammunitionTypeChange = new EventEmitter<string>();
  @Output() linkedChange = new EventEmitter<string>();
  @Output() primaryPurposeChange = new EventEmitter<string>();
  @Output() classificationChange = new EventEmitter<string>();
  @Output() caseTypeChange = new EventEmitter<string>();
  @Output() compatibilityChange = new EventEmitter<string>();
  @Output() hazardDivisionChange = new EventEmitter<string>();
  @Output() propellantChange = new EventEmitter<string>();
  @Output() ammunitionArmNumberChange = new EventEmitter<string>();
  @Output() ammunitionPartNoChange = new EventEmitter<string>();

  @Output() weaponTypeChange = new EventEmitter<string>();
  @Output() caliberChange = new EventEmitter<string>();
  @Output() countryOfManufactureChange = new EventEmitter<string>();
  @Output() weaponUNNumberChange = new EventEmitter<string>();
  @Output() partNoChange = new EventEmitter<string>();
  @Output() weaponModelChange = new EventEmitter<string>();
  @Output() weaponReferenceNoChange = new EventEmitter<string>();

  @Output() explosiveTypeChange = new EventEmitter<string>();
  @Output() unNumberChange = new EventEmitter<string>();
  @Output() explosiveHazardDivisionChange = new EventEmitter<string>();
  @Output() explosiveCompatibilityChange = new EventEmitter<string>();
  @Output() armNumberChange = new EventEmitter<string>();
  @Output() explosivePartNoChange = new EventEmitter<string>();
  @Output() explosiveReferenceNoChange = new EventEmitter<string>();

  @Output() nsnChange = new EventEmitter<string>();
  @Output() additionalTextFiltersApply = new EventEmitter<AdditionalTextFiltersPatch>();
  @Output() addSelection = new EventEmitter<{ cartridge: Cartridge; quantity: number }>();
  @Output() removeSelection = new EventEmitter<number>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() applyCatalogSearch = new EventEmitter<string>();
  @Output() catalogPageNext = new EventEmitter<void>();
  @Output() catalogPagePrev = new EventEmitter<void>();

  readonly ChevronDown = ChevronDown;
  readonly moreFilterInputClass = ASSET_LIST_MORE_FILTER_TEXT_INPUT_CLASS;

  showMoreFilters = false;

  pendingCartridgeId: number | null = null;
  pendingQuantity: number = 1;
  searchTerm: string = '';
  draftSearchTerm = '';
  draftNsn = '';
  draftAmmunitionArmNumber = '';
  draftAmmunitionPartNo = '';
  draftPartNo = '';
  draftWeaponModel = '';
  draftWeaponReferenceNo = '';
  draftArmNumber = '';
  draftExplosivePartNo = '';
  draftExplosiveReferenceNo = '';
  allowanceErrorMessage: string | null = null;
  itemTypeValidationErrorMessage: string | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private config: ConfigService,
    private itemTypeValidationService: ItemTypeValidationService,
    private cdr: ChangeDetectorRef,
    private readonly router: Router,
    private readonly translate: TranslateService
  ) { }

  ngOnInit(): void {
    this.draftSearchTerm = this.appliedSearchTerm ?? '';
    this.searchTerm = this.appliedSearchTerm ?? '';
    this.syncAdditionalFilterDraftsFromApplied();
    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Catalog row title: Arabic when UI is Arabic and `nameAr` exists, else English (`nameEn` / `name`). */
  cartridgeDisplayName(cartridge: Cartridge): string {
    return localizedCartridgeDisplayName(cartridge, getCurrentLang(this.translate));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['appliedSearchTerm']) {
      this.draftSearchTerm = this.appliedSearchTerm ?? '';
    }
    if (
      changes['selectedNSN'] ||
      changes['selectedAmmunitionArmNumber'] ||
      changes['selectedAmmunitionPartNo'] ||
      changes['selectedPartNo'] ||
      changes['selectedWeaponModel'] ||
      changes['selectedWeaponReferenceNo'] ||
      changes['selectedArmNumber'] ||
      changes['selectedExplosivePartNo'] ||
      changes['selectedExplosiveReferenceNo']
    ) {
      this.syncAdditionalFilterDraftsFromApplied();
    }
    if (changes['appliedSearchTerm'] || changes['selectedNSN']) {
      this.cdr.markForCheck();
    }
  }

  private syncAdditionalFilterDraftsFromApplied(): void {
    this.draftNsn = this.selectedNSN ?? '';
    this.draftAmmunitionArmNumber = this.selectedAmmunitionArmNumber ?? '';
    this.draftAmmunitionPartNo = this.selectedAmmunitionPartNo ?? '';
    this.draftPartNo = this.selectedPartNo ?? '';
    this.draftWeaponModel = this.selectedWeaponModel ?? '';
    this.draftWeaponReferenceNo = this.selectedWeaponReferenceNo ?? '';
    this.draftArmNumber = this.selectedArmNumber ?? '';
    this.draftExplosivePartNo = this.selectedExplosivePartNo ?? '';
    this.draftExplosiveReferenceNo = this.selectedExplosiveReferenceNo ?? '';
  }

  trackByCartridgeId(_index: number, cartridge: Cartridge): number {
    return cartridge.id;
  }

  get catalogRangeStart(): number {
    const p = this.catalogPagination;
    if (!p || p.totalCount === 0) {
      return 0;
    }
    return (p.page - 1) * p.pageSize + 1;
  }

  get catalogRangeEnd(): number {
    const p = this.catalogPagination;
    if (!p) {
      return 0;
    }
    return Math.min(p.page * p.pageSize, p.totalCount);
  }

  onApplyCatalogQuery(): void {
    if (this.catalogPageLoading) {
      return;
    }
    this.applyCatalogSearch.emit(this.draftSearchTerm.trim());
  }

  /**
   * Query params for full-page asset details; `returnTo` restores the wizard when the user goes back.
   */
  assetCatalogDetailQueryParams(cartridge: Cartridge): { tab: string; returnTo: string } {
    return {
      tab: this.resolveCatalogItemTab(cartridge),
      returnTo: this.router.url
    };
  }

  private resolveCatalogItemTab(cartridge: Cartridge): string {
    const fromCart = (cartridge.itemType || '').toLowerCase();
    if (fromCart === 'ammunition' || fromCart === 'weapon' || fromCart === 'explosive') {
      return fromCart;
    }
    const t = (this.selectedItemType || 'Ammunition').toLowerCase();
    if (t === 'ammunition' || t === 'weapon' || t === 'explosive') {
      return t;
    }
    return 'ammunition';
  }

  beginSelection(cartridge: Cartridge, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.pendingCartridgeId = cartridge.id;
    this.pendingQuantity = cartridge.quantity && cartridge.quantity > 0 ? cartridge.quantity : 1;
  }

  updatePendingQuantity(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const parsed = value ? parseInt(value, 10) : 1;
    this.pendingQuantity = parsed > 0 ? parsed : 1;
    // Clear errors when quantity changes
    this.allowanceErrorMessage = null;
    this.itemTypeValidationErrorMessage = null;
  }

  confirmAdd(cartridge: Cartridge, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    const quantity = this.pendingQuantity > 0 ? this.pendingQuantity : 1;
    this.allowanceErrorMessage = null;
    this.itemTypeValidationErrorMessage = null;

    // Infer item type for the cartridge being added
    const newItemType = cartridge.itemType || this.inferItemType(cartridge) || this.selectedItemType;
    
    // Validate item type combination before proceeding
    const existingItemTypes = this.selectedCartridges
      .map(c => c.itemType || this.inferItemType(c))
      .filter(t => t != null) as string[];

    const validationResult = this.itemTypeValidationService.validateItemTypeCombination(
      newItemType,
      existingItemTypes
    );

    if (!validationResult.isValid) {
      const errorMsg = validationResult.errorMessageKey 
        ? this.itemTypeValidationService.getErrorMessage(validationResult.errorMessageKey)
        : validationResult.errorMessage || 'Invalid item type combination';
      this.itemTypeValidationErrorMessage = errorMsg;
      this.itemTypeValidationError.emit(errorMsg);
      return; // Don't proceed, show error
    }

    // Set itemType on cartridge if not already set
    if (!cartridge.itemType) {
      cartridge.itemType = newItemType;
    }

    // From allowance: allow quantities above remaining allowance (negative balance tracked server-side)
    this.proceedWithConfirmation(cartridge, quantity);
  }

  /**
   * Infers item type from cartridge properties
   */
  private inferItemType(cartridge: Cartridge): string | null {
    if (cartridge.itemType) {
      return cartridge.itemType;
    }

    // Infer from properties
    if (cartridge.weaponType || cartridge.caliber || cartridge.actionType) {
      return 'Weapon';
    }
    if (cartridge.explosiveType || cartridge.unNumber) {
      return 'Explosive';
    }
    if (cartridge.ammunitionType || cartridge.bulletDiameterLabel || cartridge.linkedLabel) {
      return 'Ammunition';
    }

    return null;
  }

  private proceedWithConfirmation(cartridge: Cartridge, quantity: number): void {
    cartridge.quantity = quantity;
    cartridge.added = true;
    cartridge.selected = false; // Clear selection highlight after saving
    this.addSelection.emit({ cartridge, quantity });
    this.pendingCartridgeId = null;
    this.pendingQuantity = 1;
    this.allowanceErrorMessage = null;
    this.itemTypeValidationErrorMessage = null;
  }

  removePending(cartridge: Cartridge, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    cartridge.quantity = null;
    cartridge.added = false;
    cartridge.selected = false;
    this.removeSelection.emit(cartridge.id);
    this.pendingCartridgeId = null;
    this.pendingQuantity = 1;
  }

  cancelSelection(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.pendingCartridgeId = null;
    this.pendingQuantity = 1;
    this.allowanceErrorMessage = null;
    this.itemTypeValidationErrorMessage = null;
  }

  onFilterChange(): void {
    this.filterChange.emit();
  }

  onConfirmSelection(): void {
    this.confirmSelection.emit();
  }

  onNext(): void {
    this.next.emit();
  }

  onPrevious(): void {
    this.previous.emit();
  }

  onClear(): void {
    this.showMoreFilters = false;
    this.clearFilters.emit();
    this.cdr.markForCheck();
  }

  applyAdditionalTextFilters(): void {
    if (this.catalogPageLoading) {
      return;
    }
    this.additionalTextFiltersApply.emit(this.buildAdditionalTextFiltersPatch());
  }

  onAdditionalFilterKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.applyAdditionalTextFilters();
    }
  }

  private buildAdditionalTextFiltersPatch(): AdditionalTextFiltersPatch {
    if (this.selectedItemType === 'Ammunition') {
      return {
        selectedNSN: this.draftNsn.trim(),
        selectedAmmunitionArmNumber: this.draftAmmunitionArmNumber.trim(),
        selectedAmmunitionPartNo: this.draftAmmunitionPartNo.trim()
      };
    }
    if (this.selectedItemType === 'Weapon') {
      return {
        selectedPartNo: this.draftPartNo.trim(),
        selectedNSN: this.draftNsn.trim(),
        selectedWeaponModel: this.draftWeaponModel.trim(),
        selectedWeaponReferenceNo: this.draftWeaponReferenceNo.trim()
      };
    }
    return {
      selectedArmNumber: this.draftArmNumber.trim(),
      selectedNSN: this.draftNsn.trim(),
      selectedExplosivePartNo: this.draftExplosivePartNo.trim(),
      selectedExplosiveReferenceNo: this.draftExplosiveReferenceNo.trim()
    };
  }

  onItemTypeChange(value: string): void {
    this.showMoreFilters = false;
    this.itemTypeChange.emit(value);
    this.onFilterChange();
    this.cdr.markForCheck();
  }

  toggleMoreFilters(): void {
    this.showMoreFilters = !this.showMoreFilters;
    this.cdr.markForCheck();
  }

  onAmmunitionTypeChange(value: string): void {
    this.ammunitionTypeChange.emit(value);
    this.onFilterChange();
  }

  onLinkedChange(value: string): void {
    this.linkedChange.emit(value);
    this.onFilterChange();
  }

  onPrimaryPurposeChange(value: string): void {
    this.primaryPurposeChange.emit(value);
    this.onFilterChange();
  }

  onClassificationChange(value: string): void {
    this.classificationChange.emit(value);
    this.onFilterChange();
  }

  onCaseTypeChange(value: string): void {
    this.caseTypeChange.emit(value);
    this.onFilterChange();
  }

  onCompatibilityChange(value: string): void {
    this.compatibilityChange.emit(value);
    this.onFilterChange();
  }

  onHazardDivisionChange(value: string): void {
    this.hazardDivisionChange.emit(value);
    this.onFilterChange();
  }

  onPropellantChange(value: string): void {
    this.propellantChange.emit(value);
    this.onFilterChange();
  }

  onAmmunitionArmNumberDraftChange(value: string): void {
    this.draftAmmunitionArmNumber = value;
  }

  onAmmunitionPartNoDraftChange(value: string): void {
    this.draftAmmunitionPartNo = value;
  }

  onWeaponTypeChange(value: string): void {
    this.weaponTypeChange.emit(value);
    this.onFilterChange();
  }

  onCaliberChange(value: string): void {
    this.caliberChange.emit(value);
    this.onFilterChange();
  }

  onCountryOfManufactureChange(value: string): void {
    this.countryOfManufactureChange.emit(value);
    this.onFilterChange();
  }

  onWeaponUNNumberChange(value: string): void {
    this.weaponUNNumberChange.emit(value);
    this.onFilterChange();
  }

  onPartNoDraftChange(value: string): void {
    this.draftPartNo = value;
  }

  onWeaponModelDraftChange(value: string): void {
    this.draftWeaponModel = value;
  }

  onWeaponReferenceNoDraftChange(value: string): void {
    this.draftWeaponReferenceNo = value;
  }

  onExplosiveTypeChange(value: string): void {
    this.explosiveTypeChange.emit(value);
    this.onFilterChange();
  }

  onUnNumberChange(value: string): void {
    this.unNumberChange.emit(value);
    this.onFilterChange();
  }

  onExplosiveHazardDivisionChange(value: string): void {
    this.explosiveHazardDivisionChange.emit(value);
    this.onFilterChange();
  }

  onExplosiveCompatibilityChange(value: string): void {
    this.explosiveCompatibilityChange.emit(value);
    this.onFilterChange();
  }

  onArmNumberDraftChange(value: string): void {
    this.draftArmNumber = value;
  }

  onExplosivePartNoDraftChange(value: string): void {
    this.draftExplosivePartNo = value;
  }

  onExplosiveReferenceNoDraftChange(value: string): void {
    this.draftExplosiveReferenceNo = value;
  }

  onNsnDraftChange(value: string): void {
    this.draftNsn = value;
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.searchChange.emit(value);
  }
}
