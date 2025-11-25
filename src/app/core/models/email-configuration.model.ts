/**
 * Email Configuration DTOs
 */

export interface EmailConfigurationDto {
  id: number;
  port?: number | null;
  ssl: boolean;
  disableAuthentication: boolean;
  hostIp: string;
  username: string;
  displayName: string;
  enableEmailNotifications: boolean;
  enableEmailLoginOtp: boolean;
  assetReturnEmailContent: string;
  bulkAssetNotificationEmailContent: string;
  organizationName: string;
  organizationNameArabic: string;
  organizationLogoFilename: string;
  organizationReportLogoFilename: string;
  hasPassword: boolean;
}

export interface CreateUpdateEmailConfigurationDto {
  port?: number | null;
  ssl: boolean;
  disableAuthentication: boolean;
  hostIp: string;
  username: string;
  displayName: string;
  enableEmailNotifications: boolean;
  enableEmailLoginOtp: boolean;
  assetReturnEmailContent: string;
  bulkAssetNotificationEmailContent: string;
  organizationName: string;
  organizationNameArabic: string;
  organizationLogoFilename: string;
  organizationReportLogoFilename: string;
  password?: string;
}

