import { Component, Input, ElementRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-annual-activity-card',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './annual-activity-card.component.html',
  styleUrls: ['./annual-activity-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnualActivityCardComponent {
  @Input() title: string = 'Annual Supply Activity';
  @Input() values: number[] = Array(12).fill(0);
  @Input() labels: string[] = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  @Input() months: string[] = ['All','JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  @Input() selectedMonth: string = 'All';

  get maxValue(): number {
    const max = Math.max(...this.values, 0);
    return max <= 0 ? 1 : max;
  }

  get tickValues(): number[] {
    const m = this.maxValue;
    return [0, Math.round(m * 0.25), Math.round(m * 0.5), Math.round(m * 0.75), m];
  }

  yFor(value: number): number {
    return 380 - (value / this.maxValue) * 320;
  }

  get displayValues(): number[] {
    if (this.selectedMonth === 'All') {
      return this.values;
    }
    const idx = this.labels.indexOf(this.selectedMonth);
    if (idx === -1) {
      return this.values;
    }
    return this.values.map((v, i) => (i === idx ? v : 0));
  }

  // Tooltip state
  hoveredIndex: number | null = null;
  tooltipX = 0;
  tooltipY = 0;
  @ViewChild('wrap', { static: true }) wrapRef!: ElementRef<HTMLDivElement>;

  onBarEnter(index: number, event: MouseEvent): void {
    this.hoveredIndex = index;
    this.updateTooltipPosition(event);
  }

  onBarLeave(): void {
    this.hoveredIndex = null;
  }

  onMove(event: MouseEvent): void {
    if (this.hoveredIndex !== null) {
      this.updateTooltipPosition(event);
    }
  }

  private updateTooltipPosition(event: MouseEvent): void {
    const rect = this.wrapRef?.nativeElement.getBoundingClientRect();
    if (!rect) return;
    this.tooltipX = event.clientX - rect.left + 8;
    this.tooltipY = event.clientY - rect.top - 34;
  }
}


