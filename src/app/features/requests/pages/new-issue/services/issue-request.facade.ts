import {
  ChangeDetectorRef,
  Injectable,
  Optional,
  Inject
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { Cartridge } from '@models/cartridge.model';
import { WeaponDto } from '@models/weapon.model';
import {
  createInitialWeaponAssociationState,
  WeaponAssociation,
  WeaponAssociationState
} from '@models/request-item.model';
import { CartridgeDataService } from '@assets/services/cartridge-data.service';
import { WeaponService } from '@assets/services/weapon.service';
import { UserContextService } from '@services/user-context.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { getWeaponTypeOptions } from '@utils/weapon.utils';
import { getExplosiveTypeOptions } from '@utils/explosive.utils';
import { scrollShellContentToTop } from '@utils/scroll-shell-content-to-top.util';
import { DropdownOption } from '@components/dropdown/dropdown.component';
import { ONBOARDING_TOUR } from '@core/tokens/onboarding-tour.token';
import { IOnboardingTourProvider } from '@core/interfaces/onboarding-tour-provider.interface';
import { Step } from '@components/stepper/stepper.component';

import { IssueRequestStateService } from './issue-request-state.service';
import { IssueRequestSubmissionService } from './issue-request-submission.service';
import {
  IssueRequestCatalogOrchestratorService,
  CatalogOrchestratorContext,
  CatalogLoadHooks
} from './issue-request-catalog-orchestrator.service';

import {
  ExtendedFilterState,
  ExtendedFilterOptions,
  CartridgeState,
  UsageFormData,
  ReserveDetailsState,
  UserContextState,
  RequestPurposeState,
  OrderSubmissionState,
  ReviewFormData,
  ConfirmDialogConfig,
  createInitialFilterState,
  createInitialFilterOptions,
  createInitialCartridgeState,
  createInitialUsageFormData,
  createInitialReserveDetailsState,
  createInitialUserContextState,
  createInitialRequestPurposeState,
  createInitialOrderSubmissionState,
  createInitialReviewFormData,
  createInitialConfirmDialogConfig
} from '../new-issue-request.state';
import type { ReserveDetailItem } from '../new-issue-request.state';

import {
  mapSelectedEntriesToCartridges,
  filterReserveDetailsBySelectedItems,
  computeTotalReserve,
  computeAvailableReserve,
  computeOrderedQuantity,
  computeUsedQuantity,
  resolveCurrentRequesterName,
  syncRequesterNameFromUserDetails as syncRequesterNameUtil,
  hasWeaponInSelection,
  getDisplayedItemTypeOptions,
  getDisplayedUsePurposeOptions,
  canProceedFromSelection,
  inferCartridgeItemType,
  applyUserContext as applyUserContextUtil,
  applyAuthenticatedUserContext as applyAuthenticatedUserContextUtil
} from '@requests/utils/issue-request.utils';
import { resolveCatalogItemCaliberId, isCatalogItemExplicitlyDeleted } from '@utils/catalog-caliber.utils';

const TRAINING_ORDER_ID = 4;

/**
 * Facade for the new-issue-request feature.
 * Provided at component level — shares the component's ChangeDetectorRef.
 * Absorbs: IssueRequestNavigationService, IssueRequestUserContextService,
 *           IssueRequestCartridgeManagementService, IssueRequestDataService.
 */
@Injectable()
export class IssueRequestFacade {
  private readonly DEFAULT_DEPARTMENT_ID = 1;
  private readonly DEFAULT_REQUEST_PURPOSE_ID = 1;
  private readonly DEFAULT_REQUEST_TYPE_ID = 1;

  private destroy$ = new Subject<void>();
  private pendingSelections: Array<{ id: number; quantity: number }> | null = null;
  private requestServerRefilter: () => void = () => undefined;
  private requestPurposeOptionsMap: Map<number, { usePurpose: string }> = new Map();
  /** In-flight / stale-response guard for weapon association API. */
  private weaponAssociationLoadSeq = 0;
  /** Distinct sorted ammo caliber ids (joined) for which association weapons were loaded successfully. */
  private weaponAssociationLoadedKey: string | null = null;

  // ---- State --------------------------------------------------------------

  currentStep = 0;
  steps: Step[] = [
    { label: 'newIssueRequest.allowanceSelection', completed: false },
    { label: 'newIssueRequest.selection', completed: false },
    { label: 'newIssueRequest.weaponAssociation.title', completed: false },
    { label: 'newIssueRequest.usage', completed: false },
    { label: 'newIssueRequest.review', completed: false },
    { label: 'newIssueRequest.send', completed: false }
  ];

  /** Stable reference when weapon step is hidden — avoids *ngFor churn in the stepper. */
  private readonly collapsedStepperSteps: Step[] = [
    this.steps[0],
    this.steps[1],
    this.steps[3],
    this.steps[4],
    this.steps[5]
  ];

  filterState: ExtendedFilterState = createInitialFilterState();
  filterOptions: ExtendedFilterOptions = createInitialFilterOptions();
  cartridgeState: CartridgeState = createInitialCartridgeState();
  weaponAssociationState: WeaponAssociationState = createInitialWeaponAssociationState();
  usageFormData: UsageFormData = createInitialUsageFormData();
  usageFormFiles: File[] = [];
  reserveDetailsState: ReserveDetailsState = createInitialReserveDetailsState();
  userContextState: UserContextState = createInitialUserContextState();
  requestPurposeState: RequestPurposeState = createInitialRequestPurposeState();
  orderSubmissionState: OrderSubmissionState = createInitialOrderSubmissionState();
  reviewFormData: ReviewFormData = createInitialReviewFormData();
  confirmDialogConfig: ConfirmDialogConfig = createInitialConfirmDialogConfig();
  showConfirmDialog = false;
  fromReserve = 'Yes';
  allowanceError: string | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private translate: TranslateService,
    private cartridgeDataService: CartridgeDataService,
    private userContextService: UserContextService,
    private backendAuthService: BackendAuthService,
    private stateService: IssueRequestStateService,
    private submissionService: IssueRequestSubmissionService,
    private catalogOrchestrator: IssueRequestCatalogOrchestratorService,
    private weaponService: WeaponService,
    @Optional() @Inject(ONBOARDING_TOUR) private onboardingTourService: IOnboardingTourProvider | null
  ) {}

  // ---- Computed view state ------------------------------------------------

  get selectedCartridges(): Cartridge[] {
    return mapSelectedEntriesToCartridges(
      this.cartridgeState.selectedEntries,
      this.cartridgeState.allCartridges,
      this.cartridgeState.selectedCartridgesCache
    );
  }

  get displayedItemTypeOptions(): string[] {
    return getDisplayedItemTypeOptions(this.filterOptions.itemTypeOptions, this.fromReserve);
  }

  get displayedUsePurposeOptions(): DropdownOption<number>[] {
    return getDisplayedUsePurposeOptions(this.requestPurposeState.requestPurposeOptions, this.selectedCartridges, TRAINING_ORDER_ID);
  }

  get canProceedFromSelection(): boolean {
    return canProceedFromSelection(this.cartridgeState.selectedEntries);
  }

  get hasAmmunitionSelected(): boolean {
    return this.cartridgeState.selectedEntries.some(e => e.itemType === 'Ammunition');
  }

  /** Steps shown in the stepper: omits weapon association when no ammunition is selected. */
  get stepperSteps(): Step[] {
    return this.hasAmmunitionSelected ? this.steps : this.collapsedStepperSteps;
  }

  /** Display index for the stepper (collapsed when weapon step is hidden). */
  get stepperCurrentStep(): number {
    if (this.hasAmmunitionSelected) {
      return this.currentStep;
    }
    if (this.currentStep <= 1) {
      return this.currentStep;
    }
    if (this.currentStep >= 3) {
      return this.currentStep - 1;
    }
    return 1;
  }

  get ammunitionCartridges(): Cartridge[] {
    return this.selectedCartridges.filter(c => c.itemType === 'Ammunition');
  }

  get canProceedFromWeaponAssociation(): boolean {
    return this.ammunitionCartridges.every(ammo => {
      const list = this.weaponAssociationState.associations.get(ammo.id);
      if (!list?.length) return false;
      return list.every(
        a =>
          (a.type === 'catalog' && !!a.weaponItemId) ||
          (a.type === 'other' && !!a.otherName?.trim())
      );
    });
  }

  get currentRequesterName(): string {
    const lang = this.translate.currentLang || 'en';
    return resolveCurrentRequesterName(
      this.userContextState.currentUserDetails,
      this.userContextState.fallbackRequesterName,
      this.reviewFormData.requesterName,
      lang
    );
  }

  get selectedItemsReserveDetails(): ReserveDetailItem[] {
    return filterReserveDetailsBySelectedItems(
      this.reserveDetailsState.reserveDetailsByItem,
      this.cartridgeState.selectedEntries.map(e => e.id)
    );
  }

  get selectedTotalReserve(): number { return computeTotalReserve(this.selectedItemsReserveDetails); }
  get selectedAvailableReserve(): number { return computeAvailableReserve(this.selectedItemsReserveDetails); }
  get selectedOrderedQuantity(): number { return computeOrderedQuantity(this.selectedItemsReserveDetails); }
  get selectedUsedQuantity(): number { return computeUsedQuantity(this.selectedItemsReserveDetails); }

  // ---- Lifecycle ----------------------------------------------------------

  init(): void {
    this.initializeUserContext();
    this.initializeStepFromQueryParams();
    this.loadRequestPurposes();

    this.filterOptions.weaponTypeOptions = getWeaponTypeOptions();
    this.filterOptions.explosiveTypeOptions = getExplosiveTypeOptions();

    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.rebuildRequestPurposeOptions();
      this.updateUsePurposeFromSelection(this.requestPurposeState.selectedRequestPurposeId);
      this.syncRequesterNameFromUserDetails();
      this.cdr.markForCheck();
    });

    this.requestServerRefilter = this.catalogOrchestrator.setupFilterDebounce(
      () => this.catalogCtx,
      this.destroy$,
      () => this.catalogHooks
    );
  }

  destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  afterViewInit(): void {
    setTimeout(() => this.onboardingTourService?.checkAndStartPageTour('issue-request'), 300);
  }

  // ---- Catalog context ----------------------------------------------------

  private get catalogCtx(): CatalogOrchestratorContext {
    return {
      cartridgeState: this.cartridgeState,
      filterState: this.filterState,
      filterOptions: this.filterOptions,
      fromReserve: this.fromReserve,
      departmentId: this.userContextState.currentUserDepartmentId,
      cdr: this.cdr
    };
  }

  private get catalogHooks(): CatalogLoadHooks {
    return {
      onAfterLoad: () => {
        if (this.fromReserve === 'Yes' && this.userContextState.currentUserDepartmentId) {
          this.loadReserveDetails();
        }
      },
      onLoadSuccess: () => {
        if (this.pendingSelections) {
          this.catalogOrchestrator.restoreSelections(this.pendingSelections, this.catalogCtx);
          this.pendingSelections = null;
        }
      }
    };
  }

  private loadCartridges(): void {
    this.catalogOrchestrator.loadCartridges(this.catalogCtx, this.catalogHooks);
  }

  // ---- Public catalog actions ---------------------------------------------

  retryLoadCartridges(): void {
    if (!this.cartridgeState.loadingCartridges && !this.cartridgeState.catalogPageLoading) {
      this.loadCartridges();
    }
  }

  applyCatalogSearch(searchTerm?: string): void {
    this.catalogOrchestrator.applyCatalogSearch(searchTerm, this.catalogCtx, this.catalogHooks);
  }

  onCatalogPageNext(): void { this.catalogOrchestrator.onCatalogPageNext(this.catalogCtx, this.catalogHooks); }
  onCatalogPagePrev(): void { this.catalogOrchestrator.onCatalogPagePrev(this.catalogCtx, this.catalogHooks); }

  onFilterSidebarChange(): void {
    this.requestServerRefilter();
  }

  onClearFilters(): void { this.catalogOrchestrator.handleClearFilters(this.catalogCtx, this.catalogHooks); }
  onItemTypeChange(value: string): void { this.catalogOrchestrator.handleItemTypeChange(value, this.catalogCtx, this.catalogHooks); }

  onFromReserveChange(value: string): void {
    if (this.fromReserve === value) return;
    this.fromReserve = value;
    this.updateQueryParams(this.currentStep);
    this.cdr.markForCheck();
    if (this.currentStep >= 1) this.loadCartridges();
  }

  // ---- Selection actions (inlined from IssueRequestCartridgeManagementService) --

  onCartridgeAdded(event: { cartridge: Cartridge; quantity: number }): void {
    const { cartridge, quantity } = event;
    this.cartridgeState.selectedCartridgesCache.set(cartridge.id, { ...cartridge });
    this.addCartridge(cartridge, quantity);
    this.stateService.persistSelections(this.cartridgeState.selectedEntries);

    if (hasWeaponInSelection([cartridge]) && this.requestPurposeState.selectedRequestPurposeId === TRAINING_ORDER_ID) {
      this.requestPurposeState.selectedRequestPurposeId = null;
      this.usageFormData.usePurpose = '';
    }
    this.cdr.markForCheck();
  }

  onRemoveSelectedCartridge(cartridgeId: number): void {
    this.cartridgeState.selectedCartridgesCache.delete(cartridgeId);
    this.removeCartridge(cartridgeId);
    this.weaponAssociationState.associations.delete(cartridgeId);
    this.stateService.persistSelections(this.cartridgeState.selectedEntries);
    this.cdr.markForCheck();
  }

  private addCartridge(cartridge: Cartridge, quantity: number): void {
    if (!cartridge.itemType) cartridge.itemType = inferCartridgeItemType(cartridge) || undefined;
    const idx = this.cartridgeState.selectedEntries.findIndex(e => e.id === cartridge.id);
    if (idx >= 0) {
      this.cartridgeState.selectedEntries[idx].quantity = quantity;
      this.cartridgeState.selectedEntries[idx].itemType = cartridge.itemType;
    } else {
      this.cartridgeState.selectedEntries.push({ id: cartridge.id, quantity, itemType: cartridge.itemType });
    }
    const target = this.cartridgeState.allCartridges.find(c => c.id === cartridge.id);
    if (target) { target.added = true; target.selected = false; target.quantity = quantity; target.itemType = cartridge.itemType; }
  }

  private removeCartridge(cartridgeId: number): void {
    this.cartridgeState.selectedEntries = this.cartridgeState.selectedEntries.filter(e => e.id !== cartridgeId);
    const target = this.cartridgeState.allCartridges.find(c => c.id === cartridgeId);
    if (target) { target.selected = false; target.added = false; target.quantity = null; }
  }

  // ---- Step navigation (inlined from IssueRequestNavigationService) -------

  /** Maps stepper UI index to internal `currentStep` when weapon step is hidden. */
  onStepperStepChange(displayIndex: number): void {
    const internal = this.hasAmmunitionSelected
      ? displayIndex
      : displayIndex <= 1
        ? displayIndex
        : displayIndex + 1;
    this.applyInternalStepChange(internal);
  }

  /** Direct internal step (e.g. tests); prefer `onStepperStepChange` from the stepper UI. */
  onStepChange(step: number): void {
    this.applyInternalStepChange(step);
  }

  private applyInternalStepChange(step: number): void {
    this.currentStep = step;
    this.updateQueryParams(step);
    if (step === 2 && this.hasAmmunitionSelected) {
      this.onLoadWeaponAssociationStep();
    }
    this.cdr.markForCheck();
    scrollShellContentToTop();
  }

  onConfirmAllowanceSelection(): void {
    if (this.fromReserve === 'No' && this.filterState.selectedItemType === 'Weapon') {
      this.filterState.selectedItemType = 'Ammunition';
    }
    this.steps[0].completed = true;
    this.currentStep = 1;
    this.updateQueryParams(1);
    this.cdr.markForCheck();
    scrollShellContentToTop();
    this.loadCartridges();
  }

  onNext(): void {
    if (this.orderSubmissionState.submittingOrder) return;

    if (this.currentStep === 0) {
      this.onConfirmAllowanceSelection();
      return;
    }

    if (this.currentStep === 1) {
      if (!this.canProceedFromSelection) return;
      this.steps[1].completed = true;
      if (this.hasAmmunitionSelected) {
        this.currentStep = 2;
        this.onLoadWeaponAssociationStep();
      } else {
        this.currentStep = 3;
      }
      this.updateQueryParams(this.currentStep);
      this.cdr.markForCheck();
      scrollShellContentToTop();
      return;
    }

    if (this.currentStep === 2) {
      if (!this.canProceedFromWeaponAssociation) return;
      this.steps[2].completed = true;
      this.currentStep = 3;
      this.updateQueryParams(3);
      this.cdr.markForCheck();
      scrollShellContentToTop();
      return;
    }

    if (this.currentStep === 4) {
      this.onSubmitOrder();
      return;
    }

    if (this.currentStep < this.steps.length - 1) {
      this.steps[this.currentStep].completed = true;
      this.currentStep++;
      this.updateQueryParams(this.currentStep);
      this.cdr.markForCheck();
      scrollShellContentToTop();
    }
  }

  onPrevious(): void {
    if (this.currentStep === 3 && !this.hasAmmunitionSelected) {
      this.currentStep = 1;
    } else if (this.currentStep > 0) {
      this.currentStep--;
    }
    this.updateQueryParams(this.currentStep);
    this.cdr.markForCheck();
    scrollShellContentToTop();
  }

  onLoadWeaponAssociationStep(): void {
    const rawIds = this.ammunitionCartridges.map(c => resolveCatalogItemCaliberId(c));
    const distinctSorted = [
      ...new Set(
        rawIds.filter((id): id is number => id != null && Number.isFinite(id) && id > 0)
      )
    ].sort((a, b) => a - b);
    const key = distinctSorted.join(',');

    if (this.weaponAssociationLoadedKey === key) {
      return;
    }

    const seq = ++this.weaponAssociationLoadSeq;

    if (distinctSorted.length === 0) {
      this.weaponAssociationLoadedKey = key;
      this.weaponAssociationState.weaponsByAmmunitionCaliberId = new Map();
      this.weaponAssociationState.loadingWeapons = true;
      this.weaponAssociationState.weaponLoadError = null;
      this.cdr.markForCheck();

      this.weaponService.getAll().pipe(takeUntil(this.destroy$)).subscribe({
        next: (weapons) => {
          if (seq !== this.weaponAssociationLoadSeq) return;
          this.weaponAssociationState.allWeapons = (weapons ?? []).filter(
            w => !isCatalogItemExplicitlyDeleted(w)
          );
          this.weaponAssociationState.loadingWeapons = false;
          this.cdr.markForCheck();
        },
        error: () => {
          if (seq !== this.weaponAssociationLoadSeq) return;
          this.weaponAssociationState.weaponLoadError =
            'Failed to load weapons. Please try again.';
          this.weaponAssociationState.allWeapons = [];
          this.weaponAssociationState.loadingWeapons = false;
          this.cdr.markForCheck();
        }
      });
      return;
    }

    this.weaponAssociationState.loadingWeapons = true;
    this.weaponAssociationState.weaponLoadError = null;
    this.cdr.markForCheck();

    forkJoin({
      groups: this.weaponService.getForAmmunitionAssociation(distinctSorted),
      weapons: this.weaponService.getAll()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ groups, weapons }) => {
          if (seq !== this.weaponAssociationLoadSeq) return;

          const byCal = new Map<number, WeaponDto[]>();
          for (const g of groups) {
            const calId = Number(g.ammunitionCaliberId);
            byCal.set(calId, g.weapons ?? []);
          }

          this.weaponAssociationState.weaponsByAmmunitionCaliberId = byCal;
          this.weaponAssociationState.allWeapons = (weapons ?? []).filter(
            w => !isCatalogItemExplicitlyDeleted(w)
          );
          this.weaponAssociationState.loadingWeapons = false;
          this.weaponAssociationLoadedKey = key;
          this.cdr.markForCheck();
        },
        error: () => {
          if (seq !== this.weaponAssociationLoadSeq) return;
          this.weaponAssociationState.weaponLoadError =
            'Failed to load weapons. Please try again.';
          this.weaponAssociationState.allWeapons = [];
          this.weaponAssociationState.loadingWeapons = false;
          this.cdr.markForCheck();
        }
      });
  }

  onAssociateCatalogWeapons(event: {
    ammoItemId: number;
    weaponIds: number[];
    caliberId: number | null;
  }): void {
    const uniq = [...new Set(event.weaponIds.filter(id => id > 0))].sort((a, b) => a - b);
    const existing = this.weaponAssociationState.associations.get(event.ammoItemId) ?? [];
    const existingCatalogIds = existing
      .filter(a => a.type === 'catalog' && a.weaponItemId != null)
      .map(a => a.weaponItemId as number)
      .sort((a, b) => a - b);

    if (
      existingCatalogIds.length === uniq.length &&
      existingCatalogIds.every((id, i) => id === uniq[i])
    ) {
      return;
    }

    // Preserve any 'other' (custom) entries already associated with this ammo line.
    const preservedOtherEntries = existing.filter(a => a.type === 'other');
    const catalogEntries: WeaponAssociation[] = uniq.map(wid => {
      const w = this.weaponAssociationState.allWeapons.find(x => x.id === wid);
      return {
        type: 'catalog',
        weaponItemId: wid,
        caliberId: event.caliberId,
        weaponName: w?.name ?? null
      };
    });
    const merged = [...preservedOtherEntries, ...catalogEntries];

    this.replaceWeaponAssociations(map => {
      if (merged.length === 0) {
        map.delete(event.ammoItemId);
      } else {
        map.set(event.ammoItemId, merged);
      }
    });
  }

  onAssociateOtherWeapon(event: {
    ammoItemId: number;
    otherName: string;
    caliberId: number | null;
  }): void {
    const name = (event.otherName ?? '').trim();
    const existing = this.weaponAssociationState.associations.get(event.ammoItemId) ?? [];
    const existingOther = existing.find(a => a.type === 'other');
    const existingOtherName = (existingOther?.otherName ?? '').trim();

    if (existingOtherName === name) {
      return;
    }

    // Preserve any 'catalog' entries already associated with this ammo line.
    const preservedCatalogEntries = existing.filter(a => a.type === 'catalog');
    const otherEntries: WeaponAssociation[] = name
      ? [
          {
            type: 'other',
            otherName: name,
            caliberId: event.caliberId
          }
        ]
      : [];
    const merged = [...preservedCatalogEntries, ...otherEntries];

    this.replaceWeaponAssociations(map => {
      if (merged.length === 0) {
        map.delete(event.ammoItemId);
      } else {
        map.set(event.ammoItemId, merged);
      }
    });
  }

  onClearWeaponAssociation(ammoItemId: number): void {
    this.replaceWeaponAssociations(map => {
      map.delete(ammoItemId);
    });
  }

  private replaceWeaponAssociations(
    mutator: (map: Map<number, WeaponAssociation[]>) => void
  ): void {
    const next = new Map(this.weaponAssociationState.associations);
    mutator(next);
    this.weaponAssociationState.associations = next;
    this.cdr.markForCheck();
  }

  onUsePurposeIdChange(value: number | null): void {
    this.requestPurposeState.selectedRequestPurposeId = value;
    this.updateUsePurposeFromSelection(value);
  }

  // ---- Submission actions -------------------------------------------------

  onSubmitOrder(): void {
    if (this.orderSubmissionState.submittingOrder) return;

    const validation = this.submissionService.validateSubmission(this.buildSubmissionContext());
    if (!validation.isValid) {
      this.orderSubmissionState.orderSubmitError = validation.error ?? 'Validation failed';
      this.currentStep = 4;
      this.updateQueryParams(4);
      this.cdr.markForCheck();
      scrollShellContentToTop();
      return;
    }

    this.submissionService.loadConfirmationDialogConfig().subscribe(config => {
      this.confirmDialogConfig = config;
      this.showConfirmDialog = true;
      this.cdr.markForCheck();
    });
  }

  onConfirmSubmit(): void {
    this.showConfirmDialog = false;
    this.cdr.markForCheck();
    this.submissionService.runSubmission(this.buildSubmissionContext(), {
      onSuccess: (orderId, orderNumber) => {
        this.orderSubmissionState.createdOrderId = orderId;
        this.orderSubmissionState.orderNumber = orderNumber;
        this.orderSubmissionState.orderSubmitted = true;
        this.steps[4].completed = true;
        this.steps[5].completed = true;
        this.currentStep = 5;
        this.updateQueryParams(5);
        this.cdr.markForCheck();
        scrollShellContentToTop();
      },
      onValidationFailure: (message) => {
        this.orderSubmissionState.orderSubmitError = message;
        this.currentStep = 4;
        this.updateQueryParams(4);
        this.cdr.markForCheck();
        scrollShellContentToTop();
      },
      onTransportError: (message) => {
        this.orderSubmissionState.orderSubmitError = message;
        this.currentStep = 4;
        this.updateQueryParams(4);
        this.cdr.markForCheck();
        scrollShellContentToTop();
      }
    });
  }

  onCancelConfirm(): void {
    this.showConfirmDialog = false;
    this.cdr.markForCheck();
  }

  onTrackOrder(): void {
    this.resetForm();
    this.router.navigate(['/dashboard']);
  }

  // ---- Private helpers ----------------------------------------------------

  private buildSubmissionContext() {
    return {
      cartridgeState: this.cartridgeState,
      requestPurposeState: this.requestPurposeState,
      usageFormData: this.usageFormData,
      reviewFormData: this.reviewFormData,
      fromReserve: this.fromReserve,
      currentUserDepartmentId: this.userContextState.currentUserDepartmentId,
      defaultDepartmentId: this.DEFAULT_DEPARTMENT_ID,
      defaultRequestPurposeId: this.DEFAULT_REQUEST_PURPOSE_ID,
      defaultRequestTypeId: this.DEFAULT_REQUEST_TYPE_ID,
      files: this.usageFormFiles,
      orderSubmissionState: this.orderSubmissionState,
      weaponAssociations: this.weaponAssociationState.associations
    };
  }

  // User context (inlined from IssueRequestUserContextService)
  private initializeUserContext(): void {
    this.userContextState.isAdminUser = this.userContextService.isAdminUser();
    this.userContextState.lockRequesterName = !this.userContextState.isAdminUser;

    this.backendAuthService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      const context = applyAuthenticatedUserContextUtil(user, this.userContextState);
      if (context) {
        applyUserContextUtil(context, this.userContextState);
        if (!this.userContextState.currentUserDetails) this.syncRequesterNameFromUserDetails();
      }
    });

    this.userContextService.getCurrentUserDetails().pipe(takeUntil(this.destroy$)).subscribe(details => {
      this.userContextState.currentUserDetails = details;
      this.syncRequesterNameFromUserDetails();
    });
  }

  private initializeStepFromQueryParams(): void {
    this.stateService.getQueryParamsState(this.steps.length).pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params.step === 5 && !this.orderSubmissionState.orderSubmitted) {
        this.resetForm(); this.clearQueryParams(); this.cdr.markForCheck(); return;
      }
      if (this.orderSubmissionState.orderSubmitted && params.step === 0) {
        this.resetForm();
        if (this.route.snapshot.queryParamMap.keys.length > 0) { this.clearQueryParams(); this.cdr.markForCheck(); return; }
      }

      this.currentStep = params.step;
      this.fromReserve = params.fromReserve;
      this.pendingSelections = params.pendingSelections;

      if (this.currentStep === 2 && !this.hasAmmunitionSelected) {
        this.currentStep = 1;
        this.updateQueryParams(this.currentStep);
      }

      if (params.step >= 1 && this.cartridgeState.allCartridges.length === 0 && !this.cartridgeState.loadingCartridges) {
        this.loadCartridges();
      }
      if (this.currentStep === 2 && this.hasAmmunitionSelected) {
        this.onLoadWeaponAssociationStep();
      }
      if (params.step === 4) this.syncRequesterNameFromUserDetails();
      this.cdr.markForCheck();
      scrollShellContentToTop();
    });
  }

  private updateQueryParams(step: number): void {
    this.stateService.updateQueryParams(step, this.fromReserve, this.cartridgeState.selectedEntries);
  }

  private clearQueryParams(): void {
    this.router.navigate(['/requests/new-issue-request'], { queryParams: {}, replaceUrl: true });
  }

  private loadReserveDetails(): void {
    if (!this.userContextState.currentUserDepartmentId) return;
    this.reserveDetailsState.loadingReserveDetails = true;
    this.cdr.markForCheck();
    this.cartridgeDataService.loadReserveDetails(this.userContextState.currentUserDepartmentId).subscribe({
      next: (result) => {
        Object.assign(this.reserveDetailsState, result);
        this.reserveDetailsState.loadingReserveDetails = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.reserveDetailsState.loadingReserveDetails = false;
        this.reserveDetailsState.reserveDetailsByItem = [];
        this.cdr.markForCheck();
      }
    });
  }

  private loadRequestPurposes(): void {
    this.requestPurposeState.loadingRequestPurposes = true;
    this.cdr.markForCheck();
    this.submissionService.loadRequestPurposes().pipe(takeUntil(this.destroy$)).subscribe({
      next: (purposes) => {
        this.requestPurposeState.requestPurposesSource = purposes;
        this.rebuildRequestPurposeOptions();
        this.requestPurposeState.loadingRequestPurposes = false;
        this.updateUsePurposeFromSelection(this.requestPurposeState.selectedRequestPurposeId);
        this.cdr.markForCheck();
      },
      error: () => {
        this.requestPurposeState.requestPurposesSource = [];
        this.requestPurposeState.requestPurposeOptions = [];
        this.requestPurposeState.loadingRequestPurposes = false;
        this.updateUsePurposeFromSelection(null);
        this.cdr.markForCheck();
      }
    });
  }

  private rebuildRequestPurposeOptions(): void {
    this.requestPurposeOptionsMap = this.submissionService.rebuildRequestPurposeOptions(this.requestPurposeState);
  }

  private updateUsePurposeFromSelection(id: number | null): void {
    this.submissionService.updateUsePurposeFromSelection(id, this.requestPurposeOptionsMap, this.usageFormData);
  }

  private syncRequesterNameFromUserDetails(): void {
    const lang = this.translate.currentLang || 'en';
    this.reviewFormData.requesterName = syncRequesterNameUtil(this.userContextState.currentUserDetails, lang);
  }

  private resetForm(): void {
    this.weaponAssociationLoadSeq++;
    this.weaponAssociationLoadedKey = null;
    this.currentStep = 0;
    this.steps.forEach(s => (s.completed = false));
    this.filterState = createInitialFilterState();
    this.cartridgeState = createInitialCartridgeState();
    this.fromReserve = 'Yes';
    this.usageFormData = createInitialUsageFormData();
    this.usageFormFiles = [];
    this.requestPurposeState.selectedRequestPurposeId = null;
    this.updateUsePurposeFromSelection(null);
    this.reserveDetailsState = createInitialReserveDetailsState();
    this.allowanceError = null;
    this.showConfirmDialog = false;
    this.orderSubmissionState = createInitialOrderSubmissionState();
    this.reviewFormData = createInitialReviewFormData();
    this.pendingSelections = null;
    this.weaponAssociationState = createInitialWeaponAssociationState();
    this.syncRequesterNameFromUserDetails();
    scrollShellContentToTop();
  }
}
