import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { RequestAutoRejectCountdownDto } from '@models/workflow.model';

@Component({
  selector: 'app-auto-reject-countdown',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './auto-reject-countdown.component.html',
  styleUrl: './auto-reject-countdown.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AutoRejectCountdownComponent {
  @Input() countdown: RequestAutoRejectCountdownDto | null | undefined;

  pillClass(): string {
    const s = this.countdown?.state ?? 'none';
    if (s === 'expired') return 'auto-reject-pill auto-reject-pill--expired';
    if (s === 'warning') return 'auto-reject-pill auto-reject-pill--warning';
    if (s === 'running') return 'auto-reject-pill auto-reject-pill--running';
    return '';
  }
}
