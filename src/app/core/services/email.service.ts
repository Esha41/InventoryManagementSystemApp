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
  ) {}

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
        console.error('[EmailService] Email send failed:', error);
        console.error('[EmailService] Error status:', error?.status);
        console.error('[EmailService] Error message:', error?.message);
        console.error('[EmailService] Error response:', error?.error);
        console.error('[EmailService] Full error object:', error);
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
    
    return this.sendEmail({
      to: recipientEmail,
      subject: title,
      body: emailBody,
      isHtml: true
    });
  }

  /**
   * Build HTML email body from notification details
   */
  private buildNotificationEmailBody(
    title: string,
    message: string,
    details?: Record<string, any>,
    entityDetails?: any,
    entityType?: string
  ): string {
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4a90e2; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .details { margin-top: 20px; padding: 15px; background-color: white; border-left: 4px solid #4a90e2; }
          .detail-row { margin: 10px 0; }
          .detail-label { font-weight: bold; color: #555; }
          .footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${this.escapeHtml(title)}</h2>
          </div>
          <div class="content">
            <p>${this.escapeHtml(message)}</p>
    `;

    // Add entity-specific detailed information
    if (entityDetails && entityType) {
      html += this.buildEntityDetailsSection(entityDetails, entityType);
    }

    // Add general details
    if (details && Object.keys(details).length > 0) {
      html += '<div class="details"><h3>Notification Details:</h3>';
      for (const [key, value] of Object.entries(details)) {
        if (value !== null && value !== undefined && !this.isEntityDetailKey(key, entityType)) {
          html += `
            <div class="detail-row">
              <span class="detail-label">${this.escapeHtml(String(key))}:</span>
              <span>${this.escapeHtml(String(value))}</span>
            </div>
          `;
        }
      }
      html += '</div>';
    }

    html += `
          </div>
          <div class="footer">
            <p>This is an automated notification email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  /**
   * Build entity-specific details section (Order, Return, Discard)
   */
  private buildEntityDetailsSection(entityDetails: any, entityType: string): string {
    let html = '<div class="details"><h3>';
    
    switch (entityType) {
      case 'order':
        html += 'Order Details:</h3>';
        html += this.buildOrderDetails(entityDetails);
        break;
      case 'return':
        html += 'Return Request Details:</h3>';
        html += this.buildReturnDetails(entityDetails);
        break;
      case 'discard':
        html += 'Discard Request Details:</h3>';
        html += this.buildDiscardDetails(entityDetails);
        break;
      default:
        html += 'Details:</h3>';
    }
    
    html += '</div>';
    return html;
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
      const statusLabels = ['New', 'Under Process', 'Approved', 'Rejected', 'Cancelled'];
      html += `<div class="detail-row"><span class="detail-label">Status:</span><span>${statusLabels[order.status] || `Status ${order.status}`}</span></div>`;
    }
    if (order.requestPurposeNameEn || order.requestPurposeNameAr) {
      html += `<div class="detail-row"><span class="detail-label">Request Purpose:</span><span>${this.escapeHtml(order.requestPurposeNameEn || order.requestPurposeNameAr)}</span></div>`;
    }
    if (order.usageDate) {
      html += `<div class="detail-row"><span class="detail-label">Usage Date:</span><span>${new Date(order.usageDate).toLocaleString()}</span></div>`;
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
      const statusLabels = ['New', 'Under Process', 'Approved', 'Rejected', 'Cancelled'];
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
      const statusLabels = ['New', 'Under Process', 'Approved', 'Rejected', 'Cancelled'];
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

