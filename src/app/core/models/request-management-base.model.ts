/**
 * Shared shapes for Ettad.RequestManagement.Service list/detail JSON (polymorphic BaseRequestDto).
 *
 * Backend references:
 * - `ettadbackend/Ettad.RequestManagement.Service/Common/Dtos/BaseRequestDto.cs`
 * - `ettadbackend/Ettad.RequestManagement.Service/Common/Dtos/RequestItemDto.cs`
 * - `ettadbackend/Ettad.RequestManagement.Service/Common/Dtos/RequesterDto.cs`
 * - `ettadbackend/Ettad.RequestManagement.Service/RequestPurposes/Dtos/RequestPurposeDto.cs`
 * - `ettadbackend/Project.Module.Logic/Dtos/DepartmentDto.cs`
 * - `ettadbackend/Project.Module.Logic/Dtos/RankDto.cs`
 * - `ettadbackend/Project.Module.Logic/Dtos/DepotDto.cs`
 */

/** @see `ettadbackend/Project.Module.Logic/Dtos/DepartmentDto.cs` */
export interface RequestManagementDepartmentDto {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string;
  isDeleted: boolean;
}

/** @see `ettadbackend/Project.Module.Logic/Dtos/RankDto.cs` */
export interface RequestManagementRankDto {
  id: number;
  nameAr: string;
  nameEn: string;
  isDeleted: boolean;
}

/** @see `ettadbackend/Ettad.RequestManagement.Service/Common/Dtos/RequesterDto.cs` */
export interface RequestManagementRequesterDto {
  id: string;
  userName: string;
  fullNameEN: string;
  fullNameAR: string;
  militoryId?: string | null;
  email?: string | null;
  rank?: RequestManagementRankDto | null;
  department?: RequestManagementDepartmentDto | null;
}

/** @see `ettadbackend/Ettad.RequestManagement.Service/RequestPurposes/Dtos/RequestPurposeDto.cs` */
export interface RequestManagementRequestPurposeDto {
  id: number;
  nameAr: string;
  nameEn: string;
  requestType: number | string;
}

/** @see `ettadbackend/Project.Module.Logic/Dtos/DepotDto.cs` */
export interface RequestManagementDepotDto {
  id: number;
  nameAr: string;
  nameEn: string;
  location: string;
  latitude: number;
  longitude: number;
  isDeleted: boolean;
  code: string;
}

/** @see `ettadbackend/Ettad.RequestManagement.Service/Common/Dtos/RequestItemDto.cs` */
export interface RequestManagementRequestItemDto {
  id: number;
  itemId: number;
  quantity: number;
  requestId: number;
  notes?: string;
  itemName?: string;
  itemNo?: string;
  nsn?: string;
  itemType?: number | string;
}

/**
 * Read model shared by Order / Return / Discard from Request Management API.
 * @see `ettadbackend/Ettad.RequestManagement.Service/Common/Dtos/BaseRequestDto.cs`
 */
export interface RequestManagementBaseRequestDto {
  id: number;
  requestNo: string;
  requestType: number | string;
  reason?: string | null;
  priority: number | string;
  status: number | string;
  notes?: string;
  requestPurposeNotes: string;
  departmentId: number;
  requesterId?: string | null;
  requestPurposeId: number;
  department?: RequestManagementDepartmentDto | null;
  requester?: RequestManagementRequesterDto | null;
  requestPurpose?: RequestManagementRequestPurposeDto | null;
  requestItems?: RequestManagementRequestItemDto[];
  creationDate: string | Date;
  isMyTurn: boolean;
  /** Workflow `BaseRequestDto` field; omitted on Request Management JSON — use `creationDate`. */
  requestDate?: string | Date;
  /** Present when System.Text.Json polymorphism emits a type discriminator. */
  readonly $type?: string;
}
