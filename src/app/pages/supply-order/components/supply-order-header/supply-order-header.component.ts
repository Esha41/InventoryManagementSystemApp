import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { OrderDto } from '@services/order.service';
import { SupplyDto } from '@services/supply.service';

/**
 * Supply Order Header Component
 * Displays the header with back button, title, and supply ID
 * Extracted from supply-order.component.ts following Angular best practices
 */
@Component({
  selector: 'app-supply-order-header',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule
  ],
  templateUrl: './supply-order-header.component.html',
  styleUrls: ['./supply-order-header.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupplyOrderHeaderComponent {
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;

  @Input() orderData: OrderDto | null = null;
  @Input() supplyData: SupplyDto | null = null;
  @Output() backClick = new EventEmitter<void>();

  constructor(private translationService: TranslationService) {}

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  onBackClick(): void {
    this.backClick.emit();
  }
}

