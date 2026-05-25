import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, PenLine, CircleCheck, RefreshCw, Loader } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { TopazService } from '@services/topaz.service';

type SignatureState = 'detecting' | 'unavailable' | 'noPad' | 'idle' | 'capturing' | 'captured';

@Component({
  selector: 'app-topaz-signature',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule],
  templateUrl: './topaz-signature.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopazSignatureComponent implements OnInit, OnDestroy {
  @Input() disabled = false;
  @Output() signatureChanged = new EventEmitter<File | null>();

  readonly PenLine = PenLine;
  readonly CircleCheck = CircleCheck;
  readonly RefreshCw = RefreshCw;
  readonly Loader = Loader;

  state: SignatureState = 'detecting';
  signaturePreviewUrl: string | null = null;
  hasNoPoints = false;

  private readonly topazService = inject(TopazService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.topazService.readyState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ phase }) => {
        // Do not override active capture or a completed signature preview
        if (this.state === 'capturing' || this.state === 'captured') {
          return;
        }

        switch (phase) {
          case 'checking':
            this.state = 'detecting';
            break;
          case 'sigweb-unavailable':
            this.state = 'unavailable';
            break;
          case 'pad-disconnected':
            this.state = 'noPad';
            break;
          case 'ready':
            this.state = 'idle';
            break;
        }
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    // Ensure pad is released if user navigates away mid-capture
    if (this.state === 'capturing') {
      this.topazService.clearPad();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  startCapture(): void {
    if (this.disabled || this.state !== 'idle') return;
    this.hasNoPoints = false;
    this.topazService.startCapture();
    this.state = 'capturing';
    this.cdr.markForCheck();
  }

  confirmCapture(): void {
    if (this.state !== 'capturing') return;

    if (!this.topazService.hasPoints()) {
      this.hasNoPoints = true;
      this.cdr.markForCheck();
      return;
    }

    this.topazService.captureSignature()
      .pipe(takeUntil(this.destroy$))
      .subscribe(base64 => {
        if (!base64) {
          this.state = 'idle';
          this.signaturePreviewUrl = null;
          this.signatureChanged.emit(null);
        } else {
          this.signaturePreviewUrl = `data:image/png;base64,${base64}`;
          this.state = 'captured';
          this.signatureChanged.emit(this.topazService.base64ToFile(base64));
        }
        this.hasNoPoints = false;
        this.cdr.markForCheck();
      });
  }

  clearSignature(): void {
    if (this.disabled) return;
    this.topazService.clearPad();
    this.signaturePreviewUrl = null;
    this.hasNoPoints = false;
    this.signatureChanged.emit(null);
    this.state = 'idle';
    this.cdr.markForCheck();
  }

  recheckPad(): void {
    this.topazService.refreshPadDetection();
    this.cdr.markForCheck();
  }

  get isDetecting(): boolean { return this.state === 'detecting'; }
  get isUnavailable(): boolean { return this.state === 'unavailable'; }
  get isNoPad(): boolean { return this.state === 'noPad'; }
  get isIdle(): boolean { return this.state === 'idle'; }
  get isCapturing(): boolean { return this.state === 'capturing'; }
  get isCaptured(): boolean { return this.state === 'captured'; }
}
