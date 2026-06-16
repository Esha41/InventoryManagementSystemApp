import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Crosshair } from 'lucide-angular';
import { InventoryDashboardSummaryDto } from '@models/inventory-dashboard-monitoring.model';

@Component({
  selector: 'app-inventory-dashboard-weapon-pipeline',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule],
  templateUrl: './inventory-dashboard-weapon-pipeline.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryDashboardWeaponPipelineComponent {
  @Input({ required: true }) monitoring!: InventoryDashboardSummaryDto;

  readonly Crosshair = Crosshair;
}
