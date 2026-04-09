/**
 * Asset List Header Component
 * Page header with title, add button, and tab navigation
 */

import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Plus, Download, Upload, FileText } from 'lucide-angular';
import { CardComponent } from '@components/card/card.component';
import { ButtonComponent } from '@components/button/button.component';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { AssetType } from '@models/asset-list.model';
import {
  ASSET_LIST_EXPORT_PERMISSIONS,
  ASSET_LIST_CREATE_PERMISSIONS,
  ASSET_LIST_TAB_PERMISSIONS
} from '@core/constants/asset-import-export-permissions';

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
  @Output() exportClick = new EventEmitter<void>();
  @Output() importClick = new EventEmitter<void>();
  @Output() templateClick = new EventEmitter<void>();

  readonly Plus = Plus;
  readonly Download = Download;
  readonly Upload = Upload;
  readonly FileText = FileText;

  get showAddButton(): boolean {
    return (
      (this.activeTab !== 'ammunition' || this.ammunitionViewMode === 'available') &&
      (this.activeTab !== 'explosive' || this.explosivesViewMode === 'available') &&
      (this.activeTab !== 'weapon' || this.weaponsViewMode === 'available')
    );
  }

  get assetExportPerms(): string[] {
    return [...ASSET_LIST_EXPORT_PERMISSIONS[this.activeTab]];
  }

  /** Add + import + template: same tab Create permission */
  get assetCreatePerms(): string[] {
    return [...ASSET_LIST_CREATE_PERMISSIONS[this.activeTab]];
  }

  get tabPermsAmmunition(): string[] {
    return [...ASSET_LIST_TAB_PERMISSIONS.ammunition];
  }

  get tabPermsExplosive(): string[] {
    return [...ASSET_LIST_TAB_PERMISSIONS.explosive];
  }

  get tabPermsWeapon(): string[] {
    return [...ASSET_LIST_TAB_PERMISSIONS.weapon];
  }

  onTabClick(tab: AssetType): void {
    this.tabChange.emit(tab);
  }

  onAddClick(): void {
    this.addClick.emit();
  }

  onExportClick(): void {
    this.exportClick.emit();
  }

  onImportClick(): void {
    this.importClick.emit();
  }

  onTemplateClick(): void {
    this.templateClick.emit();
  }
}
