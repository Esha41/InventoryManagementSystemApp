import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { EditBatchFormComponent } from './edit-batch-form.component';

@Component({
  selector: 'app-edit-batch',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    LucideAngularModule,
    EditBatchFormComponent
  ],
  templateUrl: './edit-batch.component.html',
  styleUrls: ['./edit-batch.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditBatchComponent implements OnInit {
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;

  batchId = 0;
  warehouseId = 0;
  invalid = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) { }

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  ngOnInit(): void {
    this.batchId = Number(this.route.snapshot.paramMap.get('batchId'));
    this.warehouseId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.batchId || !this.warehouseId) {
      this.invalid = true;
    }
    this.cdr.markForCheck();
  }

  onCancel(): void {
    this.navigateToBatchInventory();
  }

  /** After successful save, return to warehouse batch tab (same as closing the old edit modal). */
  onSaved(): void {
    this.navigateToBatchInventory();
  }

  private navigateToBatchInventory(): void {
    this.router.navigate(['/warehouse', this.warehouseId, 'inventory'], {
      queryParams: { tab: 'batch' },
      queryParamsHandling: 'merge'
    });
  }
}
