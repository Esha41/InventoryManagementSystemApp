export interface ReportRole {
  roleId: string;
  roleName: string;
  roleNameEn?: string;
  roleNameAr?: string;
}

export interface Report {
  id: string;
  reportName: string;
  url: string;
  reportStatusId: ReportStatus;
  description?: string;
  reportParameters?: string;
  creationDate: Date;
  createdBy: string;
  modificationDate?: Date;
  modifiedBy?: string;
  isDeleted: boolean;
  deletionDate?: Date;
  deletedBy?: string;
  roles?: ReportRole[];
}

export enum ReportStatus {
  Draft = 1,
  Published = 2,
  Inactive = 3
}

export interface ReportTemplate {
  url: string;
  name: string;
  description?: string;
}

export interface ScheduledReport {
  id: string;
  scheduleName: string;
  reportId: string;
  reportName: string;
  reportUrl: string;
  outputFormat: string;
  frequency: string;
  timeOfDay: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  nextRunDate?: Date | string;
  lastRunDate?: Date | string;
  isActive: boolean;
  emailSubject?: string;
  emailBody?: string;
  recipients: ScheduledReportRecipient[];
  creationDate: Date | string;
  createdBy: string;
}

export interface ScheduledReportRecipient {
  id: string;
  scheduledReportId: string;
  userId?: string;
  userName?: string;
  emailAddress: string;
  recipientType: string;
}

export interface ScheduledReportExecution {
  id: string;
  scheduledReportId: string;
  executionDate: Date | string;
  status: string;
  errorMessage?: string;
  recipientCount: number;
  fileSizeBytes?: number;
}

export interface CreateScheduledReportDto {
  scheduleName: string;
  reportId: string;
  outputFormat: string;
  frequency: string;
  timeOfDay: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  emailSubject?: string;
  emailBody?: string;
  recipients: CreateScheduledReportRecipientDto[];
}

export interface CreateScheduledReportRecipientDto {
  userId?: string;
  emailAddress?: string;
  recipientType: string;
}
