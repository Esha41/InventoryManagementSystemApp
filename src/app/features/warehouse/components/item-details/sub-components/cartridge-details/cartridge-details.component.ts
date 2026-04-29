import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ItemDetailsResolvedContext } from '../../models/item-details-resolved-context';
import { ItemPropertyMapperService } from '../../services/item-property-mapper.service';
import { AmmunitionDetailsComponent } from '../ammunition-details/ammunition-details.component';
import { WeaponDetailsComponent } from '../weapon-details/weapon-details.component';
import { ExplosiveDetailsComponent } from '../explosive-details/explosive-details.component';

@Component({
  selector: 'app-cartridge-details',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    AmmunitionDetailsComponent,
    WeaponDetailsComponent,
    ExplosiveDetailsComponent
  ],
  templateUrl: './cartridge-details.component.html',
  styleUrls: ['./cartridge-details.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CartridgeDetailsComponent {
  @Input({ required: true }) ctx!: ItemDetailsResolvedContext;

  constructor(public mapper: ItemPropertyMapperService) {}
}
