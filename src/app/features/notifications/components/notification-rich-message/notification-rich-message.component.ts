import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationMessagePart } from '@notifications/utils/notification-workflow-navigation.utils';

@Component({
  selector: 'app-notification-rich-message',
  standalone: true,
  imports: [TranslateModule],
  template: `
    @for (part of parts(); track trackPart($index, part)) {
      @if (part.kind === 'link') {
        <button
          type="button"
          class="notif-rich-msg__link"
          [attr.title]="'notifications.openWorkflowApproval' | translate"
          (click)="onLinkClick($event)"
        >
          {{ part.value }}
        </button>
      } @else {
        {{ part.value }}
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }

    .notif-rich-msg__link {
      margin: 0;
      padding: 0;
      border: none;
      background: none;
      font: inherit;
      /* Classic default hyperlink blue (not project theme) */
      color: #0000ee;
      cursor: pointer;
      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-underline-offset: 2px;
      border-radius: 2px;
      transition: color 0.15s ease;
    }

    .notif-rich-msg__link:hover {
      color: #0000cc;
    }

    .notif-rich-msg__link:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px var(--color-background), 0 0 0 4px rgba(0, 0, 238, 0.35);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationRichMessageComponent {
  readonly parts = input.required<NotificationMessagePart[]>();
  readonly linkClick = output<Event>();

  onLinkClick(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.linkClick.emit(event);
  }

  trackPart(index: number, part: NotificationMessagePart): string {
    return `${index}:${part.kind}:${part.value}`;
  }
}
