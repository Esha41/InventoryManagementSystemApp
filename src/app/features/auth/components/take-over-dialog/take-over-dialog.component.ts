import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-take-over-dialog',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './take-over-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TakeOverDialogComponent {
  @Input({ required: true }) existingSessionUser!: string;
  @Input({ required: true }) requestingUser!: string;

  @Output() readonly confirm = new EventEmitter<void>();
  @Output() readonly cancel = new EventEmitter<void>();
}
