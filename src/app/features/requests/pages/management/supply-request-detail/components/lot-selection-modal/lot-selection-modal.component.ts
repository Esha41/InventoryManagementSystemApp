/**
 * Lot Selection Modal Component
 * Handles lot selection for a single order item
 */

import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Package, AlertTriangle, X } from 'lucide-angular';
import { ModalComponent } from '@components/modal/modal.component';
import { OrderItem, LotItem } from '@models/supply-request.model';
import { getLotConditionClass as lookupLotConditionClass } from '../../../utils/ui-helpers.utils';
import { formatDate as formatDateUtil, formatNumber as formatNumberUtil } from '@utils/format.utils';

@Component({
  selector: 'app-lot-selection-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    ModalComponent
  ],
  templateUrl: './lot-selection-modal.component.html',
  styleUrls: ['./lot-selection-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LotSelectionModalComponent implements OnInit, OnChanges {
  @Input() isOpen: boolean = false;
  @Input() selectedItem: OrderItem | null = null;
  @Input() availableLots: LotItem[] = [];
  @Input() loadingAllLots: boolean = false;
  @Input() loadingManualLot: boolean = false;
  @Output() closed = new EventEmitter<void>();
  @Output() showAvailableLots = new EventEmitter<void>();
  @Output() showAllLots = new EventEmitter<void>();
  @Output() addLotManually = new EventEmitter<void>();
  @Output() getManualLotDetails = new EventEmitter<string>();
  @Output() lotQuantityChange = new EventEmitter<{ lotNumber: string; quantity: number }>();
  @Output() removeLot = new EventEmitter<string>();
  @Output() confirmSelection = new EventEmitter<Map<string, number>>();

  readonly Package = Package;
  readonly AlertTriangle = AlertTriangle;
  readonly XIcon = X;

  tempLotSelections: Map<string, number> = new Map();
  showManualLotEntry: boolean = false;
  manualLotNumber: string = '';

  constructor(
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    if (this.selectedItem) {
      this.initializeTempSelections();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedItem'] && this.selectedItem && this.isOpen) {
      this.initializeTempSelections();
    }
  }

  private initializeTempSelections(): void {
    this.tempLotSelections.clear();
    if (this.selectedItem?.availableLots) {
      this.selectedItem.availableLots.forEach(lot => {
        if (lot.selectedQuantity > 0) {
          this.tempLotSelections.set(String(lot.lotNumber), lot.selectedQuantity);
        }
      });
    }
  }

  onClose(): void {
    this.showManualLotEntry = false;
    this.manualLotNumber = '';
    this.closed.emit();
  }

  onShowAvailableLots(): void {
    this.showAvailableLots.emit();
  }

  onShowAllLots(): void {
    this.showAllLots.emit();
  }

  onAddLotManually(): void {
    this.showManualLotEntry = !this.showManualLotEntry;
    if (this.showManualLotEntry) {
      this.manualLotNumber = '';
    }
    this.addLotManually.emit();
  }

  onGetManualLotDetails(): void {
    if (this.manualLotNumber.trim()) {
      this.getManualLotDetails.emit(this.manualLotNumber.trim());
      this.manualLotNumber = '';
    }
  }

  onLotQuantityChange(lotNumber: string, quantity: number): void {
    // Handle NaN or invalid values
    const validQuantity = Number.isNaN(quantity) ? 0 : Math.max(0, quantity);
    const key = String(lotNumber);

    if (validQuantity > 0) {
      this.tempLotSelections.set(key, validQuantity);
    } else {
      this.tempLotSelections.delete(key);
    }
    this.lotQuantityChange.emit({ lotNumber: key, quantity: validQuantity });
  }

  onRemoveLot(lotNumber: string): void {
    const key = String(lotNumber);
    this.removeLot.emit(key);
    this.tempLotSelections.delete(key);
  }

  getTempTotalSelected(): number {
    return Array.from(this.tempLotSelections.values())
      .reduce((sum, qty) => sum + qty, 0);
  }

  canConfirmSelection(): boolean {
    if (!this.selectedItem) return false;
    const total = this.getTempTotalSelected();
    return total > 0 && total <= this.selectedItem.approvedQuantity;
  }

  onConfirmSelection(): void {
    if (this.canConfirmSelection()) {
      this.confirmSelection.emit(new Map(this.tempLotSelections));
      this.onClose();
    }
  }

  getLotConditionClass(condition: string): string {
    return lookupLotConditionClass(condition);
  }

  formatDate(date: Date | string | undefined): string {
    return formatDateUtil(date);
  }

  formatNumber(num: number): string {
    return formatNumberUtil(num);
  }

  getTempQuantity(lotNumber: string): number {
    return this.tempLotSelections.get(String(lotNumber)) || 0;
  }
}

