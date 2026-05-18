import { ConfirmationType } from '@components/confirmation-dialog/confirmation-dialog.component';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';

export type ReturnItemType = 'Ammunition' | 'Weapon' | 'Explosive';
export type CatalogListItem = AmmunitionReadDto | WeaponDto | ExplosiveDto;

export interface ReturnSelectedItem {
  itemId: number;
  name: string;
  itemNo: string;
  quantity: number;
  notes: string;
  /** Catalog tab active when the line was added (used when merging the shared cartridge list). */
  itemType?: string;
}

export interface RequestPurpose {
  id: number;
  nameAr: string;
  nameEn: string;
}

export interface ReturnSelectionState {
  selectedItemType: ReturnItemType;
  selectedItems: ReturnSelectedItem[];
}

export interface ReturnDetailsState {
  reason: string;
  priority: number;
  requestPurposeId: number | null;
  requestPurposeNotes: string;
  selectedFiles: File[];
}

export interface ReturnLookupState {
  requestPurposes: RequestPurpose[];
  isLoadingRequestPurposes: boolean;
  ammunitionTypeOptions: { label: string; value: string }[];
  linkedOptions: { label: string; value: string }[];
  weaponTypeOptions: { label: string; value: string }[];
  explosiveTypeOptions: { label: string; value: string }[];
  bulletDiameters: string[];
  natureOptions: string[];
}

export interface ReturnSuccessState {
  /** Display reference (usually `requestNo` from the API). */
  returnNumber: string | null;
  /** Created return id — enables the same “track” affordance as new issue. */
  createdReturnId: number | null;
}

export interface ReturnSubmissionState {
  isLoading: boolean;
  isSubmitted: boolean;
  hasAttemptedSubmit: boolean;
  errors: Record<string, string>;
}

export interface ReturnConfirmDialogConfig {
  show: boolean;
  title: string;
  message: string;
  type: ConfirmationType;
  confirmText: string;
  cancelText: string;
}

export function createInitialSelectionState(): ReturnSelectionState {
  return {
    selectedItemType: 'Ammunition',
    selectedItems: []
  };
}

export function createInitialDetailsState(): ReturnDetailsState {
  return {
    reason: '',
    priority: 1,
    requestPurposeId: null,
    requestPurposeNotes: '',
    selectedFiles: []
  };
}

export function createInitialLookupState(): ReturnLookupState {
  return {
    requestPurposes: [],
    isLoadingRequestPurposes: false,
    ammunitionTypeOptions: [
      { label: 'returnRequest.filters.small', value: 'Small' },
      { label: 'returnRequest.filters.medium', value: 'Medium' },
      { label: 'returnRequest.filters.large', value: 'Large' }
    ],
    linkedOptions: [
      { label: 'returnRequest.filters.linked', value: 'Linked' },
      { label: 'returnRequest.filters.notLinked', value: 'Not Linked' }
    ],
    weaponTypeOptions: [],
    explosiveTypeOptions: [],
    bulletDiameters: [],
    natureOptions: []
  };
}

export function createInitialSubmissionState(): ReturnSubmissionState {
  return { isLoading: false, isSubmitted: false, hasAttemptedSubmit: false, errors: {} };
}

export function createInitialConfirmDialogConfig(): ReturnConfirmDialogConfig {
  return { show: false, title: '', message: '', type: 'success', confirmText: '', cancelText: '' };
}

export function createInitialSuccessState(): ReturnSuccessState {
  return { returnNumber: null, createdReturnId: null };
}
