import {
  ChangeDetectorRef,
  Injectable,
  Optional,
  Inject,
  inject
} from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil, debounceTime, of, throwError, Observable } from 'rxjs';
import { catchError, finalize, map, switchMap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';

import { DropdownOption } from '@components/dropdown/dropdown.component';
import { ReturnService } from '@requests/services/return.service';
import { AmmunitionService } from '@assets/services/ammunition.service';
import { WeaponService } from '@assets/services/weapon.service';
import { ExplosiveService } from '@assets/services/explosive.service';
import { CartridgeDataService } from '@assets/services/cartridge-data.service';
import { ToastService } from '@services/toast.service';
import { ApiService } from '@services/api.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { UserContextService } from '@services/user-context.service';
import { ONBOARDING_TOUR } from '@core/tokens/onboarding-tour.token';
import { IOnboardingTourProvider } from '@core/interfaces/onboarding-tour-provider.interface';
import { IssueRequestFilterService } from '@requests/pages/new-issue/services/issue-request-filter.service';

import { Step } from '@components/stepper/stepper.component';
import { API_ENDPOINTS } from '@constants/app.constants';
import { PaginatedList, PagedRequest } from '@models/api-response.model';
import { CreateReturnDto } from '@models/return.model';
import { Cartridge } from '@models/cartridge.model';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { getFileSizeFromFile, removeFile, validateFile, showFileValidationErrors } from '@utils/file.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { scrollShellContentToTop } from '@utils/scroll-shell-content-to-top.util';
import { getWeaponTypeOptions } from '@utils/weapon.utils';
import { getExplosiveTypeOptions } from '@utils/explosive.utils';
import {
  createInitialFilterState,
  createInitialFilterOptions,
  createInitialCartridgeState,
  createInitialCatalogPagination,
  createInitialUserContextState,
  ExtendedFilterState,
  ExtendedFilterOptions,
  CartridgeState
} from '@requests/pages/new-issue/new-issue-request.state';

import {
  buildAmmunitionPagedRequest,
  buildWeaponPagedRequest,
  buildExplosivePagedRequest
} from '@requests/utils/catalog-paged-request.builder';
import {
  catalogListItemToCartridge,
  mergeReturnSelectionsIntoFilteredView,
  returnSelectedItemToCartridge
} from '@requests/utils/return-catalog-to-cartridge.util';
import {
  applyAuthenticatedUserContext,
  applyUserContext,
  getDepartmentIdForRequest,
  resolveCurrentRequesterName,
  resolveRequesterDepartmentDisplay,
  syncRequesterNameFromUserDetails
} from '@requests/utils/issue-request.utils';

import {
  ReturnItemType,
  CatalogListItem,
  ReturnSelectedItem,
  RequestPurpose,
  createInitialSelectionState,
  createInitialDetailsState,
  createInitialLookupState,
  createInitialSubmissionState,
  createInitialConfirmDialogConfig,
  createInitialSuccessState
} from '../return-request.state';

import {
  createInitialAttachmentUploadsState,
  type AttachmentRequirementDto,
  type AttachmentUploadsState
} from '@requests/pages/new-issue/new-issue-request.state';

const CATALOG_FILTER_DEBOUNCE_MS = 350;
const DEFAULT_DEPARTMENT_ID = 1;

@Injectable()
export class ReturnRequestFacade {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private readonly filterApply$ = new Subject<void>();

  // ---- Stepper -------------------------------------------------------------
  currentStep = 0;

  readonly steps: Step[] = [
    { label: 'returnRequest.steps.selection', completed: false },
    { label: 'returnRequest.steps.details', completed: false },
    { label: 'returnRequest.steps.review', completed: false },
    { label: 'newIssueRequest.send', completed: false }
  ];

  // ---- Feature state -------------------------------------------------------
  selectionState = createInitialSelectionState();
  detailsState = createInitialDetailsState();
  userContextState = createInitialUserContextState();
  lookupState = createInitialLookupState();
  submissionState = createInitialSubmissionState();
  successState = createInitialSuccessState();
  confirmDialogConfig = createInitialConfirmDialogConfig();

  /** Same shapes as new-issue step-selection / cartridge-list (server-side catalog). */
  filterState: ExtendedFilterState = createInitialFilterState();
  filterOptions: ExtendedFilterOptions = createInitialFilterOptions();
  cartridgeState: CartridgeState = createInitialCartridgeState();

  readonly priorityOptions = [
    { value: 1, labelKey: 'common.priorityLevels.Normal' },
    { value: 2, labelKey: 'common.priorityLevels.Urgent' },
    { value: 3, labelKey: 'common.priorityLevels.VeryUrgent' }
  ];

  /** Attachment slots for the currently selected request purpose (ordered). */
  get selectedAttachmentRequirements(): AttachmentRequirementDto[] {
    const id = this.detailsState.requestPurposeId;
    if (id == null) return [];
    const purpose = this.lookupState.requestPurposes.find((p) => p.id === id);
    const reqs = purpose?.attachmentRequirements ?? [];
    return [...reqs].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  }

  constructor(
    private readonly returnService: ReturnService,
    private readonly ammunitionService: AmmunitionService,
    private readonly weaponService: WeaponService,
    private readonly explosiveService: ExplosiveService,
    private readonly cartridgeDataService: CartridgeDataService,
    private readonly filterService: IssueRequestFilterService,
    private readonly toastService: ToastService,
    private readonly apiService: ApiService,
    private readonly translate: TranslateService,
    private readonly router: Router,
    private readonly backendAuthService: BackendAuthService,
    private readonly userContextService: UserContextService,
    @Optional() @Inject(ONBOARDING_TOUR) private readonly onboardingTourService: IOnboardingTourProvider | null
  ) {}

  get currentRequesterName(): string {
    return resolveCurrentRequesterName(
      this.userContextState.currentUserDetails,
      this.userContextState.fallbackRequesterName,
      '',
      getCurrentLang(this.translate)
    );
  }

  get currentRequesterDepartmentDisplay(): string {
    return resolveRequesterDepartmentDisplay(
      this.userContextState.currentUserDetails,
      getCurrentLang(this.translate)
    );
  }

  // ---- Lifecycle -----------------------------------------------------------

  init(): void {
    this.filterState.selectedItemType = this.selectionState.selectedItemType;
    this.filterOptions.weaponTypeOptions = getWeaponTypeOptions();
    this.filterOptions.explosiveTypeOptions = getExplosiveTypeOptions();
    this.initializeUserContext();

    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.syncRequesterNameFromUserDetails();
      this.cdr.markForCheck();
    });

    this.filterApply$
      .pipe(debounceTime(CATALOG_FILTER_DEBOUNCE_MS), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.cartridgeState.catalogPageLoading || this.cartridgeState.loadingCartridges) return;
        this.cartridgeState.catalogPagination.page = 1;
        this.loadCatalogPage(1, 'overlay');
      });

    this.loadRequestPurposes();
    this.loadCartridgesInitial();
  }

  destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  afterViewInit(): void {
    setTimeout(() => this.onboardingTourService?.checkAndStartPageTour('return-request'), 300);
  }

  // ---- Stepper navigation --------------------------------------------------

  get stepperSteps(): Step[] {
    return this.steps;
  }

  get stepperCurrentStep(): number {
    return this.currentStep;
  }

  onStepperStepChange(index: number): void {
    if (index >= 0 && index < this.steps.length) {
      this.currentStep = index;
      this.cdr.markForCheck();
      scrollShellContentToTop();
    }
  }

  onNext(): void {
    if (this.currentStep === 1 && !this.canProceedFromCurrentStep()) {
      this.submissionState.errors = {};
      this.setDetailsStepValidationErrors();
      this.submissionState.hasAttemptedSubmit = true;
      this.submissionState.isSubmitted = true;
      this.cdr.markForCheck();
      return;
    }
    if (!this.canProceedFromCurrentStep()) return;
    if (this.currentStep < this.steps.length - 1) {
      if (this.currentStep === 1) {
        this.submissionState.errors = {};
        this.submissionState.isSubmitted = false;
        this.submissionState.hasAttemptedSubmit = false;
      }
      this.steps[this.currentStep].completed = true;
      this.currentStep++;
      if (this.currentStep === 2) {
        this.syncRequesterNameFromUserDetails();
      }
      this.cdr.markForCheck();
      scrollShellContentToTop();
    }
  }

  onPrevious(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.cdr.markForCheck();
      scrollShellContentToTop();
    }
  }

  canProceedFromCurrentStep(): boolean {
    switch (this.currentStep) {
      case 0:
        return this.selectionState.selectedItems.length > 0;
      case 1:
        return (
          !!this.detailsState.requestPurposeId &&
          !!this.detailsState.requestPurposeNotes.trim() &&
          this.attachmentsSatisfied()
        );
      default:
        return true;
    }
  }

  get canProceedFromSelection(): boolean {
    return this.selectionState.selectedItems.length > 0;
  }

  get displayedItemTypeOptions(): string[] {
    return [...this.filterOptions.itemTypeOptions];
  }

  /** `CartridgeListComponent` selected rows — built from return line items. */
  get selectedCartridges(): Cartridge[] {
    return this.selectionState.selectedItems.map((i) =>
      returnSelectedItemToCartridge(i, i.itemType || this.filterState.selectedItemType)
    );
  }

  // ---- Shared step-selection catalog API (matches new-issue wiring) --------

  retryLoadCartridges(): void {
    if (!this.cartridgeState.loadingCartridges && !this.cartridgeState.catalogPageLoading) {
      this.loadCartridgesInitial();
    }
  }

  applyCatalogSearch(searchTerm?: string): void {
    if (this.cartridgeState.catalogPageLoading || this.cartridgeState.loadingCartridges) return;
    if (searchTerm !== undefined) this.filterState.searchTerm = searchTerm;
    this.cartridgeState.catalogPagination.page = 1;
    this.loadCatalogPage(1, 'overlay');
  }

  onCatalogPageNext(): void {
    if (!this.cartridgeState.catalogPagination.hasNextPage) return;
    if (this.cartridgeState.catalogPageLoading || this.cartridgeState.loadingCartridges) return;
    this.loadCatalogPage(this.cartridgeState.catalogPagination.page + 1, 'overlay');
  }

  onCatalogPagePrev(): void {
    if (!this.cartridgeState.catalogPagination.hasPreviousPage) return;
    if (this.cartridgeState.catalogPageLoading || this.cartridgeState.loadingCartridges) return;
    this.loadCatalogPage(this.cartridgeState.catalogPagination.page - 1, 'overlay');
  }

  onFilterSidebarChange(): void {
    this.filterApply$.next();
  }

  onClearFilters(): void {
    this.filterService.clearFilters(this.filterState, this.filterState.selectedItemType);
    if (this.cartridgeState.catalogPageLoading || this.cartridgeState.loadingCartridges) return;
    this.cartridgeState.catalogPagination.page = 1;
    this.loadCatalogPage(1, 'overlay');
  }

  onStepSelectionItemTypeChange(value: string): void {
    if (this.filterState.selectedItemType === value) return;
    this.filterState.selectedItemType = value;
    this.selectionState.selectedItemType = value as ReturnItemType;
    this.filterService.clearFilters(this.filterState, value);
    if (value !== 'Ammunition') {
      this.filterOptions.bulletDiameters = [];
      this.filterOptions.natureOptions = [];
    }
    this.loadCartridgesInitial();
  }

  onCartridgeAdded(event: { cartridge: Cartridge; quantity: number }): void {
    const { cartridge, quantity } = event;
    const itemId = cartridge.id;
    const name = cartridge.name || String(cartridge.itemNo || '');
    const nameAr = cartridge.nameAr ?? null;
    const nameEn = cartridge.nameEn ?? null;
    const itemNo = String(cartridge.itemNo || '');
    const itemType = cartridge.itemType || this.filterState.selectedItemType;
    const existing = this.selectionState.selectedItems.find((x) => x.itemId === itemId);
    if (existing) {
      existing.quantity = quantity;
      existing.name = name;
      existing.nameAr = nameAr;
      existing.nameEn = nameEn;
      existing.itemNo = itemNo;
      existing.itemType = itemType;
    } else {
      this.selectionState.selectedItems = [
        ...this.selectionState.selectedItems,
        { itemId, name, nameAr, nameEn, itemNo, quantity, notes: '', itemType }
      ];
    }
    this.refreshMergedList();
    this.cdr.markForCheck();
  }

  removeItem(itemId: number): void {
    this.selectionState.selectedItems = this.selectionState.selectedItems.filter((i) => i.itemId !== itemId);
    this.refreshMergedList();
    this.cdr.markForCheck();
  }

  updateItemNotes(itemId: number, notes: string): void {
    const item = this.selectionState.selectedItems.find((i) => i.itemId === itemId);
    if (item) item.notes = notes;
  }

  readonly requestPurposeOptionLabel = (
    option: DropdownOption<RequestPurpose> | RequestPurpose | null | undefined
  ): string => {
    if (!option) return '';
    const p: RequestPurpose | null = 'value' in option ? (option as DropdownOption<RequestPurpose>).value : (option as RequestPurpose);
    if (!p) return '';
    return getLocalizedName(p, getCurrentLang(this.translate));
  };

  // ---- Step 1: details -----------------------------------------------------

  onRequestPurposeChange(): void {
    this.detailsState.attachmentUploads = createInitialAttachmentUploadsState();
    this.detailsState.selectedFiles = [];
    this.clearError('requestPurposeId');
    this.clearError('attachmentRequirements');
    this.clearError('selectedFiles');
    if (!this.detailsState.requestPurposeId) {
      this.detailsState.requestPurposeNotes = '';
      this.clearError('requestPurposeNotes');
    }
  }

  onAttachmentUploadsChange(state: AttachmentUploadsState): void {
    this.detailsState.attachmentUploads = state;
    this.clearError('attachmentRequirements');
    this.cdr.markForCheck();
  }

  onRequestPurposeNotesChange(): void {
    this.clearError('requestPurposeNotes');
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const newFiles = Array.from(input.files);
    const invalidFiles: string[] = [];
    const validFiles: File[] = [];
    newFiles.forEach((file) => {
      const v = validateFile(file);
      v.isValid ? validFiles.push(file) : invalidFiles.push(v.errorMessage);
    });
    if (invalidFiles.length) showFileValidationErrors(this.translate, this.toastService, invalidFiles, 'returnRequest');
    if (validFiles.length) {
      this.detailsState.selectedFiles = [...this.detailsState.selectedFiles, ...validFiles];
      this.clearError('selectedFiles');
    }
    input.value = '';
    this.cdr.markForCheck();
  }

  removeFile(index: number, fileInputElement: HTMLInputElement | null): void {
    removeFile(this.detailsState.selectedFiles, index, fileInputElement);
    if (this.detailsState.selectedFiles.length > 0) {
      this.clearError('selectedFiles');
    }
    this.cdr.markForCheck();
  }

  readonly getFileSize = getFileSizeFromFile;

  private attachmentsSatisfied(): boolean {
    if (this.selectedAttachmentRequirements.length === 0) {
      return this.detailsState.selectedFiles.some((f) => f instanceof File && f.size > 0);
    }
    for (const req of this.selectedAttachmentRequirements) {
      const files = (this.detailsState.attachmentUploads.filesByRequirementId.get(req.id) ?? []).filter(
        (f) => f instanceof File && f.size > 0
      );
      if (req.isRequired && files.length < req.minCount) return false;
      if (files.length > req.maxCount) return false;
    }
    return true;
  }

  /** Purpose / notes / files only — used by details Next and final submit. */
  private setDetailsStepValidationErrors(): void {
    delete this.submissionState.errors['selectedFiles'];
    delete this.submissionState.errors['attachmentRequirements'];

    if (!this.detailsState.requestPurposeId) {
      this.submissionState.errors['requestPurposeId'] = this.translate.instant(
        'returnRequest.errors.requestPurposeRequired'
      );
    }
    if (this.detailsState.requestPurposeId && !this.detailsState.requestPurposeNotes.trim()) {
      this.submissionState.errors['requestPurposeNotes'] = this.translate.instant(
        'returnRequest.errors.requestPurposeNotesRequired'
      );
    }

    if (this.selectedAttachmentRequirements.length > 0) {
      let invalid = false;
      for (const req of this.selectedAttachmentRequirements) {
        const files = (this.detailsState.attachmentUploads.filesByRequirementId.get(req.id) ?? []).filter(
          (f) => f instanceof File && f.size > 0
        );
        if (req.isRequired && files.length < req.minCount) invalid = true;
        if (files.length > req.maxCount) invalid = true;
      }
      if (invalid) {
        this.submissionState.errors['attachmentRequirements'] = this.translate.instant(
          'newIssueRequest.validation.attachmentRequirementsInvalid'
        );
      }
    } else if (!this.detailsState.selectedFiles.some((f) => f instanceof File && f.size > 0)) {
      this.submissionState.errors['selectedFiles'] = this.translate.instant(
        'newIssueRequest.validation.attachmentsRequired'
      );
    }
  }

  // ---- Step 2: submit ------------------------------------------------------

  onSubmit(): void {
    this.submissionState.hasAttemptedSubmit = true;
    this.submissionState.isSubmitted = true;
    this.submissionState.errors = {};

    if (this.selectionState.selectedItems.length === 0) {
      this.submissionState.errors['selectedItems'] = 'At least one item is required';
    }
    this.setDetailsStepValidationErrors();

    if (Object.keys(this.submissionState.errors).length > 0) {
      this.cdr.markForCheck();
      return;
    }

    this.translate
      .get(['returnRequest.confirmDialog.title', 'returnRequest.confirmDialog.message', 'common.yes', 'common.cancel'])
      .pipe(takeUntil(this.destroy$))
      .subscribe((t: Record<string, string>) => {
        this.confirmDialogConfig = {
          show: true,
          title: t['returnRequest.confirmDialog.title'] || 'Confirm',
          message: t['returnRequest.confirmDialog.message'] || 'Submit return request?',
          type: 'success',
          confirmText: t['common.yes'] || 'Yes',
          cancelText: t['common.cancel'] || 'Cancel'
        };
        this.cdr.markForCheck();
      });
  }

  onConfirmSubmit(): void {
    this.confirmDialogConfig.show = false;
    this.submitReturnRequest();
  }

  onCancelConfirm(): void {
    this.confirmDialogConfig.show = false;
    this.cdr.markForCheck();
  }

  private submitReturnRequest(): void {
    const dto: CreateReturnDto = {
      reason: this.detailsState.reason || undefined,
      priority: Number(this.detailsState.priority),
      notes: undefined,
      requestPurposeNotes: this.detailsState.requestPurposeNotes || undefined,
      departmentId: getDepartmentIdForRequest(
        this.userContextState.currentUserDepartmentId,
        DEFAULT_DEPARTMENT_ID
      ),
      requesterId: this.userContextState.currentUserDetails?.id || undefined,
      requestPurposeId: Number(this.detailsState.requestPurposeId!),
      returnItems: this.selectionState.selectedItems.map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity,
        notes: item.notes || undefined
      }))
    };

    this.submissionState.isLoading = true;
    this.cdr.markForCheck();

    const slotMap = this.detailsState.attachmentUploads.filesByRequirementId;
    const nonEmptySlots = new Map<number, File[]>();
    slotMap.forEach((files, requirementId) => {
      const effective = (files ?? []).filter((f) => f instanceof File && f.size > 0);
      if (effective.length > 0) {
        nonEmptySlots.set(requirementId, effective);
      }
    });

    const otherFilesMerged = [...(this.detailsState.attachmentUploads.otherFiles ?? []), ...this.detailsState.selectedFiles].filter(
      (f) => f instanceof File && f.size > 0
    );

    const createOpts: { attachmentUploads?: Map<number, File[]>; otherFiles?: File[] } | undefined =
      nonEmptySlots.size > 0 || otherFilesMerged.length > 0
        ? {
            ...(nonEmptySlots.size > 0 ? { attachmentUploads: nonEmptySlots } : {}),
            ...(otherFilesMerged.length > 0 ? { otherFiles: otherFilesMerged } : {})
          }
        : undefined;

    this.returnService
      .createReturn(dto, createOpts)
      .pipe(
        takeUntil(this.destroy$),
        switchMap((response: unknown) => {
          const id = this.parseCreateReturnId(response);
          if (id == null) {
            return throwError(() => new Error('Invalid response from create return'));
          }
          return this.returnService.getReturnById(id).pipe(
            map((r) => ({
              displayNo: (r.requestNo && r.requestNo.trim()) || String(r.id),
              returnId: id
            })),
            catchError(() => of({ displayNo: String(id), returnId: id }))
          );
        }),
        finalize(() => {
          this.submissionState.isLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: ({ displayNo, returnId }) => {
          this.successState.returnNumber = displayNo;
          this.successState.createdReturnId = returnId;
          this.currentStep = 3;
          this.steps[2].completed = true;
          this.cdr.markForCheck();
          scrollShellContentToTop();
        },
        error: (error: unknown) => {
          const msg = ErrorHandler.extractAndTranslateErrorMessage(
            error,
            'Failed to create return request',
            this.translate
          );
          this.translate.get(['toast.error']).pipe(takeUntil(this.destroy$)).subscribe((t: Record<string, string>) => {
            this.toastService.error(msg, t['toast.error']);
          });
        }
      });
  }

  /** Same UX as new issue success: leave the flow via dashboard. */
  onTrackReturn(): void {
    this.router.navigate(['/dashboard']);
  }

  private parseCreateReturnId(response: unknown): number | null {
    if (typeof response === 'number' && Number.isFinite(response)) {
      return response;
    }
    if (typeof response === 'string') {
      const n = Number(response.trim());
      return Number.isFinite(n) ? n : null;
    }
    if (typeof response === 'object' && response !== null) {
      const o = response as Record<string, unknown>;
      for (const key of ['id', 'value'] as const) {
        const v = o[key];
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v === 'string') {
          const n = Number(v.trim());
          if (Number.isFinite(n)) return n;
        }
      }
    }
    return null;
  }

  // ---- Error helpers -------------------------------------------------------

  hasError(field: string): boolean {
    return this.submissionState.isSubmitted && !!this.submissionState.errors[field];
  }

  getError(field: string): string {
    return this.submissionState.errors[field] || '';
  }

  clearError(field: string): void {
    if (this.submissionState.errors[field]) delete this.submissionState.errors[field];
  }

  // ---- Lookup helpers ------------------------------------------------------

  getRequestPurposeName(purposeId: number): string {
    const p = this.lookupState.requestPurposes.find((x) => x.id === purposeId);
    return p ? getLocalizedName(p, getCurrentLang(this.translate)) : '';
  }

  getPriorityLabel(priority: number): string {
    return this.priorityOptions.find((o) => o.value === priority)?.labelKey ?? '';
  }

  // ---- Catalog (paged server list, same UX as new-issue) ------------------

  private loadCartridgesInitial(): void {
    this.cartridgeState.cartridgeError = null;
    this.cartridgeState.catalogPagination = createInitialCatalogPagination();
    this.loadAmmunitionFacetMetadataIfNeeded();
    this.loadCatalogPage(1, 'initial');
  }

  private loadAmmunitionFacetMetadataIfNeeded(): void {
    if (this.filterState.selectedItemType !== 'Ammunition') return;
    const request: PagedRequest = { page: 1, pageSize: 500, filter: { sortField: 'Name', sortDirection: 1 } };
    this.cartridgeDataService.loadAmmunitionFacetSample(request).pipe(takeUntil(this.destroy$)).subscribe({
      next: (facets) => {
        this.filterOptions.bulletDiameters = facets.bulletDiameters;
        this.filterOptions.natureOptions = facets.natureOptions;
        this.cdr.markForCheck();
      }
    });
  }

  private loadCatalogPage(page: number, loadMode: 'initial' | 'overlay'): void {
    this.cartridgeState.cartridgeError = null;
    if (loadMode === 'overlay') {
      this.cartridgeState.catalogPageLoading = true;
    } else {
      this.cartridgeState.loadingCartridges = true;
      this.cartridgeState.catalogPageLoading = false;
    }
    this.cdr.markForCheck();

    this.fetchCatalogPage(page).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        const itemType = this.filterState.selectedItemType;
        const rows = result.items.map((row) => catalogListItemToCartridge(row, itemType, this.translate));
        this.cartridgeState.allCartridges = rows;
        this.cartridgeState.catalogPagination = {
          page: result.pageIndex,
          pageSize: this.cartridgeState.catalogPagination.pageSize,
          totalCount: result.totalCount,
          totalPages: result.totalPages,
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage
        };
        this.refreshMergedList();
        this.cartridgeState.loadingCartridges = false;
        this.cartridgeState.catalogPageLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.cartridgeState.allCartridges = [];
        this.cartridgeState.filteredCartridges = [];
        this.cartridgeState.loadingCartridges = false;
        this.cartridgeState.catalogPageLoading = false;
        this.cartridgeState.cartridgeError = 'Failed to load items. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  private refreshMergedList(): void {
    this.cartridgeState.filteredCartridges = mergeReturnSelectionsIntoFilteredView(
      this.cartridgeState.allCartridges,
      this.selectionState.selectedItems,
      this.filterState.selectedItemType
    );
  }

  private fetchCatalogPage(page: number): Observable<PaginatedList<CatalogListItem>> {
    const pageSize = this.cartridgeState.catalogPagination.pageSize;
    const fs = this.filterState;
    let req: PagedRequest;
    if (fs.selectedItemType === 'Weapon') {
      req = buildWeaponPagedRequest(page, pageSize, fs);
    } else if (fs.selectedItemType === 'Explosive') {
      req = buildExplosivePagedRequest(page, pageSize, fs);
    } else {
      req = buildAmmunitionPagedRequest(page, pageSize, fs);
    }

    if (fs.selectedItemType === 'Weapon') {
      return this.weaponService.getAllPaginated(req) as Observable<PaginatedList<CatalogListItem>>;
    }
    if (fs.selectedItemType === 'Explosive') {
      return this.explosiveService.getAllPaginated(req) as Observable<PaginatedList<CatalogListItem>>;
    }
    return this.ammunitionService.getAllPaginated(req) as Observable<PaginatedList<CatalogListItem>>;
  }

  private loadRequestPurposes(): void {
    this.lookupState.isLoadingRequestPurposes = true;
    this.apiService
      .get<RequestPurpose[]>(API_ENDPOINTS.REQUEST_PURPOSES.FOR_RETURN)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          if (Array.isArray(data)) this.lookupState.requestPurposes = data;
          this.lookupState.isLoadingRequestPurposes = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.translate
            .get(['toast.error', 'returnRequest.errors.failedToLoadRequestPurposes'])
            .pipe(takeUntil(this.destroy$))
            .subscribe((t: Record<string, string>) => {
              this.toastService.error(
                t['returnRequest.errors.failedToLoadRequestPurposes'] || 'Failed to load request purposes',
                t['toast.error']
              );
            });
          this.lookupState.isLoadingRequestPurposes = false;
          this.cdr.markForCheck();
        }
      });
  }

  private initializeUserContext(): void {
    this.backendAuthService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      const context = applyAuthenticatedUserContext(user, this.userContextState);
      if (context) {
        applyUserContext(context, this.userContextState);
        if (!this.userContextState.currentUserDetails) {
          this.syncRequesterNameFromUserDetails();
        }
      }
      this.cdr.markForCheck();
    });

    this.userContextService.getCurrentUserDetails().pipe(takeUntil(this.destroy$)).subscribe(details => {
      this.userContextState.currentUserDetails = details;
      this.syncRequesterNameFromUserDetails();
      this.cdr.markForCheck();
    });
  }

  private syncRequesterNameFromUserDetails(): void {
    this.userContextState.fallbackRequesterName = syncRequesterNameFromUserDetails(
      this.userContextState.currentUserDetails,
      getCurrentLang(this.translate)
    );
  }

}
