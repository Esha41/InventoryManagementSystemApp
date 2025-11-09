import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { ReturnDto } from '@services/return.service';

@Component({
  selector: 'app-return-details-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule],
  templateUrl: './return-details-modal.component.html',
  styleUrls: ['./return-details-modal.component.css']
})
export class ReturnDetailsModalComponent {
  @Input() isOpen = false;
  @Input() returnRequest: ReturnDto | null = null;
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

  getPriorityText(priority: number): string {
    switch (priority) {
      case 1: return 'dashboard.priorityLabels.high';
      case 2: return 'dashboard.priorityLabels.medium';
      case 3: return 'dashboard.priorityLabels.low';
      default: return 'N/A';
    }
  }

  getStatusText(status: number): string {
    switch (status) {
      case 1: return 'dashboard.statusLabels.new';
      case 2: return 'dashboard.statusLabels.underProcess';
      case 3: return 'dashboard.statusLabels.approved';
      case 4: return 'dashboard.statusLabels.rejected';
      case 5: return 'dashboard.statusLabels.cancelled';
      default: return 'N/A';
    }
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = d.getDate();
    const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 
                    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }

  getCurrentDate(): string {
    return this.formatDate(new Date());
  }
}

