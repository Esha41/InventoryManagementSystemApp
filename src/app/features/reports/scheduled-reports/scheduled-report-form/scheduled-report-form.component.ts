import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Save, X, ArrowLeft, ArrowRight, Plus, Trash2, Mail } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { ReportService, Report, CreateScheduledReportDto, CreateScheduledReportRecipientDto, ScheduledReport } from '@reports/services/report.service';
import { BackendUserService } from '@services/backend-user.service';
import { LoadingStateComponent } from '@components/index';
import { ButtonComponent } from '@components/button/button.component';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface RecipientForm {
  userId?: string;
  emailAddress?: string;
  recipientType: 'To' | 'CC' | 'BCC';
}

@Component({
  selector: 'app-scheduled-report-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    ButtonComponent,
    LoadingStateComponent
  ],
  templateUrl: './scheduled-report-form.component.html',
  styleUrls: ['./scheduled-report-form.component.css']
})
export class ScheduledReportFormComponent implements OnInit {
  readonly Save = Save;
  readonly X = X;
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly Plus = Plus;
  readonly Trash2 = Trash2;
  readonly Mail = Mail;

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  isEditMode = false;
  scheduleId: string | null = null;
  loading = false;
  submitting = false;
  errorMessage: string | null = null;

  // Form data
  formData: CreateScheduledReportDto = {
    scheduleName: '',
    reportId: '',
    outputFormat: 'PDF',
    frequency: 'Daily',
    timeOfDay: '08:00',
    dayOfWeek: undefined,
    dayOfMonth: undefined,
    emailSubject: '',
    emailBody: '',
    recipients: []
  };

