import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from '@services/config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { ApiService } from '@services/api.service';

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
  constructor(
    private config: ConfigService,
    private apiService: ApiService
  ) { }

  /**
   * Send an email
   */
  sendEmail(request: SendEmailRequest): Observable<void> {
    this.config.log('Sending email', { to: request.to, subject: request.subject });

    return this.apiService.post<void>(API_ENDPOINTS.EMAIL.SEND, {
      To: request.to,
      Subject: request.subject,
      Body: request.body,
      IsHtml: request.isHtml ?? true
    });
  }

  /**
   * Send email with notification details
   */
  sendNotificationEmail(
    recipientEmail: string,
    title: string,
    message: string,
    details?: Record<string, unknown>,
    entityDetails?: unknown,
    entityType?: string
  ): Observable<void> {
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
    entityDetails?: unknown,
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

  /** Coerce unknown API/entity payloads to a string-keyed record for safe reads. */
  private asEntityRecord(value: unknown): Record<string, unknown> | null {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
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
  private buildEntityPlainText(entityDetails?: unknown, entityType?: string): string[] {
    const entity = this.asEntityRecord(entityDetails);
    if (!entity || !entityType) {
      return [];
    }

    const lines: string[] = [];

    switch (entityType.toLowerCase()) {
      case 'order': {
        if (entity['orderNo'] || entity['requestNo']) {
          lines.push(`  Order Number: ${entity['orderNo'] || entity['requestNo'] || `#${entity['id']}`}`);
        }
        if (entity['departmentNameEn'] || entity['departmentNameAr']) {
          lines.push(`  Department: ${entity['departmentNameEn'] || entity['departmentNameAr']}`);
        }
        if (entity['requesterName']) {
          lines.push(`  Requester: ${entity['requesterName']}`);
        }
        if (entity['priority'] !== undefined) {
          const priorityLabel = entity['priority'] === 1 ? 'High' : entity['priority'] === 2 ? 'Medium' : 'Low';
          lines.push(`  Priority: ${priorityLabel}`);
        }
        if (entity['status'] !== undefined) {
          const statusLabels = ['New', 'In Progress', 'Approved', 'Rejected', 'Cancelled'];
          const status = entity['status'] as number;
          lines.push(`  Status: ${statusLabels[status] ?? `Status ${status}`}`);
        }
        const orderItems = entity['requestItems'] as unknown[] | undefined;
        if (orderItems && Array.isArray(orderItems) && orderItems.length > 0) {
          lines.push('  Items:');
          orderItems.forEach((item: unknown) => {
            const i = this.asEntityRecord(item);
            lines.push(`    - ${i?.['itemName'] || i?.['name'] || `Item #${i?.['itemId']}`}: ${i?.['quantity'] ?? 0}`);
          });
        }
        break;
      }

      case 'return': {
        if (entity['requestNo']) {
          lines.push(`  Return Number: ${entity['requestNo'] || `#${entity['id']}`}`);
        }
        if (entity['departmentName']) {
          lines.push(`  Department: ${entity['departmentName']}`);
        }
        if (entity['requesterName']) {
          lines.push(`  Requester: ${entity['requesterName']}`);
        }
        if (entity['priority'] !== undefined) {
          const priorityLabel = entity['priority'] === 1 ? 'High' : entity['priority'] === 2 ? 'Medium' : 'Low';
          lines.push(`  Priority: ${priorityLabel}`);
        }
        if (entity['status'] !== undefined) {
          const statusLabels = ['New', 'In Progress', 'Approved', 'Rejected', 'Cancelled'];
          const status = entity['status'] as number;
          lines.push(`  Status: ${statusLabels[status] ?? `Status ${status}`}`);
        }
        const returnItems = entity['requestItems'] as unknown[] | undefined;
        if (returnItems && Array.isArray(returnItems) && returnItems.length > 0) {
          lines.push('  Items:');
          returnItems.forEach((item: unknown) => {
            const i = this.asEntityRecord(item);
            lines.push(`    - ${i?.['itemName'] || i?.['name'] || `Item #${i?.['itemId']}`}: ${i?.['quantity'] ?? 0}`);
          });
        }
        break;
      }

      case 'discard': {
        if (entity['requestNo']) {
          lines.push(`  Discard Number: ${entity['requestNo'] || `#${entity['id']}`}`);
        }
        if (entity['departmentName']) {
          lines.push(`  Department: ${entity['departmentName']}`);
        }
        if (entity['requesterName']) {
          lines.push(`  Requester: ${entity['requesterName']}`);
        }
        if (entity['priority'] !== undefined) {
          const priorityLabel = entity['priority'] === 1 ? 'High' : entity['priority'] === 2 ? 'Medium' : 'Low';
          lines.push(`  Priority: ${priorityLabel}`);
        }
        if (entity['status'] !== undefined) {
          const statusLabels = ['New', 'In Progress', 'Approved', 'Rejected', 'Cancelled'];
          const status = entity['status'] as number;
          lines.push(`  Status: ${statusLabels[status] ?? `Status ${status}`}`);
        }
        const discardItems = entity['requestItems'] as unknown[] | undefined;
        if (discardItems && Array.isArray(discardItems) && discardItems.length > 0) {
          lines.push('  Items:');
          discardItems.forEach((item: unknown) => {
            const i = this.asEntityRecord(item);
            lines.push(`    - ${i?.['itemName'] || i?.['name'] || `Item #${i?.['itemId']}`}: ${i?.['quantity'] ?? 0}`);
          });
        }
        break;
      }
    }

    return lines;
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
  private buildOrderDetails(order: unknown): string {
    const o = this.asEntityRecord(order);
    if (!o) {
      return '';
    }

    let html = '';

    if (o['orderNo'] || o['requestNo']) {
      html += `<div class="detail-row"><span class="detail-label">Order Number:</span><span>${this.escapeHtml(String(o['orderNo'] ?? o['requestNo'] ?? `#${o['id'] ?? ''}`))}</span></div>`;
    }
    if (o['departmentNameEn'] || o['departmentNameAr']) {
      html += `<div class="detail-row"><span class="detail-label">Department:</span><span>${this.escapeHtml(String(o['departmentNameEn'] ?? o['departmentNameAr'] ?? ''))}</span></div>`;
    }
    if (o['requesterName']) {
      html += `<div class="detail-row"><span class="detail-label">Requester:</span><span>${this.escapeHtml(String(o['requesterName']))}</span></div>`;
    }
    if (o['priority'] !== undefined) {
      const priorityLabel = o['priority'] === 1 ? 'High' : o['priority'] === 2 ? 'Medium' : 'Low';
      html += `<div class="detail-row"><span class="detail-label">Priority:</span><span>${priorityLabel}</span></div>`;
    }
    if (o['status'] !== undefined) {
      const statusLabels = ['New', 'In Progress', 'Approved', 'Rejected', 'Cancelled'];
      const status = typeof o['status'] === 'number' ? o['status'] : Number(o['status']);
      html += `<div class="detail-row"><span class="detail-label">Status:</span><span>${statusLabels[status] || `Status ${String(o['status'])}`}</span></div>`;
    }
    if (o['requestPurposeNameEn'] || o['requestPurposeNameAr']) {
      html += `<div class="detail-row"><span class="detail-label">Request Purpose:</span><span>${this.escapeHtml(String(o['requestPurposeNameEn'] ?? o['requestPurposeNameAr'] ?? ''))}</span></div>`;
    }
    if (o['usageDateFrom']) {
      const fromDate = new Date(o['usageDateFrom'] as string | number | Date).toLocaleString();
      const toDate = o['usageDateTo'] ? new Date(o['usageDateTo'] as string | number | Date).toLocaleString() : '';
      const fromTime = String(o['usageTimeFrom'] ?? '');
      const toTime = String(o['usageTimeTo'] ?? '');
      const dateRange = toDate
        ? `${fromDate} ${fromTime} - ${toDate} ${toTime}`
        : `${fromDate} ${fromTime}`;
      html += `<div class="detail-row"><span class="detail-label">Usage Date:</span><span>${dateRange}</span></div>`;
    }
    if (o['usageLocation']) {
      html += `<div class="detail-row"><span class="detail-label">Usage Location:</span><span>${this.escapeHtml(String(o['usageLocation']))}</span></div>`;
    }
    if (o['notes']) {
      html += `<div class="detail-row"><span class="detail-label">Notes:</span><span>${this.escapeHtml(String(o['notes']))}</span></div>`;
    }

    const requestItems = o['requestItems'];
    if (Array.isArray(requestItems) && requestItems.length > 0) {
      html += '<div style="margin-top: 15px;"><h4 style="margin-bottom: 10px; color: #555;">Items:</h4><table style="width: 100%; border-collapse: collapse;"><thead><tr style="background-color: #f0f0f0;"><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Item</th><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Quantity</th></tr></thead><tbody>';
      requestItems.forEach((item: unknown) => {
        const i = this.asEntityRecord(item);
        const name = String(i?.['itemName'] ?? i?.['name'] ?? `Item #${i?.['itemId'] ?? ''}`);
        const qty = i?.['quantity'] ?? 0;
        html += `<tr><td style="padding: 8px; border: 1px solid #ddd;">${this.escapeHtml(name)}</td><td style="padding: 8px; border: 1px solid #ddd;">${String(qty)}</td></tr>`;
      });
      html += '</tbody></table></div>';
    }

    return html;
  }

  /**
   * Build return details HTML
   */
  private buildReturnDetails(returnReq: unknown): string {
    const r = this.asEntityRecord(returnReq);
    if (!r) {
      return '';
    }

    let html = '';

    if (r['requestNo']) {
      html += `<div class="detail-row"><span class="detail-label">Return Number:</span><span>${this.escapeHtml(String(r['requestNo'] ?? `#${r['id'] ?? ''}`))}</span></div>`;
    }
    if (r['departmentName']) {
      html += `<div class="detail-row"><span class="detail-label">Department:</span><span>${this.escapeHtml(String(r['departmentName']))}</span></div>`;
    }
    if (r['requesterName']) {
      html += `<div class="detail-row"><span class="detail-label">Requester:</span><span>${this.escapeHtml(String(r['requesterName']))}</span></div>`;
    }
    if (r['priority'] !== undefined) {
      const priorityLabel = r['priority'] === 1 ? 'High' : r['priority'] === 2 ? 'Medium' : 'Low';
      html += `<div class="detail-row"><span class="detail-label">Priority:</span><span>${priorityLabel}</span></div>`;
    }
    if (r['status'] !== undefined) {
      const statusLabels = ['New', 'In Progress', 'Approved', 'Rejected', 'Cancelled'];
      const status = typeof r['status'] === 'number' ? r['status'] : Number(r['status']);
      html += `<div class="detail-row"><span class="detail-label">Status:</span><span>${statusLabels[status] || `Status ${String(r['status'])}`}</span></div>`;
    }
    if (r['requestPurposeName']) {
      html += `<div class="detail-row"><span class="detail-label">Request Purpose:</span><span>${this.escapeHtml(String(r['requestPurposeName']))}</span></div>`;
    }
    if (r['reason']) {
      html += `<div class="detail-row"><span class="detail-label">Reason:</span><span>${this.escapeHtml(String(r['reason']))}</span></div>`;
    }
    if (r['notes']) {
      html += `<div class="detail-row"><span class="detail-label">Notes:</span><span>${this.escapeHtml(String(r['notes']))}</span></div>`;
    }

    const requestItems = r['requestItems'];
    if (Array.isArray(requestItems) && requestItems.length > 0) {
      html += '<div style="margin-top: 15px;"><h4 style="margin-bottom: 10px; color: #555;">Items:</h4><table style="width: 100%; border-collapse: collapse;"><thead><tr style="background-color: #f0f0f0;"><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Item</th><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Quantity</th></tr></thead><tbody>';
      requestItems.forEach((item: unknown) => {
        const i = this.asEntityRecord(item);
        const name = String(i?.['itemName'] ?? i?.['name'] ?? `Item #${i?.['itemId'] ?? ''}`);
        const qty = i?.['quantity'] ?? 0;
        html += `<tr><td style="padding: 8px; border: 1px solid #ddd;">${this.escapeHtml(name)}</td><td style="padding: 8px; border: 1px solid #ddd;">${String(qty)}</td></tr>`;
      });
      html += '</tbody></table></div>';
    }

    return html;
  }

  /**
   * Build discard details HTML
   */
  private buildDiscardDetails(discard: unknown): string {
    const d = this.asEntityRecord(discard);
    if (!d) {
      return '';
    }

    let html = '';

    if (d['requestNo']) {
      html += `<div class="detail-row"><span class="detail-label">Discard Number:</span><span>${this.escapeHtml(String(d['requestNo'] ?? `#${d['id'] ?? ''}`))}</span></div>`;
    }
    if (d['departmentName']) {
      html += `<div class="detail-row"><span class="detail-label">Department:</span><span>${this.escapeHtml(String(d['departmentName']))}</span></div>`;
    }
    if (d['requesterName']) {
      html += `<div class="detail-row"><span class="detail-label">Requester:</span><span>${this.escapeHtml(String(d['requesterName']))}</span></div>`;
    }
    if (d['priority'] !== undefined) {
      const priorityLabel = d['priority'] === 1 ? 'High' : d['priority'] === 2 ? 'Medium' : 'Low';
      html += `<div class="detail-row"><span class="detail-label">Priority:</span><span>${priorityLabel}</span></div>`;
    }
    if (d['status'] !== undefined) {
      const statusLabels = ['New', 'In Progress', 'Approved', 'Rejected', 'Cancelled'];
      const status = typeof d['status'] === 'number' ? d['status'] : Number(d['status']);
      html += `<div class="detail-row"><span class="detail-label">Status:</span><span>${statusLabels[status] || `Status ${String(d['status'])}`}</span></div>`;
    }
    if (d['requestPurposeName']) {
      html += `<div class="detail-row"><span class="detail-label">Request Purpose:</span><span>${this.escapeHtml(String(d['requestPurposeName']))}</span></div>`;
    }
    if (d['reason']) {
      html += `<div class="detail-row"><span class="detail-label">Reason:</span><span>${this.escapeHtml(String(d['reason']))}</span></div>`;
    }
    if (d['notes']) {
      html += `<div class="detail-row"><span class="detail-label">Notes:</span><span>${this.escapeHtml(String(d['notes']))}</span></div>`;
    }

    const requestItems = d['requestItems'];
    if (Array.isArray(requestItems) && requestItems.length > 0) {
      html += '<div style="margin-top: 15px;"><h4 style="margin-bottom: 10px; color: #555;">Items:</h4><table style="width: 100%; border-collapse: collapse;"><thead><tr style="background-color: #f0f0f0;"><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Item</th><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Quantity</th></tr></thead><tbody>';
      requestItems.forEach((item: unknown) => {
        const i = this.asEntityRecord(item);
        const name = String(i?.['itemName'] ?? i?.['name'] ?? `Item #${i?.['itemId'] ?? ''}`);
        const qty = i?.['quantity'] ?? 0;
        html += `<tr><td style="padding: 8px; border: 1px solid #ddd;">${this.escapeHtml(name)}</td><td style="padding: 8px; border: 1px solid #ddd;">${String(qty)}</td></tr>`;
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

