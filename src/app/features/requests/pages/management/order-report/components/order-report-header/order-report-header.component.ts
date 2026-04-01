import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Component for displaying the order report header with logo and QR code
 */
@Component({
  selector: 'app-order-report-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-report-header.component.html',
  styleUrls: ['./order-report-header.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderReportHeaderComponent {
  @Input() qrCodeDataUrl: string | null = null;
  @Input() orderId: string = '';
}
