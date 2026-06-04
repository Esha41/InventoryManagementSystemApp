import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
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
    LookupManagementComponent
  ],
  template: `
    <div class="page-wrapper">
      <div class="page-container space-y-6">
        <app-lookup-management></app-lookup-management>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LookupTablesComponent {
}
