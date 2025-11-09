import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { DiscardDto } from '@services/discard.service';

@Component({
  selector: 'app-discard-details-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule],
  templateUrl: './discard-details-modal.component.html',
  styleUrls: ['./discard-details-modal.component.css']
})
export class DiscardDetailsModalComponent {
  @Input() isOpen = false;
  @Input() discardRequest: DiscardDto | null = null;
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

  getCurrentDate(): string {
    return this.formatDate(new Date());
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
}

