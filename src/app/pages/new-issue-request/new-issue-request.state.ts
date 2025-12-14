import { Cartridge } from './components/cartridge-list/cartridge-list.component';
import { BackendUserDto } from '@models/backend-user.model';
import { DropdownOption } from '@components/dropdown/dropdown.component';

export interface RequestPurposeDto {
  id: number;
  nameEn?: string | null;
  nameAr?: string | null;
}

export interface FilterState {
  selectedItemType: string;
  selectedAmmunitionType: string;
  selectedBulletDiameter: string;
  selectedLinked: string;
  selectedNature: string;
  selectedNSN: string;
  searchTerm: string;

  // New Filters
  selectedWeaponType?: string;
  selectedCaliber?: string;
  selectedExplosiveType?: string;
  selectedUNNumber?: string;
}

export interface FilterOptions {
  itemTypeOptions: string[];
  ammunitionTypeOptions: string[];
  bulletDiameters: string[];
  linkedOptions: string[];
  natureOptions: string[];
  orderPriorities: DropdownOption<string>[] | string[]; // Allow objects or strings

  weaponTypeOptions?: any[]; // DropdownOption[]
  explosiveTypeOptions?: any[]; // DropdownOption[]
}

export interface CartridgeState {
  allCartridges: Cartridge[];
  filteredCartridges: Cartridge[];
  selectedCartridgeForView: Cartridge | null;
  showCartridgeDetails: boolean;
  loadingCartridges: boolean;
  cartridgeError: string | null;
  selectedEntries: Array<{ id: number; quantity: number }>;
}

export interface UsageFormData {
  usePurpose: string;
  usageLocation: string;
  numberOfOfficers: number | null;
  numberOfOtherRanks: number | null;
  usageDateFrom: string;
  usageTimeFrom: string;
  usageDateTo: string;
  usageTimeTo: string;
  orderPriority: string;
}

export interface ReserveDetailsState {
  totalReserve: number;
  availableReserve: number;
  orderedQuantity: number;
  usedQuantity: number;
  loadingReserveDetails: boolean;
  reserveDetailsByItem: any[];
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
  requesterComments: string;
  orderType: string;
  orderDocument: string;
}
