/**
 * Backend-aligned numeric enums (Ettad.Data.Enums).
 * Single source of truth for API request/response enum values.
 */

export enum RequestType {
  Order = 1,
  Return = 2,
  Discard = 3
}

export enum RequestStatus {
  New = 1,
  UnderProcess = 2,
  Approved = 3,
  Rejected = 4,
  Cancelled = 5,
  ReturnedForReview = 6,
  AutoRejected = 7
}

export enum RequestPriority {
  Normal = 1,
  Urgent = 2,
  VeryUrgent = 3
}

export enum ItemType {
  Ammunition = 1,
  Weapon = 2,
  Explosive = 3,
  Accessory = 4
}

export enum AssetStatus {
  ReadyToIssue = 1,
  InMaintenance = 2,
  UnserviceableRepairable = 3,
  UnserviceableUnrepairable = 4,
  AwaitingDisposal = 5,
  Disposed = 6,
  NotReadyToIssue = 7,
  Assigned = 8
}

export enum WorkflowType {
  NormalOrder = 1,
  OrderFromAllowance = 2,
  Return = 3,
  Discard = 4,
  NormalOrderForTrainingPurpose = 5,
  NormalOrder_Weapon = 6,
  OrderFromAllowance_Weapon = 7,
  NormalOrderForTrainingPurpose_Weapon = 8,
  Return_Weapon = 9
}

export enum AutoRejectTriggerMode {
  None = 0,
  Role = 1,
  Step = 2,
  Disabled = 3
}

export enum RequestPurposeAllowanceContext {
  FromAllowance = 1,
  OutsideAllowance = 2,
  Both = 3
}

export enum AmmunitionType {
  Small = 1,
  Medium = 2,
  Large = 3
}

export enum WeaponCaliberCategory {
  Small = 1,
  Medium = 2,
  Large = 3
}

export enum WeaponType {
  Rifle = 1,
  Pistol = 2,
  MachineGun = 3,
  SniperRifle = 4,
  GrenadeLauncher = 5,
  Shotgun = 6,
  SubmachineGun = 7,
  AntiTank = 8,
  Mortar = 9,
  Other = 99
}

export enum ActionType {
  BoltAction = 1,
  SemiAutomatic = 2,
  Automatic = 3,
  PumpAction = 4,
  LeverAction = 5,
  BreakAction = 6,
  Revolver = 7,
  Other = 99
}

/** Frontend-only explosive taxonomy (lookup Type.NameEn filters). */
export enum ExplosiveType {
  Grenade = 1,
  Mine = 2,
  PlasticExplosive = 3,
  Rocket = 4,
  Missile = 5,
  Detonator = 6,
  Bomb = 7,
  Other = 99
}

export enum DelegationScope {
  None = 0,
  WorkflowApproval = 1
}

export enum SupplySubmissionStatus {
  Draft = 1,
  Submitted = 2
}

export enum SupplyFulfillmentStatus {
  Partial = 1,
  Fully = 2
}

export enum AnnouncementDeliveryType {
  Banner = 1,
  Notification = 2,
  Both = 3
}

export enum ApprovalStatus {
  Pending = 1,
  Approved = 2,
  Rejected = 3,
  Returned = 4,
  Cancelled = 5
}

export enum ReportStatuses {
  Draft = 1,
  Published = 2,
  Inactive = 3
}

/** @deprecated Use {@link RequestType} */
export const RequestTypeEnum = RequestType;
/** @deprecated Use {@link RequestPriority} */
export const PriorityEnum = RequestPriority;
/** @deprecated Use {@link RequestStatus} */
export const RequestStatusEnum = RequestStatus;
