/** Mirrors backend HelpCenter DTOs (Ettad.HelpCenter.Service.Dtos). */

export interface HelpCenterArticleDto {
  id: number;
  title: string;
  content: string;
  category: string | null;
  sortOrder?: number;
  isPublished: boolean;
  creationDate: string;
  createdBy: string | null;
  modificationDate: string | null;
  modifiedBy: string | null;
}

export interface CreateHelpCenterArticleDto {
  title: string;
  content: string;
  category?: string | null;
  sortOrder?: number;
  isPublished: boolean;
}

export interface UpdateHelpCenterArticleDto {
  title?: string | null;
  content?: string | null;
  category?: string | null;
  sortOrder?: number | null;
  isPublished?: boolean | null;
}

export interface HelpCenterContactMessageDto {
  id: number;
  senderName: string;
  senderEmail: string;
  subject: string;
  body: string;
  isRead: boolean;
  adminReply: string | null;
  repliedAt: string | null;
  repliedBy: string | null;
  creationDate: string;
}

export interface SubmitContactMessageDto {
  senderName: string;
  senderEmail: string;
  subject: string;
  body: string;
}

export interface ReplyContactMessageDto {
  adminReply: string;
}

/** Support email and phone shown on the user Contact tab (admin-managed). */
export interface HelpCenterContactDisplayDto {
  supportEmail: string;
  supportPhone: string;
}

export interface UpdateHelpCenterContactDisplayDto {
  supportEmail: string;
  supportPhone: string;
}

export interface HelpCenterTermsDto {
  id: number;
  version: string;
  content: string;
  isActive: boolean;
  effectiveDate: string;
  creationDate: string;
  createdBy: string | null;
}

export interface UpsertHelpCenterTermsDto {
  version: string;
  content: string;
  effectiveDate: string;
}

export interface UpdateHelpCenterTermsDto {
  version?: string | null;
  content?: string | null;
  effectiveDate?: string | null;
}

export interface TermsAcceptanceStatusDto {
  mustAccept: boolean;
  terms: HelpCenterTermsDto | null;
}
