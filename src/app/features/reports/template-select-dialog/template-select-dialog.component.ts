import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '@components/modal/modal.component';
import { ButtonComponent } from '@components/button/button.component';
import { LucideAngularModule, FileText, Check } from 'lucide-angular';
import { ReportService, ReportTemplate } from '@reports/services/report.service';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-template-select-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ModalComponent,
    ButtonComponent,
    LucideAngularModule,
    TranslateModule
  ],
  templateUrl: './template-select-dialog.component.html',
  styleUrls: ['./template-select-dialog.component.css']
})
export class TemplateSelectDialogComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Output() templateSelected = new EventEmitter<ReportTemplate>();
  @Output() cancelled = new EventEmitter<void>();

  templates: ReportTemplate[] = [];
  selectedTemplate: ReportTemplate | null = null;
  loading = false;
  error: string | null = null;

  readonly FileText = FileText;
  readonly Check = Check;

  constructor(private reportService: ReportService) {}

  ngOnInit(): void {
    if (this.isOpen) {
      this.loadTemplates();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen && this.templates.length === 0) {
      this.loadTemplates();
    }
    if (changes['isOpen'] && !this.isOpen) {
      this.selectedTemplate = null;
      this.error = null;
    }
  }

  loadTemplates(): void {
    this.loading = true;
    this.error = null;

    this.reportService.getTemplates()
      .pipe(
        catchError((err) => {
          console.error('Error loading templates:', err);
          this.error = 'Failed to load templates';
          return of([]);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((templates) => {
        this.templates = templates;
      });
  }

  onSelectTemplate(template: ReportTemplate): void {
    this.selectedTemplate = template;
  }

  onConfirm(): void {
    if (this.selectedTemplate) {
      this.templateSelected.emit(this.selectedTemplate);
      this.selectedTemplate = null;
    }
  }

  onCancel(): void {
    this.cancelled.emit();
    this.selectedTemplate = null;
  }
}
