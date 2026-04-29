import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Package } from 'lucide-angular';
import { RequestItem } from '@models/workflow-approval.model';

@Component({
    selector: 'app-request-items-table',
    standalone: true,
    imports: [CommonModule, TranslateModule, LucideAngularModule],
    template: `
    <div class="mb-6 overflow-x-auto border-2 border-[var(--color-border)] rounded-lg">
      <table class="w-full">
        <thead class="bg-[var(--color-background-muted)]">
          <tr>
            <th class="px-4 py-3 text-start text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              {{ 'supplyRequestManagement.detail.itemName' | translate }}</th>
            <th class="px-4 py-3 text-start text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              {{ 'supplyRequestManagement.detail.itemCode' | translate }}</th>
            <th class="px-4 py-3 text-end text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              {{ 'supplyRequestManagement.detail.quantity' | translate }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--color-border)]">
          <tr *ngFor="let item of items" class="hover:bg-[var(--color-background-hover)] transition-colors">
            <td class="px-4 py-3 text-sm text-[var(--color-text)] font-medium">{{ item.itemName }}</td>
            <td class="px-4 py-3 text-sm text-[var(--color-text-muted)]">{{ item.itemNo || '-' }}</td>
            <td class="px-4 py-3 text-sm text-[var(--color-text)] text-end font-semibold">{{ item.quantity }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div *ngIf="!items || items.length === 0" class="text-center py-12">
      <div class="w-16 h-16 rounded-full bg-[var(--color-background-muted)] flex items-center justify-center mx-auto mb-3">
        <lucide-angular [img]="Package" class="h-8 w-8 text-[var(--color-text-muted)]"></lucide-angular>
      </div>
      <p class="text-sm text-[var(--color-text-muted)]">{{ 'supplyRequestManagement.detail.noItemsFound' | translate }}</p>
    </div>
  `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RequestItemsTableComponent {
    @Input() items: RequestItem[] = [];
    readonly Package = Package;
}
