import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { IdleService, IdleState } from '@services/idle.service';

@Component({
  selector: 'app-idle-timeout-modal',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *ngIf="idleState$ | async as state">
      <div
        *ngIf="state.isWarning"
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50"
        role="alertdialog"
        aria-modal="true"
        [attr.aria-labelledby]="'idle-timeout-title'"
        [attr.aria-describedby]="'idle-timeout-msg'"
      >
        <div
          class="bg-[var(--color-background)] rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4 border-2 border-[var(--color-border)]"
        >
          <div class="flex justify-center">
            <div class="relative w-24 h-24">
              <svg class="w-24 h-24 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke="var(--color-border)"
                  stroke-width="6"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  [attr.stroke]="state.secondsRemaining <= 10 ? 'var(--color-error)' : 'var(--color-brand)'"
                  stroke-width="6"
                  fill="none"
                  stroke-linecap="round"
                  [attr.stroke-dasharray]="circumference"
                  [attr.stroke-dashoffset]="getStrokeDashoffset(state.secondsRemaining)"
                  style="transition: stroke-dashoffset 1s linear, stroke 0.3s ease"
                />
              </svg>
              <div class="absolute inset-0 flex items-center justify-center">
                <span
                  class="text-2xl font-bold tabular-nums"
                  [style.color]="state.secondsRemaining <= 10 ? 'var(--color-error)' : 'var(--color-text)'"
                >
                  {{ state.secondsRemaining }}
                </span>
              </div>
            </div>
          </div>

          <div class="text-center space-y-2">
            <h3 id="idle-timeout-title" class="text-lg font-bold text-[var(--color-text)]">
              {{ 'common.idleTimeout.title' | translate }}
            </h3>
            <p id="idle-timeout-msg" class="text-sm text-[var(--color-text-muted)] leading-relaxed">
              {{ 'common.idleTimeout.message' | translate : { seconds: state.secondsRemaining } }}
            </p>
          </div>

          <div class="flex flex-col gap-3">
            <button
              type="button"
              (click)="onStayActive()"
              class="w-full px-4 py-3 rounded-xl bg-[var(--color-brand)] text-white font-semibold
                     hover:bg-[var(--color-brand-dark)] focus:outline-none focus:ring-4 focus:ring-[var(--color-brand)]/20
                     active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-md"
            >
              {{ 'common.idleTimeout.stayActive' | translate }}
            </button>
            <button
              type="button"
              (click)="onSignOut()"
              class="w-full px-4 py-3 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-background-muted)]
                     text-[var(--color-text)] font-semibold hover:bg-[var(--color-background)]
                     focus:outline-none focus:ring-4 focus:ring-[var(--color-brand)]/15
                     active:scale-[0.98] transition-all duration-200"
            >
              {{ 'common.idleTimeout.signOut' | translate }}
            </button>
          </div>
        </div>
      </div>
    </ng-container>
  `
})
export class IdleTimeoutModalComponent implements OnDestroy {
  idleState$: Observable<IdleState>;
  readonly circumference = 2 * Math.PI * 44;

  private readonly destroy$ = new Subject<void>();
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);

  constructor(private idleService: IdleService) {
    this.idleState$ = this.idleService.state$;
    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());
    this.translate.onTranslationChange.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());
    this.translate.onDefaultLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getStrokeDashoffset(secondsRemaining: number): number {
    const total = this.idleService.logoutCountdownTotalSeconds || 60;
    const progress = secondsRemaining / total;
    return this.circumference * (1 - progress);
  }

  onStayActive(): void {
    this.idleService.dismissWarning();
  }

  onSignOut(): void {
    this.idleService.signOutFromIdle();
  }
}
