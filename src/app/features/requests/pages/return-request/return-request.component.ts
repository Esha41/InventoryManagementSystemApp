import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { StepperComponent } from '@components/stepper/stepper.component';
import { ConfirmationDialogComponent } from '@components/confirmation-dialog/confirmation-dialog.component';
import { ReturnRequestFacade } from './services/return-request.facade';
import { StepSelectionComponent } from '@requests/pages/new-issue/components/step-selection/step-selection.component';
import { ReturnDetailsStepComponent } from './components/return-details-step/return-details-step.component';
import { ReturnReviewStepComponent } from './components/return-review-step/return-review-step.component';
import { OrderSuccessComponent } from '@requests/pages/new-issue/components/order-success/order-success.component';

@Component({
  selector: 'app-return-request',
  standalone: true,
  providers: [ReturnRequestFacade],
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    StepperComponent,
    ConfirmationDialogComponent,
    StepSelectionComponent,
    ReturnDetailsStepComponent,
    ReturnReviewStepComponent,
    OrderSuccessComponent
  ],
  templateUrl: './return-request.component.html',
  styleUrls: ['./return-request.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReturnRequestComponent implements OnInit, OnDestroy, AfterViewInit {
  constructor(readonly facade: ReturnRequestFacade) {}

  ngOnInit(): void { this.facade.init(); }
  ngOnDestroy(): void { this.facade.destroy(); }
  ngAfterViewInit(): void { this.facade.afterViewInit(); }

  getRequestPurposeNameForReview(): string {
    const id = this.facade.detailsState.requestPurposeId;
    return id != null ? this.facade.getRequestPurposeName(id) : '';
  }

  onFilesSelected(event: Event): void {
    this.facade.onFilesSelected(event);
  }

  onFileRemoved(event: { index: number; fileInput: HTMLInputElement | null }): void {
    this.facade.removeFile(event.index, event.fileInput);
  }
}
