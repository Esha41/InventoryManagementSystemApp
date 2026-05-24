/**
 * Centralized Request Item DTOs
 * Consolidates all request item-related interfaces from Order, Return, and Discard services
 */

import type { RequestManagementRequestItemDto } from './request-management-base.model';
import type { WeaponDto } from './weapon.model';

/**
 * Base request item DTO (read) — matches Request Management `RequestItemDto`.
 * @see `ettadbackend/Ettad.RequestManagement.Service/Common/Dtos/RequestItemDto.cs`
 */
export type RequestItemDto = RequestManagementRequestItemDto;

/** @see `ettadbackend/Ettad.RequestManagement.Service/Orders/Dto/CreateRequestItemWeaponAssociationDto.cs` */
export interface CreateRequestItemWeaponAssociationDto {
  associatedWeaponItemId?: number | null;
  associatedWeaponOtherName?: string | null;
  associatedWeaponCaliberId?: number | null;
}

/**
 * DTO for creating or updating request items
 * Used when adding/editing items in Order, Return, and Discard services
 */
export interface CreateRequestItemDto {
  itemId: number;
  quantity: number;
  notes?: string;
  /** Ammunition order lines: one row per intended weapon (catalog id XOR custom name each row). */
  weaponAssociations?: CreateRequestItemWeaponAssociationDto[];
}

/** New-issue wizard: per ammunition line, weapon(s) the ammo is intended for (metadata only). */
export interface WeaponAssociation {
  type: 'catalog' | 'other';
  weaponItemId?: number | null;
  otherName?: string | null;
  caliberId: number | null;
  /** Display name stored when selecting a catalog weapon (review UI). */
  weaponName?: string | null;
}

export interface WeaponAssociationState {
  /** Key: ammunition catalog item id → one entry per selected weapon (catalog or custom). */
  associations: Map<number, WeaponAssociation[]>;
  allWeapons: WeaponDto[];
  /** Key: ammunition-side caliber id; weapons the backend allows for that caliber. */
  weaponsByAmmunitionCaliberId: Map<number, WeaponDto[]>;
  loadingWeapons: boolean;
  weaponLoadError: string | null;
  /**
   * Order-level files supporting non-catalog ("other") weapon associations.
   * Required by the backend WEAPON_ASSOCIATION system slot when any line uses
   * a non-catalog weapon. Not keyed by ammunition id — one bucket per order.
   */
  attachmentFiles: File[];
}

export function createInitialWeaponAssociationState(): WeaponAssociationState {
  return {
    associations: new Map(),
    allWeapons: [],
    weaponsByAmmunitionCaliberId: new Map(),
    loadingWeapons: false,
    weaponLoadError: null,
    attachmentFiles: []
  };
}

/**
 * Order-specific request item DTO
 * Extends base with order-specific fields
 */
export type OrderRequestItemDto = RequestItemDto;

/**
 * Return-specific request item DTO
 * Extends base with return-specific fields
 */
export type ReturnItemDto = RequestItemDto;

/**
 * Discard-specific request item DTO
 * Extends base with discard-specific fields
 */
export type DiscardItemDto = RequestItemDto;

/**
 * DTO for creating order items
 */
export type CreateOrderItemDto = CreateRequestItemDto;

/**
 * DTO for creating return items
 */
export type CreateReturnItemDto = CreateRequestItemDto;

/**
 * DTO for creating discard items
 */
export type CreateDiscardItemDto = CreateRequestItemDto;
