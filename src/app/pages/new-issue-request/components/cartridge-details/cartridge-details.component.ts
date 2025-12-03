import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Cartridge } from '../cartridge-list/cartridge-list.component';


@Component({
  selector: 'app-cartridge-details',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './cartridge-details.component.html',
  styleUrls: ['./cartridge-details.component.css']
})
export class CartridgeDetailsComponent {
  @Input() cartridge: Cartridge | null = null;
  @Input() showActions: boolean = true; // Control whether to show action buttons
  @Output() select = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onSelect(): void {
    this.select.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}

