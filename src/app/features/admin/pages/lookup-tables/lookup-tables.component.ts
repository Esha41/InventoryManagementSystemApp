import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LookupManagementComponent } from './components/lookup-management/lookup-management.component';

/**
 * Lookup Tables Page Component
 * Standalone page for managing lookup tables
 */
@Component({
  selector: 'app-lookup-tables',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LookupManagementComponent
  ],
  template: `
    <div class="page-wrapper">
      <div class="page-container space-y-6">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">
              {{ 'lookupManagement.title' | translate }}
            </h1>
            <p class="text-sm text-[var(--color-text-muted)] mt-1">
              {{ 'lookupManagement.subtitle' | translate }}
            </p>
          </div>
        </div>

        <!-- Lookup Management Content -->
        <app-lookup-management></app-lookup-management>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LookupTablesComponent {
}
