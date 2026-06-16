import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X } from 'lucide-angular';

interface OrderDetailsRequest {
  orderId: string;
  requestDate: string;
  priority: string;
  requestType: string;
  status: string;
}

@Component({
  selector: 'app-order-details-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './order-details-modal.component.html',
  styleUrls: ['./order-details-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderDetailsModalComponent {
  @Input() isOpen = false;
  @Input() order: OrderDetailsRequest | null = null;
  @Output() close = new EventEmitter<void>();

  readonly X = X;

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}

