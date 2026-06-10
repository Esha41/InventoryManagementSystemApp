import { Cartridge } from '@models/cartridge.model';
import { BackendUserDto } from '@models/backend-user.model';
import { DropdownOption } from '@components/dropdown/dropdown.component';
import { defaultPageSize } from '@constants/app.constants';

export interface AttachmentRequirementDto {
  id: number;
  nameEn?: string | null;
  nameAr?: string | null;
  isRequired: boolean;
  minCount: number;
  maxCount: number;
  displayOrder: number;
}

export interface RequestPurposeDto {
  id: number;
  nameEn?: string | null;
  nameAr?: string | null;
  allowanceContext?: number;
  /** Allowed item types for this purpose (empty = all types). */
  itemTypes?: number[];
  attachmentRequirements?: AttachmentRequirementDto[];
}

/**
 * Tracks files chosen per AttachmentRequirementId plus an optional
 * entity-only "other" files bucket. Wired through the new-issue flow
 * down to OrderService.createOrder.
 */
export interface AttachmentUploadsState {
  filesByRequirementId: Map<number, File[]>;
  otherFiles: File[];
}

export interface FilterState {
  selectedItemType: string;
  selectedAmmunitionType: string;
  selectedLinked: string;
  selectedPrimaryPurposeId: string;
  selectedClassificationId: string;
  selectedNSN: string;
  searchTerm: string;

  selectedWeaponType?: string;
  selectedCaliber?: string;
  selectedExplosiveType?: string;
  selectedUNNumber?: string;

  /** Ammunition */
  selectedCaseType?: string;
  selectedCompatibility?: string;
  selectedHazardDivision?: string;
  selectedPropellant?: string;
  selectedAmmunitionArmNumber?: string;
  selectedAmmunitionPartNo?: string;

  /** Weapon */
  selectedCountryOfManufacture?: string;
  selectedWeaponUNNumber?: string;
  selectedPartNo?: string;
  selectedWeaponModel?: string;
  selectedWeaponReferenceNo?: string;

  /** Explosive */
  selectedExplosiveHazardDivision?: string;
  selectedExplosiveCompatibility?: string;
  selectedArmNumber?: string;
  selectedExplosivePartNo?: string;
  selectedExplosiveReferenceNo?: string;
}

export interface ExtendedFilterState extends FilterState {}

export interface FilterOptions {
  itemTypeOptions: string[];
  ammunitionTypeOptions: DropdownOption<string>[] | string[];
  caliberOptions: DropdownOption<string>[];
  linkedOptions: DropdownOption<string>[] | string[];
  primaryPurposeOptions: DropdownOption<string>[];
  classificationOptions: DropdownOption<string>[];
  caseTypeOptions: DropdownOption<string>[];
  compatibilityOptions: DropdownOption<string>[];
  hazardDivisionOptions: DropdownOption<string>[];
  propellantOptions: DropdownOption<string>[];
  countryOptions: DropdownOption<string>[];

  weaponTypeOptions?: DropdownOption<string>[];
  explosiveTypeOptions?: DropdownOption<string>[];
}

export interface ExtendedFilterOptions extends FilterOptions {}

