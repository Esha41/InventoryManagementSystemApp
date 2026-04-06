import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ModalComponent } from '@components/modal/modal.component';
import { ButtonComponent } from '@components/button/button.component';
import { LucideAngularModule, Loader2, Save } from 'lucide-angular';
import { EditBatchFormComponent } from './edit-batch-form.component';

@Component({
  selector: 'app-edit-batch-modal',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModalComponent,
    ButtonComponent,
    LucideAngularModule,
    EditBatchFormComponent
  ],
  templateUrl: './edit-batch-modal.component.html'
})
export class EditBatchModalComponent {
  @Input() isOpen = false;
  @Input() batchId = 0;
  @Input() warehouseId = 0;
  @Input() batchNumber = '';

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  @ViewChild(EditBatchFormComponent) form?: EditBatchFormComponent;

  readonly Loader2 = Loader2;
  readonly Save = Save;

  constructor(private translateService: TranslateService) { }

  get modalTitle(): string {
    const base = this.translateService.instant('editBatch.title');
    return this.batchNumber ? `${base} — ${this.batchNumber}` : base;
  }

  close(): void {
    this.closed.emit();
  }

  onFormSaved(): void {
    this.saved.emit();
    this.close();
  }

  onFormCancelled(): void {
    this.close();
  }

  saveFromFooter(): void {
    this.form?.onSaveAll();
  }

  get saving(): boolean {
    return this.form?.saving ?? false;
  }
}
