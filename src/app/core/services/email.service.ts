import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ConfigService } from './config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { APIOperationResponse } from '@models/api-response.model';

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
    console.log('[EmailService] Sending email:', {
      to: request.to,
      subject: request.subject,
      endpoint: endpoint,
      fullUrl: endpoint
    });
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
    details?: Record<string, any>,
    entityDetails?: any,
    entityType?: string
  ): Observable<APIOperationResponse<void>> {
    const emailBody = this.buildNotificationEmailBody(title, message, details, entityDetails, entityType);
    console.log('[EmailService] Sending notification email with body:', emailBody);

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
    details?: Record<string, any>,
    entityDetails?: any,
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
  private buildPlainTextDetails(details?: Record<string, any>): string[] {
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
  private buildEntityPlainText(entityDetails?: any, entityType?: string): string[] {
    if (!entityDetails || !entityType) {
      return [];
    }

    const lines: string[] = [];

    switch (entityType.toLowerCase()) {
      case 'order':
        if (entityDetails.orderNo || entityDetails.requestNo) {
          lines.push(`  Order Number: ${entityDetails.orderNo || entityDetails.requestNo || `#${entityDetails.id}`}`);
        }
        if (entityDetails.departmentNameEn || entityDetails.departmentNameAr) {
          lines.push(`  Department: ${entityDetails.departmentNameEn || entityDetails.departmentNameAr}`);
        }
        if (entityDetails.requesterName) {
          lines.push(`  Requester: ${entityDetails.requesterName}`);
        }
        if (entityDetails.priority !== undefined) {
          const priorityLabel = entityDetails.priority === 1 ? 'High' : entityDetails.priority === 2 ? 'Medium' : 'Low';
          lines.push(`  Priority: ${priorityLabel}`);
        }
        if (entityDetails.status !== undefined) {
          const statusLabels = ['New', 'In Progress', 'Approved', 'Rejected', 'Cancelled'];
          lines.push(`  Status: ${statusLabels[entityDetails.status] || `Status ${entityDetails.status}`}`);
        }
        if (entityDetails.requestItems && entityDetails.requestItems.length > 0) {
          lines.push('  Items:');
          entityDetails.requestItems.forEach((item: any) => {
            lines.push(`    - ${item.itemName || item.name || `Item #${item.itemId}`}: ${item.quantity || 0}`);
          });
        }
        break;

      case 'return':
        if (entityDetails.requestNo) {
          lines.push(`  Return Number: ${entityDetails.requestNo || `#${entityDetails.id}`}`);
        }
        if (entityDetails.departmentName) {
          lines.push(`  Department: ${entityDetails.departmentName}`);
        }
        if (entityDetails.requesterName) {
          lines.push(`  Requester: ${entityDetails.requesterName}`);
        }
        if (entityDetails.priority !== undefined) {
          const priorityLabel = entityDetails.priority === 1 ? 'High' : entityDetails.priority === 2 ? 'Medium' : 'Low';
          lines.push(`  Priority: ${priorityLabel}`);
        }
        if (entityDetails.status !== undefined) {
          const statusLabels = ['New', 'In Progress', 'Approved', 'Rejected', 'Cancelled'];
          lines.push(`  Status: ${statusLabels[entityDetails.status] || `Status ${entityDetails.status}`}`);
        }
        if (entityDetails.requestItems && entityDetails.requestItems.length > 0) {
          lines.push('  Items:');
          entityDetails.requestItems.forEach((item: any) => {
            lines.push(`    - ${item.itemName || item.name || `Item #${item.itemId}`}: ${item.quantity || 0}`);
          });
        }
        break;

      case 'discard':
        if (entityDetails.requestNo) {
          lines.push(`  Discard Number: ${entityDetails.requestNo || `#${entityDetails.id}`}`);
        }
        if (entityDetails.departmentName) {
          lines.push(`  Department: ${entityDetails.departmentName}`);
        }
        if (entityDetails.requesterName) {
          lines.push(`  Requester: ${entityDetails.requesterName}`);
        }
        if (entityDetails.priority !== undefined) {
          const priorityLabel = entityDetails.priority === 1 ? 'High' : entityDetails.priority === 2 ? 'Medium' : 'Low';
          lines.push(`  Priority: ${priorityLabel}`);
        }
        if (entityDetails.status !== undefined) {
          const statusLabels = ['New', 'In Progress', 'Approved', 'Rejected', 'Cancelled'];
          lines.push(`  Status: ${statusLabels[entityDetails.status] || `Status ${entityDetails.status}`}`);
        }
        if (entityDetails.requestItems && entityDetails.requestItems.length > 0) {
          lines.push('  Items:');
          entityDetails.requestItems.forEach((item: any) => {
            lines.push(`    - ${item.itemName || item.name || `Item #${item.itemId}`}: ${item.quantity || 0}`);
          });
        }
        break;
    }

    return lines;
  }

  /**
   * Format a value for plain text output
   */
  private formatPlainTextValue(value: any): string {
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
  private buildOrderDetails(order: any): string {
    let html = '';

    if (order.orderNo || order.requestNo) {
      html += `<div class="detail-row"><span class="detail-label">Order Number:</span><span>${this.escapeHtml(order.orderNo || order.requestNo || `#${order.id}`)}</span></div>`;
    }
    if (order.departmentNameEn || order.departmentNameAr) {
      html += `<div class="detail-row"><span class="detail-label">Department:</span><span>${this.escapeHtml(order.departmentNameEn || order.departmentNameAr)}</span></div>`;
    }
    if (order.requesterName) {
      html += `<div class="detail-row"><span class="detail-label">Requester:</span><span>${this.escapeHtml(order.requesterName)}</span></div>`;
    }
    if (order.priority !== undefined) {
      const priorityLabel = order.priority === 1 ? 'High' : order.priority === 2 ? 'Medium' : 'Low';
      html += `<div class="detail-row"><span class="detail-label">Priority:</span><span>${priorityLabel}</span></div>`;
    }
    if (order.status !== undefined) {
      const statusLabels = ['New', 'In Progress', 'Approved', 'Rejected', 'Cancelled'];
      html += `<div class="detail-row"><span class="detail-label">Status:</span><span>${statusLabels[order.status] || `Status ${order.status}`}</span></div>`;
    }
    if (order.requestPurposeNameEn || order.requestPurposeNameAr) {
      html += `<div class="detail-row"><span class="detail-label">Request Purpose:</span><span>${this.escapeHtml(order.requestPurposeNameEn || order.requestPurposeNameAr)}</span></div>`;
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
      order.requestItems.forEach((item: any) => {
        html += `<tr><td style="padding: 8px; border: 1px solid #ddd;">${this.escapeHtml(item.itemName || item.name || `Item #${item.itemId}`)}</td><td style="padding: 8px; border: 1px solid #ddd;">${item.quantity || 0}</td></tr>`;
      });
      html += '</tbody></table></div>';
    }

    return html;
  }

  /**
   * Build return details HTML
   */
  private buildReturnDetails(returnReq: any): string {
    let html = '';

    if (returnReq.requestNo) {
      html += `<div class="detail-row"><span class="detail-label">Return Number:</span><span>${this.escapeHtml(returnReq.requestNo || `#${returnReq.id}`)}</span></div>`;
    }
    if (returnReq.departmentName) {
      html += `<div class="detail-row"><span class="detail-label">Department:</span><span>${this.escapeHtml(returnReq.departmentName)}</span></div>`;
    }
    if (returnReq.requesterName) {
      html += `<div class="detail-row"><span class="detail-label">Requester:</span><span>${this.escapeHtml(returnReq.requesterName)}</span></div>`;
    }
    if (returnReq.priority !== undefined) {
      const priorityLabel = returnReq.priority === 1 ? 'High' : returnReq.priority === 2 ? 'Medium' : 'Low';
      html += `<div class="detail-row"><span class="detail-label">Priority:</span><span>${priorityLabel}</span></div>`;
    }
    if (returnReq.status !== undefined) {
      const statusLabels = ['New', 'In Progress', 'Approved', 'Rejected', 'Cancelled'];
      html += `<div class="detail-row"><span class="detail-label">Status:</span><span>${statusLabels[returnReq.status] || `Status ${returnReq.status}`}</span></div>`;
    }
    if (returnReq.requestPurposeName) {
      html += `<div class="detail-row"><span class="detail-label">Request Purpose:</span><span>${this.escapeHtml(returnReq.requestPurposeName)}</span></div>`;
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
      returnReq.requestItems.forEach((item: any) => {
        html += `<tr><td style="padding: 8px; border: 1px solid #ddd;">${this.escapeHtml(item.itemName || item.name || `Item #${item.itemId}`)}</td><td style="padding: 8px; border: 1px solid #ddd;">${item.quantity || 0}</td></tr>`;
      });
      html += '</tbody></table></div>';
    }

    return html;
  }

  /**
   * Build discard details HTML
   */
  private buildDiscardDetails(discard: any): string {
    let html = '';

    if (discard.requestNo) {
      html += `<div class="detail-row"><span class="detail-label">Discard Number:</span><span>${this.escapeHtml(discard.requestNo || `#${discard.id}`)}</span></div>`;
    }
    if (discard.departmentName) {
      html += `<div class="detail-row"><span class="detail-label">Department:</span><span>${this.escapeHtml(discard.departmentName)}</span></div>`;
    }
    if (discard.requesterName) {
      html += `<div class="detail-row"><span class="detail-label">Requester:</span><span>${this.escapeHtml(discard.requesterName)}</span></div>`;
    }
    if (discard.priority !== undefined) {
      const priorityLabel = discard.priority === 1 ? 'High' : discard.priority === 2 ? 'Medium' : 'Low';
      html += `<div class="detail-row"><span class="detail-label">Priority:</span><span>${priorityLabel}</span></div>`;
    }
    if (discard.status !== undefined) {
      const statusLabels = ['New', 'In Progress', 'Approved', 'Rejected', 'Cancelled'];
      html += `<div class="detail-row"><span class="detail-label">Status:</span><span>${statusLabels[discard.status] || `Status ${discard.status}`}</span></div>`;
    }
    if (discard.requestPurposeName) {
      html += `<div class="detail-row"><span class="detail-label">Request Purpose:</span><span>${this.escapeHtml(discard.requestPurposeName)}</span></div>`;
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
      discard.requestItems.forEach((item: any) => {
        html += `<tr><td style="padding: 8px; border: 1px solid #ddd;">${this.escapeHtml(item.itemName || item.name || `Item #${item.itemId}`)}</td><td style="padding: 8px; border: 1px solid #ddd;">${item.quantity || 0}</td></tr>`;
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

