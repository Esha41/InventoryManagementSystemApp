import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X } from 'lucide-angular';

interface Request {
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
  styleUrls: ['./order-details-modal.component.css']
})
export class OrderDetailsModalComponent {
  @Input() isOpen = false;
  @Input() order: Request | null = null;
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

