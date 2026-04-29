import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ItemDetailsResolvedContext } from '../../models/item-details-resolved-context';
import { ItemPropertyMapperService } from '../../services/item-property-mapper.service';

@Component({
  selector: 'app-weapon-details',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './weapon-details.component.html',
  styleUrls: ['./weapon-details.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeaponDetailsComponent {
  @Input({ required: true }) ctx!: ItemDetailsResolvedContext;

  constructor(public mapper: ItemPropertyMapperService) {}
}
