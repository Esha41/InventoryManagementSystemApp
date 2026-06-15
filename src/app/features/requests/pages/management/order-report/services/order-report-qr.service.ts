import { Injectable } from '@angular/core';
import QRCode from 'qrcode';

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
      const qrCodeDataUrl = await QRCode.toDataURL(
        orderId,
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
}
