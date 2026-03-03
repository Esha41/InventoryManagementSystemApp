import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight } from 'lucide-angular';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { TranslationService } from '@services/translation.service';

export type WarehouseDetailTab = 'overview' | 'stock';

@Component({
  selector: 'app-warehouse-detail-layout',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    LoadingStateComponent,
    ErrorStateComponent,
    HasPermissionDirective
  ],
  templateUrl: './warehouse-detail-layout.component.html',
  styleUrls: ['./warehouse-detail-layout.component.css']
})
export class WarehouseDetailLayoutComponent {
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;

  @Input() title = '';
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() hasData = false;
  @Input() showViewOnMap = true;
  @Input() activeTab: WarehouseDetailTab = 'overview';

  @Output() back = new EventEmitter<void>();
  @Output() mapView = new EventEmitter<void>();
  @Output() tabChange = new EventEmitter<WarehouseDetailTab>();

  constructor(private translationService: TranslationService) {}

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  onBack(): void {
    this.back.emit();
  }

  onMapView(): void {
    this.mapView.emit();
  }

  setActiveTab(tab: WarehouseDetailTab): void {
    this.tabChange.emit(tab);
  }
}
