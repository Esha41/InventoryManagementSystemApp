import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Injector,
  Input,
  OnChanges,
  OnDestroy,
  Renderer2,
  SimpleChanges,
  ViewChild,
  afterNextRender,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, filter, takeUntil } from 'rxjs';
import { TranslationService } from '@services/translation.service';
import { SidebarFlyoutService } from './sidebar-flyout.service';

export interface SidebarFlyoutMenuItem {
  label: string;
  route?: string;
  isHeader?: boolean;
  children?: SidebarFlyoutMenuItem[];
}

const FLYOUT_CLOSE_DELAY_MS = 200;
const FLYOUT_GAP_PX = 2;

@Component({
  selector: 'app-sidebar-collapsed-flyout',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './sidebar-collapsed-flyout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class SidebarCollapsedFlyoutComponent implements OnChanges, OnDestroy {
  @Input() collapsed = false;
  @Input() menuItem!: SidebarFlyoutMenuItem;
  @Input() title = '';
  @Input() submenuExpanded = false;

  @ViewChild('flyoutPanel') flyoutPanel?: ElementRef<HTMLElement>;

  isOpen = false;

  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private scrollListenerAttached = false;
  private attachScheduled = false;
  private readonly destroy$ = new Subject<void>();
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private readonly injector = inject(Injector);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translationService = inject(TranslationService);
  private readonly router = inject(Router);
  private readonly flyoutService = inject(SidebarFlyoutService);

  private readonly reposition = (): void => {
    if (this.isOpen) this.positionFlyout();
  };

  constructor() {
    this.flyoutService.open$
      .pipe(
        filter(source => source !== this),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.close());

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.close());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['collapsed'] && !this.collapsed) {
      this.close();
    }
    if (changes['submenuExpanded'] && this.submenuExpanded && !this.collapsed) {
      this.close();
    }
  }

  ngOnDestroy(): void {
    this.detachScrollListener();
    this.clearCloseTimer();
    // Panel was portaled to document.body — remove it if the component is
    // destroyed while still open (e.g. menu rebuilt mid-hover), else it orphans.
    const panel = this.flyoutPanel?.nativeElement;
    if (panel?.parentElement === document.body) {
      this.renderer.removeChild(document.body, panel);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  hasChildren(item: SidebarFlyoutMenuItem): boolean {
    return !!(item.children && item.children.length > 0);
  }

  @HostListener('mouseenter')
  onHostEnter(): void {
    // Only suppress the flyout when the inline submenu is actually visible —
    // i.e. sidebar expanded AND this submenu open. When collapsed the inline
    // submenu is hidden, so the flyout must still open regardless of saved state.
    if (!this.collapsed && this.submenuExpanded) return;
    this.clearCloseTimer();
    this.flyoutService.open$.next(this);
    this.isOpen = true;
    this.cdr.markForCheck();
    this.scheduleAttach();
  }

  @HostListener('mouseleave')
  onHostLeave(): void {
    this.scheduleClose();
  }

  onFlyoutEnter(): void {
    this.clearCloseTimer();
  }

  onFlyoutLeave(): void {
    this.scheduleClose();
  }

  @HostListener('click', ['$event'])
  onHostClick(event: MouseEvent): void {
    if (!this.collapsed) {
      this.close();
      return;
    }
    const trigger = (event.target as HTMLElement).closest('[data-flyout-trigger]');
    if (!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    if (this.isOpen) {
      this.close();
    } else {
      this.onHostEnter();
    }
  }

  close(): void {
    this.clearCloseTimer();
    this.detachScrollListener();
    this.isOpen = false;
    this.cdr.markForCheck();
  }

  private scheduleAttach(): void {
    if (this.attachScheduled) return;
    this.attachScheduled = true;
    afterNextRender(
      () => {
        this.attachScheduled = false;
        if (!this.isOpen) return;
        this.attachToBodyAndPosition();
      },
      { injector: this.injector }
    );
  }

  private attachToBodyAndPosition(): void {
    const panel = this.flyoutPanel?.nativeElement;
    if (!panel) return;
    if (panel.parentElement !== document.body) {
      this.renderer.appendChild(document.body, panel);
    }
    this.positionFlyout();
    this.attachScrollListener();
  }

  private positionFlyout(): void {
    const panel = this.flyoutPanel?.nativeElement;
    const trigger = this.hostEl.nativeElement.querySelector('[data-flyout-trigger]') as HTMLElement | null;
    if (!panel || !trigger) return;

    // Anchor horizontally to the sidebar's outer edge so the panel sits beside
    // the whole rail (collapsed) or the full sidebar (expanded) — never overlapping it.
    const sidebar = (this.hostEl.nativeElement.closest('aside') as HTMLElement | null) ?? trigger;
    const sidebarRect = sidebar.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();

    const panelHeight = panel.offsetHeight || Math.min(window.innerHeight * 0.7, 384);
    const top = Math.max(0, Math.min(triggerRect.top, window.innerHeight - panelHeight - FLYOUT_GAP_PX));

    panel.style.top = `${top}px`;
    panel.style.bottom = 'auto';
    panel.style.margin = '0';

    if (this.isRTL) {
      panel.style.left = `${sidebarRect.left - FLYOUT_GAP_PX}px`;
      panel.style.right = 'auto';
      panel.style.transform = 'translateX(-100%)';
    } else {
      panel.style.left = `${sidebarRect.right + FLYOUT_GAP_PX}px`;
      panel.style.right = 'auto';
      panel.style.transform = 'none';
    }
  }

  private attachScrollListener(): void {
    if (this.scrollListenerAttached) return;
    document.addEventListener('scroll', this.reposition, true);
    window.addEventListener('resize', this.reposition);
    this.scrollListenerAttached = true;
  }

  private detachScrollListener(): void {
    if (!this.scrollListenerAttached) return;
    document.removeEventListener('scroll', this.reposition, true);
    window.removeEventListener('resize', this.reposition);
    this.scrollListenerAttached = false;
  }

  private scheduleClose(): void {
    this.clearCloseTimer();
    this.closeTimer = setTimeout(() => this.close(), FLYOUT_CLOSE_DELAY_MS);
  }

  private clearCloseTimer(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }
}
