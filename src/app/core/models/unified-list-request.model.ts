import { RankDto } from './rank.model';
import { DepartmentDto } from './lookup.model';
import { RequestItemDto } from './common.model';


export interface UnifiedListRequestDto {
  id: number;
  requestNo: string;
  requestType: number;
  reason?: string;
  priority: number;
  status: number;
  notes?: string;
  departmentId: number;
  departmentName?: string;
  departmentNameAr?: string;
  departmentNameEn?: string;
  requesterId?: string;
  requesterName?: string;
  requesterNameAr?: string;
  requesterNameEn?: string;
  requesterRoleNameAr?: string;
  requestPurposeId: number;
  requestPurposeName?: string;
  requestPurposeNameAr?: string;
  requestPurposeNameEn?: string;
  requestDate: string | Date;
  creationDate: string | Date;

  department?: {
    id: number;
    code: string;
    nameAr: string;
    nameEn: string;
    isDeleted: boolean;
  };

  requester?: {
    id: string;
    userName: string;
    fullNameEN: string;
    fullNameAR: string;
    militoryId?: string | null;
    email?: string;
    rank?: RankDto;
    department?: DepartmentDto;
  };

  requestPurpose?: {
    id: number;
    nameAr: string;
    nameEn: string;
    requestType: number;
  };

  requestItems?: RequestItemDto[];

  usageDateFrom?: string | Date;
  usageDateTo?: string | Date;
  usageTimeFrom?: string;
  usageTimeTo?: string;
  usagePurpose?: string;
  usageLocation?: string;
  isFromAllowance?: boolean;
  annualDiscard?: boolean;
  numberOfOfficer?: number;
  numberOfOtherRank?: number;
  depotId?: number;
  depotNameAr?: string;
  depotNameEn?: string;
  receiverId?: string;
  receiverName?: string;
  isMyTurn?: boolean;
}
