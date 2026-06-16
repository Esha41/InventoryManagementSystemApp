import { Component, Input, Output, EventEmitter, HostListener, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, ChevronDown } from 'lucide-angular';

/** Selectable request statuses — single source of truth for the dropdown input and options. */
export const REQUEST_STATUS_OPTIONS = [
  'New',
  'Pending',
  'Confirmed',
  'Rejected',
  'Returned',
  'ReturnedForReview',
] as const;

export type RequestStatusOption = (typeof REQUEST_STATUS_OPTIONS)[number];

@Component({
  selector: 'app-status-dropdown',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './status-dropdown.component.html',
  styleUrls: ['./status-dropdown.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusDropdownComponent {
  @Input() status: RequestStatusOption = 'New';
  @Output() statusChange = new EventEmitter<RequestStatusOption>();

  readonly ChevronDown = ChevronDown;
  readonly statuses = REQUEST_STATUS_OPTIONS;
  isOpen = false;

  constructor(private elementRef: ElementRef) { }

  toggleDropdown(): void {
    this.isOpen = !this.isOpen;
  }

  selectStatus(newStatus: RequestStatusOption): void {
    if (newStatus !== this.status) {
      this.statusChange.emit(newStatus);
    }
    this.isOpen = false;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'New': return 'bg-[#DBEAFE] text-[#1E40AF]';
      case 'Pending': return 'bg-[#FEF3C7] text-[#92400E]';
      case 'Confirmed': return 'bg-[#D1FAE5] text-[#065F46]';
      case 'Rejected': return 'bg-[#FEE2E2] text-[#991B1B]';
      case 'Returned':
      case 'ReturnedForReview': return 'bg-purple-50 text-purple-700';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }
}

