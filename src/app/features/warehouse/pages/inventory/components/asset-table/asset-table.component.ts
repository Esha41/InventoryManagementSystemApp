import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { PERMISSIONS } from '@constants/permissions.constants';

import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Edit2, Trash2, Eye } from 'lucide-angular';
import { AssetDto } from '@models/asset.model';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { trackById } from '@utils/trackby.utils';

@Component({
  selector: 'app-asset-table',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    HasPermissionDirective
  ],
  templateUrl: './asset-table.component.html',
  styleUrls: ['./asset-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetTableComponent {
  readonly PERMISSIONS = PERMISSIONS;

  @Input() assets: AssetDto[] = [];
  @Input() getAssetItemName: (asset: AssetDto) => string = () => '';

  @Output() editAsset = new EventEmitter<AssetDto>();
  @Output() deleteAsset = new EventEmitter<AssetDto>();
  @Output() viewAsset = new EventEmitter<AssetDto>();

  readonly Edit2 = Edit2;
  readonly Trash2 = Trash2;
  readonly Eye = Eye;
  readonly trackById = trackById;
}

