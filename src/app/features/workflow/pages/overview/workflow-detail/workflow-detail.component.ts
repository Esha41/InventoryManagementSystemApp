import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { WorkflowService } from '@workflow/services/workflow.service';
import { BackendWorkflowDto } from '@models/workflow.model';
import { trackById } from '@utils/trackby.utils';

@Component({
  selector: 'app-workflow-detail',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './workflow-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkflowDetailComponent implements OnInit, OnDestroy {
  readonly trackById = trackById;
  workflow: BackendWorkflowDto | null = null;
  loading = false;
  errorMessage: string | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private workflowService: WorkflowService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.router.navigate(['/workflow']);
      return;
    }
    this.fetch(id);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  fetch(id: number): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.workflowService.getWorkflowDetailById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: wf => {
          this.workflow = wf;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.translate
            .get('toast.failedToLoad')
            .pipe(takeUntil(this.destroy$))
            .subscribe(msg => {
              const fallback =
                err instanceof Error ? err.message : typeof err === 'string' ? err : '';
              this.errorMessage = fallback || msg;
              this.cdr.markForCheck();
            });
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  goBack(): void {
    this.router.navigate(['/workflow']);
  }
}

