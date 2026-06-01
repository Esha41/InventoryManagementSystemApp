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
import { ButtonComponent } from '@components/button/button.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { CatalogPaginationState } from '../../new-issue-request.state';
import { ConfigService } from '@services/config.service';
import { ItemTypeValidationService } from '@admin/services/item-type-validation.service';
import { Cartridge } from '@models/cartridge.model';

@Component({
  selector: 'app-cartridge-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ButtonComponent, DropdownComponent, RouterLink],
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
  @Input() bulletDiameters: string[] = [];
  @Input() linkedOptions: Array<string | DropdownOption<string>> = [];
  @Input() natureOptions: string[] = [];

  // Weapon Options
  @Input() weaponTypeOptions: Array<DropdownOption<string>> = [];
  @Input() caliberOptions: string[] = []; // If we have predefined calibers

  // Explosive Options
  @Input() explosiveTypeOptions: Array<DropdownOption<string>> = [];

  // Selected Values
  @Input() selectedItemType: string = '';

  // Ammunition Selections
  @Input() selectedAmmunitionType: string = '';
  @Input() selectedBulletDiameter: string = '';
  @Input() selectedLinked: string = '';
  @Input() selectedNature: string = '';

  // Weapon Selections
  @Input() selectedWeaponType: string = '';
  @Input() selectedCaliber: string = '';

  // Explosive Selections
  @Input() selectedExplosiveType: string = '';
  @Input() selectedUNNumber: string = ''; // Similar to NSN search

  @Input() selectedNSN: string = '';
  @Input() canProceed: boolean = false;
  @Input() fromReserve: string = 'No'; // 'Yes' or 'No'
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
  @Output() bulletDiameterChange = new EventEmitter<string>();
  @Output() linkedChange = new EventEmitter<string>();
  @Output() natureChange = new EventEmitter<string>();

  @Output() weaponTypeChange = new EventEmitter<string>();
  @Output() caliberChange = new EventEmitter<string>();

  @Output() explosiveTypeChange = new EventEmitter<string>();
  @Output() unNumberChange = new EventEmitter<string>();

  @Output() nsnChange = new EventEmitter<string>();
  @Output() addSelection = new EventEmitter<{ cartridge: Cartridge; quantity: number }>();
  @Output() removeSelection = new EventEmitter<number>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() applyCatalogSearch = new EventEmitter<string>();
  @Output() catalogPageNext = new EventEmitter<void>();
  @Output() catalogPagePrev = new EventEmitter<void>();

  pendingCartridgeId: number | null = null;
  pendingQuantity: number = 1;
  searchTerm: string = '';
  draftSearchTerm = '';
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
      this.cdr.markForCheck();
    }
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
    this.clearFilters.emit();
  }

  onItemTypeChange(value: string): void {
    this.itemTypeChange.emit(value);
    this.onFilterChange();
  }

  onAmmunitionTypeChange(value: string): void {
    this.ammunitionTypeChange.emit(value);
    this.onFilterChange();
  }

  onBulletDiameterChange(value: string): void {
    this.bulletDiameterChange.emit(value);
    this.onFilterChange();
  }

  onLinkedChange(value: string): void {
    this.linkedChange.emit(value);
    this.onFilterChange();
  }

  onNatureChange(value: string): void {
    this.natureChange.emit(value);
    this.onFilterChange();
  }

  onWeaponTypeChange(value: string): void {
    this.weaponTypeChange.emit(value);
    this.onFilterChange();
  }

  onCaliberChange(value: string): void {
    this.caliberChange.emit(value);
    this.onFilterChange();
  }

  onExplosiveTypeChange(value: string): void {
    this.explosiveTypeChange.emit(value);
    this.onFilterChange();
  }

  onUnNumberChange(value: string): void {
    this.unNumberChange.emit(value);
    this.onFilterChange();
  }

  onNSNChange(value: string): void {
    this.nsnChange.emit(value);
    this.onFilterChange();
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.searchChange.emit(value);
  }
}
