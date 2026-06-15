import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { WarehouseInventoryItem } from '@models/warehouse-inventory.model';
import { formatDateShort } from '@utils/format.utils';
import { AppNumberPipe } from '@shared/pipes/app-number.pipe';

@Component({
  selector: 'app-item-details-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule, AppNumberPipe],
  templateUrl: './item-details-modal.component.html',
  styleUrls: ['./item-details-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ItemDetailsModalComponent {
  @Input() isOpen = false;
  @Input() item: WarehouseInventoryItem | null = null;
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

  formatDate(date: Date): string {
    const formatted = formatDateShort(date);
    return formatted === 'N/A' ? '-' : formatted;
  }
}

