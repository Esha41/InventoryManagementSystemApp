/**
 * Asset List Header Component
 * Page header with title, add button, and tab navigation
 */

import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Plus } from 'lucide-angular';
import { CardComponent } from '@components/card/card.component';
import { ButtonComponent } from '@components/button/button.component';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { AssetType } from '@models/asset-list.model';

type ViewMode = 'available' | 'deleted';

@Component({
  selector: 'app-asset-list-header',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    CardComponent,
    ButtonComponent,
    HasPermissionDirective
  ],
  templateUrl: './asset-list-header.component.html',
  styleUrls: ['./asset-list-header.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetListHeaderComponent {
  @Input() activeTab: AssetType = 'ammunition';
  @Input() ammunitionViewMode: ViewMode = 'available';
  @Input() explosivesViewMode: ViewMode = 'available';
  @Input() weaponsViewMode: ViewMode = 'available';
  @Input() isRTL = false;

  @Output() tabChange = new EventEmitter<AssetType>();
  @Output() addClick = new EventEmitter<void>();

  readonly Plus = Plus;

  get showAddButton(): boolean {
    return (
      (this.activeTab !== 'ammunition' || this.ammunitionViewMode === 'available') &&
      (this.activeTab !== 'explosive' || this.explosivesViewMode === 'available') &&
      (this.activeTab !== 'weapon' || this.weaponsViewMode === 'available')
    );
  }

  onTabClick(tab: AssetType): void {
    this.tabChange.emit(tab);
  }

  onAddClick(): void {
    this.addClick.emit();
  }
}
