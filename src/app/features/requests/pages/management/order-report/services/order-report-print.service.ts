import { Injectable } from '@angular/core';
import { OrderSummary } from '@models/order-report.model';

/**
 * Service for handling print functionality for order reports
 */
@Injectable({
  providedIn: 'root'
})
export class OrderReportPrintService {
  /**
   * Print the order report
   * @param contentElement - The HTML element containing the report content
   * @param orderSummary - Order summary for title and metadata
   * @param isRTL - Whether the layout is right-to-left
   */
  printReport(contentElement: HTMLElement, orderSummary: OrderSummary, isRTL: boolean): void {
    if (!contentElement) {
      console.error('Report content element is required for printing');
      return;
    }

    const clone = contentElement.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script').forEach((s) => s.remove());
    const printContents = clone.innerHTML;

    const printStyles = this.generatePrintStyles(isRTL);
    // Blob documents use an opaque origin; root-relative URLs in CSS (e.g. /assets/...) need a real base URL.
    const baseHref = new URL('./', document.baseURI).href;

    const htmlDocument = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <base href="${baseHref}">
          <meta name="url" content="">
          <title>Request Report - ${orderSummary.orderId}</title>
          <style>
            ${printStyles}
          </style>
        </head>
        <body>
          ${printContents}
        </body>
      </html>
    `;

    const blob = new Blob([htmlDocument], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '', 'width=900,height=700');

    if (!printWindow) {
      URL.revokeObjectURL(url);
      console.error('Failed to open print window. Please check popup blocker settings.');
      return;
    }

    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
      URL.revokeObjectURL(url);
    }, 250);
  }

  /**
   * Generate print styles for the report
   * @param isRTL - Whether the layout is right-to-left
   * @returns CSS string for print styles
   */
  private generatePrintStyles(isRTL: boolean): string {
    return `
      @page {
        size: A4;
        margin: 0.8cm 1.5cm 1.5cm 1.5cm;
      }
      
      @page {
        @bottom-left {
          content: none;
        }
        @bottom-center {
          content: none;
        }
        @bottom-right {
          content: none;
        }
      }
      
      * {
        -webkit-print-color-adjust: exact;
        color-adjust: exact;
        print-color-adjust: exact;
      }
      
      body {
        font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        margin: 0;
        padding: 0;
        color: #000000;
        background: #ffffff;
        font-size: 11pt;
        line-height: 1.4;
        direction: ${isRTL ? 'rtl' : 'ltr'};
      }
      
      /* Hide non-printable elements */
      button, aside, .no-print {
        display: none !important;
      }
      
      /* Report container */
      .print-report-content {
        max-width: 100%;
        margin: 0;
        padding: 0;
      }
      
      /* Header section with Logo centered and QR on right */
      .print-header {
        margin-bottom: 20px;
        page-break-after: avoid;
      }
      
      .print-header-content {
        display: flex !important;
        justify-content: center !important;
        align-items: flex-start !important;
        margin-bottom: 15px !important;
        position: relative !important;
        min-height: 120px !important;
      }
      
      .print-logo-center {
        flex: 1 !important;
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
      }

      .print-logo.emdad-logo-mark--brand,
      .emdad-logo-mark--brand.print-logo {
        display: block !important;
        visibility: visible !important;
        max-width: 200px !important;
        width: 100% !important;
        height: 72px !important;
        background-color: #183553 !important;
        -webkit-mask-image: url('/assets/EMDAD-EXT-VER-Digi-Logo-White_updated.png') !important;
        mask-image: url('/assets/EMDAD-EXT-VER-Digi-Logo-White_updated.png') !important;
        -webkit-mask-size: contain !important;
        mask-size: contain !important;
        -webkit-mask-repeat: no-repeat !important;
        mask-repeat: no-repeat !important;
        -webkit-mask-position: center !important;
        mask-position: center !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      .print-qr-container {
        position: absolute !important;
        right: 0 !important;
        top: -10px !important;
        text-align: center !important;
        border: none !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
      
      .print-qr-code,
      img[alt="Order QR Code"] {
        width: 100px !important;
        height: 100px !important;
        display: block !important;
        margin: 0 auto 5px auto !important;
        border: none !important;
        padding: 5px !important;
        background: #ffffff !important;
      }
      
      .print-qr-label {
        font-size: 9pt !important;
        font-weight: bold !important;
        color: #000 !important;
        margin: 0 !important;
        text-align: center !important;
      }
      
      .print-divider {
        border-bottom: none !important;
        margin-top: 10px !important;
        margin-bottom: 15px !important;
      }
      
      /* Sections */
      .print-section,
      section {
        break-inside: avoid;
        page-break-inside: avoid;
        border: 2px solid #000 !important;
        border-radius: 0 !important;
        padding: 12px !important;
        margin-bottom: 15px !important;
        background: #ffffff !important;
        box-shadow: none !important;
      }
      
      .print-section-title {
        font-size: 14pt !important;
        font-weight: bold !important;
        color: #000 !important;
        margin: 0 0 8px 0 !important;
        padding-bottom: 6px !important;
      }
      
      .print-info-grid {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 8px 15px !important;
        margin-bottom: 0 !important;
        margin-top: 0 !important;
      }
      
      .print-info-item {
        display: flex !important;
        align-items: flex-start !important;
        gap: 10px !important;
        padding: 6px 0 !important;
        border-bottom: 1px solid #ddd !important;
        margin: 0 !important;
      }
      
      .print-info-item-span-full {
        grid-column: 1 / -1 !important;
      }
      
      .print-info-label {
        font-weight: bold !important;
        color: #333 !important;
        min-width: 120px !important;
        font-size: 9pt !important;
        flex-shrink: 0 !important;
      }
      
      .print-info-value {
        color: #000 !important;
        font-size: 9pt !important;
        flex: 1 !important;
        min-width: 0 !important;
      }
      
      .print-info-value-multiline {
        white-space: pre-wrap !important;
        word-break: break-word !important;
      }
      
      .order-info-section {
        position: relative !important;
      }
      
      .print-section-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        margin-bottom: 8px !important;
        padding-bottom: 6px !important;
        border-bottom: 2px solid #000 !important;
      }
      
      .print-section-title {
        margin: 0 !important;
        padding-bottom: 0 !important;
      }
      
      .allowance-badge {
        background: #f5f5f5 !important;
        padding: 4px 12px !important;
        border: none !important;
        border-radius: 6px !important;
        font-size: 10pt !important;
        font-weight: bold !important;
        color: #000 !important;
        white-space: nowrap !important;
        line-height: 1.4 !important;
        margin: 0 !important;
      }
      
      .priority-value,
      .priority-value.priority-normal,
      .priority-value.priority-urgent,
      .priority-value.priority-veryurgent {
        color: #000000 !important;
      }
      
      /* Order info: status as plain text when printing (no pill) */
      .order-info-section .status-badge {
        display: inline !important;
        align-items: unset !important;
        padding: 0 !important;
        margin: 0 !important;
        border: none !important;
        border-radius: 0 !important;
        background: none !important;
        background-color: transparent !important;
        box-shadow: none !important;
        font-size: 9pt !important;
        font-weight: normal !important;
        color: #000 !important;
        line-height: inherit !important;
        width: auto !important;
        max-width: none !important;
      }
      
      /* Professional Tables */
      .print-table,
      table {
        width: 100% !important;
        border-collapse: collapse !important;
        margin-top: 10px !important;
        page-break-inside: avoid !important;
        border: 2px solid #000 !important;
      }
      
      .print-table-header,
      table thead th {
        background-color: #333 !important;
        color: #ffffff !important;
        font-weight: bold !important;
        font-size: 10pt !important;
        padding: 6px 12px !important;
        text-align: left !important;
        border: 1px solid #000 !important;
      }
      
      .print-table-cell,
      table tbody td {
        padding: 6px 12px !important;
        border: 1px solid #333 !important;
        font-size: 10pt !important;
        color: #000 !important;
      }
      
      .print-table-row:nth-child(even),
      table tbody tr:nth-child(even) {
        background-color: #f9f9f9 !important;
      }
      
      .print-table-footer,
      table tfoot tr {
        background-color: #e8e8e8 !important;
        font-weight: bold !important;
      }
      
      .print-table-footer-cell,
      table tfoot td {
        padding: 6px 12px !important;
        border: 1px solid #000 !important;
        font-size: 10pt !important;
        font-weight: bold !important;
        color: #000 !important;
      }
      
      /* Approval Workflow Cards */
      .approval-workflow-cards {
        display: grid !important;
        grid-template-columns: repeat(4, 1fr) !important;
        gap: 6px !important;
        margin-top: 8px !important;
      }
      
      .approval-card {
        border: 1px solid #333 !important;
        border-radius: 0 !important;
        background: #ffffff !important;
        page-break-inside: avoid !important;
        overflow: hidden !important;
        font-size: 7pt !important;
      }
      
      .approval-card-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        padding: 4px 6px !important;
        background: #f5f5f5 !important;
        border-bottom: 1px solid #333 !important;
      }
      
      .approval-step-number {
        font-weight: bold !important;
        font-size: 7pt !important;
        color: #000 !important;
        background: #fff !important;
        border: 1px solid #333 !important;
        padding: 1px 5px !important;
        border-radius: 0 !important;
      }
      
      .approval-status {
        font-size: 6.5pt !important;
        font-weight: bold !important;
        padding: 2px 5px !important;
        border-radius: 0 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.2px !important;
      }
      
      .approval-status.status-approved {
        background: #d4edda !important;
        color: #155724 !important;
        border: 1px solid #155724 !important;
      }
      
      .approval-status.status-rejected {
        background: #f8d7da !important;
        color: #721c24 !important;
        border: 1px solid #721c24 !important;
      }
      
      .approval-status.status-pending {
        background: #fff3cd !important;
        color: #856404 !important;
        border: 1px solid #856404 !important;
      }
      
      .approval-status.status-in-progress {
        background: #d1ecf1 !important;
        color: #0c5460 !important;
        border: 1px solid #0c5460 !important;
      }

      .approval-status.status-returned,
      .approval-status.status-returnedforreview {
        background: #fff4e6 !important;
        color: #d9480f !important;
        border: 1px solid #d9480f !important;
      }
      
      .approval-card-body {
        padding: 5px 6px !important;
      }
      
      .approval-role {
        font-weight: bold !important;
        font-size: 7pt !important;
        color: #000 !important;
        margin-bottom: 2px !important;
      }
      
      .approval-approver {
        font-size: 6.5pt !important;
        color: #333 !important;
        margin-bottom: 2px !important;
      }
      
      .approval-date {
        font-size: 6pt !important;
        color: #666 !important;
        margin-bottom: 2px !important;
      }
      
      .approval-notes {
        font-size: 6pt !important;
        color: #444 !important;
        margin-top: 3px !important;
        padding-top: 3px !important;
        border-top: 1px dashed #ccc !important;
        line-height: 1.2 !important;
      }
      
      .approval-notes .notes-label {
        font-weight: bold !important;
        color: #000 !important;
        font-size: 6pt !important;
      }
      
      /* Headers */
      h1, h2, h3, h4 {
        color: #000000 !important;
        margin: 0.5rem 0 !important;
        page-break-after: avoid;
      }
      
      h2 {
        font-size: 18pt !important;
        font-weight: bold !important;
      }
      
      h3 {
        font-size: 14pt !important;
        font-weight: bold !important;
      }
      
      h4 {
        font-size: 12pt !important;
        font-weight: bold !important;
      }
      
      /* Remove backgrounds */
      .bg-gradient-to-br,
      .bg-gradient-to-r,
      .bg-white,
      .bg-slate-50,
      .bg-blue-50,
      .bg-indigo-100,
      .bg-green-100 {
        background: #ffffff !important;
      }
      
      .bg-gradient-to-r.from-slate-900,
      .bg-gradient-to-r.from-slate-800 {
        background: #000000 !important;
        color: #ffffff !important;
      }
      
      /* Text colors */
      .text-slate-900,
      .text-slate-700,
      .text-slate-600,
      .text-slate-500 {
        color: #000000 !important;
      }
      
      .text-white {
        color: #ffffff !important;
      }
      
      /* Badges */
      span[class*="bg-"],
      div[class*="bg-"] {
        background: #f0f0f0 !important;
        border: 1px solid #000 !important;
        color: #000000 !important;
      }
      
      /* Remove effects */
      .shadow-lg,
      .shadow-xl,
      .shadow-sm {
        box-shadow: none !important;
      }
      
      /* Spacing */
      .space-y-6 > * + * {
        margin-top: 1rem !important;
      }
      
      .p-8, .p-6, .p-5, .p-4 {
        padding: 0.75rem !important;
      }
      
      /* Hide icons */
      lucide-angular {
        display: none !important;
      }
      
      /* Page breaks */
      .page-break-before {
        page-break-before: always;
      }
      
      .page-break-after {
        page-break-after: always;
      }
      
      /* Print specific adjustments */
      .rounded-2xl {
        border-radius: 0 !important;
      }
      
      /* Ensure tables don't break */
      table, .grid {
        page-break-inside: avoid;
      }
      
      tr {
        page-break-inside: avoid;
      }
    `;
  }
}
