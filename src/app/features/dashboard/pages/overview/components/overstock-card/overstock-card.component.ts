import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

export interface OverstockItemView {
  name: string;
  lot: number | string;
  percentage: number; // 0..100
  expiryDate?: string;
  imageUrl?: string;
}

@Component({
  selector: 'app-overstock-card',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './overstock-card.component.html',
  styleUrls: ['./overstock-card.component.css']
})
export class OverstockCardComponent {
  @Input() title: string = 'Overstock';
  @Input() items: OverstockItemView[] = [];
  isExpanded: boolean = false;

  toggle(): void {
    this.isExpanded = !this.isExpanded;
  }

  get visibleItems(): OverstockItemView[] {
    if (this.isExpanded) return this.items;
    return this.items.slice(0, 3);
  }
}