export interface CatalogPaginationState {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CartridgeState {
  allCartridges: Cartridge[];
  filteredCartridges: Cartridge[];
  loadingCartridges: boolean;
  /** True while fetching another page (full catalog only); list stays visible with overlay. */
  catalogPageLoading: boolean;
  cartridgeError: string | null;
  selectedEntries: Array<{ id: number; quantity: number; itemType?: string }>;
  selectedCartridgesCache: Map<number, Cartridge>; // Cache to preserve full cartridge data across item type changes
  /** Server-driven catalog (full catalog mode). Allowance mode uses client filtering only. */
  catalogPagination: CatalogPaginationState;
}

export interface UsageFormData {
  usePurpose: string;
  requestPurposeNotes: string;
  usageLocation: string;
  numberOfOfficers: number | null;
  numberOfOtherRanks: number | null;
  usageDateFrom: string;
  usageTimeFrom: string;
  usageDateTo: string;
  usageTimeTo: string;
}

export interface ReserveDetailsState {
  totalReserve: number;
  availableReserve: number;
  orderedQuantity: number;
  usedQuantity: number;
  loadingReserveDetails: boolean;
  reserveDetailsByItem: ReserveDetailItem[];
}

export interface ReserveDetailItem {
  itemId: number;
  itemName: string;
  itemNo?: string | null;
  totalReserve: number;
  availableReserve: number;
  orderedQuantity: number;
  usedQuantity: number;
}

export interface UserContextState {
  currentUserDetails: BackendUserDto | null;
  currentUserDepartmentId: number | null;
  currentUserRequesterId: string | null;
  fallbackRequesterName: string;
  isAdminUser: boolean;
  lockRequesterName: boolean;
}

export interface RequestPurposeState {
  requestPurposeOptions: DropdownOption<number>[];
  selectedRequestPurposeId: number | null;
  loadingRequestPurposes: boolean;
  requestPurposesSource: RequestPurposeDto[];
}

export interface OrderSubmissionState {
  submittingOrder: boolean;
  orderSubmitError: string | null;
  createdOrderId: number | null;
  orderNumber: string | null;
  orderSubmitted: boolean;
}

export interface ReviewFormData {
  requesterName: string;
  orderType: string;
  orderDocument: string;
}

export interface ConfirmDialogConfig {
  title: string;
  message: string;
  type: 'success' | 'warning' | 'danger' | 'info';
  confirmText: string;
  cancelText: string;
}

// ----- State factories ---------------------------------------------------
// Pure factory functions that return fresh state objects. The component uses
// them for both initial field values and `resetForm()` so the defaults stay
// declared in exactly one place.

export function createInitialFilterState(): ExtendedFilterState {
  return {
    selectedItemType: 'Ammunition',
    selectedAmmunitionType: '',
    selectedLinked: '',
    selectedPrimaryPurposeId: '',
    selectedClassificationId: '',
    selectedNSN: '',
    searchTerm: '',
    selectedWeaponType: '',
    selectedCaliber: '',
    selectedExplosiveType: '',
    selectedUNNumber: '',
    selectedCaseType: '',
    selectedCompatibility: '',
    selectedHazardDivision: '',
    selectedPropellant: '',
    selectedAmmunitionArmNumber: '',
    selectedAmmunitionPartNo: '',
    selectedCountryOfManufacture: '',
    selectedWeaponUNNumber: '',
    selectedPartNo: '',
    selectedWeaponModel: '',
    selectedWeaponReferenceNo: '',
    selectedExplosiveHazardDivision: '',
    selectedExplosiveCompatibility: '',
    selectedArmNumber: '',
    selectedExplosivePartNo: '',
    selectedExplosiveReferenceNo: ''
  };
}

export function createInitialFilterOptions(): ExtendedFilterOptions {
  return {
    itemTypeOptions: ['Ammunition', 'Explosive', 'Weapon'],
    ammunitionTypeOptions: [
      { label: 'newIssueRequest.ammunitionTypeSmall', value: '1' },
      { label: 'newIssueRequest.ammunitionTypeMedium', value: '2' },
      { label: 'newIssueRequest.ammunitionTypeLarge', value: '3' }
    ],
    caliberOptions: [],
    linkedOptions: [
      { label: 'newIssueRequest.linkedOptionLinked', value: 'Linked' },
      { label: 'newIssueRequest.linkedOptionNotLinked', value: 'Not Linked' }
    ],
    primaryPurposeOptions: [],
    classificationOptions: [],
    caseTypeOptions: [],
    compatibilityOptions: [],
    hazardDivisionOptions: [],
    propellantOptions: [],
    countryOptions: [],
    weaponTypeOptions: [],
    explosiveTypeOptions: []
  };
}

export function createInitialCatalogPagination(): CatalogPaginationState {
  return {
    page: 1,
    pageSize: defaultPageSize,
    totalCount: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false
  };
}

export function createInitialCartridgeState(): CartridgeState {
  return {
    allCartridges: [],
    filteredCartridges: [],
    loadingCartridges: false,
    catalogPageLoading: false,
    cartridgeError: null,
    selectedEntries: [],
    selectedCartridgesCache: new Map<number, Cartridge>(),
    catalogPagination: createInitialCatalogPagination()
  };
}

export function createInitialUsageFormData(): UsageFormData {
  return {
    usePurpose: '',
    requestPurposeNotes: '',
    usageLocation: '',
    numberOfOfficers: null,
    numberOfOtherRanks: null,
    usageDateFrom: '',
    usageTimeFrom: '',
    usageDateTo: '',
    usageTimeTo: ''
  };
}

export function createInitialReserveDetailsState(): ReserveDetailsState {
  return {
    totalReserve: 0,
    availableReserve: 0,
    orderedQuantity: 0,
    usedQuantity: 0,
    loadingReserveDetails: false,
    reserveDetailsByItem: []
  };
}

export function createInitialUserContextState(): UserContextState {
  return {
    currentUserDetails: null,
    currentUserDepartmentId: null,
    currentUserRequesterId: null,
    fallbackRequesterName: '',
    isAdminUser: false,
    lockRequesterName: false
  };
}

export function createInitialRequestPurposeState(): RequestPurposeState {
  return {
    requestPurposeOptions: [],
    selectedRequestPurposeId: null,
    loadingRequestPurposes: false,
    requestPurposesSource: []
  };
}

export function createInitialOrderSubmissionState(): OrderSubmissionState {
  return {
    submittingOrder: false,
    orderSubmitError: null,
    createdOrderId: null,
    orderNumber: null,
    orderSubmitted: false
  };
}

export function createInitialReviewFormData(): ReviewFormData {
  return {
    requesterName: '',
    orderType: 'New Issue Request',
    orderDocument: ''
  };
}

export function createInitialAttachmentUploadsState(): AttachmentUploadsState {
  return {
    filesByRequirementId: new Map<number, File[]>(),
    otherFiles: []
  };
}

export function createInitialConfirmDialogConfig(): ConfirmDialogConfig {
  return {
    title: '',
    message: '',
    type: 'success',
    confirmText: '',
    cancelText: ''
  };
}
