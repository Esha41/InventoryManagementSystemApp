import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Order Success Component
 * Step 4 of the new issue request flow
 * Displays success message after order submission
 */
@Component({
  selector: 'app-order-success',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './order-success.component.html',
  styleUrls: ['./order-success.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderSuccessComponent {
  /** i18n keys — override for flows other than new issue (e.g. return request). */
  @Input() titleTranslateKey = 'newIssueRequest.orderSentSuccessfully';
  @Input() orderNumberLabelKey = 'newIssueRequest.orderNumber';
  @Input() trackButtonTranslateKey = 'newIssueRequest.goToDashboard';

  @Input() orderNumber: string | null = null;
  @Input() createdOrderId: number | null = null;
  @Output() trackOrder = new EventEmitter<void>();

  onTrackOrder(): void {
    this.trackOrder.emit();
  }
}

