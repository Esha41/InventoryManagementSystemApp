import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { WorkflowService } from '@services/workflow.service';

@Component({
  selector: 'app-workflow-detail',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './workflow-detail.component.html',
  styleUrls: ['./workflow-detail.component.css']
})
export class WorkflowDetailComponent implements OnInit {
  workflow: any;
  loading = false;
  errorMessage: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private workflowService: WorkflowService,
    private translate: TranslateService
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
    this.workflowService.getWorkflowDetailById(id).subscribe({
      next: wf => { this.workflow = wf; this.loading = false; },
      error: err => {
        this.translate.get('toast.failedToLoad').subscribe(msg => {
          this.errorMessage = err.message || msg;
        });
        this.loading = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/workflow']);
  }
}

