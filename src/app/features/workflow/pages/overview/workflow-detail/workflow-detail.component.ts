import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { WorkflowService } from '@services/workflow.service';
import { BackendWorkflowDto } from '@models/workflow.model';

@Component({
  selector: 'app-workflow-detail',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './workflow-detail.component.html',
  styleUrls: ['./workflow-detail.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkflowDetailComponent implements OnInit {
  workflow: BackendWorkflowDto | null = null;
  loading = false;
  errorMessage: string | null = null;

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

  fetch(id: number): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.workflowService.getWorkflowDetailById(id).subscribe({
      next: wf => { this.workflow = wf; this.loading = false; this.cdr.markForCheck(); },
      error: err => {
        this.translate.get('toast.failedToLoad').subscribe(msg => {
          this.errorMessage = err.message || msg;
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

