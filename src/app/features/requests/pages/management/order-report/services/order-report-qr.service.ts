import { Injectable } from '@angular/core';
import QRCode from 'qrcode';
import { OrderSummary } from '@models/order-report.model';
import { generateQrCodeData } from '../../utils/order-report.utils';

/**
 * Service for generating QR codes for order reports
 */
@Injectable({
  providedIn: 'root'
})
export class OrderReportQrService {
  /**
   * Generate QR code image as data URL
   * @param orderId - The order ID to encode in the QR code
   * @returns Promise resolving to QR code data URL or null if generation fails
   */
  async generateQrCode(orderId: string): Promise<string | null> {
    if (!orderId || orderId.trim() === '') {
      return null;
    }

    try {
      const qrData = orderId;
      const qrCodeDataUrl = await QRCode.toDataURL(
        qrData,
        {
          width: 320,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' },
          errorCorrectionLevel: 'H'
        }
      );
      return qrCodeDataUrl;
    } catch (error) {
      console.error('Failed to generate QR code', error);
      return null;
    }
  }

  /**
   * Generate QR code data string for order summary
   * This creates a human-readable and JSON format string for the QR code
   * @param orderSummary - The order summary to encode
   * @param localizedUsagePurpose - Optional localized usage purpose string
   * @returns QR code data string
   */
  generateQrCodeData(orderSummary: OrderSummary, localizedUsagePurpose?: string): string {
    return generateQrCodeData(orderSummary, localizedUsagePurpose);
  }
}