  // Available options
  reports: Report[] = [];
  users: UserOption[] = [];
  outputFormats = [
    { value: 'PDF', label: 'PDF' },
    { value: 'Excel', label: 'Excel' }
  ];
  frequencies = [
    { value: 'Daily', label: 'scheduledReports.daily' },
    { value: 'Weekly', label: 'scheduledReports.weekly' },
    { value: 'Monthly', label: 'scheduledReports.monthly' }
  ];
  daysOfWeek = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
  ];
  daysOfMonth = Array.from({ length: 31 }, (_, i) => i + 1);
  recipientTypes = [
    { value: 'To', label: 'To' },
    { value: 'CC', label: 'CC' },
    { value: 'BCC', label: 'BCC' }
  ];

  // Recipient form
  recipientForm: RecipientForm = {
    recipientType: 'To'
  };
  showRecipientForm = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private reportService: ReportService,
    private backendUserService: BackendUserService,
    private translationService: TranslationService,
    private translateService: TranslateService
  ) { }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.scheduleId = params['id'];
        this.loadScheduledReport(params['id']);
      }
    });

    this.loadReports();
    this.loadUsers();
  }

  loadReports(): void {
    this.loading = true;
    this.reportService.getPublicReports()
      .pipe(
        catchError((err) => {
          console.error('Error loading reports:', err);
          return of([]);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((reports) => {
        // Filter out deleted reports (extra safety check)
        this.reports = reports.filter(report => !report.isDeleted);
      });
  }

  loadUsers(): void {
    // Fetch users with a large page size to get all users
    this.backendUserService.getUsers({ page: 1, pageSize: 1000 })
      .pipe(
        catchError((err) => {
          console.error('Error loading users:', err);
          return of({ items: [], totalCount: 0, pageIndex: 1, totalPages: 1 });
        })
      )
      .subscribe((response) => {
        this.users = response.items.map(u => ({
          id: u.id,
          name: u.nameEn || u.nameAr || u.userName || u.email || '',
          email: u.email || ''
        }));
      });
  }

  loadScheduledReport(id: string): void {
    this.loading = true;
    this.reportService.getScheduledReportById(id)
      .pipe(
        catchError((err) => {
          console.error('Error loading scheduled report:', err);
          this.errorMessage = this.translateService.instant('common.error');
          return of(null);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((report) => {
        if (report) {
          this.formData = {
            scheduleName: report.scheduleName,
            reportId: report.reportId,
            outputFormat: report.outputFormat,
            frequency: report.frequency,
            timeOfDay: report.timeOfDay,
            dayOfWeek: report.dayOfWeek,
            dayOfMonth: report.dayOfMonth,
            emailSubject: report.emailSubject || '',
            emailBody: report.emailBody || '',
            recipients: report.recipients.map(r => ({
              userId: r.userId,
              emailAddress: r.emailAddress,
              recipientType: r.recipientType as 'To' | 'CC' | 'BCC'
            }))
          };
        }
      });
  }

  onFrequencyChange(): void {
    // Reset day fields when frequency changes
    if (this.formData.frequency === 'Daily') {
      this.formData.dayOfWeek = undefined;
      this.formData.dayOfMonth = undefined;
    } else if (this.formData.frequency === 'Weekly') {
      this.formData.dayOfMonth = undefined;
      if (this.formData.dayOfWeek === undefined) {
        this.formData.dayOfWeek = 1; // Default to Monday
      }
    } else if (this.formData.frequency === 'Monthly') {
      this.formData.dayOfWeek = undefined;
      if (this.formData.dayOfMonth === undefined) {
        this.formData.dayOfMonth = 1; // Default to 1st of month
      }
    }
  }

  addRecipient(): void {
    if (!this.recipientForm.userId) {
      return;
    }

    const recipient: CreateScheduledReportRecipientDto = {
      userId: this.recipientForm.userId,
      recipientType: this.recipientForm.recipientType
    };

    this.formData.recipients.push(recipient);
    this.recipientForm = { recipientType: 'To' };
    this.showRecipientForm = false;
  }

  removeRecipient(index: number): void {
    this.formData.recipients.splice(index, 1);
  }

  getRecipientDisplay(recipient: CreateScheduledReportRecipientDto): string {
    if (recipient.userId) {
      const user = this.users.find(u => u.id === recipient.userId);
      return user ? `${user.name} (${user.email})` : recipient.emailAddress || '';
    }
    return recipient.emailAddress || '';
  }

  onSubmit(): void {
    if (!this.isFormValid()) {
      this.errorMessage = this.translateService.instant('common.error');
      return;
    }

    this.submitting = true;
    this.errorMessage = null;

    if (this.isEditMode && this.scheduleId) {
      this.reportService.updateScheduledReport(this.scheduleId, this.formData)
        .pipe(
          catchError((err: any) => {
            console.error('Error saving scheduled report:', err);
            this.errorMessage = this.translateService.instant('common.error');
            return of(false);
          }),
          finalize(() => {
            this.submitting = false;
          })
        )
        .subscribe((success: boolean) => {
          if (success) {
            this.router.navigate(['/reports/scheduled-reports']);
          }
        });
    } else {
      this.reportService.createScheduledReport(this.formData)
        .pipe(
          catchError((err: any) => {
            console.error('Error saving scheduled report:', err);
            this.errorMessage = this.translateService.instant('common.error');
            return of('');
          }),
          finalize(() => {
            this.submitting = false;
          })
        )
        .subscribe((id: string) => {
          if (id) {
            this.router.navigate(['/reports/scheduled-reports']);
          }
        });
    }
  }

  isFormValid(): boolean {
    return !!(
      this.formData.scheduleName &&
      this.formData.reportId &&
      this.formData.timeOfDay &&
      (this.formData.frequency !== 'Weekly' || this.formData.dayOfWeek !== undefined) &&
      (this.formData.frequency !== 'Monthly' || this.formData.dayOfMonth !== undefined) &&
      this.formData.recipients.length > 0
    );
  }

  onCancel(): void {
    this.router.navigate(['/reports/scheduled-reports']);
  }

  clearError(): void {
    this.errorMessage = null;
  }
}
