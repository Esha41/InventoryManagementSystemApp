import { Directive, ElementRef, AfterViewInit } from '@angular/core';

/** Focuses the element when it is first rendered (e.g. after *ngIf becomes true) */
@Directive({
  selector: '[appFocusOnInit]',
  standalone: true
})
export class FocusOnInitDirective implements AfterViewInit {
  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    setTimeout(() => {
      const el = this.el.nativeElement;
      if (el && typeof el.focus === 'function') {
        el.focus();
      }
    }, 0);
  }
}
