import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ConfigService } from './config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { APIOperationResponse } from '@models/api-response.model';
import { OrderDto } from '@models/order.model';
import { ReturnDto } from '@models/return.model';
import { DiscardDto } from '@models/discard.model';
import { RequestItemDto } from '@models/request-item.model';

export interface SendEmailRequest {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
}

/**
 * Service for sending emails
 */
@Injectable({
  providedIn: 'root'
})
export class EmailService {
  private get baseUrl(): string {
    return `${this.config.apiUrl}${API_ENDPOINTS.EMAIL.BASE}`;
  }

  constructor(
    private http: HttpClient,
    private config: ConfigService
  ) { }

  /**
   * Send an email
   */
  sendEmail(request: SendEmailRequest): Observable<APIOperationResponse<void>> {
    const endpoint = `${this.config.apiUrl}${API_ENDPOINTS.EMAIL.SEND}`;
    this.config.log('Sending email', { to: request.to, subject: request.subject });

    return this.http.post<APIOperationResponse<void>>(endpoint, {
      To: request.to,
      Subject: request.subject,
      Body: request.body,
      IsHtml: request.isHtml ?? true
    }).pipe(
      catchError(error => {
        this.config.logError('Failed to send email', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Send email with notification details
   */
  sendNotificationEmail(
    recipientEmail: string,
    title: string,
    message: string,
    details?: Record<string, unknown>,
    entityDetails?: OrderDto | ReturnDto | DiscardDto | null,
    entityType?: string
  ): Observable<APIOperationResponse<void>> {
    const emailBody = this.buildNotificationEmailBody(title, message, details, entityDetails, entityType);

    return this.sendEmail({
      to: recipientEmail,
      subject: title,
      body: emailBody,
      isHtml: false
    });
  }

  /**
   * Build a plain-text compatible email body so details survive even if HTML is stripped.
   */
  private buildNotificationEmailBody(
    title: string,
    message: string,
    details?: Record<string, unknown>,
    entityDetails?: OrderDto | ReturnDto | DiscardDto | null,
    entityType?: string
  ): string {
    const lines: string[] = [];

    lines.push(title || 'New Notification');

    if (message) {
      lines.push('', message);
    }

    const detailLines = this.buildPlainTextDetails(details);
    if (detailLines.length > 0) {
      lines.push('', 'Details:');
      lines.push(...detailLines);
    }

    const entityLines = this.buildEntityPlainText(entityDetails, entityType);
    if (entityLines.length > 0) {
      lines.push('', 'Items:');
      lines.push(...entityLines);
    }

    lines.push('', 'This is an automated notification email.');

    return lines.join('\n');
  }

  /**
   * Build plain text details from a details object
   */
  private buildPlainTextDetails(details?: Record<string, unknown>): string[] {
    if (!details || Object.keys(details).length === 0) {
      return [];
    }

    return Object.entries(details)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => {
        const formattedValue = this.formatPlainTextValue(value);
        return `  ${key}: ${formattedValue}`;
      });
  }

  /**
   * Build plain text representation of entity details (order, return, discard)
   */
  private buildEntityPlainText(entityDetails?: OrderDto | ReturnDto | DiscardDto | null, entityType?: string): string[] {
    if (!entityDetails || !entityType) {
      return [];
    }

    const lines: string[] = [];
    const order = entityDetails as OrderDto;
    const returnOrDiscard = entityDetails as ReturnDto | DiscardDto;
    const deptName = order.departmentNameEn ?? order.departmentNameAr ?? returnOrDiscard.department?.nameEn ?? returnOrDiscard.department?.nameAr;

    switch (entityType.toLowerCase()) {
      case 'order':
        if (order.orderNo || order.requestNo) {
          lines.push(`  Order Number: ${order.orderNo || order.requestNo || `#${order.id}`}`);
        }
        if (deptName) {
          lines.push(`  Department: ${deptName}`);
        }
        if (order.requesterName) {
          lines.push(`  Requester: ${order.requesterName}`);
        }
        if (order.priority !== undefined) {
          const priorityLabel = order.priority === 1 ? 'High' : order.priority === 2 ? 'Medium' : 'Low';
          lines.push(`  Priority: ${priorityLabel}`);
        }
        if (order.status !== undefined) {
          const statusLabels = ['New', 'In Progress', 'Approved', 'Rejected', 'Cancelled'];
          lines.push(`  Status: ${statusLabels[order.status as number] || `Status ${order.status}`}`);
        }
        this.appendRequestItems(lines, order.requestItems);
        break;

      case 'return':
        if (returnOrDiscard.requestNo) {
          lines.push(`  Return Number: ${returnOrDiscard.requestNo || `#${returnOrDiscard.id}`}`);
        }
        if (deptName) {
          lines.push(`  Department: ${deptName}`);
        }
        const returnRequester = (returnOrDiscard as ReturnDto & { requesterName?: string }).requesterName
          ?? returnOrDiscard.requester?.fullNameEN ?? returnOrDiscard.requester?.fullNameAR ?? returnOrDiscard.requester?.userName;
        if (returnRequester) {
          lines.push(`  Requester: ${returnRequester}`);
        }
        if (returnOrDiscard.priority !== undefined) {
          const priorityLabel = returnOrDiscard.priority === 1 ? 'High' : returnOrDiscard.priority === 2 ? 'Medium' : 'Low';
          lines.push(`  Priority: ${priorityLabel}`);
        }
        if (returnOrDiscard.status !== undefined) {
          const statusLabels = ['New', 'In Progress', 'Approved', 'Rejected', 'Cancelled'];
          lines.push(`  Status: ${statusLabels[returnOrDiscard.status] || `Status ${returnOrDiscard.status}`}`);
        }
        this.appendRequestItems(lines, returnOrDiscard.requestItems);
        break;

      case 'discard':
        if (returnOrDiscard.requestNo) {
          lines.push(`  Discard Number: ${returnOrDiscard.requestNo || `#${returnOrDiscard.id}`}`);
        }
        if (deptName) {
          lines.push(`  Department: ${deptName}`);
        }
        const discardRequester = (returnOrDiscard as DiscardDto & { requesterName?: string }).requesterName
          ?? returnOrDiscard.requester?.fullNameEN ?? returnOrDiscard.requester?.fullNameAR ?? returnOrDiscard.requester?.userName;
        if (discardRequester) {
          lines.push(`  Requester: ${discardRequester}`);
        }
        if (returnOrDiscard.priority !== undefined) {
          const priorityLabel = returnOrDiscard.priority === 1 ? 'High' : returnOrDiscard.priority === 2 ? 'Medium' : 'Low';
          lines.push(`  Priority: ${priorityLabel}`);
        }
        if (returnOrDiscard.status !== undefined) {
          const statusLabels = ['New', 'In Progress', 'Approved', 'Rejected', 'Cancelled'];
          lines.push(`  Status: ${statusLabels[returnOrDiscard.status] || `Status ${returnOrDiscard.status}`}`);
        }
        this.appendRequestItems(lines, returnOrDiscard.requestItems);
        break;
    }

    return lines;
  }

  private appendRequestItems(lines: string[], requestItems?: RequestItemDto[]): void {
    if (requestItems && requestItems.length > 0) {
      lines.push('  Items:');
      requestItems.forEach((item: RequestItemDto) => {
        const itemLabel = item.itemName ?? (item as RequestItemDto & { name?: string }).name ?? `Item #${item.itemId}`;
        lines.push(`    - ${itemLabel}: ${item.quantity ?? 0}`);
      });
    }
  }

  /**
   * Format a value for plain text output
   */
  private formatPlainTextValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }

    return String(value);
  }

  /**
   * Build order details HTML
   */
  private buildOrderDetails(order: OrderDto): string {
    let html = '';

    if (order.orderNo || order.requestNo) {
      html += `<div class="detail-row"><span class="detail-label">Order Number:</span><span>${this.escapeHtml(order.orderNo || order.requestNo || `#${order.id}`)}</span></div>`;
    }
    const orderDeptName = order.departmentNameEn || order.departmentNameAr;
    if (orderDeptName) {
      html += `<div class="detail-row"><span class="detail-label">Department:</span><span>${this.escapeHtml(orderDeptName)}</span></div>`;
    }
    if (order.requesterName) {
      html += `<div class="detail-row"><span class="detail-label">Requester:</span><span>${this.escapeHtml(order.requesterName)}</span></div>`;
    }
    if (order.priority !== undefined) {
      const priorityLabel = order.priority === 1 ? 'High' : order.priority === 2 ? 'Medium' : 'Low';
      html += `<div class="detail-row"><span class="detail-label">Priority:</span><span>${priorityLabel}</span></div>`;
    }
    if (order.status !== undefined) {
      const statusLabels: Record<number, string> = { 1: 'New', 2: 'In Progress', 3: 'Approved', 4: 'Rejected', 5: 'Cancelled' };
      const statusNum = typeof order.status === 'number' ? order.status : parseInt(String(order.status), 10);
      html += `<div class="detail-row"><span class="detail-label">Status:</span><span>${statusLabels[statusNum] ?? `Status ${order.status}`}</span></div>`;
    }
    const orderPurposeName = order.requestPurposeNameEn || order.requestPurposeNameAr;
    if (orderPurposeName) {
      html += `<div class="detail-row"><span class="detail-label">Request Purpose:</span><span>${this.escapeHtml(orderPurposeName)}</span></div>`;
    }
    if (order.usageDateFrom) {
      const fromDate = new Date(order.usageDateFrom).toLocaleString();
      const toDate = order.usageDateTo ? new Date(order.usageDateTo).toLocaleString() : '';
      const fromTime = order.usageTimeFrom || '';
      const toTime = order.usageTimeTo || '';
      const dateRange = toDate
        ? `${fromDate} ${fromTime} - ${toDate} ${toTime}`
        : `${fromDate} ${fromTime}`;
      html += `<div class="detail-row"><span class="detail-label">Usage Date:</span><span>${dateRange}</span></div>`;
    }
    if (order.usageLocation) {
      html += `<div class="detail-row"><span class="detail-label">Usage Location:</span><span>${this.escapeHtml(order.usageLocation)}</span></div>`;
    }
    if (order.notes) {
      html += `<div class="detail-row"><span class="detail-label">Notes:</span><span>${this.escapeHtml(order.notes)}</span></div>`;
    }

    // Add items if available
    if (order.requestItems && order.requestItems.length > 0) {
      html += '<div style="margin-top: 15px;"><h4 style="margin-bottom: 10px; color: #555;">Items:</h4><table style="width: 100%; border-collapse: collapse;"><thead><tr style="background-color: #f0f0f0;"><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Item</th><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Quantity</th></tr></thead><tbody>';
      order.requestItems?.forEach((item: RequestItemDto) => {
        const label = item.itemName ?? (item as RequestItemDto & { name?: string }).name ?? `Item #${item.itemId}`;
        html += `<tr><td style="padding: 8px; border: 1px solid #ddd;">${this.escapeHtml(label)}</td><td style="padding: 8px; border: 1px solid #ddd;">${item.quantity ?? 0}</td></tr>`;
      });
      html += '</tbody></table></div>';
    }

    return html;
  }

  /**
   * Build return details HTML
   */
  private buildReturnDetails(returnReq: ReturnDto): string {
    let html = '';

    if (returnReq.requestNo) {
      html += `<div class="detail-row"><span class="detail-label">Return Number:</span><span>${this.escapeHtml(returnReq.requestNo || `#${returnReq.id}`)}</span></div>`;
    }
    const returnDeptName = returnReq.department?.nameEn ?? returnReq.department?.nameAr;
    if (returnDeptName) {
      html += `<div class="detail-row"><span class="detail-label">Department:</span><span>${this.escapeHtml(returnDeptName)}</span></div>`;
    }
    const returnRequesterName = (returnReq as ReturnDto & { requesterName?: string }).requesterName
      ?? returnReq.requester?.fullNameEN ?? returnReq.requester?.fullNameAR ?? returnReq.requester?.userName;
    if (returnRequesterName) {
      html += `<div class="detail-row"><span class="detail-label">Requester:</span><span>${this.escapeHtml(returnRequesterName)}</span></div>`;
    }
    if (returnReq.priority !== undefined) {
      const priorityLabel = returnReq.priority === 1 ? 'High' : returnReq.priority === 2 ? 'Medium' : 'Low';
      html += `<div class="detail-row"><span class="detail-label">Priority:</span><span>${priorityLabel}</span></div>`;
    }
    if (returnReq.status !== undefined) {
      const statusLabels = ['New', 'In Progress', 'Approved', 'Rejected', 'Cancelled'];
      html += `<div class="detail-row"><span class="detail-label">Status:</span><span>${statusLabels[returnReq.status] || `Status ${returnReq.status}`}</span></div>`;
    }
    const returnPurposeName = returnReq.requestPurpose?.nameEn ?? returnReq.requestPurpose?.nameAr;
    if (returnPurposeName) {
      html += `<div class="detail-row"><span class="detail-label">Request Purpose:</span><span>${this.escapeHtml(returnPurposeName)}</span></div>`;
    }
    if (returnReq.reason) {
      html += `<div class="detail-row"><span class="detail-label">Reason:</span><span>${this.escapeHtml(returnReq.reason)}</span></div>`;
    }
    if (returnReq.notes) {
      html += `<div class="detail-row"><span class="detail-label">Notes:</span><span>${this.escapeHtml(returnReq.notes)}</span></div>`;
    }

    // Add items if available
    if (returnReq.requestItems && returnReq.requestItems.length > 0) {
      html += '<div style="margin-top: 15px;"><h4 style="margin-bottom: 10px; color: #555;">Items:</h4><table style="width: 100%; border-collapse: collapse;"><thead><tr style="background-color: #f0f0f0;"><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Item</th><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Quantity</th></tr></thead><tbody>';
      returnReq.requestItems?.forEach((item: RequestItemDto) => {
        const label = item.itemName ?? (item as RequestItemDto & { name?: string }).name ?? `Item #${item.itemId}`;
        html += `<tr><td style="padding: 8px; border: 1px solid #ddd;">${this.escapeHtml(label)}</td><td style="padding: 8px; border: 1px solid #ddd;">${item.quantity ?? 0}</td></tr>`;
      });
      html += '</tbody></table></div>';
    }

    return html;
  }

  /**
   * Build discard details HTML
   */
  private buildDiscardDetails(discard: DiscardDto): string {
    let html = '';

    if (discard.requestNo) {
      html += `<div class="detail-row"><span class="detail-label">Discard Number:</span><span>${this.escapeHtml(discard.requestNo || `#${discard.id}`)}</span></div>`;
    }
    const discardDeptName = discard.department?.nameEn ?? discard.department?.nameAr;
    if (discardDeptName) {
      html += `<div class="detail-row"><span class="detail-label">Department:</span><span>${this.escapeHtml(discardDeptName)}</span></div>`;
    }
    const discardRequesterName = (discard as DiscardDto & { requesterName?: string }).requesterName
      ?? discard.requester?.fullNameEN ?? discard.requester?.fullNameAR ?? discard.requester?.userName;
    if (discardRequesterName) {
      html += `<div class="detail-row"><span class="detail-label">Requester:</span><span>${this.escapeHtml(discardRequesterName)}</span></div>`;
    }
    if (discard.priority !== undefined) {
      const priorityLabel = discard.priority === 1 ? 'High' : discard.priority === 2 ? 'Medium' : 'Low';
      html += `<div class="detail-row"><span class="detail-label">Priority:</span><span>${priorityLabel}</span></div>`;
    }
    if (discard.status !== undefined) {
      const statusLabels = ['New', 'In Progress', 'Approved', 'Rejected', 'Cancelled'];
      html += `<div class="detail-row"><span class="detail-label">Status:</span><span>${statusLabels[discard.status] || `Status ${discard.status}`}</span></div>`;
    }
    const discardPurposeName = discard.requestPurpose?.nameEn ?? discard.requestPurpose?.nameAr;
    if (discardPurposeName) {
      html += `<div class="detail-row"><span class="detail-label">Request Purpose:</span><span>${this.escapeHtml(discardPurposeName)}</span></div>`;
    }
    if (discard.reason) {
      html += `<div class="detail-row"><span class="detail-label">Reason:</span><span>${this.escapeHtml(discard.reason)}</span></div>`;
    }
    if (discard.notes) {
      html += `<div class="detail-row"><span class="detail-label">Notes:</span><span>${this.escapeHtml(discard.notes)}</span></div>`;
    }

    // Add items if available
    if (discard.requestItems && discard.requestItems.length > 0) {
      html += '<div style="margin-top: 15px;"><h4 style="margin-bottom: 10px; color: #555;">Items:</h4><table style="width: 100%; border-collapse: collapse;"><thead><tr style="background-color: #f0f0f0;"><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Item</th><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Quantity</th></tr></thead><tbody>';
      discard.requestItems?.forEach((item: RequestItemDto) => {
        const label = item.itemName ?? (item as RequestItemDto & { name?: string }).name ?? `Item #${item.itemId}`;
        html += `<tr><td style="padding: 8px; border: 1px solid #ddd;">${this.escapeHtml(label)}</td><td style="padding: 8px; border: 1px solid #ddd;">${item.quantity ?? 0}</td></tr>`;
      });
      html += '</tbody></table></div>';
    }

    return html;
  }

  /**
   * Check if a detail key is already shown in entity details section
   */
  private isEntityDetailKey(key: string, entityType?: string): boolean {
    if (!entityType) return false;
    const entityKeys = ['Order Number', 'Return Number', 'Discard Number', 'Department', 'Requester', 'Priority', 'Status', 'Request Purpose', 'Reason', 'Notes', 'Items Count'];
    return entityKeys.some(k => key.includes(k));
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

