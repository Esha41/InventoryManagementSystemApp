import {
  Component,
  OnDestroy,
  OnInit,
  AfterViewInit,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { StepperComponent } from '@components/stepper/stepper.component';
import { UsageFormComponent } from './components/usage-form/usage-form.component';
import { ReviewFormComponent } from './components/review-form/review-form.component';
import { AllowanceSelectionComponent } from './components/allowance-selection/allowance-selection.component';
import { OrderSuccessComponent } from './components/order-success/order-success.component';
import { StepSelectionComponent } from './components/step-selection/step-selection.component';
import { ErrorBannerComponent } from './components/error-banner/error-banner.component';
import { ConfirmationDialogComponent } from '@components/confirmation-dialog/confirmation-dialog.component';
import { IssueRequestFacade } from './services/issue-request.facade';

@Component({
  selector: 'app-new-issue-request',
  standalone: true,
  providers: [IssueRequestFacade],
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    StepperComponent,
    UsageFormComponent,
    ReviewFormComponent,
    AllowanceSelectionComponent,
    OrderSuccessComponent,
    ErrorBannerComponent,
    ConfirmationDialogComponent,
    StepSelectionComponent
  ],
  templateUrl: './new-issue-request.component.html',
  styleUrls: ['./new-issue-request.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewIssueRequestComponent implements OnInit, OnDestroy, AfterViewInit {
  constructor(readonly facade: IssueRequestFacade) {}

  ngOnInit(): void { this.facade.init(); }
  ngOnDestroy(): void { this.facade.destroy(); }
  ngAfterViewInit(): void { this.facade.afterViewInit(); }
}
