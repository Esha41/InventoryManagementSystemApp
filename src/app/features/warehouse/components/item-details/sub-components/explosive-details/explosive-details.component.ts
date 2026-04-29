import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ItemDetailsResolvedContext } from '../../models/item-details-resolved-context';
import { ItemPropertyMapperService } from '../../services/item-property-mapper.service';

@Component({
  selector: 'app-explosive-details',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './explosive-details.component.html',
  styleUrls: ['./explosive-details.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExplosiveDetailsComponent {
  @Input({ required: true }) ctx!: ItemDetailsResolvedContext;

  constructor(public mapper: ItemPropertyMapperService) {}
}
